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

export const MAX_REPORTED_ERRORS = 20;

export class SeatingPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeatingPlanError";
  }
}

export function fail(message: string): never {
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
