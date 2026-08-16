import {
  hotelAssignmentListResponseSchema,
  hotelErrorResponseSchema,
  hotelInquiryCapabilitiesResponseSchema,
  hotelInquiryContactResponseSchema,
  hotelInquiryInternalResponseSchema,
  hotelInquiryListResponseSchema,
  hotelInquiryOwnerResponseSchema,
  hotelInquiryRoutes,
  hotelInquirySettingsResponseSchema,
  hotelRoutes,
} from "@werehere/contracts";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchApi } from "./api-transport";

async function request(path: string) {
  const headers = new Headers();
  const cookie = (await cookies()).toString();
  if (cookie) headers.set("cookie", cookie);
  try {
    return await fetchApi(path, { cache: "no-store", headers });
  } catch {
    return new Response(null, { status: 503 });
  }
}

function detail(value: unknown) {
  const internal = hotelInquiryInternalResponseSchema.safeParse(value);
  if (internal.success) return internal.data.data.inquiry;
  const owner = hotelInquiryOwnerResponseSchema.safeParse(value);
  return owner.success ? owner.data.data.inquiry : null;
}

export async function fetchInquiryCapabilities() {
  const response = await request(hotelInquiryRoutes.capabilities);
  if (response.status === 401) redirect("/login");
  if (!response.ok) return [];
  const parsed = hotelInquiryCapabilitiesResponseSchema.safeParse(
    await response.json().catch(() => undefined),
  );
  return parsed.success ? parsed.data.data.hotels : [];
}

export async function fetchInquiries(hotelId: string) {
  const [listResponse, contactResponse, assignmentResponse, capResponse] =
    await Promise.all([
      request(`${hotelInquiryRoutes.list(hotelId)}?page=1&pageSize=100`),
      request(hotelInquiryRoutes.contact(hotelId)),
      request(hotelRoutes.assignments(hotelId)),
      request(hotelInquiryRoutes.capabilities),
    ]);
  if (
    [listResponse, contactResponse, assignmentResponse, capResponse].some(
      (response) => response.status === 401,
    )
  )
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
        : "문의 목록을 불러오지 못했습니다.",
    };
  }
  const list = hotelInquiryListResponseSchema.safeParse(
    await listResponse.json().catch(() => undefined),
  );
  const contact = hotelInquiryContactResponseSchema.safeParse(
    await contactResponse.json().catch(() => undefined),
  );
  const caps = hotelInquiryCapabilitiesResponseSchema.safeParse(
    await capResponse.json().catch(() => undefined),
  );
  const assignments = hotelAssignmentListResponseSchema.safeParse(
    await assignmentResponse.json().catch(() => undefined),
  );
  if (!list.success || !caps.success)
    return {
      ok: false as const,
      code: "INTERNAL_ERROR" as const,
      error: "문의 응답을 안전하게 확인하지 못했습니다.",
    };
  const capability =
    caps.data.data.hotels.find((value) => value.hotelId === hotelId) ?? null;
  let settings = null;
  if (capability?.canManageSettings) {
    const response = await request(hotelInquiryRoutes.settings(hotelId));
    if (response.status === 401) redirect("/login");
    const parsed = hotelInquirySettingsResponseSchema.safeParse(
      await response.json().catch(() => undefined),
    );
    if (!response.ok || !parsed.success)
      return {
        ok: false as const,
        code: "INTERNAL_ERROR" as const,
        error: "문의 설정을 안전하게 확인하지 못했습니다.",
      };
    settings = parsed.data.data;
  }
  let selected = null;
  if (list.data.data.inquiries[0]) {
    const response = await request(
      hotelInquiryRoutes.detail(hotelId, list.data.data.inquiries[0].id),
    );
    if (!response.ok)
      return {
        ok: false as const,
        code: "INTERNAL_ERROR" as const,
        error: "문의 상세를 불러오지 못했습니다.",
      };
    selected = detail(await response.json().catch(() => undefined));
    if (!selected)
      return {
        ok: false as const,
        code: "INTERNAL_ERROR" as const,
        error: "문의 상세 응답을 확인하지 못했습니다.",
      };
  }
  const today = new Date().toISOString().slice(0, 10);
  return {
    ok: true as const,
    inquiries: list.data.data.inquiries,
    notifications: list.data.data.notifications,
    selected,
    contact: contact.success
      ? contact.data.data.contact
      : (settings?.contact ?? null),
    capability,
    settings,
    assignments: assignments.success
      ? assignments.data.data.assignments.filter(
          (assignment) =>
            assignment.assignee.userType === "INTERNAL_STAFF" &&
            !assignment.terminatedAt &&
            assignment.startDate <= today &&
            (!assignment.endDate || assignment.endDate >= today),
        )
      : [],
  };
}
