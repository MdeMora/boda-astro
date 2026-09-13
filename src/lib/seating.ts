// Shared seating-plan data model and pure helpers.
//
// This module is imported by the planner UI (browser) and by server code, so
// it must stay dependency-free and must never read secrets or touch the DOM.

export type Attendance = "confirmed" | "pending" | "declined";
export type TableShape = "round" | "rectangular";

export interface PlannerGuest {
  id: string;
  name: string;
  attendance: Attendance;
  dietaryRestrictions: string;
  allergies: string;
  notes: string;
  isChild: boolean;
  group: string;
  tableId: string | null;
  /**
   * 0-based seat index at `tableId`. Optional: guests without one (older
   * backups, RSVP imports) take the first free seat when the table is drawn.
   */
  seat?: number;
}

export interface PlannerTable {
  id: string;
  name: string;
  capacity: number;
  shape: TableShape;
  position?: { x: number; y: number };
}

export interface SeatingPlan {
  version: 1;
  name: string;
  guests: PlannerGuest[];
  tables: PlannerTable[];
}

export const DEFAULT_PLAN_NAME = "Plan de seating";

export const ATTENDANCE_VALUES: readonly Attendance[] = [
  "confirmed",
  "pending",
  "declined",
];
export const TABLE_SHAPES: readonly TableShape[] = ["round", "rectangular"];

export class SeatingPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeatingPlanError";
  }
}

function fail(message: string): never {
  throw new SeatingPlanError(message);
}

export function emptyPlan(): SeatingPlan {
  return { version: 1, name: DEFAULT_PLAN_NAME, guests: [], tables: [] };
}

/** Maps any loose attendance value to a valid one; unknown/empty values become "pending". */
export function normalizeAttendance(value: unknown): Attendance {
  const normalized =
    typeof value === "string" ? value.trim().toLowerCase() : "";
  return (ATTENDANCE_VALUES as readonly string[]).includes(normalized)
    ? (normalized as Attendance)
    : "pending";
}

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

const MAX_REPORTED_ERRORS = 20;

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${path}: expected an object, got ${describe(value)}`);
  }
  return value as Record<string, unknown>;
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  return typeof value;
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function optionalText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : "";
}

function isIntegerAtLeast(value: unknown, min: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min;
}

/**
 * Parses untrusted input (localStorage JSON, imported backups) into a
 * {@link SeatingPlan}. Throws {@link SeatingPlanError} with one descriptive
 * message per problem found (up to a limit).
 *
 * Normalizations applied while parsing:
 * - `null` for optional text fields (`dietaryRestrictions`, `allergies`,
 *   `notes`, `group`) becomes `""`.
 * - Attendance values are trimmed and lowercased.
 * - Declined guests always end up unassigned (`tableId: null`).
 *
 * Everything else that cannot be auto-repaired (bad types, duplicate IDs,
 * references to unknown tables, tables seated beyond capacity) is collected
 * and reported in a single descriptive error.
 */
export function parsePlan(input: unknown): SeatingPlan {
  const rec = asRecord(input, "plan");
  const errors: string[] = [];

  if (rec.version !== 1) {
    errors.push(
      `plan.version: expected 1, got ${
        typeof rec.version === "string" || typeof rec.version === "number"
          ? JSON.stringify(rec.version)
          : describe(rec.version)
      }`,
    );
  }

  let name = DEFAULT_PLAN_NAME;
  if (rec.name !== undefined && rec.name !== null) {
    if (typeof rec.name !== "string")
      errors.push("plan.name: expected a string");
    else name = rec.name;
  }

  const tables: PlannerTable[] = [];
  if (!Array.isArray(rec.tables)) {
    errors.push(`plan.tables: expected an array, got ${describe(rec.tables)}`);
  } else {
    const seenTableIds = new Set<string>();
    rec.tables.forEach((raw, index) => {
      const path = `plan.tables[${index}]`;
      const value = asRecord(raw, path);
      const id = nonEmptyString(value.id);
      if (id === undefined) {
        errors.push(`${path}.id: expected a non-empty string`);
      } else if (seenTableIds.has(id)) {
        errors.push(`${path}.id: duplicate table id "${id}"`);
      }

      const tableName = nonEmptyString(value.name);
      if (tableName === undefined) {
        errors.push(`${path}.name: expected a non-empty string`);
      }

      const capacity = value.capacity;
      if (!isIntegerAtLeast(capacity, 1)) {
        errors.push(
          `${path}.capacity: expected a positive integer, got ${JSON.stringify(capacity)}`,
        );
      }

      const shape = value.shape;
      if (
        typeof shape !== "string" ||
        !(TABLE_SHAPES as readonly string[]).includes(shape)
      ) {
        errors.push(
          `${path}.shape: expected one of ${TABLE_SHAPES.join(", ")}, got ${JSON.stringify(shape)}`,
        );
      }

      if (id === undefined || seenTableIds.has(id)) return;
      if (tableName === undefined || !isIntegerAtLeast(capacity, 1)) return;
      if (
        typeof shape !== "string" ||
        !(TABLE_SHAPES as readonly string[]).includes(shape)
      )
        return;
      let position: PlannerTable["position"];
      if (value.position !== undefined) {
        const pos = asRecord(value.position, `${path}.position`);
        if (
          typeof pos.x !== "number" ||
          !Number.isFinite(pos.x) ||
          pos.x < 0 ||
          pos.x > 10000 ||
          typeof pos.y !== "number" ||
          !Number.isFinite(pos.y) ||
          pos.y < 0 ||
          pos.y > 10000
        ) {
          errors.push(
            `${path}.position: expected finite coordinates between 0 and 10000`,
          );
        } else position = { x: pos.x, y: pos.y };
      }
      seenTableIds.add(id);
      tables.push({
        id,
        name: tableName,
        capacity,
        shape: shape as TableShape,
        ...(position ? { position } : {}),
      });
    });
  }

  const guests: PlannerGuest[] = [];
  if (!Array.isArray(rec.guests)) {
    errors.push(`plan.guests: expected an array, got ${describe(rec.guests)}`);
  } else {
    const seenGuestIds = new Set<string>();
    rec.guests.forEach((raw, index) => {
      const path = `plan.guests[${index}]`;
      const value = asRecord(raw, path);
      const id = nonEmptyString(value.id);
      if (id === undefined) {
        errors.push(`${path}.id: expected a non-empty string`);
      } else if (seenGuestIds.has(id)) {
        errors.push(`${path}.id: duplicate guest id "${id}"`);
      }

      const guestName = nonEmptyString(value.name);
      if (guestName === undefined) {
        errors.push(`${path}.name: expected a non-empty string`);
      }

      const attendance = normalizeAttendance(value.attendance);
      if (
        typeof value.attendance !== "string" ||
        value.attendance.trim().toLowerCase() !== attendance
      ) {
        errors.push(
          `${path}.attendance: expected one of ${ATTENDANCE_VALUES.join(", ")}, got ${JSON.stringify(value.attendance)}`,
        );
      }

      if (value.isChild !== true && value.isChild !== false) {
        errors.push(
          `${path}.isChild: expected a boolean, got ${describe(value.isChild)}`,
        );
      }

      let tableId: string | null = null;
      if (value.tableId !== null && value.tableId !== undefined) {
        const parsedTableId = nonEmptyString(value.tableId);
        if (parsedTableId === undefined) {
          errors.push(`${path}.tableId: expected a string or null`);
        } else {
          tableId = parsedTableId;
        }
      }
      if (attendance === "declined") tableId = null;

      let seat: number | undefined;
      if (value.seat !== undefined && value.seat !== null) {
        if (!isIntegerAtLeast(value.seat, 0)) {
          errors.push(
            `${path}.seat: expected a non-negative integer, got ${JSON.stringify(value.seat)}`,
          );
        } else if (tableId !== null) {
          seat = value.seat;
        }
      }

      if (id === undefined || seenGuestIds.has(id)) return;
      if (guestName === undefined) return;
      if (value.isChild !== true && value.isChild !== false) return;
      seenGuestIds.add(id);
      guests.push({
        id,
        name: guestName,
        attendance,
        dietaryRestrictions: optionalText(value.dietaryRestrictions),
        allergies: optionalText(value.allergies),
        notes: optionalText(value.notes),
        isChild: value.isChild === true,
        group: optionalText(value.group),
        tableId,
        ...(seat !== undefined ? { seat } : {}),
      });
    });
  }

  // Reference + capacity invariants.
  const tableIds = new Set(tables.map((t) => t.id));
  const seated = new Map<string, number>();
  guests.forEach((guest, index) => {
    if (guest.tableId === null) return;
    if (!tableIds.has(guest.tableId)) {
      errors.push(
        `plan.guests[${index}].tableId: guest "${guest.id}" references unknown table "${guest.tableId}"`,
      );
      return;
    }
    seated.set(guest.tableId, (seated.get(guest.tableId) ?? 0) + 1);
  });
  for (const table of tables) {
    const occupied = seated.get(table.id) ?? 0;
    if (occupied > table.capacity) {
      errors.push(
        `plan: table "${table.name}" (${table.id}) seats ${occupied} guests but has capacity ${table.capacity}`,
      );
    }
  }

  if (errors.length > 0) {
    const reported = errors.slice(0, MAX_REPORTED_ERRORS);
    const extra = errors.length - reported.length;
    fail(
      `Invalid seating plan:\n- ${reported.join("\n- ")}` +
        (extra > 0 ? `\n- ...and ${extra} more problem(s)` : ""),
    );
  }

  return { version: 1, name, guests, tables };
}

/* ------------------------------------------------------------------ */
/* Mutations (all immutable — they never change the input plan)        */
/* ------------------------------------------------------------------ */

function occupancyOf(
  plan: SeatingPlan,
  tableId: string,
  exceptGuestId?: string,
): number {
  return plan.guests.filter(
    (g) => g.tableId === tableId && g.id !== exceptGuestId,
  ).length;
}

/**
 * Resolves who sits where at `table`, one entry per seat (`null` = free).
 * Guests with a valid, unique `seat` keep it; everyone else (older backups,
 * collisions, seats beyond the current capacity) fills the first free seats
 * in plan order. If more guests are seated than the capacity allows, the
 * extra ones are appended after the last seat so nobody disappears.
 */
export function tableSeats(
  guests: readonly PlannerGuest[],
  table: PlannerTable,
): (PlannerGuest | null)[] {
  const seats: (PlannerGuest | null)[] = Array.from(
    { length: table.capacity },
    () => null,
  );
  const unplaced: PlannerGuest[] = [];
  for (const guest of guests) {
    if (guest.tableId !== table.id) continue;
    const seat = guest.seat;
    if (seat !== undefined && seat < table.capacity && seats[seat] === null) {
      seats[seat] = guest;
    } else {
      unplaced.push(guest);
    }
  }
  for (const guest of unplaced) {
    const free = seats.indexOf(null);
    if (free === -1) seats.push(guest);
    else seats[free] = guest;
  }
  return seats;
}

function unseated(guest: PlannerGuest): PlannerGuest {
  const next: PlannerGuest = { ...guest, tableId: null };
  delete next.seat;
  return next;
}

/**
 * Pins the resolved seat of every guest at the given tables, so that moving
 * one guest never shuffles neighbours who still lacked an explicit `seat`.
 */
function pinSeats(plan: SeatingPlan, tableIds: Iterable<string>): SeatingPlan {
  const pinned = new Map<string, number>();
  for (const tableId of new Set(tableIds)) {
    const table = plan.tables.find((t) => t.id === tableId);
    if (!table) continue;
    tableSeats(plan.guests, table).forEach((guest, index) => {
      if (guest) pinned.set(guest.id, index);
    });
  }
  if (pinned.size === 0) return plan;
  return {
    ...plan,
    guests: plan.guests.map((g) => {
      const seat = pinned.get(g.id);
      return seat === undefined || g.seat === seat ? g : { ...g, seat };
    }),
  };
}

function requireSeatable(
  plan: SeatingPlan,
  guestId: string,
  tableId: string,
): { guest: PlannerGuest; table: PlannerTable } {
  const guest = plan.guests.find((g) => g.id === guestId);
  if (!guest) fail(`Guest not found: "${guestId}"`);
  const table = plan.tables.find((t) => t.id === tableId);
  if (!table) fail(`Table not found: "${tableId}"`);
  if (guest.attendance === "declined") {
    fail(`"${guest.name}" declined the invitation and cannot be seated`);
  }
  return { guest, table };
}

function failFull(table: PlannerTable): never {
  fail(
    `Table "${table.name}" is full (${table.capacity}/${table.capacity} seats); unassign someone first`,
  );
}

/**
 * Seats `guestId` at `tableId` (first free seat), or unassigns them when
 * `tableId` is null. Rejects (throws) declined guests, unknown guests/tables
 * and full tables. Re-assigning a guest to the table they already occupy is
 * always allowed and keeps their seat.
 */
export function assignGuest(
  plan: SeatingPlan,
  guestId: string,
  tableId: string | null,
): SeatingPlan {
  if (tableId === null) {
    const guest = plan.guests.find((g) => g.id === guestId);
    if (!guest) fail(`Guest not found: "${guestId}"`);
    return {
      ...plan,
      guests: plan.guests.map((g) => (g.id === guestId ? unseated(g) : g)),
    };
  }

  const { guest, table } = requireSeatable(plan, guestId, tableId);
  if (guest.tableId === tableId) return plan;
  if (occupancyOf(plan, tableId, guestId) >= table.capacity) failFull(table);

  const others = plan.guests.filter((g) => g.id !== guestId);
  const seat = tableSeats(others, table).indexOf(null);
  return {
    ...plan,
    guests: plan.guests.map((g) =>
      g.id === guestId ? { ...g, tableId, ...(seat >= 0 ? { seat } : {}) } : g,
    ),
  };
}

/**
 * Seats `guestId` at a specific seat of `tableId` (same or different table).
 * When that seat is taken, the occupant swaps into the mover's previous seat;
 * if the mover had no table yet, the occupant slides to the first free seat
 * of the same table instead (so the table must have room). Rejects the same
 * cases as {@link assignGuest} plus seats outside the table's capacity.
 */
export function seatGuest(
  plan: SeatingPlan,
  guestId: string,
  tableId: string,
  seat: number,
): SeatingPlan {
  const { guest, table } = requireSeatable(plan, guestId, tableId);
  if (!Number.isInteger(seat) || seat < 0 || seat >= table.capacity) {
    fail(`Seat ${seat + 1} does not exist at table "${table.name}"`);
  }

  const affected = [tableId, ...(guest.tableId ? [guest.tableId] : [])];
  const pinned = pinSeats(plan, affected);
  const mover = pinned.guests.find((g) => g.id === guestId)!;
  const seats = tableSeats(pinned.guests, table);
  const occupant = seats[seat];
  if (occupant?.id === guestId) return pinned;

  const arriving = mover.tableId !== tableId;
  if (arriving && !occupant && occupancyOf(pinned, tableId) >= table.capacity) {
    failFull(table);
  }
  if (occupant && mover.tableId === null) {
    const free = seats.indexOf(null);
    if (free === -1) failFull(table);
    return place(pinned, mover, tableId, seat, occupant, tableId, free);
  }
  if (occupant) {
    return place(
      pinned,
      mover,
      tableId,
      seat,
      occupant,
      mover.tableId!,
      mover.seat,
    );
  }
  return place(pinned, mover, tableId, seat);
}

function place(
  plan: SeatingPlan,
  mover: PlannerGuest,
  tableId: string,
  seat: number,
  occupant?: PlannerGuest,
  occupantTable?: string,
  occupantSeat?: number,
): SeatingPlan {
  return {
    ...plan,
    guests: plan.guests.map((g) => {
      if (g.id === mover.id) return { ...g, tableId, seat };
      if (occupant && g.id === occupant.id) {
        return {
          ...g,
          tableId: occupantTable ?? null,
          ...(occupantSeat !== undefined ? { seat: occupantSeat } : {}),
        };
      }
      return g;
    }),
  };
}

/**
 * Merges an incoming guest list (from the RSVP API or a guest CSV) into the
 * plan:
 * - Guests matched by `id` keep their local seating (unless the incoming
 *   attendance is "declined", which clears the seat) and their locally edited
 *   details (`dietaryRestrictions`, `allergies`, `notes`) — but blank local
 *   details adopt the incoming values. RSVP metadata (`name`, `attendance`,
 *   `group`, `isChild`) is refreshed from the incoming list.
 * - Manual guests (ids not present in the incoming list) are kept untouched.
 * - Brand-new guests are appended with `tableId: null` unless the incoming
 *   `tableId` references an existing table with room for them.
 *
 * The input plan and the incoming guests are never mutated. If the incoming
 * list contains duplicate ids, the first occurrence wins.
 */
export function mergeGuests(
  plan: SeatingPlan,
  incoming: PlannerGuest[],
): SeatingPlan {
  const firstIncomingById = new Map<string, PlannerGuest>();
  for (const guest of incoming) {
    if (!firstIncomingById.has(guest.id))
      firstIncomingById.set(guest.id, guest);
  }

  const mergedGuests: PlannerGuest[] = [];
  const mergeOne = (
    local: PlannerGuest | undefined,
    next: PlannerGuest,
  ): PlannerGuest => {
    if (!local) {
      // Brand-new guest: only seat them when the provided seat is valid.
      const attendance = normalizeAttendance(next.attendance);
      const tableId =
        next.tableId !== null &&
        attendance !== "declined" &&
        hasRoom(plan, mergedGuests, next.tableId, next.id)
          ? next.tableId
          : null;
      return { ...next, tableId };
    }
    const attendance = normalizeAttendance(next.attendance);
    const merged: PlannerGuest = {
      ...next,
      attendance,
      dietaryRestrictions:
        local.dietaryRestrictions || next.dietaryRestrictions,
      allergies: local.allergies || next.allergies,
      notes: local.notes || next.notes,
      tableId: attendance === "declined" ? null : local.tableId,
    };
    delete merged.seat;
    if (merged.tableId !== null && local.seat !== undefined)
      merged.seat = local.seat;
    return merged;
  };

  const handled = new Set<string>();
  for (const local of plan.guests) {
    const next = firstIncomingById.get(local.id);
    handled.add(local.id);
    mergedGuests.push(next ? mergeOne(local, next) : local);
  }
  for (const [id, next] of firstIncomingById) {
    if (handled.has(id)) continue;
    mergedGuests.push(mergeOne(undefined, next));
  }

  return { ...plan, guests: mergedGuests };
}

function hasRoom(
  plan: SeatingPlan,
  extraGuests: PlannerGuest[],
  tableId: string,
  guestId: string,
): boolean {
  const table = plan.tables.find((t) => t.id === tableId);
  if (!table) return false;
  const occupied =
    plan.guests.filter((g) => g.tableId === tableId && g.id !== guestId)
      .length +
    extraGuests.filter((g) => g.tableId === tableId && g.id !== guestId).length;
  return occupied < table.capacity;
}

/* ------------------------------------------------------------------ */
/* CSV export / import                                                 */
/* ------------------------------------------------------------------ */

/**
 * Characters that spreadsheet applications (Excel, Numbers, Sheets) may
 * interpret as formulas. Cells starting with one of these get prefixed with a
 * single quote so they are imported as plain text (OWASP CSV injection
 * mitigation).
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function escapeCsvField(value: string): string {
  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const SEATING_CSV_HEADER = [
  "table",
  "guest",
  "attendance",
  "dietaryRestrictions",
  "allergies",
  "notes",
  "isChild",
  "group",
  "guestId",
] as const;

function guestRow(plan: SeatingPlan, guest: PlannerGuest): string[] {
  const table = guest.tableId
    ? plan.tables.find((t) => t.id === guest.tableId)
    : undefined;
  return [
    table?.name ?? "",
    guest.name,
    guest.attendance,
    guest.dietaryRestrictions,
    guest.allergies,
    guest.notes,
    guest.isChild ? "true" : "false",
    guest.group,
    guest.id,
  ];
}

/**
 * Exports the plan as CSV (RFC 4180: quoted fields, doubled quotes, CRLF line
 * endings) with spreadsheet formula safety. Rows are ordered by table name,
 * then guest name; unassigned guests come last.
 */
export function planToCsv(plan: SeatingPlan): string {
  const rows: string[][] = [SEATING_CSV_HEADER.slice()];

  const seated = plan.guests
    .filter((g) => g.tableId !== null)
    .map((guest) => {
      const table = plan.tables.find((t) => t.id === guest.tableId);
      return {
        guest,
        sortKey: `${table?.name ?? ""}\u0000${guest.name}`.toLowerCase(),
      };
    })
    .sort((a, b) =>
      a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0,
    )
    .map(({ guest }) => guestRow(plan, guest));

  const unassigned = plan.guests
    .filter((g) => g.tableId === null)
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .map((guest) => guestRow(plan, guest));

  rows.push(...seated, ...unassigned);
  return `${rows.map((row) => row.map(escapeCsvField).join(",")).join("\r\n")}\r\n`;
}

/* ------------------------------------------------------------------ */
/* Guest CSV import                                                    */
/* ------------------------------------------------------------------ */

const GUEST_CSV_HEADER = [
  "name",
  "group",
  "attendance",
  "dietaryRestrictions",
  "allergies",
  "notes",
  "isChild",
] as const;

const TRUE_VALUES = new Set(["true", "1", "yes", "si", "sí"]);
const FALSE_VALUES = new Set(["false", "0", "no"]);

/** Minimal RFC 4180 tokenizer: quoted fields, doubled quotes, CRLF/LF rows. */
function tokenizeCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let index = 0;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (index < text.length) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
        } else {
          inQuotes = false;
          index += 1;
        }
      } else {
        field += char;
        index += 1;
      }
      continue;
    }
    if (char === '"' && field === "") {
      inQuotes = true;
      index += 1;
      continue;
    }
    if (char === ",") {
      pushField();
      index += 1;
      continue;
    }
    if (char === "\r" || char === "\n") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      pushRow();
      index += 1;
      continue;
    }
    field += char;
    index += 1;
  }

  if (inQuotes) fail('CSV: unclosed quoted field (missing closing ")');
  if (field !== "" || row.length > 0) pushRow();
  return rows;
}

function slugifyId(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseIsChild(rawValue: string | undefined, path: string): boolean {
  const value = (rawValue ?? "").trim().toLowerCase();
  if (value === "") return false;
  if (TRUE_VALUES.has(value)) return true;
  if (FALSE_VALUES.has(value)) return false;
  fail(
    `${path}.isChild: expected true or false (accepted: ${[...TRUE_VALUES, ...FALSE_VALUES].join(", ")}), got "${value}"`,
  );
}

/**
 * Parses a guest CSV with the header `name,group,attendance,dietaryRestrictions,
 * allergies,notes,isChild` (only `name` is required; extra known columns may be
 * omitted). Supports quoted fields containing commas/newlines/escaped quotes,
 * BOM and CRLF. Throws a single {@link SeatingPlanError} listing every problem
 * with its row number.
 *
 * Guest ids are derived from the name (`csv:<slug>`), so re-importing the same
 * person merges into the same guest instead of creating duplicates.
 */
export function parseGuestCsv(text: string): PlannerGuest[] {
  const cleaned = text.replace(/^\uFEFF/, "");
  const rows = tokenizeCsv(cleaned);
  if (rows.length === 0) fail("CSV: the file is empty, expected a header row");

  const canonicalByLower = new Map(
    (GUEST_CSV_HEADER as readonly string[]).map((column) => [
      column.toLowerCase(),
      column,
    ]),
  );
  const header = rows[0].map((cellValue) => cellValue.trim().toLowerCase());
  const missing = ["name"].filter((required) => !header.includes(required));
  if (missing.length > 0) {
    fail(
      `CSV: missing required header column(s): ${missing.join(", ")}. Expected header: ${GUEST_CSV_HEADER.join(", ")}`,
    );
  }
  const unknown = header.filter(
    (cellValue) => !canonicalByLower.has(cellValue),
  );
  if (unknown.length > 0) {
    fail(
      `CSV: unknown header column(s): ${unknown.join(", ")}. Expected header: ${GUEST_CSV_HEADER.join(", ")}`,
    );
  }

  const columnIndex = new Map<string, number>();
  header.forEach((cellValue, index) => {
    const canonical = canonicalByLower.get(cellValue);
    if (canonical) columnIndex.set(canonical, index);
  });
  const cell = (row: string[], column: string): string => {
    const index = columnIndex.get(column) ?? -1;
    return index >= 0 ? (row[index] ?? "").trim() : "";
  };

  const errors: string[] = [];
  const guests: PlannerGuest[] = [];
  const nameCounts = new Map<string, number>();

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const rowNumber = rowIndex + 1; // 1-based, counting the header as row 1
    const path = `CSV row ${rowNumber}`;
    if (row.every((value) => value.trim() === "")) continue;

    const name = cell(row, "name");
    if (name === "") {
      errors.push(`${path}: "name" is required`);
      continue;
    }

    const attendanceRaw = cell(row, "attendance");
    let attendance: Attendance = "pending";
    if (attendanceRaw !== "") {
      const candidate = attendanceRaw.toLowerCase();
      if ((ATTENDANCE_VALUES as readonly string[]).includes(candidate)) {
        attendance = candidate as Attendance;
      } else {
        errors.push(
          `${path}.attendance: expected one of ${ATTENDANCE_VALUES.join(", ")}, got "${attendanceRaw}"`,
        );
      }
    }

    let isChild = false;
    try {
      isChild = parseIsChild(cell(row, "isChild"), path);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    const base = slugifyId(name);
    const occurrence = (nameCounts.get(base) ?? 0) + 1;
    nameCounts.set(base, occurrence);
    const id = occurrence === 1 ? `csv:${base}` : `csv:${base}-${occurrence}`;

    guests.push({
      id,
      name,
      attendance,
      dietaryRestrictions: cell(row, "dietaryRestrictions"),
      allergies: cell(row, "allergies"),
      notes: cell(row, "notes"),
      isChild,
      group: cell(row, "group"),
      tableId: null,
    });
  }

  if (errors.length > 0) {
    const reported = errors.slice(0, MAX_REPORTED_ERRORS);
    const extra = errors.length - reported.length;
    fail(
      `Invalid guest CSV:\n- ${reported.join("\n- ")}` +
        (extra > 0 ? `\n- ...and ${extra} more problem(s)` : ""),
    );
  }

  return guests;
}
