import {
  ATTENDANCE_VALUES,
  DEFAULT_PLAN_NAME,
  TABLE_SHAPES,
  fail,
  normalizeAttendance,
  MAX_REPORTED_ERRORS,
  type PlannerGuest,
  type PlannerTable,
  type SeatingPlan,
  type TableShape,
} from "./types";

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
      `El plan no es válido:\n- ${reported.join("\n- ")}` +
        (extra > 0 ? `\n- …y ${extra} problema(s) más` : ""),
    );
  }

  return { version: 1, name, guests, tables };
}
