import { useCallback, useEffect, useRef, useState } from "react";
import { emptyPlan, parsePlan, type SeatingPlan } from "@/lib/seating";
import { STORAGE_KEY, formatClock } from "./utils";
import type { Toast } from "./toasts";

export type StorageState = "ok" | "unavailable" | "corrupt";

export function usePlanStorage(
  pushToast: (kind: Toast["kind"], text: string) => void,
) {
  const [plan, setPlan] = useState<SeatingPlan | null>(null);
  const [storage, setStorage] = useState<{
    state: StorageState;
    corruptRaw?: string;
  }>({ state: "ok" });
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const initRef = useRef(false);

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

  useEffect(() => {
    if (!plan || storage.state === "ok") return;
    if (plan.guests.length === 0 && plan.tables.length === 0) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [plan, storage.state]);

  const discardCorruptStorage = useCallback(() => {
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
  }, [pushToast]);

  return {
    plan,
    setPlan,
    storage,
    saveState,
    savedAt,
    discardCorruptStorage,
  };
}
