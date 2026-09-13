import {
  fail,
  normalizeAttendance,
  type PlannerGuest,
  type PlannerTable,
  type SeatingPlan,
} from "./types";

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
  if (!guest) fail(`Invitado no encontrado: "${guestId}"`);
  const table = plan.tables.find((t) => t.id === tableId);
  if (!table) fail(`Mesa no encontrada: "${tableId}"`);
  if (guest.attendance === "declined") {
    fail(`«${guest.name}» no puede sentarse porque declinó la invitación.`);
  }
  return { guest, table };
}

function failFull(table: PlannerTable): never {
  fail(
    `«${table.name}» está completa; libera una plaza antes de sentar a alguien.`,
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
    if (!guest) fail(`Invitado no encontrado: "${guestId}"`);
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
    fail(`«${table.name}» no tiene un asiento ${seat + 1}.`);
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

/**
 * Creates or replaces a table by `table.id`. Other plan fields are unchanged.
 */
export function upsertTable(
  plan: SeatingPlan,
  table: PlannerTable,
): SeatingPlan {
  const exists = plan.tables.some((candidate) => candidate.id === table.id);
  return {
    ...plan,
    tables: exists
      ? plan.tables.map((candidate) =>
          candidate.id === table.id ? table : candidate,
        )
      : [...plan.tables, table],
  };
}

/**
 * Removes a table and unseats every guest who was at it via {@link unseated}.
 */
export function deleteTable(plan: SeatingPlan, tableId: string): SeatingPlan {
  return {
    ...plan,
    tables: plan.tables.filter((candidate) => candidate.id !== tableId),
    guests: plan.guests.map((guest) =>
      guest.tableId === tableId ? unseated(guest) : guest,
    ),
  };
}

/**
 * Creates or replaces a guest by `guest.id`. When `attendance` is
 * `"declined"`, seating is always cleared with {@link unseated}.
 */
export function upsertGuest(
  plan: SeatingPlan,
  guest: PlannerGuest,
): SeatingPlan {
  const stored =
    guest.attendance === "declined" ? unseated(guest) : guest;
  const exists = plan.guests.some((candidate) => candidate.id === guest.id);
  return {
    ...plan,
    guests: exists
      ? plan.guests.map((candidate) =>
          candidate.id === guest.id ? stored : candidate,
        )
      : [...plan.guests, stored],
  };
}

/** Removes a guest from the plan entirely (their seat, if any, becomes free). */
export function deleteGuest(plan: SeatingPlan, guestId: string): SeatingPlan {
  return {
    ...plan,
    guests: plan.guests.filter((candidate) => candidate.id !== guestId),
  };
}
