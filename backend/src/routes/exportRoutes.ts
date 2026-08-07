/**
 * Interoperability export routes.
 *
 * Per refinement plan §15.5:
 *   - GeoJSON for safe crisis boundaries
 *   - HXL-tagged CSV for humanitarian data exchange
 *   - CAP (Common Alerting Protocol) XML for alerting interoperability
 *   - organization-approved CSV exports
 *
 * GET /exports/crises.geojson     → GeoJSON FeatureCollection of active crises
 * GET /exports/crises.csv         → HXL-tagged CSV of active crises
 * GET /exports/reports.csv        → HXL-tagged CSV of published reports
 * GET /exports/crises.cap         → CAP XML feed of active crises
 *
 * All exports require authentication.
 */

import { Router, type Request, type Response } from "express";

import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const exportRoutes = Router();

/**
 * Escape a value for CSV output.
 * Prefixes dangerous characters (=, +, -, @) with a tab to prevent
 * formula injection in spreadsheet applications (CSV injection).
 */
function csvEscape(value: unknown): string {
  if (value == null) return "";
  let str = String(value);
  // Prevent CSV formula injection: if the cell starts with a dangerous char,
  // prepend a tab so spreadsheet apps don't interpret it as a formula.
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "\t" + str;
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert an array of objects to HXL-tagged CSV.
 * The first row is HXL hashtags, the second row is human headers, then data.
 */
function toHxlCsv(rows: Record<string, unknown>[], hxlTags: Record<string, string>, headers: Record<string, string>): string {
  const keys = Object.keys(hxlTags);
  const lines: string[] = [];

  // HXL hashtag row
  lines.push(keys.map((k) => hxlTags[k]).join(","));
  // Human-readable header row
  lines.push(keys.map((k) => headers[k]).join(","));
  // Data rows
  for (const row of rows) {
    lines.push(keys.map((k) => csvEscape(row[k])).join(","));
  }

  return lines.join("\n");
}

/**
 * GET /exports/crises.geojson
 * Returns a GeoJSON FeatureCollection of active crisis events.
 * Coordinates are included for mapping; sensitive details are excluded.
 */
exportRoutes.get("/crises.geojson", requireAuth, async (_request: Request, response: Response) => {
  try {
    const crises = await prisma.crisisEvent.findMany({
      where: { status: { not: "RESOLVED" } },
      select: {
        id: true,
        title: true,
        status: true,
        severityLevel: true,
        incidentType: true,
        locationText: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const features = crises
      .filter((c) => c.latitude != null && c.longitude != null)
      .map((c) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [c.longitude!, c.latitude!],
        },
        properties: {
          id: c.id,
          title: c.title,
          status: c.status,
          severity: c.severityLevel,
          incidentType: c.incidentType,
          location: c.locationText,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        },
      }));

    return response.status(200).json({
      type: "FeatureCollection",
      features,
      metadata: {
        count: features.length,
        generatedAt: new Date().toISOString(),
        note: "Coordinates are approximate crisis locations. Sensitive details are excluded.",
      },
    });
  } catch (error) {
    console.error("GeoJSON export failed:", error);
    return response.status(500).json({
      message: "Failed to generate GeoJSON export",
      detail: "See server logs for details",
    });
  }
});

/**
 * GET /exports/crises.csv
 * Returns an HXL-tagged CSV of active crisis events.
 */
exportRoutes.get("/crises.csv", requireAuth, async (_request: Request, response: Response) => {
  try {
    const crises = await prisma.crisisEvent.findMany({
      where: { status: { not: "RESOLVED" } },
      select: {
        id: true,
        title: true,
        status: true,
        severityLevel: true,
        incidentType: true,
        locationText: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const rows = crises.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      severity: c.severityLevel,
      incidentType: c.incidentType,
      location: c.locationText,
      latitude: c.latitude ?? "",
      longitude: c.longitude ?? "",
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    const csv = toHxlCsv(
      rows,
      {
        id: "#id+code",
        title: "#title",
        status: "#status",
        severity: "#severity",
        incidentType: "#category+type",
        location: "#loc+name",
        latitude: "#geo+lat",
        longitude: "#geo+lon",
        createdAt: "#date+created",
        updatedAt: "#date+updated",
      },
      {
        id: "ID",
        title: "Title",
        status: "Status",
        severity: "Severity",
        incidentType: "Incident Type",
        location: "Location",
        latitude: "Latitude",
        longitude: "Longitude",
        createdAt: "Created At",
        updatedAt: "Updated At",
      }
    );

    response.setHeader("Content-Type", "text/csv");
    response.setHeader("Content-Disposition", "attachment; filename=crises.csv");
    return response.status(200).send(csv);
  } catch (error) {
    console.error("CSV export failed:", error);
    return response.status(500).json({
      message: "Failed to generate CSV export",
      detail: "See server logs for details",
    });
  }
});

/**
 * GET /exports/reports.csv
 * Returns an HXL-tagged CSV of published incident reports.
 */
exportRoutes.get("/reports.csv", requireAuth, async (_request: Request, response: Response) => {
  try {
    const reports = await prisma.incidentReport.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        incidentTitle: true,
        incidentType: true,
        severityLevel: true,
        status: true,
        locationText: true,
        latitude: true,
        longitude: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500, // Cap to prevent excessive export size
    });

    const rows = reports.map((r) => ({
      id: r.id,
      title: r.incidentTitle,
      type: r.incidentType,
      severity: r.severityLevel,
      status: r.status,
      location: r.locationText,
      latitude: r.latitude ?? "",
      longitude: r.longitude ?? "",
      createdAt: r.createdAt.toISOString(),
    }));

    const csv = toHxlCsv(
      rows,
      {
        id: "#id+code",
        title: "#title",
        type: "#category+type",
        severity: "#severity",
        status: "#status",
        location: "#loc+name",
        latitude: "#geo+lat",
        longitude: "#geo+lon",
        createdAt: "#date+created",
      },
      {
        id: "ID",
        title: "Title",
        type: "Incident Type",
        severity: "Severity",
        status: "Status",
        location: "Location",
        latitude: "Latitude",
        longitude: "Longitude",
        createdAt: "Created At",
      }
    );

    response.setHeader("Content-Type", "text/csv");
    response.setHeader("Content-Disposition", "attachment; filename=reports.csv");
    return response.status(200).send(csv);
  } catch (error) {
    console.error("CSV export failed:", error);
    return response.status(500).json({
      message: "Failed to generate CSV export",
      detail: "See server logs for details",
    });
  }
});

/**
 * Escape a value for XML output.
 */
function xmlEscape(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Map severity to CAP urgency/severity values.
 */
function capSeverityMapping(severity: string): { urgency: string; severity: string; certainty: string } {
  switch (severity) {
    case "CRITICAL":
      return { urgency: "Immediate", severity: "Extreme", certainty: "Observed" };
    case "HIGH":
      return { urgency: "Expected", severity: "Severe", certainty: "Likely" };
    case "MEDIUM":
      return { urgency: "Future", severity: "Moderate", certainty: "Possible" };
    default:
      return { urgency: "Future", severity: "Minor", certainty: "Possible" };
  }
}

/**
 * GET /exports/crises.cap
 * Returns a CAP (Common Alerting Protocol) 1.2 XML feed of active crisis events.
 * Per §15.5: CAP format for interoperability with emergency alerting systems.
 */
exportRoutes.get("/crises.cap", requireAuth, async (_request: Request, response: Response) => {
  try {
    const crises = await prisma.crisisEvent.findMany({
      where: { status: { notIn: ["RESOLVED", "CLOSED"] } },
      select: {
        id: true,
        canonicalId: true,
        title: true,
        status: true,
        severityLevel: true,
        incidentType: true,
        locationText: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const sender = "core@ffwc.gov.bd";
    const now = new Date().toISOString();
    const sentDate = now;

    const infoBlocks = crises.map((c) => {
      const cap = capSeverityMapping(c.severityLevel);
      const identifier = c.canonicalId ?? c.id;
      const capId = `CORE-${identifier}`;
      const sent = c.createdAt.toISOString();
      const expires = new Date(c.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

      return `    <info>
      <language>en</language>
      <category>Env</category>
      <event>${xmlEscape(c.incidentType)} — ${xmlEscape(c.title)}</event>
      <urgency>${cap.urgency}</urgency>
      <severity>${cap.severity}</severity>
      <certainty>${cap.certainty}</certainty>
      <eventCode>
        <valueName>incidentType</valueName>
        <value>${xmlEscape(c.incidentType)}</value>
      </eventCode>
      <eventCode>
        <valueName>severityLevel</valueName>
        <value>${xmlEscape(c.severityLevel)}</value>
      </eventCode>
      <eventCode>
        <valueName>canonicalId</valueName>
        <value>${xmlEscape(identifier)}</value>
      </eventCode>
      <senderName>CORE Crisis Network</senderName>
      <headline>${xmlEscape(c.title)} — ${xmlEscape(c.locationText)}</headline>
      <description>Status: ${xmlEscape(c.status)}. Severity: ${xmlEscape(c.severityLevel)}. Location: ${xmlEscape(c.locationText)}.</description>
      <area>
        <areaDesc>${xmlEscape(c.locationText)}</areaDesc>
${c.latitude != null && c.longitude != null
          ? `        <circle>${c.latitude},${c.longitude} 5.0</circle>\n`
          : ""}      </area>
    </info>`;
    }).join("\n");

    const alertBlocks = crises.map((c) => {
      const identifier = c.canonicalId ?? c.id;
      const capId = `CORE-${identifier}`;
      const sent = c.createdAt.toISOString();
      const expires = new Date(c.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const cap = capSeverityMapping(c.severityLevel);
      const msgType = c.status === "REPORTED" ? "Alert" : "Update";

      return `  <alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
    <identifier>${xmlEscape(capId)}</identifier>
    <sender>${xmlEscape(sender)}</sender>
    <sent>${sent}</sent>
    <status>Actual</status>
    <msgType>${msgType}</msgType>
    <scope>Public</scope>
    <info>
      <language>en</language>
      <category>Env</category>
      <event>${xmlEscape(c.incidentType)} — ${xmlEscape(c.title)}</event>
      <urgency>${cap.urgency}</urgency>
      <severity>${cap.severity}</severity>
      <certainty>${cap.certainty}</certainty>
      <eventCode>
        <valueName>incidentType</valueName>
        <value>${xmlEscape(c.incidentType)}</value>
      </eventCode>
      <eventCode>
        <valueName>canonicalId</valueName>
        <value>${xmlEscape(identifier)}</value>
      </eventCode>
      <senderName>CORE Crisis Network</senderName>
      <headline>${xmlEscape(c.title)} — ${xmlEscape(c.locationText)}</headline>
      <description>Status: ${xmlEscape(c.status)}. Severity: ${xmlEscape(c.severityLevel)}. Location: ${xmlEscape(c.locationText)}.</description>
      <expires>${expires}</expires>
      <area>
        <areaDesc>${xmlEscape(c.locationText)}</areaDesc>
${c.latitude != null && c.longitude != null
        ? `        <circle>${c.latitude},${c.longitude} 5.0</circle>\n`
        : ""}      </area>
    </info>
  </alert>`;
    }).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<alerts xmlns="urn:oasis:names:tc:emergency:cap:1.2">
${alertBlocks}
</alerts>`;

    response.setHeader("Content-Type", "application/cap+xml");
    response.setHeader("Content-Disposition", "attachment; filename=crises.cap");
    return response.status(200).send(xml);
  } catch (error) {
    console.error("CAP XML export failed:", error);
    return response.status(500).json({
      message: "Failed to generate CAP XML export",
      detail: "See server logs for details",
    });
  }
});

