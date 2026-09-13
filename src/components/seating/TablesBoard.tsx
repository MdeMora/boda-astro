import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SeatingMap } from "./SeatingMap";
import { PlannerSelect, PlannerOption } from "./PlannerSelect";
import { Button } from "@/components/ui/button";
import { memo, useMemo } from "react";
import {
  Circle,
  Pencil,
  Plus,
  RectangleHorizontal,
  Trash2,
} from "lucide-react";
import type { PlannerGuest, PlannerTable } from "@/lib/seating";
import { ATTENDANCE_LABELS, compareByField, compareTables } from "./utils";

function shapeIcon(shape: PlannerTable["shape"]) {
  return shape === "round" ? (
    <Circle
      aria-hidden="true"
      className="sp-table__shape sp-table__shape--round"
    />
  ) : (
    <RectangleHorizontal aria-hidden="true" className="sp-table__shape" />
  );
}

function freeSlots(count: number) {
  return Array.from({ length: count }, (_, index) => (
    <li key={index} className="sp-slot" aria-hidden="true">
      plaza libre
    </li>
  ));
}

export const TablesBoard = memo(function TablesBoard({
  tables,
  guests,
  onAssign,
  onEditTable,
  onDeleteTable,
  onCreateTable,
  onMoveTable,
  onSeat,
}: {
  tables: PlannerTable[];
  guests: PlannerGuest[];
  onAssign: (guestId: string, tableId: string | null) => void;
  onSeat: (guestId: string, tableId: string, seat: number) => void;
  onEditTable: (table: PlannerTable) => void;
  onDeleteTable: (table: PlannerTable) => void;
  onCreateTable: () => void;
  onMoveTable: (id: string, position: { x: number; y: number }) => void;
}) {
  const sortedTables = useMemo(() => [...tables].sort(compareTables), [tables]);

  const byTable = useMemo(() => {
    const map = new Map<string, PlannerGuest[]>();
    for (const table of tables) map.set(table.id, []);
    for (const guest of guests) {
      if (guest.tableId && map.has(guest.tableId)) {
        map.get(guest.tableId)!.push(guest);
      }
    }
    for (const list of map.values())
      list.sort(compareByField((guest) => guest.name));
    return map;
  }, [tables, guests]);

  const candidates = useMemo(
    () =>
      guests
        .filter(
          (guest) => guest.attendance !== "declined" && guest.tableId === null,
        )
        .sort(compareByField((guest) => guest.name)),
    [guests],
  );

  if (tables.length === 0) {
    return (
      <section className="sp-panel sp-board" aria-label="Mesas">
        <header className="sp-board__head">
          <h2 className="sp-section-title">
            Mesas
            <span className="sp-count">{tables.length}</span>
          </h2>
          <Button
            variant="ghost"
            type="button"
            className="sp-btn sp-btn--primary sp-btn--small"
            onClick={onCreateTable}
          >
            <Plus aria-hidden="true" />
            Nueva mesa
          </Button>
        </header>
        <div className="sp-empty">
          <Circle aria-hidden="true" />
          <h3>Aún no hay mesas</h3>
          <p>
            Crea la primera mesa y reparte a tus invitados. Puedes definir
            nombre, forma y plazas.
          </p>
          <Button
            variant="ghost"
            type="button"
            className="sp-btn sp-btn--primary"
            onClick={onCreateTable}
          >
            <Plus aria-hidden="true" />
            Crear la primera mesa
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="sp-panel sp-board" aria-label="Mesas">
      <header className="sp-board__head">
        <h2 className="sp-section-title">
          Mesas
          <span className="sp-count">{tables.length}</span>
        </h2>
        <Button
          variant="ghost"
          type="button"
          className="sp-btn sp-btn--primary sp-btn--small"
          onClick={onCreateTable}
        >
          <Plus aria-hidden="true" />
          Nueva mesa
        </Button>
      </header>
      <Tabs defaultValue="map">
        <TabsList className="sp-view-tabs" aria-label="Vista de mesas">
          <TabsTrigger value="map">Plano visual</TabsTrigger>
          <TabsTrigger value="list">Lista de mesas</TabsTrigger>
        </TabsList>
        <TabsContent value="map">
          <SeatingMap
            tables={sortedTables}
            guests={guests}
            onAssign={onAssign}
            onSeat={onSeat}
            onMoveTable={onMoveTable}
            onEditTable={onEditTable}
          />
        </TabsContent>
        <TabsContent value="list">
          <ul className="sp-tables">
            {sortedTables.map((table) => {
              const seated = byTable.get(table.id) ?? [];
              const remaining = table.capacity - seated.length;
              const isFull = remaining <= 0;
              return (
                <li
                  key={table.id}
                  className={isFull ? "sp-table sp-table--full" : "sp-table"}
                >
                  <header className="sp-table__head">
                    {shapeIcon(table.shape)}
                    <h3 className="sp-table__name">{table.name}</h3>
                    <span
                      className={
                        isFull
                          ? "sp-occupancy sp-occupancy--full"
                          : "sp-occupancy"
                      }
                      title={`${seated.length} de ${table.capacity} plazas ocupadas`}
                    >
                      {seated.length}/{table.capacity}
                    </span>
                    <div className="sp-table__tools">
                      <Button
                        variant="ghost"
                        type="button"
                        className="sp-iconbtn"
                        aria-label={`Editar ${table.name}`}
                        title={`Editar ${table.name}`}
                        onClick={() => onEditTable(table)}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        type="button"
                        className="sp-iconbtn sp-iconbtn--danger"
                        aria-label={`Eliminar ${table.name}`}
                        title={`Eliminar ${table.name}`}
                        onClick={() => onDeleteTable(table)}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </header>
                  {seated.length === 0 ? (
                    <p className="sp-table__empty">Mesa vacía de momento.</p>
                  ) : (
                    <ul className="sp-table__guests">
                      {seated.map((guest) => (
                        <li key={guest.id} className="sp-seated">
                          <span className="sp-seated__name">
                            {guest.name}
                            {guest.attendance === "pending" ? (
                              <span
                                className="sp-minibadge"
                                title={`${guest.name} aún está pendiente de confirmar`}
                              >
                                {ATTENDANCE_LABELS[guest.attendance]}
                              </span>
                            ) : null}
                          </span>
                          <PlannerSelect
                            className="sp-select-assign sp-select-assign--compact"
                            aria-label={`Mover a ${guest.name} o quitar de ${table.name}`}
                            value={table.id}
                            onValueChange={(value) => {
                              const target = value === "" ? null : value;
                              if (target !== table.id)
                                onAssign(guest.id, target);
                            }}
                          >
                            <PlannerOption value="">
                              Quitar de la mesa
                            </PlannerOption>
                            {sortedTables.map((other) => {
                              const mine = other.id === table.id;
                              const taken = (byTable.get(other.id) ?? [])
                                .length;
                              const free = other.capacity - taken;
                              if (mine) {
                                return (
                                  <PlannerOption
                                    key={other.id}
                                    value={other.id}
                                  >
                                    {other.name}
                                  </PlannerOption>
                                );
                              }
                              return (
                                <PlannerOption
                                  key={other.id}
                                  value={other.id}
                                  disabled={free <= 0}
                                >
                                  Mover a {other.name}{" "}
                                  {free > 0 ? `· ${free} libres` : "· completa"}
                                </PlannerOption>
                              );
                            })}
                          </PlannerSelect>
                        </li>
                      ))}
                    </ul>
                  )}
                  {remaining > 0 ? freeSlots(Math.min(remaining, 8)) : null}
                  {remaining > 8 ? (
                    <p className="sp-slots-more">
                      …y {remaining - 8} plazas más
                    </p>
                  ) : null}
                  <footer className="sp-table__add">
                    <PlannerSelect
                      id={`sp-add-${table.id}`}
                      className="sp-input sp-input--compact sp-table__add-select"
                      value=""
                      disabled={isFull || candidates.length === 0}
                      aria-label={`Añadir invitado a ${table.name}`}
                      onValueChange={(value) => {
                        if (value) onAssign(value, table.id);
                      }}
                    >
                      <PlannerOption value="">
                        {isFull
                          ? "Mesa completa"
                          : candidates.length === 0
                            ? "Todos los invitados están sentados"
                            : "Añadir invitado…"}
                      </PlannerOption>
                      {candidates.map((guest) => (
                        <PlannerOption key={guest.id} value={guest.id}>
                          {guest.name}
                          {guest.group ? ` · ${guest.group}` : ""}
                        </PlannerOption>
                      ))}
                    </PlannerSelect>
                  </footer>
                </li>
              );
            })}
          </ul>
        </TabsContent>
      </Tabs>
    </section>
  );
});
