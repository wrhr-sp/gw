import {
  operationalIssueInternalResponseSchema,
  operationalIssueListResponseSchema,
} from "@werehere/contracts";
import { createPostgresOperationalIssueRepository } from "@werehere/db";
import { createApp } from "../src/app";
import type { AuthService } from "../src/auth/service";
import { createOperationalIssueService } from "../src/issues/service";

const companyId = "10000000-0000-0000-0000-000000000001";
const hotelId = "50000000-0000-4000-8000-000000000001";
const sessionId = "4f000000-0000-4000-8000-000000000001";
const userId = "2f000000-0000-4000-8000-000000000001";
const issueId = "d9500000-0000-4000-8000-000000000001";
const token = "I".repeat(43);

async function request(
  app: ReturnType<typeof createApp>,
  path: string,
  method = "GET",
  body?: unknown,
  idempotencyKey?: string,
) {
  const headers: Record<string, string> = {
    cookie: `__Host-hotel_session=${token}`,
  };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
  return app.request(path, {
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers,
    method,
  });
}

async function expectStatus(response: Response, status: number, label: string) {
  if (response.status === status) return;
  const value = (await response.json().catch(() => null)) as {
    error?: { code?: string } | null;
  } | null;
  throw new Error(
    `${label}: expected ${status}, received ${response.status} ${value?.error?.code ?? "UNKNOWN"}`,
  );
}

const databaseUrl = process.env.TEST_READY_URL;
if (!databaseUrl) throw new Error("operational issue actual API URL is missing");

const principal = {
  companyId,
  displayName: "운영이슈 API 통합검증자",
  identityId: "3f000000-0000-4000-8000-000000000001",
  sessionId,
  userId,
  userType: "INTERNAL_STAFF" as const,
};
const authService = {
  resolvePrincipal: async () => principal,
} as unknown as AuthService;
const service = createOperationalIssueService(
  createPostgresOperationalIssueRepository(databaseUrl),
);
const app = createApp({ authService, operationalIssueService: service });

try {
  const createPath = `/api/hotels/${hotelId}/issues`;
  const createBody = {
    description: "실제 Hono API를 통한 운영이슈 저장·재조회 검증입니다.",
    issueId,
    roomId: null,
    severity: "MAJOR",
    title: "운영이슈 실제 API 검증",
  };
  const createdResponse = await request(
    app,
    createPath,
    "POST",
    createBody,
    "issue-actual-create-1",
  );
  await expectStatus(createdResponse, 201, "issue create");
  const created = operationalIssueInternalResponseSchema.parse(
    await createdResponse.json(),
  ).data.issue;
  if (created.id !== issueId || created.status !== "RECEIVED")
    throw new Error("created issue snapshot mismatch");

  const replayResponse = await request(
    app,
    createPath,
    "POST",
    createBody,
    "issue-actual-create-1",
  );
  await expectStatus(replayResponse, 201, "issue replay");
  const replay = operationalIssueInternalResponseSchema.parse(
    await replayResponse.json(),
  ).data.issue;
  if (replay.id !== issueId || replay.version !== created.version)
    throw new Error("idempotent issue replay mismatch");

  const listResponse = await request(
    app,
    `${createPath}?page=1&pageSize=100&severity=MAJOR`,
  );
  await expectStatus(listResponse, 200, "issue list");
  const list = operationalIssueListResponseSchema.parse(
    await listResponse.json(),
  ).data;
  if (!list.issues.some((issue) => issue.id === issueId))
    throw new Error("created issue missing from canonical list");

  const detailPath = `${createPath}/${issueId}`;
  const detailResponse = await request(app, detailPath);
  await expectStatus(detailResponse, 200, "issue detail");
  const detail = operationalIssueInternalResponseSchema.parse(
    await detailResponse.json(),
  ).data.issue;

  const assignResponse = await request(
    app,
    `${detailPath}/assign`,
    "POST",
    { assigneeUserId: userId, reason: "실제 API 담당 지정", version: detail.version },
    "issue-actual-assign-1",
  );
  await expectStatus(assignResponse, 200, "issue assign");
  const assigned = operationalIssueInternalResponseSchema.parse(
    await assignResponse.json(),
  ).data.issue;
  if (assigned.status !== "ASSIGNED" || assigned.assignee?.userId !== userId)
    throw new Error("issue assignee read-back mismatch");

  const staleResponse = await request(
    app,
    `${detailPath}/transitions`,
    "POST",
    { action: "START", reason: "낡은 화면 동시 요청", version: detail.version },
    "issue-actual-stale-1",
  );
  await expectStatus(staleResponse, 409, "stale issue version");

  const startResponse = await request(
    app,
    `${detailPath}/transitions`,
    "POST",
    { action: "START", reason: "실제 API 현장 확인 시작", version: assigned.version },
    "issue-actual-start-1",
  );
  await expectStatus(startResponse, 200, "issue start");
  const started = operationalIssueInternalResponseSchema.parse(
    await startResponse.json(),
  ).data.issue;

  const logResponse = await request(
    app,
    `${detailPath}/work-logs`,
    "POST",
    { body: "실제 API를 통해 현장 작업기록을 저장했습니다.", version: started.version },
    "issue-actual-log-1",
  );
  await expectStatus(logResponse, 200, "issue work log");
  const logged = operationalIssueInternalResponseSchema.parse(
    await logResponse.json(),
  ).data.issue;
  if (!logged.workLogs.some((entry) => entry.body.includes("현장 작업기록")))
    throw new Error("issue work log read-back mismatch");

  const completeResponse = await request(
    app,
    `${detailPath}/transitions`,
    "POST",
    {
      action: "COMPLETE_ACTION",
      reason: "실제 API 현장 조치 완료",
      version: logged.version,
    },
    "issue-actual-complete-1",
  );
  await expectStatus(completeResponse, 200, "issue action completion");
  const completed = operationalIssueInternalResponseSchema.parse(
    await completeResponse.json(),
  ).data.issue;
  if (completed.status !== "ACTION_COMPLETED")
    throw new Error("issue action completion read-back mismatch");

  console.log("HOTEL_OPERATIONAL_ISSUES_ACTUAL_API_OK");
} finally {
  await service.close?.();
}
