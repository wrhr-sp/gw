import {
  hotelErrorResponseSchema,
  inspectionChecklistResponseSchema,
  inspectionRoutes,
  processDefinitionListResponseSchema,
  processDefaultResponseSchema,
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

export async function fetchInspectionConfiguration(hotelId: string) {
  const [checklistResponse, definitionsResponse, defaultResponse] =
    await Promise.all([
      request(inspectionRoutes.checklist(hotelId)),
      request(
        `${processRoutes.definitions}?hotelId=${encodeURIComponent(hotelId)}`,
      ),
      request(processRoutes.hotelDefault(hotelId)),
    ]);
  if (
    checklistResponse.status === 401 ||
    definitionsResponse.status === 401 ||
    defaultResponse.status === 401
  )
    redirect("/login");
  if (checklistResponse.ok && definitionsResponse.ok && defaultResponse.ok) {
    const checklist = inspectionChecklistResponseSchema.safeParse(
      await checklistResponse.json().catch(() => undefined),
    );
    const definitions = processDefinitionListResponseSchema.safeParse(
      await definitionsResponse.json().catch(() => undefined),
    );
    const currentDefault = processDefaultResponseSchema.safeParse(
      await defaultResponse.json().catch(() => undefined),
    );
    if (checklist.success && definitions.success && currentDefault.success)
      return {
        ok: true as const,
        checklist: checklist.data.data.checklist,
        definitions: definitions.data.data.definitions,
        currentDefault: currentDefault.data.data.default,
      };
  }
  const response = !checklistResponse.ok
    ? checklistResponse
    : !definitionsResponse.ok
      ? definitionsResponse
      : defaultResponse;
  const parsed = hotelErrorResponseSchema.safeParse(
    await response.json().catch(() => undefined),
  );
  return {
    ok: false as const,
    error: parsed.success
      ? parsed.data.error.message
      : "점검 설정을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.",
  };
}
