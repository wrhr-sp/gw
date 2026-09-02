import {
  hotelErrorResponseSchema,
  inspectionChecklistV2ResponseSchema,
  inspectionExecutionV2ListResponseSchema,
  inspectionExecutionV2ResponseSchema,
  inspectionReviewListResponseSchema,
  inspectionReviewResponseSchema,
  inspectionRoutineV2ListResponseSchema,
  inspectionRoutes,
  processDefinitionListResponseSchema,
  processDefaultResponseSchema,
  processReviewerCandidatesResponseSchema,
  processRoutes,
} from "@werehere/contracts";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchApi } from "./api-transport";

async function request(path: string) {
  const cookieHeader = (await cookies()).toString();
  const headers = new Headers();
  if (cookieHeader) headers.set("cookie", cookieHeader);
  try {
    return await fetchApi(path, { cache: "no-store", headers });
  } catch {
    return new Response(null, { status: 503 });
  }
}

async function structuredFailure(response: Response, fallback: string) {
  const parsed = hotelErrorResponseSchema.safeParse(await response.json().catch(() => undefined));
  if (!parsed.success)
    return { code: "INVALID_ERROR_RESPONSE", error: fallback, message: fallback, retryable: true };
  const { code, message, retryable } = parsed.data.error;
  const hasUnsafeControlCharacter = [...message].some((character) => {
    const code = character.charCodeAt(0);
    return (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127;
  });
  if (message.length > 500 || hasUnsafeControlCharacter)
    return { code: "INVALID_ERROR_RESPONSE", error: fallback, message: fallback, retryable: true };
  return { code, error: code === "RESOURCE_NOT_FOUND" ? code : message, message, retryable };
}

export async function fetchInspectionExecutions(hotelId: string) {
  const firstResponse = await request(
    `${inspectionRoutes.listV2(hotelId)}?page=1&pageSize=100&status=PENDING_INPUT`,
  );
  if (firstResponse.status === 401) redirect("/login");
  if (!firstResponse.ok) {
    const parsed = hotelErrorResponseSchema.safeParse(
      await firstResponse.json().catch(() => undefined),
    );
    return {
      ok: false as const,
      error: parsed.success
        ? parsed.data.error.message
        : "점검 수행 목록을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
  const first = inspectionExecutionV2ListResponseSchema.safeParse(
    await firstResponse.json().catch(() => undefined),
  );
  if (!first.success || first.data.data.pagination.totalPages > 100)
    return {
      ok: false as const,
      error:
        "점검 수행 목록을 안전하게 불러오지 못했습니다. 관리자에게 문의해 주세요.",
    };

  const inspections = [...first.data.data.inspections];
  for (let page = 2; page <= first.data.data.pagination.totalPages; page += 1) {
    const pageResponse = await request(
      `${inspectionRoutes.listV2(hotelId)}?page=${page}&pageSize=100&status=PENDING_INPUT`,
    );
    if (pageResponse.status === 401) redirect("/login");
    if (!pageResponse.ok)
      return {
        ok: false as const,
        error:
          "점검 수행 목록을 모두 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      };
    const parsedPage = inspectionExecutionV2ListResponseSchema.safeParse(
      await pageResponse.json().catch(() => undefined),
    );
    if (
      !parsedPage.success ||
      parsedPage.data.data.pagination.page !== page ||
      parsedPage.data.data.pagination.totalPages !==
        first.data.data.pagination.totalPages
    )
      return {
        ok: false as const,
        error: "점검 수행 목록이 변경되었습니다. 페이지를 새로고침해 주세요.",
      };
    inspections.push(...parsedPage.data.data.inspections);
  }

  const selectedSummary = inspections[0];
  if (!selectedSummary)
    return {
      ok: true as const,
      inspections,
      pagination: first.data.data.pagination,
      selectedInspection: null,
    };
  const detailResponse = await request(
    inspectionRoutes.detailV2(hotelId, selectedSummary.id),
  );
  if (detailResponse.status === 401) redirect("/login");
  if (detailResponse.ok) {
    const detail = inspectionExecutionV2ResponseSchema.safeParse(
      await detailResponse.json().catch(() => undefined),
    );
    if (detail.success)
      return {
        ok: true as const,
        inspections,
        pagination: first.data.data.pagination,
        selectedInspection: detail.data.data.inspection,
      };
  }
  return {
    ok: false as const,
    error: "점검 수행 상세를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.",
  };
}

export async function fetchInspectionReviews(hotelId: string) {
  const listResponse = await request(
    `${inspectionRoutes.reviews(hotelId)}?page=1&pageSize=20`,
  );
  if (listResponse.status === 401) redirect("/login");
  if (!listResponse.ok)
    return {
      ok: false as const,
      ...(await structuredFailure(
        listResponse,
        "검토 대기 목록을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.",
      )),
    };
  const list = inspectionReviewListResponseSchema.safeParse(
    await listResponse.json().catch(() => undefined),
  );
  if (!list.success)
    return {
      ok: false as const,
      error:
        "검토 대기 목록을 안전하게 불러오지 못했습니다. 관리자에게 문의해 주세요.",
    };
  const reviews = list.data.data.reviews;
  const selected = reviews[0];
  if (!selected)
    return {
      ok: true as const,
      pagination: list.data.data.pagination,
      reviews,
      selectedReview: null,
    };
  const detailResponse = await request(
    inspectionRoutes.review(hotelId, selected.id),
  );
  if (detailResponse.status === 401) redirect("/login");
  if (!detailResponse.ok)
    return {
      ok: false as const,
      ...(await structuredFailure(
        detailResponse,
        "검토 상세를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.",
      )),
    };
  const detail = inspectionReviewResponseSchema.safeParse(
    await detailResponse.json().catch(() => undefined),
  );
  if (!detail.success)
    return {
      ok: false as const,
      code: "INVALID_RESPONSE",
      error: "검토 상세를 안전하게 불러오지 못했습니다.",
      message: "검토 상세를 안전하게 불러오지 못했습니다.",
      retryable: true,
    };
  return {
    ok: true as const,
    pagination: list.data.data.pagination,
    reviews,
    selectedReview: detail.data.data.review,
  };
}

export async function fetchInspectionConfiguration(hotelId: string) {
  const responses = await Promise.all([
    request(inspectionRoutes.checklistV2(hotelId)),
    request(
      `${processRoutes.definitions}?hotelId=${encodeURIComponent(hotelId)}`,
    ),
    request(processRoutes.hotelDefault(hotelId)),
    request(processRoutes.reviewerCandidates(hotelId)),
    request(inspectionRoutes.routinesV2(hotelId)),
  ]);
  const [
    checklistResponse,
    definitionsResponse,
    defaultResponse,
    candidatesResponse,
    routinesResponse,
  ] = responses;
  if (responses.some((response) => response.status === 401)) redirect("/login");

  const failedResponse = [
    { response: checklistResponse, stage: "CHECKLIST" as const },
    { response: definitionsResponse, stage: "DEFINITIONS" as const },
    { response: defaultResponse, stage: "DEFAULT" as const },
    { response: candidatesResponse, stage: "CANDIDATES" as const },
    { response: routinesResponse, stage: "ROUTINES" as const },
  ].find(({ response }) => !response.ok);
  if (failedResponse)
    return {
      ok: false as const,
      ...(await structuredFailure(
        failedResponse.response,
        "점검 설정을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.",
      )),
      stage: failedResponse.stage,
      status: failedResponse.response.status,
    };

  const checklist = inspectionChecklistV2ResponseSchema.safeParse(
    await checklistResponse.json().catch(() => undefined),
  );
  const definitions = processDefinitionListResponseSchema.safeParse(
    await definitionsResponse.json().catch(() => undefined),
  );
  const currentDefault = processDefaultResponseSchema.safeParse(
    await defaultResponse.json().catch(() => undefined),
  );
  const reviewerCandidates = processReviewerCandidatesResponseSchema.safeParse(
    await candidatesResponse.json().catch(() => undefined),
  );
  const routines = inspectionRoutineV2ListResponseSchema.safeParse(
    await routinesResponse.json().catch(() => undefined),
  );
  if (
    checklist.success &&
    definitions.success &&
    currentDefault.success &&
    reviewerCandidates.success &&
    routines.success
  )
    return {
      ok: true as const,
      checklist: checklist.data.data.checklist,
      definitions: definitions.data.data.definitions,
      currentDefault: currentDefault.data.data.default,
      reviewerCandidates: reviewerCandidates.data.data.candidates,
      routines: routines.data.data.routines,
    };
  return {
    code: "INVALID_RESPONSE" as const,
    error: "점검 설정 응답이 올바르지 않습니다.",
    message: "점검 설정 응답이 올바르지 않습니다.",
    ok: false as const,
    retryable: true,
    stage: "RESPONSE_SCHEMA" as const,
    status: 502,
  };
}
