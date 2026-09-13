import { useCallback, useState } from "react";
import {
  emptyPlan,
  mergeGuests,
  parseGuestCsv,
  parsePlan,
  planToCsv,
  type PlannerGuest,
  type SeatingPlan,
} from "@/lib/seating";
import { demoPlan } from "./demo";
import { downloadText, errorText, slugify } from "./utils";
import type { ConfirmRequest } from "./dialogs";
import type { Toast } from "./toasts";

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

type ImportExportOptions = {
  plan: SeatingPlan | null;
  setPlan: React.Dispatch<React.SetStateAction<SeatingPlan | null>>;
  pushToast: (kind: Toast["kind"], text: string) => void;
  setConfirmRequest: React.Dispatch<
    React.SetStateAction<ConfirmRequest | null>
  >;
  isEmptyPlan: boolean;
};

export function usePlanImportExport({
  plan,
  setPlan,
  pushToast,
  setConfirmRequest,
  isEmptyPlan,
}: ImportExportOptions) {
  const [importingRsvp, setImportingRsvp] = useState(false);

  const importFromRsvp = useCallback(async () => {
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
  }, [plan, pushToast, setPlan]);

  const importGuestCsv = useCallback(
    async (file: File) => {
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
          `El CSV no se ha podido importar y el plan no ha cambiado. ${errorText(
            error,
            "Revisa el formato del archivo.",
          )}`.trim(),
        );
      }
    },
    [plan, pushToast, setPlan],
  );

  const importJsonBackup = useCallback(
    async (file: File) => {
      if (!plan) return;
      let parsed: SeatingPlan;
      try {
        const text = await file.text();
        parsed = parsePlan(JSON.parse(text) as unknown);
      } catch (error) {
        pushToast(
          "error",
          `La copia no es válida y el plan no ha cambiado. ${errorText(
            error,
            "Revisa que el archivo sea una copia JSON de este panel.",
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
    },
    [plan, pushToast, setConfirmRequest, setPlan],
  );

  const exportJsonBackup = useCallback(() => {
    if (!plan) return;
    downloadText(
      `${slugify(plan.name)}.json`,
      JSON.stringify(plan, null, 2),
      "application/json",
    );
    pushToast("info", "Copia JSON descargada. Guárdala donde la encuentres.");
  }, [plan, pushToast]);

  const exportCsv = useCallback(() => {
    if (!plan) return;
    const csv = `\uFEFF${planToCsv(plan)}`;
    downloadText(`${slugify(plan.name)}.csv`, csv, "text/csv;charset=utf-8");
    pushToast("info", "CSV del plan descargado.");
  }, [plan, pushToast]);

  const loadDemoPlan = useCallback(() => {
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
  }, [isEmptyPlan, plan, pushToast, setConfirmRequest, setPlan]);

  const resetPlan = useCallback(() => {
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
  }, [pushToast, setConfirmRequest, setPlan]);

  return {
    importingRsvp,
    importFromRsvp,
    importGuestCsv,
    importJsonBackup,
    exportJsonBackup,
    exportCsv,
    loadDemoPlan,
    resetPlan,
  };
}
