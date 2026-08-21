import {
  hotelAssignmentListResponseSchema,
  hotelErrorResponseSchema,
  hotelRoutes,
  operationalIssueCapabilitiesResponseSchema,
  operationalIssueInternalResponseSchema,
  operationalIssueListResponseSchema,
  operationalIssueOwnerResponseSchema,
  operationalIssueRoutes,
} from "@werehere/contracts";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchApi } from "./api-transport";

async function request(path: string) {
  const headers = new Headers();
  const cookieHeader = (await cookies()).toString();
  if (cookieHeader) headers.set("cookie", cookieHeader);
  try {
    return await fetchApi(path, { cache: "no-store", headers });
  } catch {
    return new Response(null, { status: 503 });
  }
}

function parseDetail(value: unknown) {
  const internal = operationalIssueInternalResponseSchema.safeParse(value);
  if (internal.success) return internal.data.data.issue;
  const owner = operationalIssueOwnerResponseSchema.safeParse(value);
  return owner.success ? owner.data.data.issue : null;
}

export async function fetchOperationalIssueCapabilities() {
  const response = await request(operationalIssueRoutes.capabilities);
  if (response.status === 401) redirect("/login");
  if (!response.ok) return [];
  const parsed = operationalIssueCapabilitiesResponseSchema.safeParse(
    await response.json().catch(() => undefined),
  );
  return parsed.success ? parsed.data.data.hotels : [];
}

export async function fetchOperationalIssues(
  hotelId: string,
  selectedIssueId?: string,
) {
  const [listResponse, assignmentResponse, capabilities] = await Promise.all([
    request(`${operationalIssueRoutes.list(hotelId)}?page=1&pageSize=100`),
    request(hotelRoutes.assignments(hotelId)),
    fetchOperationalIssueCapabilities(),
  ]);
  if (listResponse.status === 401 || assignmentResponse.status === 401)
    redirect("/login");
  if (!listResponse.ok) {
    const error = hotelErrorResponseSchema.safeParse(
      await listResponse.json().catch(() => undefined),
    );
    return {
      ok: false as const,
      code: error.success ? error.data.error.code : "INTERNAL_ERROR",
      error: error.success
        ? error.data.error.message
        : "운영이슈 목록을 불러오지 못했습니다.",
    };
  }
  const list = operationalIssueListResponseSchema.safeParse(
    await listResponse.json().catch(() => undefined),
  );
  if (!list.success)
    return {
      ok: false as const,
      code: "INTERNAL_ERROR" as const,
      error: "운영이슈 목록 응답을 안전하게 확인하지 못했습니다.",
    };

  const assignments = assignmentResponse.ok
    ? hotelAssignmentListResponseSchema.safeParse(
        await assignmentResponse.json().catch(() => undefined),
      )
    : null;
  const today = new Date().toISOString().slice(0, 10);
  const activeAssignments = assignments?.success
    ? assignments.data.data.assignments.filter(
        (assignment) =>
          assignment.terminatedAt === null &&
          (assignment.endDate === null || assignment.endDate >= today) &&
          ["INTERNAL_STAFF", "HOUSEKEEPING"].includes(
            assignment.assignee.userType,
          ),
      )
    : [];

  const issues = list.data.data.issues;
  const issueToSelectId = selectedIssueId ?? issues[0]?.id;
  let selectedIssue = null;
  if (issueToSelectId) {
    const detailResponse = await request(
      operationalIssueRoutes.detail(hotelId, issueToSelectId),
    );
    if (!detailResponse.ok) {
      const error = hotelErrorResponseSchema.safeParse(
        await detailResponse.json().catch(() => undefined),
      );
      return {
        ok: false as const,
        code:
          detailResponse.status === 404
            ? ("RESOURCE_NOT_FOUND" as const)
            : error.success
              ? error.data.error.code
              : "INTERNAL_ERROR",
        error: error.success
          ? error.data.error.message
          : "운영이슈 상세를 불러오지 못했습니다.",
      };
    }
    selectedIssue = parseDetail(
      await detailResponse.json().catch(() => undefined),
    );
    if (!selectedIssue)
      return {
        ok: false as const,
        code: "INTERNAL_ERROR" as const,
        error: "운영이슈 상세 응답을 안전하게 확인하지 못했습니다.",
      };
  }

  return {
    ok: true as const,
    assignments: activeAssignments,
    capability:
      capabilities.find((capability) => capability.hotelId === hotelId) ?? null,
    issues,
    selectedIssue,
  };
}
