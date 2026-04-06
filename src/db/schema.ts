import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const guests = sqliteTable("guests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email"),
  attendance: text("attendance", { enum: ["confirmed", "declined", "pending"] }).default("pending"),
  dietaryRestrictions: text("dietary_restrictions", { enum: ["omnivore", "vegetarian", "piscivegetarian"] }).default("omnivore"),
  allergies: text("allergies"),
  notes: text("notes"),
  isChild: integer("is_child", { mode: "boolean" }).default(false),
  parentId: integer("parent_id").references((): any => guests.id),
});

export type Guest = typeof guests.$inferSelect;
export type NewGuest = typeof guests.$inferInsert;
