import type { MailTemplate, MailTemplateRenderResult } from "@gw/shared";
import { getDbClient, type DatabaseEnv } from "../utils/db";

type MailTemplateRow = {
  id: string;
  company_id: string;
  template_code: string;
  template_name: string;
  email_type: MailTemplate["emailType"];
  subject_template: string;
  body_template: string;
  body_type: MailTemplate["bodyType"];
  required_variables: string[] | null;
  is_active: boolean;
  created_by: string;
  created_at: Date | string;
  updated_at: Date | string;
};

function toIso(value: Date | string | null | undefined) {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapTemplate(row: MailTemplateRow): MailTemplate {
  return {
    id: row.id,
    companyId: row.company_id,
    templateCode: row.template_code,
    templateName: row.template_name,
    emailType: row.email_type,
    subjectTemplate: row.subject_template,
    bodyTemplate: row.body_template,
    bodyType: row.body_type,
    requiredVariables: row.required_variables ?? [],
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function extractMailTemplateVariables(input: string) {
  return Array.from(new Set(Array.from(input.matchAll(/{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}/g)).map((match) => match[1]))).sort();
}

export function renderMailTemplateText(input: string, variables: Record<string, string>) {
  return input.replace(/{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}/g, (_match, key: string) => variables[key] ?? `{{${key}}}`);
}

export function renderOperationalMailTemplate(template: MailTemplate, variables: Record<string, string>): MailTemplateRenderResult {
  const declaredVariables = template.requiredVariables;
  const discoveredVariables = extractMailTemplateVariables(`${template.subjectTemplate}\n${template.bodyTemplate}`);
  const requiredVariables = Array.from(new Set([...declaredVariables, ...discoveredVariables])).sort();
  const missingVariables = requiredVariables.filter((variable) => !variables[variable]);
  return {
    templateId: template.id,
    subject: renderMailTemplateText(template.subjectTemplate, variables),
    body: renderMailTemplateText(template.bodyTemplate, variables),
    bodyType: template.bodyType,
    missingVariables,
  };
}

export async function listOperationalMailTemplates(env: DatabaseEnv | undefined, input: { companyId: string }) {
  const sql = getDbClient(env ?? {});
  const rows = await sql`
    select id, company_id, template_code, template_name, email_type, subject_template, body_template, body_type, required_variables, is_active, created_by, created_at, updated_at
    from mail_templates
    where company_id = ${input.companyId}
      and deleted_at is null
    order by is_active desc, updated_at desc
    limit 100
  `;
  return (rows as MailTemplateRow[]).map(mapTemplate);
}

export async function getOperationalMailTemplate(env: DatabaseEnv | undefined, input: { companyId: string; templateId: string }) {
  const sql = getDbClient(env ?? {});
  const rows = await sql`
    select id, company_id, template_code, template_name, email_type, subject_template, body_template, body_type, required_variables, is_active, created_by, created_at, updated_at
    from mail_templates
    where company_id = ${input.companyId}
      and id = ${input.templateId}
      and deleted_at is null
    limit 1
  `;
  const row = rows[0] as MailTemplateRow | undefined;
  return row ? mapTemplate(row) : null;
}

export async function createOperationalMailTemplate(env: DatabaseEnv | undefined, input: {
  id: string;
  companyId: string;
  userId: string;
  templateCode: string;
  templateName: string;
  emailType: MailTemplate["emailType"];
  subjectTemplate: string;
  bodyTemplate: string;
  bodyType: MailTemplate["bodyType"];
  requiredVariables: string[];
  isActive: boolean;
}) {
  const sql = getDbClient(env ?? {});
  const rows = await sql`
    insert into mail_templates (id, company_id, template_code, template_name, email_type, subject_template, body_template, body_type, required_variables, is_active, created_by, created_at, updated_at)
    values (${input.id}, ${input.companyId}, ${input.templateCode}, ${input.templateName}, ${input.emailType}, ${input.subjectTemplate}, ${input.bodyTemplate}, ${input.bodyType}, ${input.requiredVariables}, ${input.isActive}, ${input.userId}, now(), now())
    returning id, company_id, template_code, template_name, email_type, subject_template, body_template, body_type, required_variables, is_active, created_by, created_at, updated_at
  `;
  const template = mapTemplate(rows[0] as MailTemplateRow);
  await sql`
    insert into mail_template_versions (id, template_id, company_id, version_no, subject_template, body_template, body_type, required_variables, changed_by, change_reason, created_at)
    values (${`${input.id}_v1`}, ${input.id}, ${input.companyId}, 1, ${input.subjectTemplate}, ${input.bodyTemplate}, ${input.bodyType}, ${input.requiredVariables}, ${input.userId}, 'initial', now())
  `;
  return template;
}

export async function updateOperationalMailTemplate(env: DatabaseEnv | undefined, input: {
  companyId: string;
  templateId: string;
  userId: string;
  templateName?: string;
  emailType?: MailTemplate["emailType"];
  subjectTemplate?: string;
  bodyTemplate?: string;
  bodyType?: MailTemplate["bodyType"];
  requiredVariables?: string[];
  isActive?: boolean;
  changeReason?: string | null;
}) {
  const sql = getDbClient(env ?? {});
  const current = await getOperationalMailTemplate(env, { companyId: input.companyId, templateId: input.templateId });
  if (!current) return null;
  const next = {
    templateName: input.templateName ?? current.templateName,
    emailType: input.emailType ?? current.emailType,
    subjectTemplate: input.subjectTemplate ?? current.subjectTemplate,
    bodyTemplate: input.bodyTemplate ?? current.bodyTemplate,
    bodyType: input.bodyType ?? current.bodyType,
    requiredVariables: input.requiredVariables ?? current.requiredVariables,
    isActive: input.isActive ?? current.isActive,
  };
  const rows = await sql`
    update mail_templates
    set template_name = ${next.templateName}, email_type = ${next.emailType}, subject_template = ${next.subjectTemplate}, body_template = ${next.bodyTemplate}, body_type = ${next.bodyType}, required_variables = ${next.requiredVariables}, is_active = ${next.isActive}, updated_at = now()
    where company_id = ${input.companyId}
      and id = ${input.templateId}
      and deleted_at is null
    returning id, company_id, template_code, template_name, email_type, subject_template, body_template, body_type, required_variables, is_active, created_by, created_at, updated_at
  `;
  const template = mapTemplate(rows[0] as MailTemplateRow);
  const versionRows = await sql`select coalesce(max(version_no), 0) + 1 as next_version_no from mail_template_versions where template_id = ${input.templateId}`;
  const nextVersionNo = Number((versionRows[0] as { next_version_no?: number | string } | undefined)?.next_version_no ?? 1);
  await sql`
    insert into mail_template_versions (id, template_id, company_id, version_no, subject_template, body_template, body_type, required_variables, changed_by, change_reason, created_at)
    values (${`${input.templateId}_v${nextVersionNo}`}, ${input.templateId}, ${input.companyId}, ${nextVersionNo}, ${template.subjectTemplate}, ${template.bodyTemplate}, ${template.bodyType}, ${template.requiredVariables}, ${input.userId}, ${input.changeReason ?? 'update'}, now())
  `;
  return template;
}
