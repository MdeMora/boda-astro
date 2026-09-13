// GET /api/internal/guests — read-only export of the existing RSVP guest list
// for the seating planner.
//
// This endpoint never mutates the database and never serves fake data: if the
// Turso connection is not configured it returns a descriptive 503. The DB
// client is imported lazily so that building the site (or running in an
// environment without database config) never fails at module-evaluation time.
// Auth for /api/internal/* is enforced by src/middleware.ts.
import type { APIRoute } from "astro";
import { normalizeAttendance, type PlannerGuest } from "@/lib/seating";

export const prerender = false;

const PRIVATE_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ["Cache-Control", "no-store"],
  ["X-Robots-Tag", "noindex"],
  ["Referrer-Policy", "no-referrer"],
];

function jsonResponse(status: number, payload: unknown): Response {
  const response = new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
  for (const [name, value] of PRIVATE_HEADERS)
    response.headers.set(name, value);
  return response;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface DbConfig {
  url: string;
  authToken: string | undefined;
}

export function readDbConfig(): DbConfig | undefined {
  const importMetaEnv = import.meta.env as unknown as
    | Record<string, unknown>
    | undefined;
  const processEnv = typeof process !== "undefined" ? process.env : undefined;
  const url =
    importMetaEnv?.TURSO_DATABASE_URL ?? processEnv?.TURSO_DATABASE_URL;
  const authToken =
    importMetaEnv?.TURSO_AUTH_TOKEN ?? processEnv?.TURSO_AUTH_TOKEN;
  if (typeof url !== "string" || url.trim() === "") return undefined;
  return {
    url,
    authToken:
      typeof authToken === "string" && authToken.trim() !== ""
        ? authToken
        : undefined,
  };
}

/** Minimal structural shape of a row from the existing `guests` table. */
export interface GuestRow {
  id: number;
  name: string;
  attendance: string | null;
  dietaryRestrictions: string | null;
  allergies: string | null;
  notes: string | null;
  isChild: boolean | null;
  parentId: number | null;
}

export function groupFor(
  row: Pick<GuestRow, "parentId" | "name">,
  nameById: Map<number, string>,
): string {
  if (row.parentId === null) return row.name;
  return nameById.get(row.parentId) ?? row.name;
}

/**
 * Maps database rows onto the planner data model: numeric ids become
 * `rsvp:<id>`, nulls are normalized and a guest's group is their parent's
 * name (companions) or their own name.
 */
export function toPlannerGuests(rows: GuestRow[]): PlannerGuest[] {
  const nameById = new Map(rows.map((row) => [row.id, row.name]));
  return rows.map((row) => ({
    id: `rsvp:${row.id}`,
    name: row.name,
    attendance: normalizeAttendance(row.attendance),
    dietaryRestrictions: row.dietaryRestrictions ?? "omnivore",
    allergies: row.allergies ?? "",
    notes: row.notes ?? "",
    isChild: row.isChild ?? false,
    group: groupFor(row, nameById),
    tableId: null,
  }));
}

export const GET: APIRoute = async () => {
  const config = readDbConfig();
  if (!config) {
    return jsonResponse(503, {
      error: "Database not configured",
      hint: "Set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN for remote Turso databases) in the environment. This endpoint reads the existing RSVP guest list; it does not provide sample data.",
    });
  }

  try {
    // Lazy imports keep `astro build` and dev sessions working without a DB.
    const [{ drizzle }, { createClient }, { guests }] = await Promise.all([
      import("drizzle-orm/libsql"),
      import("@libsql/client"),
      import("@/db/schema"),
    ]);
    const client = createClient({
      url: config.url,
      authToken: config.authToken,
    });
    const db = drizzle(client);
    const rows = await db.select().from(guests).orderBy(guests.id);

    return jsonResponse(200, { guests: toPlannerGuests(rows) });
  } catch (error) {
    // Never echo the connection URL: it can embed credentials.
    const detail = errorMessage(error).replaceAll(config.url, "[redacted]");
    return jsonResponse(502, {
      error: "Failed to read guests from the database",
      detail,
    });
  }
};
