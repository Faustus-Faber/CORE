import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Incident report Prisma schema", () => {
  it("defines IncidentReport model and required enums", () => {
    const schemaPath = resolve(process.cwd(), "prisma", "schema.prisma");
    const schema = readFileSync(schemaPath, "utf8");

    expect(schema).toMatch(/enum\s+IncidentSeverity\s*{/);
    expect(schema).toMatch(/enum\s+IncidentStatus\s*{/);
    expect(schema).toMatch(/enum\s+IncidentType\s*{/);
    expect(schema).toMatch(/model\s+IncidentReport\s*{/);
    expect(schema).toMatch(/credibilityScore/);
    expect(schema).toMatch(/spamFlagged/);
    expect(schema).toMatch(/severityLevel/);
    expect(schema).toMatch(/classifiedIncidentType/);
    expect(schema).toMatch(/classifiedIncidentTitle/);
  });
});
