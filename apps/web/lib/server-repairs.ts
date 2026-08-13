import {
  hotelAssignmentListResponseSchema,
  hotelErrorResponseSchema,
  hotelRoutes,
  repairCaseResponseSchema,
  repairListResponseSchema,
  repairPriorityListResponseSchema,
  repairRoutes,
} from "@werehere/contracts";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchApi } from "./api-transport";
import { fetchAllFacilityInspectionData } from "./server-facilities";

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

export async function fetchRepairs(hotelId: string) {
  const [listResponse, priorityResponse, assignmentResponse, facilityResult] =
    await Promise.all([
      request(`${repairRoutes.list(hotelId)}?page=1&pageSize=100&status=OPEN`),
      request(repairRoutes.priorities(hotelId)),
      request(hotelRoutes.assignments(hotelId)),
      fetchAllFacilityInspectionData(hotelId),
    ]);
  if (
    listResponse.status === 401 ||
    priorityResponse.status === 401 ||
    assignmentResponse.status === 401
  )
    redirect("/login");
  for (const response of [listResponse, priorityResponse, assignmentResponse]) {
    if (!response.ok) {
      const error = hotelErrorResponseSchema.safeParse(
        await response.json().catch(() => undefined),
      );
      return {
        ok: false as const,
        error: error.success
          ? error.data.error.message
          : "보수 업무 기준정보를 불러오지 못했습니다.",
      };
    }
  }
  if (!facilityResult.ok)
    return { ok: false as const, error: facilityResult.error.message };
  const [list, priorities, assignments] = await Promise.all([
    listResponse.json().catch(() => undefined),
    priorityResponse.json().catch(() => undefined),
    assignmentResponse.json().catch(() => undefined),
  ]);
  const parsedList = repairListResponseSchema.safeParse(list);
  const parsedPriorities = repairPriorityListResponseSchema.safeParse(priorities);
  const parsedAssignments = hotelAssignmentListResponseSchema.safeParse(assignments);
  if (!parsedList.success || !parsedPriorities.success || !parsedAssignments.success)
    return {
      ok: false as const,
      error: "보수 업무 기준정보 응답을 안전하게 확인하지 못했습니다.",
    };
  const repairs = parsedList.data.data.repairs;
  const selected = repairs[0];
  let selectedRepair = null;
  if (selected) {
    const detailResponse = await request(repairRoutes.detail(hotelId, selected.id));
    if (!detailResponse.ok)
      return { ok: false as const, error: "보수 상세를 불러오지 못했습니다." };
    const detail = repairCaseResponseSchema.safeParse(
      await detailResponse.json().catch(() => undefined),
    );
    if (!detail.success)
      return {
        ok: false as const,
        error: "보수 상세 응답을 안전하게 확인하지 못했습니다.",
      };
    selectedRepair = detail.data.data.repair;
  }
  const today = new Date().toISOString().slice(0, 10);
  return {
    ok: true as const,
    assignments: parsedAssignments.data.data.assignments.filter(
      (assignment) =>
        assignment.terminatedAt === null &&
        (assignment.endDate === null || assignment.endDate >= today),
    ),
    facilityData: facilityResult.data,
    priorities: parsedPriorities.data.data.priorities,
    repairs,
    selectedRepair,
  };
}