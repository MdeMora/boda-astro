import { describe, expect, test } from "bun:test";
import {
  assignGuest,
  deleteGuest,
  deleteTable,
  emptyPlan,
  mergeGuests,
  parseGuestCsv,
  parsePlan,
  planToCsv,
  seatGuest,
  tableSeats,
  upsertGuest,
  upsertTable,
  type PlannerGuest,
  type PlannerTable,
  type SeatingPlan,
  SeatingPlanError,
} from "./seating";

const table = (
  id: string,
  name: string,
  capacity: number,
  shape: PlannerTable["shape"] = "round",
): PlannerTable => ({
  id,
  name,
  capacity,
  shape,
});

const guest = (
  overrides: Partial<PlannerGuest> & { id: string },
): PlannerGuest => ({
  name: overrides.id,
  attendance: "confirmed",
  dietaryRestrictions: "",
  allergies: "",
  notes: "",
  isChild: false,
  group: "",
  tableId: null,
  ...overrides,
});

const basePlan = (): SeatingPlan => ({
  version: 1,
  name: "Boda",
  tables: [table("t1", "Mesa 1", 2), table("t2", "Mesa 2", 1)],
  guests: [
    guest({ id: "g1", name: "Ana", tableId: "t1" }),
    guest({ id: "g2", name: "Bo", tableId: "t1" }),
    guest({ id: "g3", name: "Cyr", tableId: null }),
  ],
});

const expectSeatingError = (fn: () => unknown, pattern: RegExp | string) => {
  let message = "";
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(SeatingPlanError);
    message = error instanceof Error ? error.message : "";
  }
  expect(message).toBeTruthy();
  if (typeof pattern === "string") {
    expect(message).toContain(pattern);
  } else {
    expect(message).toMatch(pattern);
  }
};

describe("emptyPlan", () => {
  test("returns a v1 plan with no guests or tables", () => {
    const plan = emptyPlan();
    expect(plan.version).toBe(1);
    expect(plan.guests).toEqual([]);
    expect(plan.tables).toEqual([]);
    expect(plan.name.length).toBeGreaterThan(0);
  });

  test("returns independent instances", () => {
    const a = emptyPlan();
    const b = emptyPlan();
    a.guests.push(guest({ id: "x" }));
    a.tables.push(table("t", "T", 4));
    expect(b.guests).toHaveLength(0);
    expect(b.tables).toHaveLength(0);
  });
});

describe("parsePlan", () => {
  test("accepts a plain-JSON plan and produces deep-equal data", () => {
    const plan = basePlan();
    const parsed = parsePlan(JSON.parse(JSON.stringify(plan)));
    expect(parsed).toEqual(plan);
  });

  test("normalizes null optional text fields to empty strings", () => {
    const parsed = parsePlan({
      version: 1,
      name: null,
      tables: [{ id: "t1", name: "Mesa 1", capacity: 2, shape: "rectangular" }],
      guests: [
        {
          id: "g1",
          name: "Ana",
          attendance: "confirmed",
          dietaryRestrictions: null,
          allergies: null,
          notes: null,
          isChild: false,
          group: null,
          tableId: null,
        },
      ],
    });
    expect(parsed.name).toBe("Plan de seating");
    expect(parsed.guests[0]).toEqual({
      id: "g1",
      name: "Ana",
      attendance: "confirmed",
      dietaryRestrictions: "",
      allergies: "",
      notes: "",
      isChild: false,
      group: "",
      tableId: null,
    });
  });

  test("unseats declined guests and trims/lowercases attendance", () => {
    const parsed = parsePlan({
      version: 1,
      tables: [{ id: "t1", name: "Mesa 1", capacity: 2, shape: "round" }],
      guests: [
        {
          id: "g1",
          name: "Ana",
          attendance: " DECLINED ",
          isChild: false,
          tableId: "t1",
        },
        {
          id: "g2",
          name: "Bo",
          attendance: "CONFIRMED",
          isChild: false,
          tableId: "t1",
        },
      ],
    });
    expect(parsed.guests[0].tableId).toBeNull();
    expect(parsed.guests[0].attendance).toBe("declined");
    expect(parsed.guests[1].attendance).toBe("confirmed");
    expect(parsed.guests[1].tableId).toBe("t1");
  });

  test("builds fresh objects (input is not aliased)", () => {
    const input = JSON.parse(JSON.stringify(basePlan()));
    const parsed = parsePlan(input);
    parsed.guests[0].name = "MUTATED";
    parsed.tables[0].capacity = 99;
    expect(input.guests[0].name).toBe("Ana");
    expect(input.tables[0].capacity).toBe(2);
  });

  test("rejects wrong version", () => {
    expectSeatingError(
      () => parsePlan({ ...basePlan(), version: 2 }),
      /version.*2/,
    );
  });

  test("rejects non-object input", () => {
    expectSeatingError(() => parsePlan("nope"), /plan.*object/i);
    expectSeatingError(() => parsePlan([basePlan()]), /plan.*object/i);
    expectSeatingError(() => parsePlan(null), /plan.*object/i);
  });

  test("rejects non-array guests/tables", () => {
    expectSeatingError(
      () => parsePlan({ ...basePlan(), guests: {} }),
      /plan\.guests.*array/i,
    );
    expectSeatingError(
      () => parsePlan({ ...basePlan(), tables: "x" }),
      /plan\.tables.*array/i,
    );
  });

  test("reports duplicate guest and table ids", () => {
    const plan = basePlan();
    plan.guests.push(guest({ id: "g1", name: "Twin" }));
    expectSeatingError(() => parsePlan(plan), /duplicate guest id "g1"/);
    const plan2 = basePlan();
    plan2.tables.push(table("t1", "Mesa repetida", 4));
    expectSeatingError(() => parsePlan(plan2), /duplicate table id "t1"/);
  });

  test("rejects references to unknown tables", () => {
    const plan = basePlan();
    plan.guests.push(guest({ id: "g4", name: "Dana", tableId: "ghost" }));
    expectSeatingError(
      () => parsePlan(plan),
      /guest "g4" references unknown table "ghost"/,
    );
  });

  test("rejects tables seated beyond capacity", () => {
    const plan = basePlan();
    plan.tables = [table("t1", "Mesa pequeña", 1)];
    expectSeatingError(
      () => parsePlan(plan),
      /"Mesa pequeña".*seats 2 guests but has capacity 1/,
    );
  });

  test("rejects invalid capacity and shape values", () => {
    expectSeatingError(
      () => parsePlan({ ...basePlan(), tables: [table("t1", "Mesa", 0)] }),
      /capacity.*0/,
    );
    expectSeatingError(
      () => parsePlan({ ...basePlan(), tables: [table("t1", "Mesa", 1.5)] }),
      /capacity.*1\.5/,
    );
    expectSeatingError(
      () =>
        parsePlan({
          ...basePlan(),
          tables: [{ ...table("t1", "Mesa", 4), shape: "oval" }],
        }),
      /shape.*oval/,
    );
  });

  test("rejects invalid attendance and isChild types", () => {
    expectSeatingError(
      () =>
        parsePlan({
          ...basePlan(),
          guests: [guest({ id: "g1", attendance: "maybe" as never })],
        }),
      /attendance.*maybe/,
    );
    expectSeatingError(
      () =>
        parsePlan({
          ...basePlan(),
          guests: [{ ...guest({ id: "g1" }), isChild: "yes" as never }],
        }),
      /isChild.*boolean/,
    );
  });

  test("rejects empty ids and names with paths in the message", () => {
    expectSeatingError(
      () => parsePlan({ ...basePlan(), guests: [guest({ id: "  " })] }),
      /plan\.guests\[0\]\.id/,
    );
    expectSeatingError(
      () =>
        parsePlan({ ...basePlan(), guests: [guest({ id: "g9", name: "" })] }),
      /plan\.guests\[0\]\.name/,
    );
  });

  test("aggregates multiple problems into one error", () => {
    try {
      parsePlan({ version: 3, guests: [{ id: "", name: "" }] });
      throw new Error("expected parsePlan to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(SeatingPlanError);
      const message = error instanceof Error ? error.message : "";
      expect(message).toContain("plan.version");
      expect(message).toContain("plan.tables");
      expect(message).toContain("plan.guests[0].id");
      expect(message).toContain("plan.guests[0].name");
    }
  });
});

describe("assignGuest", () => {
  test("seats a guest and does not mutate the input plan", () => {
    const plan = basePlan();
    const next = assignGuest(plan, "g3", "t2");
    expect(next.guests.find((g) => g.id === "g3")?.tableId).toBe("t2");
    expect(plan.guests.find((g) => g.id === "g3")?.tableId).toBeNull();
  });

  test("unassigns with null", () => {
    const next = assignGuest(basePlan(), "g1", null);
    expect(next.guests.find((g) => g.id === "g1")?.tableId).toBeNull();
  });

  test("allows moving a guest off a full table to one with room", () => {
    // t1 is full (2/2); moving g1 to t2 (0/1) must work.
    const next = assignGuest(basePlan(), "g1", "t2");
    expect(next.guests.find((g) => g.id === "g1")?.tableId).toBe("t2");
  });

  test("re-assigning a guest to the table they already occupy is allowed", () => {
    const plan = basePlan(); // t1 full with g1+g2
    const next = assignGuest(plan, "g1", "t1");
    expect(next.guests.find((g) => g.id === "g1")?.tableId).toBe("t1");
  });

  test("rejects full tables", () => {
    expectSeatingError(
      () => assignGuest(basePlan(), "g3", "t1"),
      /«Mesa 1» está completa/,
    );
  });

  test("rejects declined guests", () => {
    const plan = basePlan();
    plan.guests.push(guest({ id: "g4", name: "Dana", attendance: "declined" }));
    expectSeatingError(() => assignGuest(plan, "g4", "t2"), /declinó/i);
  });

  test("allows unassigning a declined guest", () => {
    const plan = basePlan();
    plan.guests.push(
      guest({ id: "g4", name: "Dana", attendance: "declined", tableId: null }),
    );
    const next = assignGuest(plan, "g4", null);
    expect(next.guests.find((g) => g.id === "g4")?.tableId).toBeNull();
  });

  test("rejects unknown guests and tables", () => {
    expectSeatingError(
      () => assignGuest(basePlan(), "ghost", "t1"),
      /Invitado no encontrado: "ghost"/,
    );
    expectSeatingError(
      () => assignGuest(basePlan(), "g3", "ghost"),
      /Mesa no encontrada: "ghost"/,
    );
  });

  test("takes the first free seat and drops the seat when unassigning", () => {
    const plan = basePlan();
    plan.tables[1] = table("t2", "Mesa 2", 3);
    plan.guests.push(guest({ id: "g4", name: "Dana", tableId: "t2", seat: 0 }));
    const next = assignGuest(plan, "g3", "t2");
    expect(next.guests.find((g) => g.id === "g3")?.seat).toBe(1);
    const freed = assignGuest(next, "g3", null);
    expect("seat" in freed.guests.find((g) => g.id === "g3")!).toBe(false);
  });
});

const seatIds = (plan: SeatingPlan, tableId: string) =>
  tableSeats(plan.guests, plan.tables.find((t) => t.id === tableId)!).map(
    (g) => g?.id ?? null,
  );

describe("seat field round-trips", () => {
  test("parsePlan keeps valid seats, drops them for unseated guests, rejects bad types", () => {
    const plan = basePlan();
    plan.guests[0] = { ...plan.guests[0], seat: 1 };
    const parsed = parsePlan(JSON.parse(JSON.stringify(plan)));
    expect(parsed.guests[0].seat).toBe(1);
    expect("seat" in parsed.guests[2]).toBe(false);

    const stray = parsePlan({
      ...plan,
      guests: [{ ...plan.guests[2], seat: 4 }],
    });
    expect("seat" in stray.guests[0]).toBe(false);

    expectSeatingError(
      () => parsePlan({ ...plan, guests: [{ ...plan.guests[0], seat: -1 }] }),
      /guests\[0\]\.seat: expected a non-negative integer/,
    );
    expectSeatingError(
      () => parsePlan({ ...plan, guests: [{ ...plan.guests[0], seat: "2" }] }),
      /guests\[0\]\.seat/,
    );
  });

  test("mergeGuests preserves the local seat unless the guest declined", () => {
    const plan = basePlan();
    plan.guests[0] = { ...plan.guests[0], seat: 1 };
    const kept = mergeGuests(plan, [
      guest({ id: "g1", name: "Ana María", attendance: "confirmed" }),
    ]);
    expect(kept.guests[0]).toMatchObject({ name: "Ana María", seat: 1 });

    const declined = mergeGuests(plan, [
      guest({ id: "g1", name: "Ana", attendance: "declined" }),
    ]);
    expect(declined.guests[0].tableId).toBeNull();
    expect("seat" in declined.guests[0]).toBe(false);
  });
});

describe("tableSeats", () => {
  test("keeps explicit seats and fills the rest in plan order", () => {
    const plan: SeatingPlan = {
      ...basePlan(),
      tables: [table("t1", "Mesa 1", 4)],
      guests: [
        guest({ id: "a", tableId: "t1" }),
        guest({ id: "b", tableId: "t1", seat: 0 }),
        guest({ id: "c", tableId: "t1", seat: 3 }),
        guest({ id: "d", tableId: null }),
      ],
    };
    expect(seatIds(plan, "t1")).toEqual(["b", "a", null, "c"]);
  });

  test("resolves collisions and out-of-range seats without losing anyone", () => {
    const plan: SeatingPlan = {
      ...basePlan(),
      tables: [table("t1", "Mesa 1", 2)],
      guests: [
        guest({ id: "a", tableId: "t1", seat: 1 }),
        guest({ id: "b", tableId: "t1", seat: 1 }),
        guest({ id: "c", tableId: "t1", seat: 9 }),
      ],
    };
    expect(seatIds(plan, "t1")).toEqual(["b", "a", "c"]);
  });
});

describe("seatGuest", () => {
  const seatedPlan = (): SeatingPlan => ({
    version: 1,
    name: "Boda",
    tables: [table("t1", "Mesa 1", 3), table("t2", "Mesa 2", 2)],
    guests: [
      guest({ id: "a", tableId: "t1", seat: 0 }),
      guest({ id: "b", tableId: "t1", seat: 1 }),
      guest({ id: "c", tableId: "t2", seat: 0 }),
      guest({ id: "d", tableId: "t2", seat: 1 }),
      guest({ id: "e", tableId: null }),
    ],
  });

  test("moves to a free seat at the same table", () => {
    const next = seatGuest(seatedPlan(), "a", "t1", 2);
    expect(seatIds(next, "t1")).toEqual([null, "b", "a"]);
  });

  test("swaps with the occupant at the same table", () => {
    const next = seatGuest(seatedPlan(), "a", "t1", 1);
    expect(seatIds(next, "t1")).toEqual(["b", "a", null]);
  });

  test("swaps across tables, even when both are full", () => {
    const next = seatGuest(seatedPlan(), "a", "t2", 1);
    expect(seatIds(next, "t1")).toEqual(["d", "b", null]);
    expect(seatIds(next, "t2")).toEqual(["c", "a"]);
  });

  test("moves an unassigned guest onto a free seat", () => {
    const next = seatGuest(seatedPlan(), "e", "t1", 2);
    expect(seatIds(next, "t1")).toEqual(["a", "b", "e"]);
  });

  test("slides the occupant to a free seat when the mover had no table", () => {
    const next = seatGuest(seatedPlan(), "e", "t1", 0);
    expect(seatIds(next, "t1")).toEqual(["e", "b", "a"]);
  });

  test("rejects an unassigned guest taking an occupied seat at a full table", () => {
    expectSeatingError(
      () => seatGuest(seatedPlan(), "e", "t2", 0),
      /«Mesa 2» está completa/,
    );
  });

  test("pins neighbours without explicit seats before moving", () => {
    const plan = seatedPlan();
    plan.guests = plan.guests.map(({ seat: _seat, ...g }) => g);
    // a→0, b→1 by plan order; moving a to seat 2 must keep b at seat 1.
    const next = seatGuest(plan, "a", "t1", 2);
    expect(seatIds(next, "t1")).toEqual([null, "b", "a"]);
    expect(next.guests.find((g) => g.id === "b")?.seat).toBe(1);
  });

  test("rejects seats outside the capacity and declined guests", () => {
    expectSeatingError(
      () => seatGuest(seatedPlan(), "a", "t1", 3),
      /no tiene un asiento 4/,
    );
    const plan = seatedPlan();
    plan.guests.push(guest({ id: "z", attendance: "declined" }));
    expectSeatingError(() => seatGuest(plan, "z", "t1", 2), /declinó/);
  });

  test("does not mutate the input plan", () => {
    const plan = seatedPlan();
    const snapshot = JSON.stringify(plan);
    seatGuest(plan, "a", "t2", 1);
    expect(JSON.stringify(plan)).toBe(snapshot);
  });
});

describe("mergeGuests", () => {
  test("refreshes RSVP metadata while preserving local seating", () => {
    const plan = basePlan();
    const incoming = [
      guest({
        id: "g1",
        name: "Ana García",
        attendance: "pending",
        tableId: null,
      }),
      guest({ id: "g2", name: "Bo", attendance: "confirmed", tableId: null }),
    ];
    const merged = mergeGuests(plan, incoming);
    const g1 = merged.guests.find((g) => g.id === "g1");
    const g2 = merged.guests.find((g) => g.id === "g2");
    expect(g1).toMatchObject({
      name: "Ana García",
      attendance: "pending",
      tableId: "t1",
    });
    expect(g2).toMatchObject({ attendance: "confirmed", tableId: "t1" });
  });

  test("clears seating when incoming attendance is declined", () => {
    const merged = mergeGuests(basePlan(), [
      guest({ id: "g1", name: "Ana", attendance: "declined" }),
    ]);
    expect(merged.guests.find((g) => g.id === "g1")?.tableId).toBeNull();
  });

  test("keeps local details, but blank local details adopt incoming values", () => {
    const plan = basePlan();
    plan.guests[0].notes = "Hablar con la familia";
    plan.guests[1].allergies = "";
    const incoming = [
      guest({ id: "g1", name: "Ana", notes: "Nota del servidor" }),
      guest({ id: "g2", name: "Bo", allergies: "Frutos secos" }),
    ];
    const merged = mergeGuests(plan, incoming);
    expect(merged.guests[0].notes).toBe("Hablar con la familia");
    expect(merged.guests[1].allergies).toBe("Frutos secos");
  });

  test("keeps manual guests untouched", () => {
    const plan = basePlan();
    plan.guests.push(
      guest({ id: "manual-1", name: "Invitado a mano", tableId: "t2" }),
    );
    const merged = mergeGuests(plan, [guest({ id: "g1", name: "Ana" })]);
    const manual = merged.guests.find((g) => g.id === "manual-1");
    expect(manual).toEqual(
      guest({ id: "manual-1", name: "Invitado a mano", tableId: "t2" }),
    );
  });

  test("appends new guests with a null seat", () => {
    const merged = mergeGuests(basePlan(), [
      guest({ id: "rsvp:9", name: "Nuevo", tableId: null }),
    ]);
    expect(merged.guests.find((g) => g.id === "rsvp:9")).toMatchObject({
      name: "Nuevo",
      tableId: null,
    });
    // Plan order for existing guests is preserved, new guests appended at the end.
    expect(merged.guests.map((g) => g.id)).toEqual([
      "g1",
      "g2",
      "g3",
      "rsvp:9",
    ]);
  });

  test("seats a new guest only when their provided table has room", () => {
    const incoming = [
      guest({ id: "new-1", name: "Con sitio", tableId: "t2" }), // t2 empty, capacity 1 -> seated
      guest({ id: "new-2", name: "Sin sitio", tableId: "t1" }), // t1 full (2/2) -> unseated
      guest({ id: "new-3", name: "Ghost", tableId: "ghost" }), // unknown table -> unseated
      guest({
        id: "new-4",
        name: "Rechazado",
        attendance: "declined",
        tableId: "t2",
      }), // declined -> unseated
    ];
    const merged = mergeGuests(basePlan(), incoming);
    expect(merged.guests.find((g) => g.id === "new-1")?.tableId).toBe("t2");
    expect(merged.guests.find((g) => g.id === "new-2")?.tableId).toBeNull();
    expect(merged.guests.find((g) => g.id === "new-3")?.tableId).toBeNull();
    expect(merged.guests.find((g) => g.id === "new-4")?.tableId).toBeNull();
  });

  test("empty incoming list leaves the plan unchanged", () => {
    const plan = basePlan();
    expect(mergeGuests(plan, [])).toEqual(plan);
  });

  test("does not mutate the input plan", () => {
    const plan = basePlan();
    const snapshot = JSON.parse(JSON.stringify(plan));
    mergeGuests(plan, [
      guest({ id: "g1", name: "Cambiada", attendance: "declined" }),
    ]);
    expect(JSON.parse(JSON.stringify(plan))).toEqual(snapshot);
  });
});

describe("planToCsv", () => {
  test("writes the header and one row per guest, tables first then unassigned", () => {
    const plan = basePlan();
    plan.guests[2].name = "Zoe";
    const csv = planToCsv(plan);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "table,guest,attendance,dietaryRestrictions,allergies,notes,isChild,group,guestId",
    );
    // Mesa 1 (Ana, Bo) sorted by name, then unassigned Zoe.
    expect(lines[1]).toContain(",Ana,");
    expect(lines[2]).toContain(",Bo,");
    expect(lines[3]).toContain(",Zoe,");
    expect(lines[4]).toBe(""); // trailing CRLF
  });

  test("escapes commas, quotes and newlines", () => {
    const plan = basePlan();
    plan.guests[0].name = 'Ana "La Jefa", Jr';
    plan.guests[0].notes = "line1\nline2";
    const csv = planToCsv(plan);
    expect(csv).toContain('"Ana ""La Jefa"", Jr"');
    expect(csv).toContain('"line1\nline2"');
  });

  test("prefixes spreadsheet formula triggers with an apostrophe", () => {
    const plan = basePlan();
    plan.guests[0].notes = '=HYPERLINK("http://evil.example","pwned")';
    plan.guests[1].allergies = "+cmd";
    plan.guests[2].group = "-2)";
    const csv = planToCsv(plan);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+cmd");
    expect(csv).toContain("'-2)");
    expect(csv).not.toContain("\r\n=HYPERLINK");
  });

  test("marks children and includes the guest id", () => {
    const plan = basePlan();
    plan.guests[0].isChild = true;
    plan.guests[0].group = "Familia A";
    const csv = planToCsv(plan);
    expect(csv).toContain(",true,");
    expect(csv).toContain(",Familia A,g1");
  });
});

describe("parseGuestCsv", () => {
  test("parses the documented example file", async () => {
    const example = await Bun.file(
      new URL("../../docs/example-guests.csv", import.meta.url),
    ).text();
    const guests = parseGuestCsv(example);
    expect(guests).toHaveLength(6);
    expect(guests[0]).toMatchObject({
      name: "Invitada de ejemplo 1",
      group: "Familia A",
      attendance: "confirmed",
      dietaryRestrictions: "vegetarian",
      allergies: "Frutos secos",
      notes: "",
      isChild: false,
      tableId: null,
    });
    expect(guests[2].isChild).toBe(true);
    expect(guests[5].attendance).toBe("declined");
    expect(guests.every((g) => g.id.startsWith("csv:"))).toBe(true);
  });

  test("handles quoted commas, doubled quotes, embedded newlines, BOM and CRLF", () => {
    const csv =
      "\uFEFFname,group,attendance,dietaryRestrictions,allergies,notes,isChild\r\n" +
      '"Doe, Jane",Familia,confirmed,,,,false\r\n' +
      'Ana,Amigos,pending,,"Dijo ""no"" a frutos secos","nota\r\nmultilínea",false\r\n';
    const guests = parseGuestCsv(csv);
    expect(guests).toHaveLength(2);
    expect(guests[0].name).toBe("Doe, Jane");
    expect(guests[1].allergies).toBe('Dijo "no" a frutos secos');
    expect(guests[1].notes).toBe("nota\r\nmultilínea");
  });

  test("derives stable ids from names and suffixes duplicates", () => {
    const csv = [
      "name,group,attendance,dietaryRestrictions,allergies,notes,isChild",
      "María López,,confirmed,,,,false",
      "María López,,pending,,,,false",
    ].join("\n");
    const guests = parseGuestCsv(csv);
    expect(guests[0].id).toBe("csv:maria-lopez");
    expect(guests[1].id).toBe("csv:maria-lopez-2");
  });

  test("accepts case-insensitive attendance and flexible isChild values", () => {
    const csv = [
      "name,attendance,isChild",
      "A,CONFIRMED,true",
      "B,declined,0",
      "C,Pending,si",
      "D,,no",
    ].join("\n");
    const guests = parseGuestCsv(csv);
    expect(guests.map((g) => g.attendance)).toEqual([
      "confirmed",
      "declined",
      "pending",
      "pending",
    ]);
    expect(guests.map((g) => g.isChild)).toEqual([true, false, true, false]);
  });

  test("returns an empty list for a header-only file", () => {
    expect(
      parseGuestCsv(
        "name,group,attendance,dietaryRestrictions,allergies,notes,isChild\n",
      ),
    ).toEqual([]);
  });

  test("fails with a useful message when the name column is missing", () => {
    expectSeatingError(
      () => parseGuestCsv("nombre,group\nA,Familia"),
      /Faltan columnas obligatorias.*name/i,
    );
  });

  test("fails on unknown columns instead of silently dropping them", () => {
    expectSeatingError(
      () => parseGuestCsv("name,email\na@b.c,x@y.z"),
      /Hay columnas desconocidas.*email/i,
    );
  });

  test("reports the row number for invalid values", () => {
    const csv = [
      "name,attendance,isChild",
      "Ana,confirmed,false",
      "Bo,maybe,true",
      "Cyr,confirmed,nunca",
    ].join("\n");
    try {
      parseGuestCsv(csv);
      throw new Error("expected parseGuestCsv to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(SeatingPlanError);
      const message = error instanceof Error ? error.message : "";
      expect(message).toContain("fila 3");
      expect(message).toContain('"maybe"');
      expect(message).toContain("fila 4");
      expect(message).toContain("nunca");
    }
  });

  test("requires a non-empty name in every data row", () => {
    const csv = "name\nAna\n\n  \n";
    const guests = parseGuestCsv(csv);
    expect(guests).toHaveLength(1);
    // A row that has other data but no name is an error, not a skipped row.
    expectSeatingError(
      () => parseGuestCsv("name,notes\nAna,hola\n,Fila sin nombre\n"),
      /fila 3.*«name» no puede estar vacía/i,
    );
  });

  test("rejects an unclosed quote", () => {
    expectSeatingError(
      () => parseGuestCsv('name,notes\nAna,"sin cerrar'),
      /entrecomillado sin cerrar/i,
    );
  });
});

describe("upsertTable", () => {
  test("creates a new table", () => {
    const plan = basePlan();
    const next = upsertTable(plan, table("t9", "Mesa nueva", 6));
    expect(next.tables).toHaveLength(3);
    expect(next.tables.find((t) => t.id === "t9")).toMatchObject({
      name: "Mesa nueva",
      capacity: 6,
    });
    expect(plan.tables).toHaveLength(2);
  });

  test("replaces an existing table by id", () => {
    const plan = basePlan();
    const next = upsertTable(plan, table("t1", "Mesa renombrada", 8, "rectangular"));
    expect(next.tables.find((t) => t.id === "t1")).toMatchObject({
      name: "Mesa renombrada",
      capacity: 8,
      shape: "rectangular",
    });
    expect(plan.tables.find((t) => t.id === "t1")?.name).toBe("Mesa 1");
  });
});

describe("deleteTable", () => {
  test("removes the table and unseats its guests via unseated()", () => {
    const plan = basePlan();
    plan.guests[0] = { ...plan.guests[0], seat: 0 };
    const next = deleteTable(plan, "t1");
    expect(next.tables.map((t) => t.id)).toEqual(["t2"]);
    const ana = next.guests.find((g) => g.id === "g1");
    const bo = next.guests.find((g) => g.id === "g2");
    expect(ana?.tableId).toBeNull();
    expect(bo?.tableId).toBeNull();
    expect("seat" in ana!).toBe(false);
    expect("seat" in bo!).toBe(false);
    expect(plan.tables).toHaveLength(2);
  });

  test("leaves guests at other tables untouched", () => {
    const plan = basePlan();
    plan.guests.push(guest({ id: "g4", name: "Dana", tableId: "t2", seat: 0 }));
    const next = deleteTable(plan, "t1");
    expect(next.guests.find((g) => g.id === "g4")).toMatchObject({
      tableId: "t2",
      seat: 0,
    });
  });
});

describe("upsertGuest", () => {
  test("appends a new guest", () => {
    const plan = basePlan();
    const next = upsertGuest(
      plan,
      guest({ id: "manual-1", name: "Nuevo", tableId: null }),
    );
    expect(next.guests).toHaveLength(4);
    expect(next.guests.find((g) => g.id === "manual-1")?.name).toBe("Nuevo");
    expect(plan.guests).toHaveLength(3);
  });

  test("updates an existing guest in place", () => {
    const plan = basePlan();
    const next = upsertGuest(
      plan,
      guest({ id: "g1", name: "Ana García", notes: "Nota", tableId: "t1", seat: 0 }),
    );
    expect(next.guests.find((g) => g.id === "g1")).toMatchObject({
      name: "Ana García",
      notes: "Nota",
      tableId: "t1",
      seat: 0,
    });
  });

  test("unseats the guest when attendance becomes declined", () => {
    const plan = basePlan();
    plan.guests[0] = { ...plan.guests[0], seat: 1 };
    const next = upsertGuest(
      plan,
      guest({
        id: "g1",
        name: "Ana",
        attendance: "declined",
        tableId: "t1",
        seat: 1,
      }),
    );
    const ana = next.guests.find((g) => g.id === "g1");
    expect(ana?.attendance).toBe("declined");
    expect(ana?.tableId).toBeNull();
    expect("seat" in ana!).toBe(false);
  });

  test("creates a declined guest unseated", () => {
    const next = upsertGuest(
      basePlan(),
      guest({ id: "g9", name: "Rechazado", attendance: "declined" }),
    );
    const created = next.guests.find((g) => g.id === "g9");
    expect(created?.tableId).toBeNull();
    expect("seat" in created!).toBe(false);
  });
});

describe("deleteGuest", () => {
  test("removes the guest and does not mutate the input plan", () => {
    const plan = basePlan();
    const next = deleteGuest(plan, "g1");
    expect(next.guests.map((g) => g.id)).toEqual(["g2", "g3"]);
    expect(plan.guests).toHaveLength(3);
  });
});

describe("table layout persistence", () => {
  test("keeps positions through JSON export/import and guest assignments", () => {
    const plan = basePlan();
    plan.tables[0].position = { x: 235, y: 410 };
    const restored = parsePlan(JSON.parse(JSON.stringify(plan)));
    expect(restored.tables[0].position).toEqual({ x: 235, y: 410 });
    expect(assignGuest(restored, "g3", "t2").tables[0].position).toEqual({
      x: 235,
      y: 410,
    });
    expect(restored.tables[0].position).not.toBe(plan.tables[0].position);
  });
  test("accepts older backups without positions", () => {
    expect(parsePlan(basePlan()).tables[0].position).toBeUndefined();
  });
  test("rejects malformed and out-of-bounds positions", () => {
    for (const position of [
      null,
      { x: -1, y: 0 },
      { x: Infinity, y: 0 },
      { x: 0, y: NaN },
      { x: 10001, y: 0 },
      { x: "4", y: 0 },
    ]) {
      const plan = basePlan();
      expect(() =>
        parsePlan({
          ...plan,
          tables: [{ ...plan.tables[0], position }, plan.tables[1]],
        }),
      ).toThrow(SeatingPlanError);
    }
  });
});
