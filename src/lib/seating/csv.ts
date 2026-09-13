import {
  ATTENDANCE_VALUES,
  fail,
  MAX_REPORTED_ERRORS,
  type Attendance,
  type PlannerGuest,
  type SeatingPlan,
} from "./types";

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

  if (inQuotes)
    fail('Hay un campo entrecomillado sin cerrar (falta una comilla ").');
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
    `${path}, columna «isChild»: se esperaba true o false (se aceptan: ${[...TRUE_VALUES, ...FALSE_VALUES].join(", ")}) y llegó "${value}"`,
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
  if (rows.length === 0)
    fail("El archivo está vacío: hace falta al menos la fila de encabezados.");

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
      `Faltan columnas obligatorias en el encabezado: ${missing.join(", ")}. El encabezado esperado es: ${GUEST_CSV_HEADER.join(", ")}.`,
    );
  }
  const unknown = header.filter(
    (cellValue) => !canonicalByLower.has(cellValue),
  );
  if (unknown.length > 0) {
    fail(
      `Hay columnas desconocidas en el encabezado: ${unknown.join(", ")}. El encabezado esperado es: ${GUEST_CSV_HEADER.join(", ")}.`,
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
    const path = `fila ${rowNumber}`;
    if (row.every((value) => value.trim() === "")) continue;

    const name = cell(row, "name");
    if (name === "") {
      errors.push(`${path}: la columna «name» no puede estar vacía`);
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
          `${path}, columna «attendance»: se esperaba uno de ${ATTENDANCE_VALUES.join(", ")} y llegó "${attendanceRaw}"`,
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
      `El CSV tiene filas con problemas:\n- ${reported.join("\n- ")}` +
        (extra > 0 ? `\n- …y ${extra} problema(s) más` : ""),
    );
  }

  return guests;
}
