import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = join(__dirname, "app");
const blockedPatterns = [
  /김민수|이서연|박지훈|최유진|정하늘|김지윤|정하린|박민재|최현우/,
  /개인정보 처리지침|복무 규정|근태현황|직원 명단|회의자료|주간업무보고|프로젝트 체크리스트|전사 공지문|출장신청서|지출결의서|기안서 양식/,
  /emp-kim|emp-lee|emp-park|emp-choi|emp-jung|doc-company-notice|doc-privacy-policy|doc-work-rule|doc-attendance-report/,
  /seedBranches|seedData|new\.user@example\.com|company_demo/,
];

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return collectSourceFiles(path);
    if (/\.(tsx|ts)$/.test(entry)) return [path];
    return [];
  });
}

describe("production sample data guard", () => {
  it("keeps user-facing app source free of hard-coded sample people, documents, and seed payloads", () => {
    const offenders = collectSourceFiles(appRoot).flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return blockedPatterns
        .filter((pattern) => pattern.test(source))
        .map((pattern) => `${relative(appRoot, path)} => ${pattern.source}`);
    });

    expect(offenders).toEqual([]);
  });
});
