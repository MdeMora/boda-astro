import type { PlannerGuest, PlannerTable } from "@/lib/seating";

export const STORAGE_KEY = "wedding-seating-plan-v1";

export const defaultPosition = (index: number): { x: number; y: number } => ({
  x: 40 + (index % 3) * 420,
  y: 40 + Math.floor(index / 3) * 420,
});

export function errorText(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

export const ATTENDANCE_LABELS: Record<PlannerGuest["attendance"], string> = {
  confirmed: "Confirmado",
  pending: "Pendiente",
  declined: "Rechazado",
};

/** Accent-insensitive lowercase, for search across Spanish names. */
export function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const ES_COLLATOR = new Intl.Collator("es", { sensitivity: "base" });

export function compareByField<T>(get: (item: T) => string) {
  return (a: T, b: T) => ES_COLLATOR.compare(get(a), get(b));
}

export function sortGuests(guests: PlannerGuest[]): PlannerGuest[] {
  return [...guests].sort(
    (a, b) =>
      compareByField((g: PlannerGuest) => g.group)(a, b) ||
      compareByField((g: PlannerGuest) => g.name)(a, b),
  );
}

export function newId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export function slugify(name: string): string {
  return (
    norm(name)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "plan-de-mesa"
  );
}

export function downloadText(
  filename: string,
  text: string,
  mime: string,
): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function formatClock(date = new Date()): string {
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatLongDate(date = new Date()): string {
  return date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Natural sort for table names like "Mesa 2", "Mesa 10". */
export function compareTables(a: PlannerTable, b: PlannerTable): number {
  const numeric = /\d+/.exec(a.name)?.[0];
  const numericB = /\d+/.exec(b.name)?.[0];
  if (numeric && numericB && numeric !== numericB) {
    return Number(numeric) - Number(numericB);
  }
  return ES_COLLATOR.compare(a.name, b.name);
}
