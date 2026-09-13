import { Checkbox } from "@/components/ui/checkbox";
import { PlannerSelect, PlannerOption } from "./PlannerSelect";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { memo, useMemo, useState } from "react";
import {
  Baby,
  Leaf,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  UserRoundX,
  Users,
} from "lucide-react";
import type { PlannerGuest, PlannerTable } from "@/lib/seating";
import { ATTENDANCE_LABELS, norm, sortGuests } from "./utils";

export type GuestFilters = {
  query: string;
  attendance: "all" | PlannerGuest["attendance"];
  unassignedOnly: boolean;
  childrenOnly: boolean;
  restrictedOnly: boolean;
};

export const defaultFilters: GuestFilters = {
  query: "",
  attendance: "all",
  unassignedOnly: false,
  childrenOnly: false,
  restrictedOnly: false,
};

function matchesFilters(guest: PlannerGuest, filters: GuestFilters): boolean {
  if (filters.attendance !== "all" && guest.attendance !== filters.attendance) {
    return false;
  }
  if (
    filters.unassignedOnly &&
    (guest.tableId || guest.attendance === "declined")
  ) {
    return false;
  }
  if (filters.childrenOnly && !guest.isChild) return false;
  if (
    filters.restrictedOnly &&
    !guest.dietaryRestrictions.trim() &&
    !guest.allergies.trim()
  ) {
    return false;
  }
  const query = norm(filters.query.trim());
  if (query) {
    const haystack = norm(
      `${guest.name} ${guest.group} ${guest.dietaryRestrictions} ${guest.allergies} ${guest.notes}`,
    );
    if (!haystack.includes(query)) return false;
  }
  return true;
}

function attendanceChipClass(attendance: PlannerGuest["attendance"]): string {
  switch (attendance) {
    case "confirmed":
      return "sp-chip sp-chip--confirmed";
    case "pending":
      return "sp-chip sp-chip--pending";
    default:
      return "sp-chip sp-chip--declined";
  }
}

export const GuestSidebar = memo(function GuestSidebar({
  guests,
  tables,
  onAssign,
  onEdit,
  onDelete,
  onCreate,
}: {
  guests: PlannerGuest[];
  tables: PlannerTable[];
  onAssign: (guestId: string, tableId: string | null) => void;
  onEdit: (guest: PlannerGuest) => void;
  onDelete: (guest: PlannerGuest) => void;
  onCreate: () => void;
}) {
  const [filters, setFilters] = useState<GuestFilters>(defaultFilters);

  const visible = useMemo(() => {
    const filtered = guests.filter((guest) => matchesFilters(guest, filters));
    return sortGuests(filtered);
  }, [guests, filters]);

  const occupancy = useMemo(() => {
    const counts = new Map<string, number>();
    for (const guest of guests) {
      if (guest.tableId)
        counts.set(guest.tableId, (counts.get(guest.tableId) ?? 0) + 1);
    }
    return counts;
  }, [guests]);

  const updateFilters = (patch: Partial<GuestFilters>) =>
    setFilters((current) => ({ ...current, ...patch }));

  const tableOptions = (guest: PlannerGuest) =>
    tables.map((table) => {
      const taken = occupancy.get(table.id) ?? 0;
      const mine = guest.tableId === table.id;
      const remaining = table.capacity - taken + (mine ? 1 : 0);
      const fits = mine || remaining > 0;
      const suffix = mine
        ? remaining - 1 > 0
          ? `· ${remaining - 1} libres más`
          : "· completa"
        : remaining > 0
          ? `· ${remaining} libres`
          : "· completa";
      return (
        <PlannerOption key={table.id} value={table.id} disabled={!fits}>
          {table.name} {suffix}
        </PlannerOption>
      );
    });

  // The badge counts the guests still in play: declined ones are kept in the
  // list (and reachable through the "Rechazados" filter) but never seated.
  const declinedCount = guests.filter(
    (guest) => guest.attendance === "declined",
  ).length;
  const activeCount = guests.length - declinedCount;

  let lastGroup: string | null = null;

  return (
    <section className="sp-panel sp-sidebar" aria-label="Invitados">
      <header className="sp-sidebar__head">
        <h2 className="sp-section-title">
          Invitados
          <span
            className="sp-count"
            title={
              declinedCount > 0
                ? `${activeCount} sin contar ${declinedCount} que han declinado`
                : undefined
            }
          >
            {activeCount}
          </span>
        </h2>
        <Button
          variant="ghost"
          type="button"
          className="sp-btn sp-btn--primary sp-btn--small"
          onClick={onCreate}
        >
          <Plus aria-hidden="true" />
          Nuevo
        </Button>
      </header>

      <div className="sp-filters">
        <div className="sp-search">
          <Search aria-hidden="true" className="sp-search__icon" />
          <Input
            type="search"
            className="sp-input sp-input--search"
            placeholder="Buscar por nombre, grupo, dieta…"
            aria-label="Buscar invitados"
            value={filters.query}
            onChange={(event) => updateFilters({ query: event.target.value })}
          />
          {filters.query ? (
            <Button
              variant="ghost"
              type="button"
              className="sp-iconbtn sp-iconbtn--tiny"
              aria-label="Limpiar búsqueda"
              onClick={() => updateFilters({ query: "" })}
            >
              ×
            </Button>
          ) : null}
        </div>
        <div className="sp-filters__row">
          <label
            className="sp-label sp-label--inline"
            htmlFor="sp-filter-attendance"
          >
            Asistencia
          </label>
          <PlannerSelect
            id="sp-filter-attendance"
            className="sp-input sp-input--compact"
            value={filters.attendance}
            onValueChange={(value) =>
              updateFilters({
                attendance: value as GuestFilters["attendance"],
              })
            }
          >
            <PlannerOption value="all">Todas</PlannerOption>
            <PlannerOption value="confirmed">Confirmados</PlannerOption>
            <PlannerOption value="pending">Pendientes</PlannerOption>
            <PlannerOption value="declined">Rechazados</PlannerOption>
          </PlannerSelect>
        </div>
        <div className="sp-filters__checks">
          <label className="sp-checkwrap">
            <Checkbox
              className="sp-check"
              checked={filters.unassignedOnly}
              onCheckedChange={(checked) =>
                updateFilters({ unassignedOnly: checked === true })
              }
            />
            Sin mesa
          </label>
          <label className="sp-checkwrap">
            <Checkbox
              className="sp-check"
              checked={filters.childrenOnly}
              onCheckedChange={(checked) =>
                updateFilters({ childrenOnly: checked === true })
              }
            />
            Niños
          </label>
          <label className="sp-checkwrap">
            <Checkbox
              className="sp-check"
              checked={filters.restrictedOnly}
              onCheckedChange={(checked) =>
                updateFilters({ restrictedOnly: checked === true })
              }
            />
            Dieta o alergias
          </label>
        </div>
      </div>

      <p className="sp-sidebar__result" role="status">
        {visible.length === guests.length
          ? `${guests.length} invitados`
          : `${visible.length} de ${guests.length} invitados`}
        {declinedCount > 0
          ? ` · ${declinedCount} ${declinedCount === 1 ? "ha declinado" : "han declinado"}`
          : ""}
      </p>

      {guests.length === 0 ? (
        <div className="sp-empty sp-empty--small">
          <Users aria-hidden="true" />
          <p>Todavía no hay invitados.</p>
          <Button
            variant="ghost"
            type="button"
            className="sp-btn sp-btn--ghost"
            onClick={onCreate}
          >
            Añadir el primero
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <div className="sp-empty sp-empty--small">
          <Search aria-hidden="true" />
          <p>Ningún invitado coincide con la búsqueda.</p>
          <Button
            variant="ghost"
            type="button"
            className="sp-btn sp-btn--ghost"
            onClick={() => setFilters(defaultFilters)}
          >
            Limpiar filtros
          </Button>
        </div>
      ) : (
        <ul className="sp-guest-list">
          {visible.map((guest) => {
            const showGroup = guest.group && guest.group !== lastGroup;
            lastGroup = guest.group;
            return (
              <li key={guest.id} className="sp-guest-item">
                {showGroup ? (
                  <p className="sp-guest-group" aria-hidden="true">
                    {guest.group}
                  </p>
                ) : null}
                <div
                  className={
                    guest.tableId
                      ? "sp-guest-row sp-guest-row--seated"
                      : "sp-guest-row"
                  }
                >
                  <div className="sp-guest-row__info">
                    <span className="sp-guest-row__name">
                      {guest.name}
                      {guest.isChild ? (
                        <Baby aria-hidden="true" className="sp-minicon" />
                      ) : null}
                    </span>
                    <span className="sp-chips">
                      <span className={attendanceChipClass(guest.attendance)}>
                        {ATTENDANCE_LABELS[guest.attendance]}
                      </span>
                      {guest.dietaryRestrictions.trim() ? (
                        <span className="sp-chip sp-chip--diet">
                          <Leaf aria-hidden="true" />
                          {guest.dietaryRestrictions.trim()}
                        </span>
                      ) : null}
                      {guest.allergies.trim() ? (
                        <span className="sp-chip sp-chip--allergy">
                          <ShieldAlert aria-hidden="true" />
                          {guest.allergies.trim()}
                        </span>
                      ) : null}
                      {guest.notes.trim() ? (
                        <span className="sp-chip sp-chip--note">
                          {guest.notes.trim()}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="sp-guest-row__actions">
                    <PlannerSelect
                      className="sp-select-assign"
                      aria-label={`Mesa de ${guest.name}`}
                      value={guest.tableId ?? ""}
                      disabled={guest.attendance === "declined"}
                      onValueChange={(value) =>
                        onAssign(guest.id, value === "" ? null : value)
                      }
                    >
                      <PlannerOption value="">
                        {guest.attendance === "declined"
                          ? "Sin mesa (rechazó)"
                          : "Sin mesa"}
                      </PlannerOption>
                      {tableOptions(guest)}
                    </PlannerSelect>
                    <Button
                      variant="ghost"
                      type="button"
                      className="sp-iconbtn"
                      aria-label={`Editar a ${guest.name}`}
                      title={`Editar a ${guest.name}`}
                      onClick={() => onEdit(guest)}
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      type="button"
                      className="sp-iconbtn sp-iconbtn--danger"
                      aria-label={`Eliminar a ${guest.name}`}
                      title={`Eliminar a ${guest.name}`}
                      onClick={() => onDelete(guest)}
                    >
                      <UserRoundX aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
});
