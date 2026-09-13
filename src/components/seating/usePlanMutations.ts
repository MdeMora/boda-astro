import { useCallback, useState } from "react";
import {
  assignGuest,
  deleteGuest,
  deleteTable,
  seatGuest,
  upsertGuest,
  upsertTable,
  type PlannerGuest,
  type PlannerTable,
  type SeatingPlan,
} from "@/lib/seating";
import type { ConfirmRequest, TableDraft } from "./dialogs";
import { compareTables, defaultPosition, errorText, newId } from "./utils";
import type { Toast } from "./toasts";

type PlanMutationsOptions = {
  plan: SeatingPlan | null;
  setPlan: React.Dispatch<React.SetStateAction<SeatingPlan | null>>;
  planRef: React.RefObject<SeatingPlan | null>;
  pushToast: (kind: Toast["kind"], text: string) => void;
  setConfirmRequest: React.Dispatch<
    React.SetStateAction<ConfirmRequest | null>
  >;
};

export function usePlanMutations({
  plan,
  setPlan,
  planRef,
  pushToast,
  setConfirmRequest,
}: PlanMutationsOptions) {
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

  const handleAssign = useCallback(
    (guestId: string, tableId: string | null) => {
      const current = planRef.current;
      if (!current) return;
      try {
        setPlan(assignGuest(current, guestId, tableId));
      } catch (error) {
        pushToast(
          "error",
          errorText(
            error,
            "No se pudo cambiar la mesa: está completa o el invitado no puede sentarse.",
          ),
        );
      }
    },
    [planRef, pushToast, setPlan],
  );

  const handleSeat = useCallback(
    (guestId: string, tableId: string, seat: number) => {
      const current = planRef.current;
      if (!current) return;
      try {
        setPlan(seatGuest(current, guestId, tableId, seat));
      } catch (error) {
        pushToast(
          "error",
          errorText(
            error,
            "No se pudo cambiar la mesa: está completa o el invitado no puede sentarse.",
          ),
        );
      }
    },
    [planRef, pushToast, setPlan],
  );

  const openCreateTable = useCallback(() => {
    const current = planRef.current;
    if (!current) return;
    const maxNumber = current.tables.reduce((max, table) => {
      const match = /\d+/.exec(table.name)?.[0];
      return match ? Math.max(max, Number(match)) : max;
    }, 0);
    setTableSuggestedName(`Mesa ${maxNumber + 1}`);
    setTableDialog({ open: true, table: null, occupied: 0 });
  }, [planRef]);

  const openEditTable = useCallback(
    (table: PlannerTable) => {
      const current = planRef.current;
      if (!current) return;
      const occupied = current.guests.filter(
        (guest) => guest.tableId === table.id,
      ).length;
      setTableDialog({ open: true, table, occupied });
    },
    [planRef],
  );

  const openEditGuest = useCallback((guest: PlannerGuest) => {
    setGuestDialog({ open: true, guest });
  }, []);

  const openCreateGuest = useCallback(() => {
    setGuestDialog({ open: true, guest: null });
  }, []);

  const closeTableDialog = useCallback(() => {
    setTableDialog({ open: false, table: null, occupied: 0 });
  }, []);

  const closeGuestDialog = useCallback(() => {
    setGuestDialog({ open: false, guest: null });
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
    [setPlan],
  );

  const submitTable = useCallback(
    (draft: TableDraft) => {
      if (!plan) return;
      if (tableDialog.table) {
        setPlan(upsertTable(plan, { ...tableDialog.table, ...draft }));
        pushToast("success", `«${draft.name}» actualizada.`);
      } else {
        setPlan(upsertTable(plan, { id: newId("table"), ...draft }));
        pushToast("success", `Mesa «${draft.name}» creada.`);
      }
      closeTableDialog();
    },
    [closeTableDialog, plan, pushToast, setPlan, tableDialog.table],
  );

  const requestDeleteTable = useCallback(
    (table: PlannerTable) => {
      const current = planRef.current;
      if (!current) return;
      const seatedCount = current.guests.filter(
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
          setPlan((latest) =>
            latest ? deleteTable(latest, table.id) : latest,
          );
          pushToast(
            "info",
            seatedCount > 0
              ? `${table.name} eliminada; ${seatedCount} ${seatedCount === 1 ? "invitado queda" : "invitados quedan"} sin mesa.`
              : `${table.name} eliminada.`,
          );
        },
      });
    },
    [planRef, pushToast, setConfirmRequest, setPlan],
  );

  const submitGuest = useCallback(
    (guestDraft: {
      name: string;
      attendance: PlannerGuest["attendance"];
      dietaryRestrictions: string;
      allergies: string;
      notes: string;
      isChild: boolean;
      group: string;
    }) => {
      if (!plan) return;
      if (guestDialog.guest) {
        const target = guestDialog.guest;
        const wasSeated = target.tableId !== null;
        const nowDeclined = guestDraft.attendance === "declined";
        setPlan(upsertGuest(plan, { ...target, ...guestDraft }));
        if (wasSeated && nowDeclined) {
          pushToast(
            "info",
            `${guestDraft.name} ha declinado: se ha liberado su mesa.`,
          );
        } else {
          pushToast("success", `Cambios guardados para ${guestDraft.name}.`);
        }
      } else {
        setPlan(
          upsertGuest(plan, {
            id: newId("manual"),
            tableId: null,
            ...guestDraft,
          }),
        );
        pushToast("success", `${guestDraft.name} añadido al plan.`);
      }
      closeGuestDialog();
    },
    [closeGuestDialog, guestDialog.guest, plan, pushToast, setPlan],
  );

  const requestDeleteGuest = useCallback(
    (guest: PlannerGuest) => {
      setConfirmRequest({
        title: `¿Eliminar a ${guest.name}?`,
        body: "Se eliminará del plan por completo y su plaza quedará libre. Para recuperarlo necesitarías una copia JSON previa.",
        confirmLabel: "Eliminar invitado",
        danger: true,
        onConfirm: () => {
          setPlan((current) =>
            current ? deleteGuest(current, guest.id) : current,
          );
          pushToast("info", `${guest.name} eliminado del plan.`);
        },
      });
    },
    [pushToast, setConfirmRequest, setPlan],
  );

  return {
    tableDialog,
    tableSuggestedName,
    guestDialog,
    handleAssign,
    handleSeat,
    openCreateTable,
    openEditTable,
    openEditGuest,
    openCreateGuest,
    closeTableDialog,
    closeGuestDialog,
    handleMoveTable,
    submitTable,
    requestDeleteTable,
    submitGuest,
    requestDeleteGuest,
  };
}
