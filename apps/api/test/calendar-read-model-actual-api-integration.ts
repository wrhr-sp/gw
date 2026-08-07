import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import {
  calendarCapabilitiesResponseSchema,
  calendarEventsResponseSchema,
  calendarVisitOptionsResponseSchema,
  hotelErrorResponseSchema,
} from "@werehere/contracts";
import { createPostgresCalendarRepository } from "@werehere/db";
import { createApp } from "../src/app";
import type { AuthService } from "../src/auth/service";
import { createCalendarService } from "../src/calendars/service";

function literalFixture(source: string, name: string) {
  const match = source.match(new RegExp(`${name}\\s+(?:constant\\s+)?uuid\\s*:=\\s*'([^']+)'`));
  if (!match?.[1]) throw new Error(`missing UUID fixture ${name}`);
  return match[1];
}
function repeatedFixture(source: string, name: string) {
  const match = source.match(new RegExp(`${name}\\s+text\\s*:=\\s*repeat\\('([^']+)',\\s*(\\d+)\\)`));
  if (!match?.[1] || !match[2]) throw new Error(`missing token fixture ${name}`);
  return match[1].repeat(Number(match[2]));
}
async function request(app: ReturnType<typeof createApp>, path: string, token: string) {
  return app.request(path, { headers: { cookie: `__Host-hotel_session=${token}` } });
}
async function expectStatus(response: Response, status: number, label: string) {
  if (response.status === status) return;
  const payload = await response.json().catch(() => null);
  throw new Error(`${label}: expected ${status}, received ${response.status} ${JSON.stringify(payload)}`);
}

type FixtureSql = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
  begin<T>(callback: (transaction: FixtureSql) => Promise<T>): Promise<T>;
  end(options: { timeout: number }): Promise<void>;
};

async function main() {
  const databaseUrl = process.env.TEST_READY_URL;
  const adminUrl = process.env.TEST_ADMIN_URL;
  const fixturePath = process.env.INSPECTION_FACILITY_SQL;
  if (!databaseUrl || !adminUrl || !fixturePath) throw new Error("Calendar actual API environment is incomplete");
  const source = await readFile(fixturePath, "utf8");
  const companyId = literalFixture(source, "v_company");
  const hotelId = literalFixture(source, "v_hotel");
  const sessionId = literalFixture(source, "v_session");
  const token = repeatedFixture(source, "v_token");
  const principal = {
    companyId,
    displayName: "Calendar API integration actor",
    identityId: "3f000000-0000-4000-8000-000000000001",
    sessionId,
    userId: "2f000000-0000-4000-8000-000000000001",
    userType: "INTERNAL_STAFF" as const,
  };
  const authService = { resolvePrincipal: async () => principal } as unknown as AuthService;
  const repository = createPostgresCalendarRepository(databaseUrl);
  const requireFromDb = createRequire(new URL("../../../packages/db/package.json", import.meta.url));
  const postgres = requireFromDb(["post", "gres"].join("")) as (url: string, options: { max: number; prepare: boolean }) => FixtureSql;
  const fixtureSql = postgres(adminUrl, { max: 1, prepare: false });
  const app = createApp({ authService, calendarService: createCalendarService(repository) });
  try {
    const capabilitiesResponse = await request(app, "/api/calendar/capabilities", token);
    await expectStatus(capabilitiesResponse, 200, "Calendar capabilities");
    const capabilities = calendarCapabilitiesResponseSchema.parse(await capabilitiesResponse.json()).data;
    if (!capabilities.canViewAllHotels || !capabilities.hotels.some((hotel) => hotel.id === hotelId && hotel.canCreateVisit))
      throw new Error("Calendar capabilities did not preserve hotel scope");

    const range = "from=2026-08-01&to=2026-09-12&pageSize=200";
    const hotelResponse = await request(app, `/api/hotels/${hotelId}/calendar?${range}`, token);
    await expectStatus(hotelResponse, 200, "single hotel Calendar");
    const hotelCalendar = calendarEventsResponseSchema.parse(await hotelResponse.json()).data;
    const repairVisit = hotelCalendar.events.find((event) => event.type === "REPAIR_VISIT");
    if (!repairVisit || repairVisit.calendarProjectionStatus !== "NOT_CONNECTED")
      throw new Error("canonical repair visit or NOT_CONNECTED state is missing");
    const serialized = JSON.stringify(hotelCalendar);
    if (/providerEventId|calendarId|refreshToken/iu.test(serialized))
      throw new Error("Calendar response exposed a provider identifier");

    const allResponse = await request(app, `/api/calendar?${range}`, token);
    await expectStatus(allResponse, 200, "all hotel Calendar");
    const allCalendar = calendarEventsResponseSchema.parse(await allResponse.json()).data;
    if (!allCalendar.hotels.some((hotel) => hotel.id === hotelId))
      throw new Error("all-hotel response lost an authorized hotel");

    const optionsResponse = await request(app, `/api/hotels/${hotelId}/calendar/visit-options`, token);
    await expectStatus(optionsResponse, 200, "Calendar visit options");
    const options = calendarVisitOptionsResponseSchema.parse(await optionsResponse.json()).data;
    if (!options.repairs.length || !options.internalPerformers.some((person) => person.userId === principal.userId))
      throw new Error("Calendar visit options are incomplete");

    const oversized = await request(app, `/api/hotels/${hotelId}/calendar?from=2026-08-01&to=2026-09-13&pageSize=200`, token);
    await expectStatus(oversized, 400, "42-day range boundary");
    const oversizedError = hotelErrorResponseSchema.parse(await oversized.json());
    if (oversizedError.error.code !== "CALENDAR_RANGE_TOO_LARGE") throw new Error("oversized range did not return the stable Calendar error");

    const invalidCursor = await request(app, `/api/hotels/${hotelId}/calendar?${range}&cursor=not_hex`, token);
    await expectStatus(invalidCursor, 400, "invalid cursor");

    const forbidden = await request(app, `/api/hotels/50000000-0000-4000-8000-000000000099/calendar?${range}`, token);
    await expectStatus(forbidden, 403, "unassigned hotel denial");

    await fixtureSql.begin(async (transaction) => {
      await transaction`update public.users set user_type = 'HOUSEKEEPING' where company_id = ${companyId}::uuid and id = ${principal.userId}::uuid`;
      await transaction`
        insert into public.housekeeping_hotel_links(
          id, company_id, branch_id, user_id, start_date, end_date, reason,
          created_by, terminated_at, terminated_by, termination_reason
        ) values (
          'ae300000-0000-4000-8000-000000000001', ${companyId}::uuid,
          ${hotelId}::uuid, ${principal.userId}::uuid,
          (statement_timestamp() at time zone 'Asia/Seoul')::date - 1,
          (statement_timestamp() at time zone 'Asia/Seoul')::date,
          'Calendar 종료 연결 회귀검증', ${principal.userId}::uuid,
          statement_timestamp(), ${principal.userId}::uuid,
          'Calendar 종료 연결 회귀검증'
        )
      `;
    });
    try {
      const terminatedCalendar = await request(app, `/api/hotels/${hotelId}/calendar?${range}`, token);
      await expectStatus(terminatedCalendar, 403, "terminated housekeeping Calendar denial");
      const terminatedOptions = await request(app, `/api/hotels/${hotelId}/calendar/visit-options`, token);
      await expectStatus(terminatedOptions, 403, "terminated housekeeping visit-options denial");
    } finally {
      await fixtureSql`update public.users set user_type = 'INTERNAL_STAFF' where company_id = ${companyId}::uuid and id = ${principal.userId}::uuid`;
    }

    const denseVisits = await fixtureSql.begin(async (transaction) => {
      const visits = await transaction`
      insert into public.hotel_repair_visits(
        id, company_id, branch_id, repair_case_id, title,
        starts_at, ends_at, status, created_by
      )
      select pg_catalog.gen_random_uuid(), ${companyId}::uuid, ${hotelId}::uuid,
             repair.id, 'Calendar density guard probe',
             '2026-08-10T01:00:00Z'::timestamptz,
             '2026-08-10T02:00:00Z'::timestamptz,
             'SCHEDULED', ${principal.userId}::uuid
        from pg_catalog.generate_series(1, 5001) sequence
        cross join lateral (
          select id from public.hotel_repair_cases
           where company_id = ${companyId}::uuid and branch_id = ${hotelId}::uuid
           order by id limit 1
        ) repair
      returning id
      `;
      await transaction`
        insert into public.hotel_repair_visit_performers(
          id, company_id, branch_id, repair_visit_id, performer_type, internal_user_id
        )
        select pg_catalog.gen_random_uuid(), visit.company_id, visit.branch_id,
               visit.id, 'INTERNAL', ${principal.userId}::uuid
          from public.hotel_repair_visits visit
         where visit.company_id = ${companyId}::uuid
           and visit.branch_id = ${hotelId}::uuid
           and visit.title = 'Calendar density guard probe'
      `;
      return visits;
    });
    if (denseVisits.length !== 5001) throw new Error(`Calendar density fixture inserted ${denseVisits.length} visits`);
    const dense = await request(app, `/api/hotels/${hotelId}/calendar?${range}`, token);
    await expectStatus(dense, 422, "Calendar density guard");
    const denseError = hotelErrorResponseSchema.parse(await dense.json());
    if (denseError.error.code !== "CALENDAR_RESULT_TOO_DENSE") throw new Error("dense range did not return the stable Calendar error");
    console.log("HOTEL_CALENDAR_ACTUAL_API_INTEGRATION_OK");
  } finally {
    await fixtureSql.end({ timeout: 5 });
    await repository.close();
  }
}

await main();
