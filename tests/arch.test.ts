import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const src = path.resolve(__dirname, "../src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}

describe("architecture", () => {
  it("dashboardService never touches nutrition data", () => {
    const code = readFileSync(path.join(src, "services/dashboardService.ts"), "utf8");
    expect(code).not.toMatch(/nutrition/i);
    expect(code).toMatch(/bodyRepo/);
    expect(code).toMatch(/runRepo/);
  });

  it("the dashboard page never imports nutrition modules", () => {
    const code = readFileSync(path.join(src, "app/(app)/page.tsx"), "utf8");
    expect(code).not.toMatch(/from ["'][^"']*nutrition[^"']*["']/i);
  });

  it("domain is pure (no db, repositories, next or I/O imports)", () => {
    for (const f of files(path.join(src, "domain"))) {
      const code = readFileSync(f, "utf8");
      expect(code, f).not.toMatch(/from ["'](@\/db|@\/repositories|next\/|node:|drizzle-orm|@neondatabase)/);
    }
  });

  it("only repositories (and db) import the database client", () => {
    for (const f of files(src)) {
      if (f.includes(`${path.sep}repositories${path.sep}`) || f.includes(`${path.sep}db${path.sep}`)) continue;
      const code = readFileSync(f, "utf8");
      expect(code, f).not.toMatch(/from ["']@\/db\/(client|schema)["']/);
    }
  });
});
