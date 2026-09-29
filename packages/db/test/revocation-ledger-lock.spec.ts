import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../scripts/revoke-preview-bootstrap-sessions.ts", import.meta.url),
  "utf8",
);
const file = ts.createSourceFile(
  "source.ts",
  source,
  ts.ScriptTarget.Latest,
  true,
);
const functionText = (name: string) => {
  const matches = file.statements.filter(
    (node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) && node.name?.text === name,
  );
  expect(matches).toHaveLength(1);
  return matches[0]!.getText(file);
};

describe("preview bootstrap revocation ledger metadata fence", () => {
  const fence = functionText("fencePreviewBootstrapSessionRevocationLedger");
  const wrapper = functionText(
    "assertPreviewBootstrapSessionRevocationLedgerReady",
  );

  it("retains the complete validator before and after the fence", () => {
    expect(
      fence.match(/validatePreviewBootstrapSessionRevocationLedger\(sql\)/g),
    ).toHaveLength(2);
  });

  it("keeps the relation lock and delegates to the fence", () => {
    expect(wrapper).toContain("access exclusive mode");
    expect(wrapper).toContain(
      "fencePreviewBootstrapSessionRevocationLedger(sql)",
    );
  });

  it("does not normalize ACLs with GRANT or REVOKE", () => {
    expect(fence).not.toMatch(/\bgrant\b|\brevoke\b/i);
  });

  it("writes the existing relation option and every existing attribute target", () => {
    expect(fence).toContain("set (fillfactor=${fillfactor})");
    expect(fence).toContain("for (const attribute of attributes)");
    expect(fence).toContain("set statistics ${target}");
    expect(fence).toContain("set statistics default");
  });

  it("restores absent fillfactor and compares option values independent of order", () => {
    expect(fence).toContain("reset (fillfactor)");
    expect(functionText("normalizedReloptions")).toContain(".sort()");
    expect(fence).toContain(
      "normalizedReloptions(afterTableRows[0]!.reloptions)",
    );
    expect(fence).toContain("normalizedReloptions(beforeOptions)");
  });

  it("rejects unexpected attribute inventory, identifiers, values, or metadata drift", () => {
    expect(fence).toContain("attributes.length !== columns.length");
    expect(fence).toContain("attribute.attname !== columns[index]");
    expect(fence).toContain("/^[a-z_]+$/");
    expect(fence).toContain("target > 10_000");
    expect(fence).toContain(
      "JSON.stringify(afterAttributes) !== JSON.stringify(attributes)",
    );
  });

  it("preserves the orchestration call sites at claim and provider entry", () => {
    const main = functionText("main");
    expect(
      main.match(
        /assertPreviewBootstrapSessionRevocationLedgerReady\(transaction\)/g,
      ),
    ).toHaveLength(2);
    const firstFence = main.indexOf(
      "assertPreviewBootstrapSessionRevocationLedgerReady(transaction)",
    );
    const secondFence = main.lastIndexOf(
      "assertPreviewBootstrapSessionRevocationLedgerReady(transaction)",
    );
    expect(firstFence).toBeLessThan(
      main.indexOf("insert into preview_bootstrap_session_revocations"),
    );
    expect(secondFence).toBeGreaterThan(firstFence);
    expect(secondFence).toBeLessThan(main.indexOf("revokeZitadelBootstrapSessions"));
  });
});
