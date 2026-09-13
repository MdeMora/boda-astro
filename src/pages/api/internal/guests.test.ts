import { afterEach, describe, expect, test } from "bun:test";
import {
  groupFor,
  readDbConfig,
  toPlannerGuests,
  type GuestRow,
} from "./guests";

const row = (
  overrides: Partial<GuestRow> & { id: number; name: string },
): GuestRow => ({
  attendance: null,
  dietaryRestrictions: null,
  allergies: null,
  notes: null,
  isChild: null,
  parentId: null,
  ...overrides,
});

describe("readDbConfig", () => {
  const saved: Record<string, string | undefined> = {};
  const keys = ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"];

  afterEach(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  const capture = () => {
    for (const key of keys) saved[key] = process.env[key];
  };

  test("returns undefined when no database URL is configured", () => {
    capture();
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;
    expect(readDbConfig()).toBeUndefined();
  });

  test("reads the URL (and optional token) from the environment", () => {
    capture();
    process.env.TURSO_DATABASE_URL = "libsql://example.turso.io";
    process.env.TURSO_AUTH_TOKEN = "token-123";
    expect(readDbConfig()).toEqual({
      url: "libsql://example.turso.io",
      authToken: "token-123",
    });
    delete process.env.TURSO_AUTH_TOKEN;
    expect(readDbConfig()).toEqual({
      url: "libsql://example.turso.io",
      authToken: undefined,
    });
  });

  test("ignores blank URLs", () => {
    capture();
    process.env.TURSO_DATABASE_URL = "   ";
    expect(readDbConfig()).toBeUndefined();
  });
});

describe("toPlannerGuests", () => {
  test("prefixes numeric ids with rsvp:", () => {
    const guests = toPlannerGuests([row({ id: 12, name: "Ana" })]);
    expect(guests[0].id).toBe("rsvp:12");
    expect(guests[0].tableId).toBeNull();
  });

  test("groups companions under their parent's name", () => {
    const guests = toPlannerGuests([
      row({ id: 1, name: "Marta" }),
      row({ id: 2, name: "Lucía", parentId: 1, isChild: true }),
      row({ id: 3, name: "Huérfano", parentId: 99 }),
    ]);
    expect(guests[0].group).toBe("Marta");
    expect(guests[1].group).toBe("Marta");
    expect(guests[1].isChild).toBe(true);
    // Parent missing from the list falls back to the guest's own name.
    expect(guests[2].group).toBe("Huérfano");
  });

  test("normalizes nulls to safe defaults", () => {
    const guests = toPlannerGuests([row({ id: 5, name: "Bo" })]);
    expect(guests[0]).toEqual({
      id: "rsvp:5",
      name: "Bo",
      attendance: "pending",
      dietaryRestrictions: "omnivore",
      allergies: "",
      notes: "",
      isChild: false,
      group: "Bo",
      tableId: null,
    });
  });

  test("keeps real values and rejects unknown attendance values to pending", () => {
    const guests = toPlannerGuests([
      row({
        id: 7,
        name: "Cyr",
        attendance: "confirmed",
        dietaryRestrictions: "vegetarian",
        allergies: "Polen",
        notes: "Mesa tranquila",
      }),
      row({ id: 8, name: "Dana", attendance: "otro" }),
    ]);
    expect(guests[0].attendance).toBe("confirmed");
    expect(guests[0].dietaryRestrictions).toBe("vegetarian");
    expect(guests[1].attendance).toBe("pending");
  });

  test("groupFor tolerates a missing name map", () => {
    expect(groupFor({ name: "Solo", parentId: null }, new Map())).toBe("Solo");
  });
});
