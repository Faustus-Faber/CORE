import { prisma } from "../lib/prisma.js";
import { objectIdHexPattern } from "./incidentMapping.js";

export type ReporterRecord = {
  id: string;
  fullName: string;
};

export async function fetchReporters(userIds: string[]): Promise<ReporterRecord[]> {
  const validIds = userIds.filter((id) => objectIdHexPattern.test(id));
  if (validIds.length === 0) {
    return [];
  }

  return prisma.user.findMany({
    where: { id: { in: validIds } },
    select: { id: true, fullName: true }
  });
}

export function buildReporterMap(reporters: ReporterRecord[]) {
  return new Map(reporters.map((reporter) => [reporter.id, reporter.fullName]));
}
