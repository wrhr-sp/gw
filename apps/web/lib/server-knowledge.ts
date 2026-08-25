import {
  hotelErrorResponseSchema,
  knowledgeCapabilitiesResponseSchema,
  knowledgeEntryResponseSchema,
  knowledgeListResponseSchema,
  knowledgeReviewerCandidatesResponseSchema,
  knowledgeRoutes,
  type KnowledgeListQuery,
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

export async function fetchKnowledgeWorkspace(
  query: Partial<KnowledgeListQuery>,
  selectedKnowledgeId?: string,
) {
  const parameters = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 20),
  });
  if (query.search) parameters.set("search", query.search);
  if (query.scopeType) parameters.set("scopeType", query.scopeType);
  if (query.hotelId) parameters.set("hotelId", query.hotelId);
  if (query.knowledgeType) parameters.set("knowledgeType", query.knowledgeType);
  if (query.status) parameters.set("status", query.status);
  if (query.reviewedBefore)
    parameters.set("reviewedBefore", query.reviewedBefore);

  const [capabilitiesResponse, listResponse, reviewerCandidatesResponse] =
    await Promise.all([
      request(knowledgeRoutes.capabilities),
      request(`${knowledgeRoutes.list}?${parameters.toString()}`),
      request(`${knowledgeRoutes.reviewerCandidates}?scopeType=COMPANY`),
    ]);
  if (
    capabilitiesResponse.status === 401 ||
    listResponse.status === 401 ||
    reviewerCandidatesResponse.status === 401
  )
    redirect("/login");
  if (
    !capabilitiesResponse.ok ||
    !listResponse.ok ||
    !reviewerCandidatesResponse.ok
  ) {
    const response = !listResponse.ok
      ? listResponse
      : !capabilitiesResponse.ok
        ? capabilitiesResponse
        : reviewerCandidatesResponse;
    const parsed = hotelErrorResponseSchema.safeParse(
      await response.json().catch(() => undefined),
    );
    return {
      ok: false as const,
      code: parsed.success ? parsed.data.error.code : "INTERNAL_ERROR",
      error: parsed.success
        ? parsed.data.error.message
        : "지식뱅크를 불러오지 못했습니다.",
    };
  }
  const capabilities = knowledgeCapabilitiesResponseSchema.safeParse(
    await capabilitiesResponse.json().catch(() => undefined),
  );
  const list = knowledgeListResponseSchema.safeParse(
    await listResponse.json().catch(() => undefined),
  );
  const reviewerCandidates = knowledgeReviewerCandidatesResponseSchema.safeParse(
    await reviewerCandidatesResponse.json().catch(() => undefined),
  );
  if (!capabilities.success || !list.success || !reviewerCandidates.success)
    return {
      ok: false as const,
      code: "INTERNAL_ERROR" as const,
      error: "지식뱅크 응답을 안전하게 확인하지 못했습니다.",
    };

  const id = selectedKnowledgeId ?? list.data.data.entries[0]?.id;
  let selected = null;
  if (id) {
    const detailResponse = await request(knowledgeRoutes.detail(id));
    if (!detailResponse.ok) {
      const parsed = hotelErrorResponseSchema.safeParse(
        await detailResponse.json().catch(() => undefined),
      );
      return {
        ok: false as const,
        code:
          detailResponse.status === 404
            ? ("RESOURCE_NOT_FOUND" as const)
            : parsed.success
              ? parsed.data.error.code
              : "INTERNAL_ERROR",
        error: parsed.success
          ? parsed.data.error.message
          : "지식 상세를 불러오지 못했습니다.",
      };
    }
    const detail = knowledgeEntryResponseSchema.safeParse(
      await detailResponse.json().catch(() => undefined),
    );
    if (!detail.success)
      return {
        ok: false as const,
        code: "INTERNAL_ERROR" as const,
        error: "지식 상세 응답을 안전하게 확인하지 못했습니다.",
      };
    selected = detail.data.data.entry;
  }

  return {
    ok: true as const,
    capabilities: capabilities.data.data,
    entries: list.data.data.entries,
    reviewerCandidates: reviewerCandidates.data.data.candidates,
    page: list.data.data.page,
    pageSize: list.data.data.pageSize,
    selected,
    totalCount: list.data.data.totalCount,
  };
}
