import postgres from "postgres";

const databaseUrl = process.env.TEST_READY_URL;
if (!databaseUrl) throw new Error("TEST_READY_URL is required");

const sql = postgres(databaseUrl, { max: 1, prepare: false });
const roleName = "werehere_hotel_rls_test";
const crossBranchId = "52000000-0000-4000-8000-000000000099";

try {
  const companies = await sql<{ id: string }[]>`
    select id from companies where status = 'ACTIVE' order by id limit 2
  `;
  if (!companies[0] || !companies[1])
    throw new Error("RLS integration requires two active companies");
  const primaryCompanyId = companies[0].id;
  const otherCompanyId = companies[1].id;

  await sql`
    insert into branches (id, company_id, branch_code, name, branch_type, status)
    values (${crossBranchId}, ${otherCompanyId}, 'RLS-CROSS-99', 'RLS 타회사 호텔', 'HOTEL', 'ACTIVE')
  `;
  await sql`
    insert into hotel_profiles (
      company_id, branch_id, hotel_status, road_address, detail_address,
      representative_phone, contract_start_date, contract_end_date
    ) values (
      ${otherCompanyId}, ${crossBranchId}, 'PREPARING', '서울특별시 테스트로 99', '',
      '02-0000-0099', date '2026-01-01', date '2026-12-31'
    )
  `;

  const existingRole = await sql<{ exists: boolean }[]>`
    select exists (select 1 from pg_roles where rolname = ${roleName})
  `;
  if (existingRole[0]?.exists) {
    await sql.unsafe(`drop owned by ${roleName}`);
    await sql.unsafe(`drop role ${roleName}`);
  }
  await sql.unsafe(`create role ${roleName} nologin`);
  await sql.unsafe(`grant usage on schema public to ${roleName}`);
  await sql.unsafe(
    `grant execute on function runtime_is_schema_owner(), runtime_has_capability(text), api_current_company_id(), reconciler_current_company_id() to ${roleName}`,
  );
  await sql.unsafe(
    `grant select, insert on branches, hotel_profiles to ${roleName}`,
  );

  await sql.unsafe(`set role ${roleName}`);
  const unscoped = await sql<{ count: number }[]>`
    select count(*)::int as count from branches where branch_type = 'HOTEL'
  `;
  if (unscoped[0]?.count !== 0)
    throw new Error("RLS exposed hotel rows without app.company_id");

  await sql.begin(async (transaction) => {
    await transaction`select set_config('app.company_id', ${primaryCompanyId}, true)`;
    const visibleBranches = await transaction<{ count: number }[]>`
      select count(*)::int as count from branches where branch_type = 'HOTEL'
    `;
    const visibleProfiles = await transaction<{ count: number }[]>`
      select count(*)::int as count from hotel_profiles
    `;
    if (visibleBranches[0]?.count !== 0 || visibleProfiles[0]?.count !== 0) {
      throw new Error(
        "RLS accepted app.company_id from an unregistered runtime",
      );
    }
  });

  let blocked = false;
  try {
    await sql.begin(async (transaction) => {
      await transaction`select set_config('app.company_id', ${primaryCompanyId}, true)`;
      await transaction`
        insert into branches (id, company_id, branch_code, name, branch_type, status)
        values (
          '52000000-0000-4000-8000-000000000098', ${primaryCompanyId},
          'RLS-BLOCK-98', 'RLS 차단 대상', 'HOTEL', 'ACTIVE'
        )
      `;
    });
  } catch (error) {
    blocked = Boolean(
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "42501",
    );
  }
  if (!blocked)
    throw new Error(
      "RLS allowed app.company_id write authority for an unregistered runtime",
    );

  console.log("HOTEL_RLS_INTEGRATION_OK");
} finally {
  await sql.unsafe("reset role").catch(() => undefined);
  await sql`delete from hotel_profiles where branch_id = ${crossBranchId}`.catch(
    () => undefined,
  );
  await sql`delete from branches where id = ${crossBranchId}`.catch(
    () => undefined,
  );
  await sql.unsafe(`drop owned by ${roleName}`).catch(() => undefined);
  await sql.unsafe(`drop role if exists ${roleName}`).catch(() => undefined);
  await sql.end({ timeout: 1 });
}
