import './server_BtU2nq7A.mjs';
import * as z from 'zod/v4';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { and, inArray, eq } from 'drizzle-orm';
import { d as defineAction } from './entrypoint_DDdUuEDv.mjs';

const guests = sqliteTable("guests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email"),
  attendance: text("attendance", { enum: ["confirmed", "declined", "pending"] }).default("pending"),
  dietaryRestrictions: text("dietary_restrictions", { enum: ["omnivore", "vegetarian", "piscivegetarian"] }).default("omnivore"),
  allergies: text("allergies"),
  notes: text("notes"),
  isChild: integer("is_child", { mode: "boolean" }).default(false),
  parentId: integer("parent_id").references(() => guests.id)
});

const schema = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  guests
}, Symbol.toStringTag, { value: 'Module' }));

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});
const db = drizzle(client, { schema });

const dietaryEnum = z.enum(["omnivore", "vegetarian", "piscivegetarian"]);
const attendanceEnum = z.enum(["confirmed", "declined", "pending"]);
const server = {
  searchGuest: defineAction({
    input: z.object({ query: z.string() }),
    handler: async ({ query }) => {
      if (!query || query.length < 2) return [];
      const allGuests = await db.select().from(guests);
      const normalizedQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const results = allGuests.filter((guest) => {
        const normalizedName = guest.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return normalizedName.includes(normalizedQuery);
      });
      return results.slice(0, 5);
    }
  }),
  getGuestWithCompanions: defineAction({
    input: z.object({ id: z.number() }),
    handler: async ({ id }) => {
      const searchedGuest = await db.query.guests.findFirst({
        where: eq(guests.id, id)
      });
      if (!searchedGuest) return null;
      const mainGuestId = searchedGuest.parentId ?? searchedGuest.id;
      const mainGuest = await db.query.guests.findFirst({
        where: eq(guests.id, mainGuestId)
      });
      if (!mainGuest) return null;
      const companions = await db.select().from(guests).where(eq(guests.parentId, mainGuestId));
      return { ...mainGuest, companions };
    }
  }),
  updateGuest: defineAction({
    input: z.object({
      id: z.number(),
      data: z.object({
        attendance: attendanceEnum.nullable().optional(),
        dietaryRestrictions: dietaryEnum.nullable().optional(),
        allergies: z.string().nullable().optional(),
        notes: z.string().nullable().optional()
      })
    }),
    handler: async ({ id, data }) => {
      await db.update(guests).set(data).where(eq(guests.id, id));
    }
  }),
  addCompanion: defineAction({
    input: z.object({
      parentId: z.number(),
      data: z.object({
        name: z.string(),
        isChild: z.boolean(),
        dietaryRestrictions: dietaryEnum.nullable().optional(),
        allergies: z.string().nullable().optional(),
        notes: z.string().nullable().optional()
      })
    }),
    handler: async ({ parentId, data }) => {
      await db.insert(guests).values({
        name: data.name,
        isChild: data.isChild,
        parentId,
        attendance: "confirmed",
        dietaryRestrictions: data.dietaryRestrictions || "omnivore",
        allergies: data.allergies,
        notes: data.notes
      });
    }
  }),
  confirmGroupAttendance: defineAction({
    input: z.object({ guestIds: z.array(z.number()) }),
    handler: async ({ guestIds }) => {
      if (guestIds.length === 0) return;
      await db.update(guests).set({ attendance: "confirmed" }).where(and(inArray(guests.id, guestIds), eq(guests.attendance, "pending")));
    }
  })
};

export { server };
