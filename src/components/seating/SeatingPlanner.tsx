import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  Loader2,
  Printer,
  RotateCcw,
  Sparkles,
  UserPlus,
} from "lucide-react";
import type { SeatingPlan } from "@/lib/seating";
import { GuestSidebar } from "./GuestSidebar";
import { TablesBoard } from "./TablesBoard";
import {
  ConfirmDialog,
  GuestDialog,
  TableDialog,
  type ConfirmRequest,
} from "./dialogs";
import { PrintView } from "./PrintView";
import { ToastStack, useToasts } from "./toasts";
import { Menu, MenuItem } from "./PlannerMenu";
import { usePlanStorage } from "./usePlanStorage";
import { usePlanImportExport } from "./usePlanImportExport";
import { usePlanMutations } from "./usePlanMutations";
import { PlanStatsBar } from "./PlanStatsBar";
import { StorageBanners } from "./StorageBanners";
import { EmptyPlanHero } from "./EmptyPlanHero";
import { PlannerFooter } from "./PlannerFooter";

export default function SeatingPlanner() {
  const { toasts, pushToast, dismissToast } = useToasts();
  const { plan, setPlan, storage, saveState, savedAt, discardCorruptStorage } =
    usePlanStorage(pushToast);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(
    null,
  );

  const planRef = useRef<SeatingPlan | null>(plan);
  useLayoutEffect(() => {
    planRef.current = plan;
  }, [plan]);

  const csvInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

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

  const {
    importingRsvp,
    importFromRsvp,
    importGuestCsv,
    importJsonBackup,
    exportJsonBackup,
    exportCsv,
    loadDemoPlan,
    resetPlan,
  } = usePlanImportExport({
    plan,
    setPlan,
    pushToast,
    setConfirmRequest,
    isEmptyPlan,
  });

  const {
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
  } = usePlanMutations({
    plan,
    setPlan,
    planRef,
    pushToast,
    setConfirmRequest,
  });

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

        <PlanStatsBar stats={stats} />

        <StorageBanners
          storage={storage}
          setConfirmRequest={setConfirmRequest}
          onDiscardCorrupt={discardCorruptStorage}
        />

        {isEmptyPlan ? (
          <EmptyPlanHero
            onCreateTable={openCreateTable}
            onLoadDemo={loadDemoPlan}
            onImportRsvp={importFromRsvp}
            importingRsvp={importingRsvp}
          />
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

        <PlannerFooter />

        {tableDialog.open ? (
          <TableDialog
            open
            table={tableDialog.table}
            occupied={tableDialog.occupied}
            suggestedName={tableSuggestedName}
            onClose={closeTableDialog}
            onSubmit={submitTable}
          />
        ) : null}

        {guestDialog.open ? (
          <GuestDialog
            open
            guest={guestDialog.guest}
            onClose={closeGuestDialog}
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

        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </div>
      {/* Sibling of .sp-shell: print CSS hides the shell entirely and shows this. */}
      <PrintView plan={plan} />
    </>
  );
}
