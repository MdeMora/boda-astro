import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Circle,
  Plus,
  Download,
  FileJson,
  FileSpreadsheet,
  Info,
  Loader2,
  Printer,
  RotateCcw,
  Sparkles,
  UserPlus,
  TriangleAlert,
} from "lucide-react";
import {
  assignGuest,
  emptyPlan,
  mergeGuests,
  parseGuestCsv,
  parsePlan,
  planToCsv,
  seatGuest,
  type PlannerGuest,
  type PlannerTable,
  type SeatingPlan,
} from "@/lib/seating";
import { GuestSidebar } from "./GuestSidebar";
import { TablesBoard } from "./TablesBoard";
import { defaultPosition } from "./SeatingMap";
import {
  ConfirmDialog,
  GuestDialog,
  TableDialog,
  type ConfirmRequest,
  type TableDraft,
} from "./dialogs";
import { demoPlan } from "./demo";
import {
  STORAGE_KEY,
  compareTables,
  downloadText,
  formatClock,
  formatLongDate,
  newId,
  slugify,
} from "./utils";

type Toast = { id: number; kind: "success" | "error" | "info"; text: string };
type StorageState = "ok" | "unavailable" | "corrupt";

/** "1 invitado" / "3 invitados" — Spanish plural for the plan summaries. */
function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function planSize(plan: { guests: unknown[]; tables: unknown[] }): string {
  return `${plural(plan.guests.length, "invitado", "invitados")}, ${plural(
    plan.tables.length,
    "mesa",
    "mesas",
  )}`;
}

function errorText(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

/** Turns the shared library's English invariant errors into friendly Spanish. */
function translateAssignError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const fullTable = /Table "(.+)" is full/.exec(raw);
  if (fullTable)
    return `«${fullTable[1]}» está completa; libera una plaza antes de sentar a alguien.`;
  const declined = /"(.+)" declined the invitation/.exec(raw);
  if (declined)
    return `«${declined[1]}» no puede sentarse porque declinó la invitación.`;
  const seat = /Seat (\d+) does not exist at table "(.+)"/.exec(raw);
  if (seat) return `«${seat[2]}» no tiene un asiento ${seat[1]}.`;
  return "No se pudo cambiar la mesa: está completa o el invitado no puede sentarse.";
}

/**
 * The shared library reports invariant problems in English. The panel is in
 * Spanish, so translate the patterns operators actually hit; anything else
 * falls through verbatim so no detail is lost.
 */
function translateDataError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/^Invalid guest CSV:/, "El CSV tiene filas con problemas:")
    .replace(
      /CSV: the file is empty, expected a header row/,
      "El archivo está vacío: hace falta al menos la fila de encabezados.",
    )
    .replace(
      /CSV: unclosed quoted field \(missing closing "\)/,
      'Hay un campo entrecomillado sin cerrar (falta una comilla ").',
    )
    .replace(
      /CSV: missing required header column\(s\): (.+?)\. Expected header: (.+)/,
      "Faltan columnas obligatorias en el encabezado: $1. El encabezado esperado es: $2.",
    )
    .replace(
      /CSV: unknown header column\(s\): (.+?)\. Expected header: (.+)/,
      "Hay columnas desconocidas en el encabezado: $1. El encabezado esperado es: $2.",
    )
    .replace(
      /CSV row (\d+)\.(\w+): expected one of ([^,]+), got "(.*?)"/g,
      'fila $1, columna «$2»: se esperaba uno de $3 y llegó "$4"',
    )
    .replace(
      /CSV row (\d+)\.isChild: expected true or false \(accepted: (.+?)\), got "(.*?)"/g,
      'fila $1, columna «isChild»: se esperaba true o false (se aceptan: $2) y llegó "$3"',
    )
    .replace(
      /CSV row (\d+): "name" is required/g,
      "fila $1: la columna «name» no puede estar vacía",
    )
    .replace(/\.\.\.and (\d+) more problem\(s\)/, "…y $1 problema(s) más");
}

/** Reading-time toast duration: ~220 wpm, floored so short messages don't flash. */
function toastDuration(text: string, kind: Toast["kind"]): number {
  const words = text.trim().split(/\s+/).length;
  const reading = Math.round((words / 220) * 60_000);
  const floor = kind === "error" ? 6000 : 4000;
  return Math.min(Math.max(reading, floor), 12_000);
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(
      () => onDismiss(toast.id),
      toastDuration(toast.text, toast.kind),
    );
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.text, toast.kind, onDismiss]);

  return (
    <div
      className={`sp-toast sp-toast--${toast.kind}`}
      role={toast.kind === "error" ? "alert" : "status"}
    >
      <span className="sp-toast__text">{toast.text}</span>
      <Button
        variant="ghost"
        type="button"
        className="sp-iconbtn sp-iconbtn--tiny sp-toast__close"
        aria-label="Descartar aviso"
        onClick={() => onDismiss(toast.id)}
      >
        ×
      </Button>
    </div>
  );
}

function Menu({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="sp-btn sp-btn--ghost">{label}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
  loading,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  danger?: boolean;
}) {
  return (
    <DropdownMenuItem
      className={
        danger ? "sp-menu__item sp-menu__item--danger" : "sp-menu__item"
      }
      onSelect={onClick}
      disabled={disabled}
    >
      {loading ? <Loader2 aria-hidden="true" className="sp-spin" /> : icon}
      <span>{label}</span>
    </DropdownMenuItem>
  );
}

const PrintView = memo(function PrintView({ plan }: { plan: SeatingPlan }) {
  const sortedTables = useMemo(
    () => [...plan.tables].sort(compareTables),
    [plan.tables],
  );
  const unassigned = plan.guests
    .filter((guest) => !guest.tableId && guest.attendance !== "declined")
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const confirmedCount = plan.guests.filter(
    (guest) => guest.attendance === "confirmed",
  ).length;
  const seatedCount = plan.guests.filter(
    (guest) => guest.tableId !== null,
  ).length;

  return (
    <div className="sp-print">
      <header className="sp-print__head">
        <h1>{plan.name}</h1>
        <p>
          Plan de mesa · {formatLongDate()} · {confirmedCount} confirmados ·{" "}
          {plan.tables.reduce((sum, table) => sum + table.capacity, 0)} plazas
        </p>
      </header>
      <section className="sp-print__tables">
        {sortedTables.map((table) => {
          const seated = plan.guests
            .filter((guest) => guest.tableId === table.id)
            .sort((a, b) => a.name.localeCompare(b.name, "es"));
          return (
            <section key={table.id} className="sp-print__table">
              <h2>
                {table.name}{" "}
                <span className="sp-print__count">
                  ({seated.length}/{table.capacity})
                </span>
              </h2>
              {seated.length === 0 ? (
                <p className="sp-print__empty">Sin invitados asignados.</p>
              ) : (
                <ul>
                  {seated.map((guest) => {
                    const details: string[] = [];
                    if (guest.attendance === "pending")
                      details.push("Pendiente de confirmar");
                    if (guest.dietaryRestrictions.trim())
                      details.push(
                        `Dieta: ${guest.dietaryRestrictions.trim()}`,
                      );
                    if (guest.allergies.trim())
                      details.push(`Alergias: ${guest.allergies.trim()}`);
                    if (guest.isChild) details.push("Niño/a");
                    if (guest.notes.trim()) details.push(guest.notes.trim());
                    return (
                      <li key={guest.id}>
                        <strong>{guest.name}</strong>
                        {details.length > 0 ? (
                          <span> — {details.join(" · ")}</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </section>
      {unassigned.length > 0 ? (
        <section className="sp-print__unassigned">
          <h2>Sin asignar ({unassigned.length})</h2>
          <ul>
            {unassigned.map((guest) => (
              <li key={guest.id}>{guest.name}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <footer className="sp-print__foot">
        {plan.guests.length} invitados en el plan · {seatedCount} sentados
      </footer>
    </div>
  );
});

export default function SeatingPlanner() {
  const [plan, setPlan] = useState<SeatingPlan | null>(null);
  const [storage, setStorage] = useState<{
    state: StorageState;
    corruptRaw?: string;
  }>({
    state: "ok",
  });
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [tableDialog, setTableDialog] = useState<{
    open: boolean;
    table: PlannerTable | null;
    occupied: number;
  }>({ open: false, table: null, occupied: 0 });
  const [tableSuggestedName, setTableSuggestedName] = useState("Mesa 1");
  const [guestDialog, setGuestDialog] = useState<{
    open: boolean;
    guest: PlannerGuest | null;
  }>({
    open: false,
    guest: null,
  });
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(
    null,
  );
  const [importingRsvp, setImportingRsvp] = useState(false);
  // Event handlers read the latest committed plan without making unrelated
  // header, save-status, or dialog updates invalidate the workspace props.
  const planRef = useRef(plan);
  useLayoutEffect(() => {
    planRef.current = plan;
  }, [plan]);

  const toastIdRef = useRef(0);
  const initRef = useRef(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const pushToast = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++toastIdRef.current;
    setToasts((current) => [...current.slice(-3), { id, kind, text }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  /* ---- initial load from localStorage ---- */
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      setPlan(emptyPlan());
      setStorage({ state: "unavailable" });
      return;
    }
    if (raw === null) {
      setPlan(emptyPlan());
      return;
    }
    try {
      setPlan(parsePlan(JSON.parse(raw) as unknown));
    } catch {
      setPlan(emptyPlan());
      setStorage({ state: "corrupt", corruptRaw: raw });
    }
  }, []);

  /* ---- debounced autosave ---- */
  useEffect(() => {
    if (!plan || storage.state !== "ok") return;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
        setSaveState("saved");
        setSavedAt(formatClock());
      } catch {
        setSaveState("error");
        pushToast(
          "error",
          "No se pudo guardar en este navegador (almacenamiento lleno o bloqueado). Exporta una copia JSON.",
        );
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [plan, storage.state, pushToast]);

  /* ---- warn before closing if changes are not being persisted ---- */
  useEffect(() => {
    if (!plan || storage.state === "ok") return;
    if (plan.guests.length === 0 && plan.tables.length === 0) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [plan, storage.state]);

  const stats = useMemo(() => {
    if (!plan) return null;
    const confirmed = plan.guests.filter(
      (guest) => guest.attendance === "confirmed",
    ).length;
    const seated = plan.guests.filter((guest) => guest.tableId !== null).length;
    const unassigned = plan.guests.filter(
      (guest) => guest.tableId === null && guest.attendance !== "declined",
    ).length;
    const places = plan.tables.reduce((sum, table) => sum + table.capacity, 0);
    const pending = plan.guests.filter(
      (guest) => guest.attendance === "pending",
    ).length;
    const declined = plan.guests.filter(
      (guest) => guest.attendance === "declined",
    ).length;
    const freePlaces = places - seated;
    return {
      confirmed,
      seated,
      unassigned,
      places,
      pending,
      declined,
      freePlaces,
    };
  }, [plan]);

  const isEmptyPlan =
    !!plan && plan.guests.length === 0 && plan.tables.length === 0;

  /* ---- plan operations ---- */

  const handleAssign = useCallback(
    (guestId: string, tableId: string | null) => {
      const plan = planRef.current;
      if (!plan) return;
      try {
        setPlan(assignGuest(plan, guestId, tableId));
      } catch (error) {
        pushToast("error", translateAssignError(error));
      }
    },
    [pushToast],
  );

  const handleSeat = useCallback(
    (guestId: string, tableId: string, seat: number) => {
      const plan = planRef.current;
      if (!plan) return;
      try {
        setPlan(seatGuest(plan, guestId, tableId, seat));
      } catch (error) {
        pushToast("error", translateAssignError(error));
      }
    },
    [pushToast],
  );

  const openCreateTable = useCallback(() => {
    const plan = planRef.current;
    if (!plan) return;
    const maxNumber = plan.tables.reduce((max, table) => {
      const match = /\d+/.exec(table.name)?.[0];
      return match ? Math.max(max, Number(match)) : max;
    }, 0);
    setTableSuggestedName(`Mesa ${maxNumber + 1}`);
    setTableDialog({ open: true, table: null, occupied: 0 });
  }, []);

  const openEditTable = useCallback((table: PlannerTable) => {
    const plan = planRef.current;
    if (!plan) return;
    const occupied = plan.guests.filter(
      (guest) => guest.tableId === table.id,
    ).length;
    setTableDialog({ open: true, table, occupied });
  }, []);

  const openEditGuest = useCallback((guest: PlannerGuest) => {
    setGuestDialog({ open: true, guest });
  }, []);
  const openCreateGuest = useCallback(() => {
    setGuestDialog({ open: true, guest: null });
  }, []);
  const handleMoveTable = useCallback(
    (id: string, position: { x: number; y: number }) => {
      setPlan((current) => {
        if (!current) return current;
        const sorted = [...current.tables].sort(compareTables);
        return {
          ...current,
          tables: sorted.map((table, index) => {
            if (table.id === id) return { ...table, position };
            return table.position
              ? table
              : { ...table, position: defaultPosition(index) };
          }),
        };
      });
    },
    [],
  );

  function submitTable(draft: TableDraft) {
    if (!plan) return;
    if (tableDialog.table) {
      const editedId = tableDialog.table.id;
      setPlan({
        ...plan,
        tables: plan.tables.map((table) =>
          table.id === editedId ? { ...table, ...draft } : table,
        ),
      });
      pushToast("success", `«${draft.name}» actualizada.`);
    } else {
      setPlan({
        ...plan,
        tables: [...plan.tables, { id: newId("table"), ...draft }],
      });
      pushToast("success", `Mesa «${draft.name}» creada.`);
    }
    setTableDialog({ open: false, table: null, occupied: 0 });
  }

  const requestDeleteTable = useCallback(
    (table: PlannerTable) => {
      const plan = planRef.current;
      if (!plan) return;
      const seatedCount = plan.guests.filter(
        (guest) => guest.tableId === table.id,
      ).length;
      setConfirmRequest({
        title: `¿Eliminar ${table.name}?`,
        body:
          seatedCount > 0
            ? `La mesa se borrará y sus ${seatedCount} ${seatedCount === 1 ? "invitado quedará" : "invitados quedarán"} sin mesa. No se elimina a nadie del plan.`
            : "La mesa está vacía y se eliminará del plan.",
        confirmLabel: "Eliminar mesa",
        danger: true,
        onConfirm: () => {
          const tableId = table.id;
          setPlan((current) => {
            if (!current) return current;
            return {
              ...current,
              tables: current.tables.filter(
                (candidate) => candidate.id !== tableId,
              ),
              guests: current.guests.map((guest) =>
                guest.tableId === tableId
                  ? { ...guest, tableId: null, seat: undefined }
                  : guest,
              ),
            };
          });
          pushToast(
            "info",
            seatedCount > 0
              ? `${table.name} eliminada; ${seatedCount} ${seatedCount === 1 ? "invitado queda" : "invitados quedan"} sin mesa.`
              : `${table.name} eliminada.`,
          );
        },
      });
    },
    [pushToast],
  );

  function submitGuest(guestDraft: {
    name: string;
    attendance: PlannerGuest["attendance"];
    dietaryRestrictions: string;
    allergies: string;
    notes: string;
    isChild: boolean;
    group: string;
  }) {
    if (!plan) return;
    if (guestDialog.guest) {
      const target = guestDialog.guest;
      const wasSeated = target.tableId !== null;
      const nowDeclined = guestDraft.attendance === "declined";
      setPlan({
        ...plan,
        guests: plan.guests.map((guest) =>
          guest.id === target.id
            ? {
                ...guest,
                ...guestDraft,
                tableId: wasSeated && nowDeclined ? null : guest.tableId,
              }
            : guest,
        ),
      });
      if (wasSeated && nowDeclined) {
        pushToast(
          "info",
          `${guestDraft.name} ha declinado: se ha liberado su mesa.`,
        );
      } else {
        pushToast("success", `Cambios guardados para ${guestDraft.name}.`);
      }
    } else {
      setPlan({
        ...plan,
        guests: [
          ...plan.guests,
          { id: newId("manual"), tableId: null, ...guestDraft },
        ],
      });
      pushToast("success", `${guestDraft.name} añadido al plan.`);
    }
    setGuestDialog({ open: false, guest: null });
  }

  const requestDeleteGuest = useCallback(
    (guest: PlannerGuest) => {
      setConfirmRequest({
        title: `¿Eliminar a ${guest.name}?`,
        body: "Se eliminará del plan por completo y su plaza quedará libre. Para recuperarlo necesitarías una copia JSON previa.",
        confirmLabel: "Eliminar invitado",
        danger: true,
        onConfirm: () => {
          const guestId = guest.id;
          setPlan((current) =>
            current
              ? {
                  ...current,
                  guests: current.guests.filter(
                    (candidate) => candidate.id !== guestId,
                  ),
                }
              : current,
          );
          pushToast("info", `${guest.name} eliminado del plan.`);
        },
      });
    },
    [pushToast],
  );

  /* ---- data import / export ---- */

  function summarizeMerge(before: SeatingPlan, after: SeatingPlan): string {
    const newCount = after.guests.filter(
      (guest) => !before.guests.some((other) => other.id === guest.id),
    ).length;
    let freed = 0;
    for (const beforeGuest of before.guests) {
      if (!beforeGuest.tableId) continue;
      const afterGuest = after.guests.find(
        (guest) => guest.id === beforeGuest.id,
      );
      if (afterGuest && afterGuest.tableId === null) freed += 1;
    }
    const parts = [
      newCount > 0
        ? `${newCount} ${newCount === 1 ? "invitado nuevo" : "invitados nuevos"}`
        : null,
      `${after.guests.length} en total`,
      freed > 0
        ? `${freed} ${freed === 1 ? "mesa liberada" : "mesas liberadas"} (invitados que declinaron)`
        : null,
    ].filter(Boolean);
    return parts.join(" · ");
  }

  async function importFromRsvp() {
    if (!plan) return;
    setImportingRsvp(true);
    try {
      const response = await fetch("/api/internal/guests", {
        headers: { Accept: "application/json" },
      });
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        /* non-JSON error page */
      }
      if (!response.ok) {
        if (response.status === 503) {
          throw new Error(
            "el servidor no tiene configurada la base de datos de invitados (TURSO_DATABASE_URL); sin ella no hay lista RSVP que importar",
          );
        }
        if (response.status === 401) {
          throw new Error("acceso denegado: revisa la contraseña del panel");
        }
        const serverMessage =
          typeof body === "object" && body !== null && "error" in body
            ? String((body as { error: unknown }).error)
            : null;
        throw new Error(
          serverMessage ?? `el servidor respondió ${response.status}`,
        );
      }
      const guests = (body as { guests?: unknown } | null)?.guests;
      if (!Array.isArray(guests)) {
        throw new Error(
          "la respuesta del servidor no tiene el formato esperado",
        );
      }
      const after = mergeGuests(plan, guests as PlannerGuest[]);
      const summary = summarizeMerge(plan, after);
      setPlan(after);
      pushToast("success", `Importación del RSVP completada: ${summary}.`);
    } catch (error) {
      pushToast(
        "error",
        `No se pudo importar del RSVP: ${errorText(error, "error inesperado.")}`,
      );
    } finally {
      setImportingRsvp(false);
    }
  }

  async function importGuestCsv(file: File) {
    if (!plan) return;
    try {
      const text = await file.text();
      const incoming = parseGuestCsv(text);
      if (incoming.length === 0) {
        pushToast(
          "info",
          "El CSV no contiene invitados; no se ha cambiado nada.",
        );
        return;
      }
      const after = mergeGuests(plan, incoming);
      const summary = summarizeMerge(plan, after);
      setPlan(after);
      pushToast("success", `CSV importado: ${summary}.`);
    } catch (error) {
      pushToast(
        "error",
        `El CSV no se ha podido importar y el plan no ha cambiado. ${translateDataError(
          errorText(error, "Revisa el formato del archivo."),
        )}`.trim(),
      );
    }
  }

  async function importJsonBackup(file: File) {
    if (!plan) return;
    let parsed: SeatingPlan;
    try {
      const text = await file.text();
      parsed = parsePlan(JSON.parse(text) as unknown);
    } catch (error) {
      pushToast(
        "error",
        `La copia no es válida y el plan no ha cambiado. ${translateDataError(
          errorText(
            error,
            "Revisa que el archivo sea una copia JSON de este panel.",
          ),
        )}`,
      );
      return;
    }
    setConfirmRequest({
      title: "¿Sustituir el plan actual?",
      body: `La copia «${parsed.name}» contiene ${planSize(parsed)}. Se sustituirá el plan actual (${planSize(plan)}).`,
      confirmLabel: "Sustituir plan",
      danger: true,
      onConfirm: () => {
        setPlan(parsed);
        pushToast("success", `Plan sustituido por la copia «${parsed.name}».`);
      },
    });
  }

  function exportJsonBackup() {
    if (!plan) return;
    downloadText(
      `${slugify(plan.name)}.json`,
      JSON.stringify(plan, null, 2),
      "application/json",
    );
    pushToast("info", "Copia JSON descargada. Guárdala donde la encuentres.");
  }

  function exportCsv() {
    if (!plan) return;
    const csv = `\uFEFF${planToCsv(plan)}`;
    downloadText(`${slugify(plan.name)}.csv`, csv, "text/csv;charset=utf-8");
    pushToast("info", "CSV del plan descargado.");
  }

  function loadDemoPlan() {
    if (!plan) return;
    if (isEmptyPlan) {
      setPlan(demoPlan());
      pushToast("info", "Plan de ejemplo cargado; juega con él sin miedo.");
    } else {
      setConfirmRequest({
        title: "¿Cargar el plan de ejemplo?",
        body: `Se sustituirá el plan actual (${planSize(plan)}) por datos de ejemplo. Exporta antes una copia JSON si quieres conservarlo.`,
        confirmLabel: "Cargar ejemplo",
        danger: true,
        onConfirm: () => {
          setPlan(demoPlan());
          pushToast("info", "Plan de ejemplo cargado.");
        },
      });
    }
  }

  function resetPlan() {
    setConfirmRequest({
      title: "¿Empezar de cero?",
      body: "Se vaciarán todas las mesas y se eliminarán todos los invitados del plan. Exporta antes una copia JSON si quieres conservarlo.",
      confirmLabel: "Empezar de cero",
      danger: true,
      onConfirm: () => {
        setPlan(emptyPlan());
        pushToast("info", "Plan vaciado.");
      },
    });
  }

  function discardCorruptStorage() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      setStorage({ state: "ok" });
      pushToast(
        "info",
        "Datos corruptos descartados. El guardado automático vuelve a funcionar.",
      );
    } catch {
      pushToast("error", "No se pudo limpiar el almacenamiento del navegador.");
    }
  }

  if (!plan || !stats) {
    return (
      <div className="sp-loading" role="status">
        <Loader2 aria-hidden="true" className="sp-spin" />
        <p>Cargando el plan de mesa…</p>
      </div>
    );
  }

  return (
    <>
      <div className="sp-shell">
        <header className="sp-header">
          <div className="sp-header__titles">
            <p className="sp-eyebrow">
              Panel interno · Boda de Cristina y Miguel
            </p>
            <Input
              className="sp-plan-name"
              type="text"
              value={plan.name}
              maxLength={60}
              aria-label="Nombre del plan"
              onChange={(event) =>
                setPlan({ ...plan, name: event.target.value })
              }
              onBlur={(event) => {
                if (!event.target.value.trim()) {
                  setPlan({ ...plan, name: "Plan de mesa" });
                }
              }}
            />
            <p
              className={
                storage.state !== "ok" || saveState === "error"
                  ? "sp-save sp-save--warn"
                  : "sp-save"
              }
              role="status"
            >
              <span className="sp-save__dot" aria-hidden="true" />
              {storage.state === "unavailable"
                ? "El navegador bloquea el guardado local: exporta copias con frecuencia"
                : storage.state === "corrupt"
                  ? "Guardado pausado: hay datos corruptos pendientes de decisión"
                  : saveState === "saving"
                    ? "Guardando…"
                    : saveState === "error"
                      ? "No se pudo guardar en este navegador"
                      : savedAt
                        ? `Guardado a las ${savedAt} en este navegador`
                        : "Guardado en este navegador"}
            </p>
          </div>
          <div className="sp-header__actions">
            <Button
              variant="ghost"
              type="button"
              className="sp-btn sp-btn--ghost"
              onClick={() => window.print()}
              disabled={plan.tables.length === 0 && plan.guests.length === 0}
            >
              <Printer aria-hidden="true" />
              Imprimir
            </Button>
            <Menu label="Importar / exportar">
              <MenuItem
                icon={<UserPlus aria-hidden="true" />}
                label="Importar del formulario RSVP"
                onClick={importFromRsvp}
                loading={importingRsvp}
                disabled={importingRsvp}
              />
              <MenuItem
                icon={<FileSpreadsheet aria-hidden="true" />}
                label="Subir CSV de invitados"
                onClick={() => csvInputRef.current?.click()}
              />
              <MenuItem
                icon={<FileJson aria-hidden="true" />}
                label="Importar copia JSON"
                onClick={() => jsonInputRef.current?.click()}
              />
              <MenuItem
                icon={<Download aria-hidden="true" />}
                label="Exportar copia JSON"
                onClick={exportJsonBackup}
              />
              <MenuItem
                icon={<FileSpreadsheet aria-hidden="true" />}
                label="Exportar CSV del plan"
                onClick={exportCsv}
              />
              <MenuItem
                icon={<Sparkles aria-hidden="true" />}
                label="Cargar plan de ejemplo"
                onClick={loadDemoPlan}
              />
              <MenuItem
                icon={<RotateCcw aria-hidden="true" />}
                label="Empezar de cero"
                onClick={resetPlan}
                danger
              />
            </Menu>
          </div>
        </header>

        <div className="sp-stats" role="group" aria-label="Resumen del plan">
          <dl className="sp-stats__list">
            <div className="sp-stat">
              <dt>Confirmados</dt>
              <dd>{stats.confirmed}</dd>
            </div>
            <div className="sp-stat">
              <dt>Sentados</dt>
              <dd>{stats.seated}</dd>
            </div>
            <div className="sp-stat">
              <dt>Sin asiento</dt>
              <dd>{stats.unassigned}</dd>
            </div>
            <div className="sp-stat">
              <dt>Plazas</dt>
              <dd>{stats.places}</dd>
            </div>
          </dl>
          <div className="sp-stats__side">
            {stats.unassigned > stats.freePlaces ? (
              <p className="sp-stat-warning" role="status">
                Faltan {stats.unassigned - stats.freePlaces}{" "}
                {stats.unassigned - stats.freePlaces === 1 ? "plaza" : "plazas"}{" "}
                para sentar a todos.
              </p>
            ) : null}
            {stats.pending > 0 || stats.declined > 0 ? (
              <p className="sp-stat-note">
                {stats.pending}{" "}
                {stats.pending === 1 ? "pendiente" : "pendientes"} de confirmar
                · {stats.declined}{" "}
                {stats.declined === 1 ? "ha declinado" : "han declinado"}
              </p>
            ) : null}
          </div>
        </div>

        {storage.state === "corrupt" ? (
          <div className="sp-banner sp-banner--warning" role="alert">
            <TriangleAlert aria-hidden="true" />
            <div className="sp-banner__text">
              <strong>Hay datos guardados con formato no válido.</strong> Para
              no perderlos, no se han cargado y este panel{" "}
              <em>no guardará encima automáticamente</em> hasta que decidas.
            </div>
            <div className="sp-banner__actions">
              <Button
                variant="ghost"
                type="button"
                className="sp-btn sp-btn--ghost sp-btn--small"
                onClick={() =>
                  downloadText(
                    "plan-guardado-corrupto.json",
                    storage.corruptRaw ?? "",
                    "application/json",
                  )
                }
              >
                Descargar copia de lo guardado
              </Button>
              <Button
                variant="ghost"
                type="button"
                className="sp-btn sp-btn--danger sp-btn--small"
                onClick={() =>
                  setConfirmRequest({
                    title: "¿Descartar los datos corruptos?",
                    body: "Se borrará lo que había guardado en este navegador y se empezará con un plan vacío. Si crees que podrías necesitarlo, descarga antes la copia.",
                    confirmLabel: "Descartar y empezar de cero",
                    danger: true,
                    onConfirm: discardCorruptStorage,
                  })
                }
              >
                Descartar y empezar de cero
              </Button>
            </div>
          </div>
        ) : null}

        {storage.state === "unavailable" ? (
          <div className="sp-banner sp-banner--warning" role="alert">
            <TriangleAlert aria-hidden="true" />
            <div className="sp-banner__text">
              <strong>
                Este navegador no permite guardar (localStorage bloqueado).
              </strong>{" "}
              El plan funcionará, pero todo se perderá al cerrar la pestaña.
              Exporta copias JSON con frecuencia.
            </div>
          </div>
        ) : null}

        {isEmptyPlan ? (
          <div className="sp-empty sp-empty--hero">
            <Circle aria-hidden="true" className="sp-empty__ornament" />
            <h2>Este es tu plan de mesa</h2>
            <p>
              Empieza cargando un plan de ejemplo para ver cómo funciona,
              importa a los invitados del formulario RSVP o crea tus mesas desde
              cero.
            </p>
            <div className="sp-empty__actions">
              <Button
                className="sp-btn sp-btn--primary"
                onClick={openCreateTable}
              >
                <Plus aria-hidden="true" />
                Crear primera mesa
              </Button>
              <Button
                variant="ghost"
                type="button"
                className="sp-btn sp-btn--ghost"
                onClick={loadDemoPlan}
              >
                <Sparkles aria-hidden="true" />
                Cargar plan de ejemplo
              </Button>
              <Button
                variant="ghost"
                type="button"
                className="sp-btn sp-btn--ghost"
                onClick={importFromRsvp}
                disabled={importingRsvp}
              >
                {importingRsvp ? (
                  <Loader2 aria-hidden="true" className="sp-spin" />
                ) : (
                  <UserPlus aria-hidden="true" />
                )}
                Importar del formulario RSVP
              </Button>
            </div>
            <p className="sp-empty__note">
              El plan se guarda automáticamente en este navegador (localStorage)
              y no se sube a ningún servidor. Para llevarlo a otro dispositivo,
              usa «Exportar copia JSON».
            </p>
          </div>
        ) : (
          <main className="sp-workspace">
            <TablesBoard
              tables={plan.tables}
              guests={plan.guests}
              onAssign={handleAssign}
              onSeat={handleSeat}
              onEditTable={openEditTable}
              onDeleteTable={requestDeleteTable}
              onCreateTable={openCreateTable}
              onMoveTable={handleMoveTable}
            />
            <GuestSidebar
              guests={plan.guests}
              tables={plan.tables}
              onAssign={handleAssign}
              onEdit={openEditGuest}
              onDelete={requestDeleteGuest}
              onCreate={openCreateGuest}
            />
          </main>
        )}

        <footer className="sp-foot">
          <p>
            <Info aria-hidden="true" className="sp-minicon" />
            El plan se guarda solo en este navegador. Exporta una copia JSON
            para conservarlo o compartirlo. La copia JSON es portable: impórtala
            en otro navegador para continuar ahí.
          </p>
          <details className="sp-help">
            <summary>Cómo funciona el panel</summary>
            <ul>
              <li>
                <strong>Importar del RSVP</strong> lee los invitados del
                formulario público (protegido con usuario <code>admin</code>) y
                los mezcla con el plan actual, respetando lo que ya hay sentado
                a mano.
              </li>
              <li>
                <strong>CSV de invitados</strong> acepta las columnas{" "}
                <code>
                  name,group,attendance,dietaryRestrictions,allergies,notes,isChild
                </code>{" "}
                con una primera fila de encabezados.
              </li>
              <li>
                <strong>Exportar CSV</strong> genera una hoja con todos los
                invitados y su mesa, con alergias y dietas, lista para el
                catering.
              </li>
              <li>
                <strong>Imprimir</strong> saca una lista por mesas con dietas,
                alergias y notas, pensada para dejarla en la cocina.
              </li>
            </ul>
          </details>
        </footer>

        {tableDialog.open ? (
          <TableDialog
            open
            table={tableDialog.table}
            occupied={tableDialog.occupied}
            suggestedName={tableSuggestedName}
            onClose={() =>
              setTableDialog({ open: false, table: null, occupied: 0 })
            }
            onSubmit={submitTable}
          />
        ) : null}

        {guestDialog.open ? (
          <GuestDialog
            open
            guest={guestDialog.guest}
            onClose={() => setGuestDialog({ open: false, guest: null })}
            onSubmit={submitGuest}
          />
        ) : null}

        <ConfirmDialog
          request={confirmRequest}
          onClose={() => setConfirmRequest(null)}
        />

        <Input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          className="sp-file-input"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importGuestCsv(file);
            event.target.value = "";
          }}
        />
        <Input
          ref={jsonInputRef}
          type="file"
          accept=".json,application/json"
          className="sp-file-input"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importJsonBackup(file);
            event.target.value = "";
          }}
        />

        <div className="sp-toasts" aria-live="polite">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </div>
      </div>
      {/* Sibling of .sp-shell: print CSS hides the shell entirely and shows this. */}
      <PrintView plan={plan} />
    </>
  );
}
