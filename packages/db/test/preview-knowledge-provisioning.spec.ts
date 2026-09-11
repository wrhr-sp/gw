import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync(new URL("../scripts/provision-preview.ts", import.meta.url), "utf8");
const core = readFileSync(new URL("../migrations/0058_hotel_knowledge_bank.sql", import.meta.url), "utf8");
const attachments = readFileSync(new URL("../migrations/0059_hotel_knowledge_attachments.sql", import.meta.url), "utf8");
const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

describe("Preview knowledge provisioning", () => {
  it("registers core before attachments and gates compatible EXPAND", () => {
    const list = source.slice(source.indexOf("const allMigrations"), source.indexOf("const contractOnlyMigrations"));
    for (const name of ["0058_hotel_knowledge_bank", "0059_hotel_knowledge_attachments"]) {
      expect(list).toContain(`"${name}.sql"`);
      expect(source).toContain(`version !== "${name}"`);
    }
    expect(list.indexOf('"0058_hotel_knowledge_bank"')).toBeLessThan(list.indexOf('"0059_hotel_knowledge_attachments"'));
    expect(source).toContain("Preview knowledge migration prerequisites are incomplete");
    expect(source).toContain("Preview knowledge migration phase is incomplete");
  });
  it("revokes helper and entrypoint ACLs before restoring exact grants", () => {
    const reset = source.slice(source.indexOf("do $exact_inspection_command_acl$"), source.indexOf("$exact_inspection_command_acl$;"));
    const names = new Set([...core.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)/gi), ...attachments.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)/gi)].map(m => m[1]));
    for (const name of names) expect(reset).toContain(`'${name}'`);
    expect(reset).toContain("acl.grantee <> procedure_record.proowner");
    expect(reset).toContain("from public cascade");
    expect(reset).toContain("from %I cascade");
  });
  it("restores only the ten API entries and one reconciler entry after role registration/reset", () => {
    const signatures = [
      "hotel_knowledge_capabilities_v1(uuid,text)",
      "hotel_knowledge_reviewer_candidates_v1(uuid,uuid,text)",
      "hotel_knowledge_read_v1(uuid,uuid,jsonb,text)",
      "hotel_knowledge_command_v1(uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)",
      "hotel_knowledge_feedback_v1(uuid,uuid,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)",
      "hotel_knowledge_file_parent_scope_v1(uuid,uuid,text)",
      "hotel_knowledge_file_scope_v1(uuid,uuid,text)",
      "hotel_knowledge_file_command_v1(uuid,uuid,uuid,text,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)",
      "hotel_knowledge_attachment_command_v1(uuid,uuid,integer,jsonb,text,uuid,text,text,text,text,uuid,uuid)",
      "hotel_knowledge_file_view_v1(uuid,uuid,uuid,text,text,uuid,text,uuid,uuid,uuid)",
    ];
    const suffix = normalize(source.slice(source.indexOf("$exact_inspection_command_acl$;")));
    for (const signature of signatures) expect(suffix).toContain(`grant execute on function public.${signature} to \${apiRuntimeRole};`);
    expect(suffix).toContain("grant execute on function public.hotel_knowledge_reconcile_due_v1(integer) to ${reconcilerRole};");
    const grants = [...suffix.matchAll(/grant execute on function public\.(hotel_knowledge_\w+)\([^)]*\) to \$\{(\w+)\}/g)];
    expect(grants).toHaveLength(11);
    expect(grants.filter(m => m[2] === "reconcilerRole").map(m => m[1])).toEqual(["hotel_knowledge_reconcile_due_v1"]);
    expect(source.indexOf("'API_RUNTIME'),")).toBeLessThan(source.indexOf("$exact_inspection_command_acl$;"));
  });
});
