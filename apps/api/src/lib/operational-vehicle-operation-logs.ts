import type {
  Vehicle,
  VehicleFuelType,
  VehicleOperationLog,
  VehicleOperationLogCreateRequest,
  VehicleOperationLogStatus,
  VehicleOperationLogUpdateRequest,
  VehicleOperationPurpose,
} from "@gw/shared";
import { createOperationalSql, isOperationalSchemaDriftError, type PostgresEnv } from "./postgres";

const VEHICLE_OPERATION_SOURCE = "postgres" as const;

type VehicleRow = {
  id: string;
  company_id: string;
  vehicle_number: string;
  display_name: string;
  fuel_type: VehicleFuelType;
  default_driver_employee_id: string | null;
  default_driver_name: string | null;
  odometer_km: number | string | null;
  is_active: boolean;
  created_at: string | Date;
  updated_at: string | Date;
};

type VehicleOperationLogRow = {
  id: string;
  company_id: string;
  vehicle_id: string;
  vehicle_number: string;
  vehicle_display_name: string;
  driver_user_id: string;
  driver_employee_id: string;
  driver_name: string;
  operation_date: string | Date;
  purpose: VehicleOperationPurpose;
  purpose_detail: string | null;
  departure_place: string;
  arrival_place: string;
  started_at: string | Date | null;
  ended_at: string | Date | null;
  start_odometer_km: number | string | null;
  end_odometer_km: number | string | null;
  distance_km: number | string;
  fuel_cost: number | string;
  toll_cost: number | string;
  parking_cost: number | string;
  other_cost: number | string;
  memo: string | null;
  status: VehicleOperationLogStatus;
  submitted_at: string | Date | null;
  approved_at: string | Date | null;
  approved_by_user_id: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

function toIsoString(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toRequiredIsoString(value: string | Date) {
  return toIsoString(value) ?? new Date(0).toISOString();
}

function toDateString(value: string | Date) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function toNullableNumber(value: number | string | null) {
  if (value === null) return null;
  return Number(value);
}

function toNumber(value: number | string) {
  return Number(value);
}

function mapVehicle(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    companyId: row.company_id,
    vehicleNumber: row.vehicle_number,
    displayName: row.display_name,
    fuelType: row.fuel_type,
    defaultDriverEmployeeId: row.default_driver_employee_id,
    defaultDriverName: row.default_driver_name,
    odometerKm: toNullableNumber(row.odometer_km),
    isActive: row.is_active,
    createdAt: toRequiredIsoString(row.created_at),
    updatedAt: toRequiredIsoString(row.updated_at),
  };
}

function mapLog(row: VehicleOperationLogRow): VehicleOperationLog {
  return {
    id: row.id,
    companyId: row.company_id,
    vehicleId: row.vehicle_id,
    vehicleNumber: row.vehicle_number,
    vehicleDisplayName: row.vehicle_display_name,
    driverUserId: row.driver_user_id,
    driverEmployeeId: row.driver_employee_id,
    driverName: row.driver_name,
    operationDate: toDateString(row.operation_date),
    purpose: row.purpose,
    purposeDetail: row.purpose_detail,
    departurePlace: row.departure_place,
    arrivalPlace: row.arrival_place,
    startedAt: toIsoString(row.started_at),
    endedAt: toIsoString(row.ended_at),
    startOdometerKm: toNullableNumber(row.start_odometer_km),
    endOdometerKm: toNullableNumber(row.end_odometer_km),
    distanceKm: toNumber(row.distance_km),
    fuelCost: toNumber(row.fuel_cost),
    tollCost: toNumber(row.toll_cost),
    parkingCost: toNumber(row.parking_cost),
    otherCost: toNumber(row.other_cost),
    memo: row.memo,
    status: row.status,
    submittedAt: toIsoString(row.submitted_at),
    approvedAt: toIsoString(row.approved_at),
    approvedByUserId: row.approved_by_user_id,
    createdAt: toRequiredIsoString(row.created_at),
    updatedAt: toRequiredIsoString(row.updated_at),
  };
}

const vehicleSelect = `
  select
    v.id,
    v.company_id,
    v.vehicle_number,
    v.display_name,
    v.fuel_type,
    v.default_driver_employee_id,
    e.full_name as default_driver_name,
    v.odometer_km,
    v.is_active,
    v.created_at,
    v.updated_at
  from fleet_vehicles v
  left join employees e on e.id = v.default_driver_employee_id and e.company_id = v.company_id
`;

const logSelect = `
  select
    l.id,
    l.company_id,
    l.vehicle_id,
    v.vehicle_number,
    v.display_name as vehicle_display_name,
    l.driver_user_id,
    l.driver_employee_id,
    e.full_name as driver_name,
    l.operation_date,
    l.purpose,
    l.purpose_detail,
    l.departure_place,
    l.arrival_place,
    l.started_at,
    l.ended_at,
    l.start_odometer_km,
    l.end_odometer_km,
    l.distance_km,
    l.fuel_cost,
    l.toll_cost,
    l.parking_cost,
    l.other_cost,
    l.memo,
    l.status,
    l.submitted_at,
    l.approved_at,
    l.approved_by_user_id,
    l.created_at,
    l.updated_at
  from vehicle_operation_logs l
  join fleet_vehicles v on v.id = l.vehicle_id and v.company_id = l.company_id and v.deleted_at is null
  join employees e on e.id = l.driver_employee_id and e.company_id = l.company_id
`;

export async function listOperationalVehicles(env: PostgresEnv | undefined, companyId: string) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql.query(
      `${vehicleSelect}
       where v.company_id = $1 and v.deleted_at is null and v.is_active = true
       order by v.vehicle_number, v.id`,
      [companyId],
    );
    return { items: rows.map((row) => mapVehicle(row as VehicleRow)), source: VEHICLE_OPERATION_SOURCE };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function listOperationalVehicleLogs(env: PostgresEnv | undefined, companyId: string, status?: VehicleOperationLogStatus) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    if (status) {
      const rows = await sql.query(
        `${logSelect}
         where l.company_id = $1 and l.status = $2 and l.deleted_at is null
         order by l.operation_date desc, l.created_at desc, l.id`,
        [companyId, status],
      );
      return { items: rows.map((row) => mapLog(row as VehicleOperationLogRow)), source: VEHICLE_OPERATION_SOURCE };
    }
    const rows = await sql.query(
      `${logSelect}
       where l.company_id = $1 and l.deleted_at is null
       order by l.operation_date desc, l.created_at desc, l.id`,
      [companyId],
    );
    return { items: rows.map((row) => mapLog(row as VehicleOperationLogRow)), source: VEHICLE_OPERATION_SOURCE };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function findOperationalVehicleLog(env: PostgresEnv | undefined, companyId: string, logId: string) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const rows = await sql.query(
      `${logSelect}
       where l.company_id = $1 and l.id = $2 and l.deleted_at is null
       limit 1`,
      [companyId, logId],
    );
    const row = rows[0] as VehicleOperationLogRow | undefined;
    return { log: row ? mapLog(row) : null, source: VEHICLE_OPERATION_SOURCE };
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function createOperationalVehicleLog(
  env: PostgresEnv | undefined,
  input: {
    id: string;
    companyId: string;
    driverUserId: string;
    driverEmployeeId: string;
    createdAt: string;
    data: VehicleOperationLogCreateRequest;
  },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const vehicleRows = await sql`
      select id
      from fleet_vehicles
      where company_id = ${input.companyId}
        and id = ${input.data.vehicleId}
        and is_active = true
        and deleted_at is null
      limit 1
    `;
    if (!vehicleRows[0]) return { log: null, source: VEHICLE_OPERATION_SOURCE };

    await sql`
      insert into vehicle_operation_logs (
        id, company_id, vehicle_id, driver_user_id, driver_employee_id, operation_date, purpose, purpose_detail,
        departure_place, arrival_place, started_at, ended_at, start_odometer_km, end_odometer_km,
        distance_km, fuel_cost, toll_cost, parking_cost, other_cost, memo, status, created_at, updated_at
      )
      values (
        ${input.id},
        ${input.companyId},
        ${input.data.vehicleId},
        ${input.driverUserId},
        ${input.driverEmployeeId},
        ${input.data.operationDate}::date,
        ${input.data.purpose},
        ${input.data.purposeDetail ?? null},
        ${input.data.departurePlace},
        ${input.data.arrivalPlace},
        ${input.data.startedAt ?? null}::timestamptz,
        ${input.data.endedAt ?? null}::timestamptz,
        ${input.data.startOdometerKm ?? null},
        ${input.data.endOdometerKm ?? null},
        ${input.data.distanceKm},
        ${input.data.fuelCost},
        ${input.data.tollCost},
        ${input.data.parkingCost},
        ${input.data.otherCost},
        ${input.data.memo ?? null},
        ${"draft"},
        ${input.createdAt}::timestamptz,
        ${input.createdAt}::timestamptz
      )
    `;
    return findOperationalVehicleLog(env, input.companyId, input.id);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function updateOperationalVehicleLog(
  env: PostgresEnv | undefined,
  input: { companyId: string; logId: string; data: VehicleOperationLogUpdateRequest; updatedAt: string },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    const existing = await findOperationalVehicleLog(env, input.companyId, input.logId);
    if (!existing?.log) return existing;
    if (existing.log.status !== "draft") return { log: null, source: VEHICLE_OPERATION_SOURCE };

    const next = {
      vehicleId: input.data.vehicleId ?? existing.log.vehicleId,
      operationDate: input.data.operationDate ?? existing.log.operationDate,
      purpose: input.data.purpose ?? existing.log.purpose,
      purposeDetail: input.data.purposeDetail ?? existing.log.purposeDetail ?? undefined,
      departurePlace: input.data.departurePlace ?? existing.log.departurePlace,
      arrivalPlace: input.data.arrivalPlace ?? existing.log.arrivalPlace,
      startedAt: input.data.startedAt ?? existing.log.startedAt ?? undefined,
      endedAt: input.data.endedAt ?? existing.log.endedAt ?? undefined,
      startOdometerKm: input.data.startOdometerKm ?? existing.log.startOdometerKm ?? undefined,
      endOdometerKm: input.data.endOdometerKm ?? existing.log.endOdometerKm ?? undefined,
      distanceKm: input.data.distanceKm ?? existing.log.distanceKm,
      fuelCost: input.data.fuelCost ?? existing.log.fuelCost,
      tollCost: input.data.tollCost ?? existing.log.tollCost,
      parkingCost: input.data.parkingCost ?? existing.log.parkingCost,
      otherCost: input.data.otherCost ?? existing.log.otherCost,
      memo: input.data.memo ?? existing.log.memo ?? undefined,
    };

    const vehicleRows = await sql`
      select id
      from fleet_vehicles
      where company_id = ${input.companyId}
        and id = ${next.vehicleId}
        and is_active = true
        and deleted_at is null
      limit 1
    `;
    if (!vehicleRows[0]) return { log: null, source: VEHICLE_OPERATION_SOURCE };

    await sql`
      update vehicle_operation_logs
      set vehicle_id = ${next.vehicleId},
          operation_date = ${next.operationDate}::date,
          purpose = ${next.purpose},
          purpose_detail = ${next.purposeDetail ?? null},
          departure_place = ${next.departurePlace},
          arrival_place = ${next.arrivalPlace},
          started_at = ${next.startedAt ?? null}::timestamptz,
          ended_at = ${next.endedAt ?? null}::timestamptz,
          start_odometer_km = ${next.startOdometerKm ?? null},
          end_odometer_km = ${next.endOdometerKm ?? null},
          distance_km = ${next.distanceKm},
          fuel_cost = ${next.fuelCost},
          toll_cost = ${next.tollCost},
          parking_cost = ${next.parkingCost},
          other_cost = ${next.otherCost},
          memo = ${next.memo ?? null},
          updated_at = ${input.updatedAt}::timestamptz
      where company_id = ${input.companyId}
        and id = ${input.logId}
        and status = 'draft'
        and deleted_at is null
    `;
    return findOperationalVehicleLog(env, input.companyId, input.logId);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}

export async function transitionOperationalVehicleLog(
  env: PostgresEnv | undefined,
  input: { companyId: string; logId: string; status: "submitted" | "cancelled"; actorUserId: string; updatedAt: string },
) {
  const sql = createOperationalSql(env);
  if (!sql) return null;
  try {
    if (input.status === "submitted") {
      await sql`
        update vehicle_operation_logs
        set status = 'submitted', submitted_at = ${input.updatedAt}::timestamptz, updated_at = ${input.updatedAt}::timestamptz
        where company_id = ${input.companyId}
          and id = ${input.logId}
          and status = 'draft'
          and deleted_at is null
      `;
    } else {
      await sql`
        update vehicle_operation_logs
        set status = 'cancelled', updated_at = ${input.updatedAt}::timestamptz
        where company_id = ${input.companyId}
          and id = ${input.logId}
          and status in ('draft', 'submitted')
          and deleted_at is null
      `;
    }
    return findOperationalVehicleLog(env, input.companyId, input.logId);
  } catch (error) {
    if (isOperationalSchemaDriftError(error)) return null;
    throw error;
  }
}
