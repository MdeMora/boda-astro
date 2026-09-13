import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { PlannerSelect, PlannerOption } from "./PlannerSelect";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, type ReactNode, type SubmitEvent } from "react";
import { Trash2 } from "lucide-react";
import type { PlannerGuest, PlannerTable } from "@/lib/seating";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
};

export function Modal({ open, onClose, title, children, wide }: ModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className={wide ? "sp-modal sp-modal--wide" : "sp-modal"}
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className="sp-dialog__title">{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function FieldError({
  id,
  message,
}: {
  id: string;
  message: string | null;
}) {
  if (!message) return null;
  return (
    <p className="sp-field__error" id={id} role="alert">
      {message}
    </p>
  );
}

export type TableDraft = {
  name: string;
  capacity: number;
  shape: PlannerTable["shape"];
};

export function TableDialog({
  open,
  table,
  occupied,
  suggestedName,
  onClose,
  onSubmit,
}: {
  open: boolean;
  table: PlannerTable | null;
  occupied: number;
  suggestedName: string;
  onClose: () => void;
  onSubmit: (draft: TableDraft) => void;
}) {
  const [name, setName] = useState(table?.name ?? suggestedName);
  const [capacity, setCapacity] = useState(String(table?.capacity ?? 8));
  const [shape, setShape] = useState<PlannerTable["shape"]>(
    table?.shape ?? "round",
  );
  const [error, setError] = useState<string | null>(null);

  const minCapacity = table ? Math.max(occupied, 1) : 1;

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    const parsed = Number.parseInt(capacity, 10);
    if (!trimmed) {
      setError("Ponle un nombre a la mesa, por ejemplo «Mesa 3».");
      return;
    }
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 30) {
      setError("La capacidad debe ser un número entre 1 y 30.");
      return;
    }
    if (table && parsed < occupied) {
      setError(
        `Hay ${occupied} ${occupied === 1 ? "invitado sentado" : "invitados sentados"} aquí; la capacidad no puede ser menor.`,
      );
      return;
    }
    onSubmit({ name: trimmed, capacity: parsed, shape });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={table ? "Editar mesa" : "Nueva mesa"}
    >
      <form className="sp-form" noValidate onSubmit={handleSubmit}>
        <div className="sp-field">
          <label className="sp-label" htmlFor="sp-table-name">
            Nombre de la mesa
          </label>
          <Input
            id="sp-table-name"
            className="sp-input"
            type="text"
            value={name}
            maxLength={60}
            autoComplete="off"
            autoFocus
            aria-describedby="sp-table-name-hint"
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
          />
          <p className="sp-hint" id="sp-table-name-hint">
            Por ejemplo: «Mesa 3 · Amigos del pueblo».
          </p>
        </div>
        <div className="sp-field-row">
          <div className="sp-field">
            <label className="sp-label" htmlFor="sp-table-capacity">
              Plazas
            </label>
            <Input
              id="sp-table-capacity"
              className="sp-input sp-input--number"
              type="number"
              inputMode="numeric"
              min={minCapacity}
              max={30}
              step={1}
              value={capacity}
              aria-describedby="sp-table-capacity-hint"
              onChange={(event) => {
                setCapacity(event.target.value);
                setError(null);
              }}
            />
            <p className="sp-hint" id="sp-table-capacity-hint">
              {table && occupied > 0
                ? `Ocupación actual: ${occupied}. Mínimo ${minCapacity}.`
                : "Entre 1 y 30."}
            </p>
          </div>
          <div className="sp-field">
            <label className="sp-label" htmlFor="sp-table-shape">
              Forma
            </label>
            <PlannerSelect
              id="sp-table-shape"
              className="sp-input"
              value={shape}
              onValueChange={(value) =>
                setShape(value as PlannerTable["shape"])
              }
            >
              <PlannerOption value="round">Redonda</PlannerOption>
              <PlannerOption value="rectangular">Rectangular</PlannerOption>
            </PlannerSelect>
          </div>
        </div>
        <FieldError id="sp-table-error" message={error} />
        <footer className="sp-dialog__foot">
          <Button
            variant="ghost"
            type="button"
            className="sp-btn sp-btn--ghost"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            variant="ghost"
            type="submit"
            className="sp-btn sp-btn--primary"
          >
            {table ? "Guardar cambios" : "Crear mesa"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

export type GuestDraft = Omit<PlannerGuest, "id" | "tableId">;

export function GuestDialog({
  open,
  guest,
  onClose,
  onSubmit,
}: {
  open: boolean;
  guest: PlannerGuest | null;
  onClose: () => void;
  onSubmit: (draft: GuestDraft) => void;
}) {
  const [draft, setDraft] = useState<GuestDraft>(() =>
    guest
      ? { ...guest }
      : {
          name: "",
          attendance: "confirmed",
          dietaryRestrictions: "",
          allergies: "",
          notes: "",
          isChild: false,
          group: "",
        },
  );
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof GuestDraft>(key: K, value: GuestDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.name.trim();
    if (!trimmed) {
      setError("El nombre del invitado no puede quedar vacío.");
      return;
    }
    onSubmit({
      ...draft,
      name: trimmed,
      group: draft.group.trim(),
      dietaryRestrictions: draft.dietaryRestrictions.trim(),
      allergies: draft.allergies.trim(),
      notes: draft.notes.trim(),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={guest ? "Editar invitado" : "Nuevo invitado"}
      wide
    >
      <form className="sp-form" noValidate onSubmit={handleSubmit}>
        <div className="sp-field-row">
          <div className="sp-field">
            <label className="sp-label" htmlFor="sp-guest-name">
              Nombre
            </label>
            <Input
              id="sp-guest-name"
              className="sp-input"
              type="text"
              value={draft.name}
              maxLength={80}
              autoComplete="off"
              autoFocus
              onChange={(event) => update("name", event.target.value)}
            />
          </div>
          <div className="sp-field">
            <label className="sp-label" htmlFor="sp-guest-group">
              Grupo
            </label>
            <Input
              id="sp-guest-group"
              className="sp-input"
              type="text"
              value={draft.group}
              maxLength={60}
              placeholder="Familia, amigos, trabajo…"
              autoComplete="off"
              onChange={(event) => update("group", event.target.value)}
            />
          </div>
        </div>
        <div className="sp-field-row">
          <div className="sp-field">
            <label className="sp-label" htmlFor="sp-guest-attendance">
              Asistencia
            </label>
            <PlannerSelect
              id="sp-guest-attendance"
              className="sp-input"
              value={draft.attendance}
              onValueChange={(value) =>
                update("attendance", value as PlannerGuest["attendance"])
              }
            >
              <PlannerOption value="confirmed">Confirmado</PlannerOption>
              <PlannerOption value="pending">Pendiente</PlannerOption>
              <PlannerOption value="declined">Rechazado</PlannerOption>
            </PlannerSelect>
            {draft.attendance === "declined" ? (
              <p className="sp-hint">
                Quien declina no se sienta; se liberará su mesa.
              </p>
            ) : null}
          </div>
          <div className="sp-field sp-field--check">
            <Input
              id="sp-guest-child"
              className="sp-check"
              type="checkbox"
              checked={draft.isChild}
              onChange={(event) => update("isChild", event.target.checked)}
            />
            <label
              className="sp-label sp-label--check"
              htmlFor="sp-guest-child"
            >
              Es niño/a
            </label>
          </div>
        </div>
        <div className="sp-field-row">
          <div className="sp-field">
            <label className="sp-label" htmlFor="sp-guest-diet">
              Restricciones de dieta
            </label>
            <Input
              id="sp-guest-diet"
              className="sp-input"
              type="text"
              value={draft.dietaryRestrictions}
              maxLength={120}
              placeholder="Vegetariana, sin gluten…"
              autoComplete="off"
              onChange={(event) =>
                update("dietaryRestrictions", event.target.value)
              }
            />
          </div>
          <div className="sp-field">
            <label className="sp-label" htmlFor="sp-guest-allergies">
              Alergias
            </label>
            <Input
              id="sp-guest-allergies"
              className="sp-input"
              type="text"
              value={draft.allergies}
              maxLength={120}
              placeholder="Frutos secos, marisco…"
              autoComplete="off"
              onChange={(event) => update("allergies", event.target.value)}
            />
          </div>
        </div>
        <div className="sp-field">
          <label className="sp-label" htmlFor="sp-guest-notes">
            Notas
          </label>
          <Textarea
            id="sp-guest-notes"
            className="sp-input sp-input--area"
            rows={2}
            maxLength={240}
            value={draft.notes}
            placeholder="Silla para bebé, llega más tarde, preferencia de sitio…"
            onChange={(event) => update("notes", event.target.value)}
          />
        </div>
        <FieldError id="sp-guest-error" message={error} />
        <footer className="sp-dialog__foot">
          <Button
            variant="ghost"
            type="button"
            className="sp-btn sp-btn--ghost"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            variant="ghost"
            type="submit"
            className="sp-btn sp-btn--primary"
          >
            {guest ? "Guardar cambios" : "Añadir invitado"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

export type ConfirmRequest = {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
};

export function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest | null;
  onClose: () => void;
}) {
  if (!request) return null;
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent className="sp-modal">
        <AlertDialogHeader>
          <AlertDialogTitle>{request.title}</AlertDialogTitle>
          <AlertDialogDescription>{request.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className={
              request.danger
                ? "sp-btn sp-btn--danger"
                : "sp-btn sp-btn--primary"
            }
            onClick={() => {
              request.onConfirm();
              onClose();
            }}
          >
            {request.danger ? <Trash2 aria-hidden="true" /> : null}
            {request.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
