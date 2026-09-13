import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Maximize2, Minimize2, Pencil, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlannerSelect, PlannerOption } from "./PlannerSelect";
import {
  tableSeats,
  type PlannerGuest,
  type PlannerTable,
} from "@/lib/seating";

type Position = { x: number; y: number };
type Seats = (PlannerGuest | null)[];
/** Where a dragged guest currently hovers: a seat, a whole table, or the tray. */
type Over = { tableId: string; seat: number | null } | { tableId: null };
type DragKind = "table" | "guest";

export const defaultPosition = (index: number): Position => ({
  x: 40 + (index % 3) * 420,
  y: 40 + Math.floor(index / 3) * 420,
});
const clamp = (value: number) =>
  Math.max(0, Math.min(10000, Math.round(value)));

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.25;
const SEAT = 40;
const LABEL = 76;
const LABEL_GAP = SEAT / 2 + 6;

type Anchor = "top" | "bottom" | "left" | "right";
interface SeatSpot {
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  labelW: number;
  /** Which edge of the label touches the seat, so text grows away from it. */
  anchor: Anchor;
}
interface Geometry {
  width: number;
  height: number;
  cx: number;
  cy: number;
  surfaceW: number;
  surfaceH: number;
  seats: SeatSpot[];
}

/** Table footprint in canvas pixels; grows with capacity so every seat is drawn. */
function geometry(table: PlannerTable): Geometry {
  const n = Math.max(1, table.capacity);
  if (table.shape === "round") {
    const seatR = Math.max(96, (n * 58) / (2 * Math.PI));
    const half = Math.ceil(seatR + LABEL_GAP + LABEL + 6);
    const surface = Math.round((seatR - SEAT / 2 - 10) * 2);
    return {
      width: half * 2,
      height: half * 2,
      cx: half,
      cy: half,
      surfaceW: surface,
      surfaceH: surface,
      seats: Array.from({ length: n }, (_, index) => {
        const angle = (index / n) * Math.PI * 2 - Math.PI / 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        // Labels leave the seat straight out (never diagonally), so they
        // clear their own circle and stack cleanly beside neighbours.
        const anchor: Anchor =
          Math.abs(cos) < 0.25
            ? sin < 0
              ? "top"
              : "bottom"
            : cos > 0
              ? "right"
              : "left";
        const x = half + cos * seatR;
        const y = half + sin * seatR;
        const vertical = anchor === "top" || anchor === "bottom";
        const sign = anchor === "top" || anchor === "left" ? -1 : 1;
        return {
          x,
          y,
          labelX: vertical ? x : x + sign * LABEL_GAP,
          labelY: vertical ? y + sign * LABEL_GAP : y,
          labelW: LABEL,
          anchor,
        };
      }),
    };
  }
  const top = Math.ceil(n / 2);
  const bottom = n - top;
  const surfaceW = Math.max(180, top * 60 + 16);
  const surfaceH = 116;
  const pad = 92;
  const width = surfaceW + 96;
  const height = surfaceH + pad * 2;
  const cx = width / 2;
  const cy = height / 2;
  const row = (count: number, y: number, anchor: Anchor): SeatSpot[] => {
    const slot = (surfaceW - 16) / Math.max(1, count);
    const direction = anchor === "top" ? -1 : 1;
    return Array.from({ length: count }, (_, index) => {
      const x = cx - surfaceW / 2 + 8 + (index + 0.5) * slot;
      return {
        x,
        y,
        labelX: x,
        labelY: y + direction * LABEL_GAP,
        labelW: Math.min(LABEL, Math.floor(slot) - 4),
        anchor,
      };
    });
  };
  const topY = cy - surfaceH / 2 - SEAT / 2 - 8;
  const bottomY = cy + surfaceH / 2 + SEAT / 2 + 8;
  return {
    width,
    height,
    cx,
    cy,
    surfaceW,
    surfaceH,
    seats: [...row(top, topY, "top"), ...row(bottom, bottomY, "bottom")],
  };
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

function sameOver(a: Over | null, b: Over | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.tableId === null || b.tableId === null) return a.tableId === b.tableId;
  return a.tableId === b.tableId && a.seat === b.seat;
}

function readTarget(x: number, y: number): Over | null {
  const target = document
    .elementFromPoint(x, y)
    ?.closest<HTMLElement>("[data-seat-target]");
  if (!target) return null;
  const tableId = target.dataset.seatTarget || null;
  if (tableId === null) return { tableId: null };
  const index = target.dataset.seatIndex;
  return { tableId, seat: index === undefined ? null : Number(index) };
}

export function SeatingMap({
  tables,
  guests,
  onAssign,
  onSeat,
  onMoveTable,
  onEditTable,
}: {
  tables: PlannerTable[];
  guests: PlannerGuest[];
  onAssign: (guestId: string, tableId: string | null) => void;
  onSeat: (guestId: string, tableId: string, seat: number) => void;
  onMoveTable: (tableId: string, position: Position) => void;
  onEditTable: (table: PlannerTable) => void;
}) {
  const [zoom, setZoom] = useState(0.75);
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    id: string;
    position: Position;
  } | null>(null);
  const previewRef = useRef<{ id: string; position: Position } | null>(null);
  const [dragGuest, setDragGuest] = useState<PlannerGuest | null>(null);
  const [over, setOver] = useState<Over | null>(null);
  const overRef = useRef<Over | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const drag = useRef<{
    id: string;
    start: Position;
    origin: Position;
    kind: DragKind;
    moved: boolean;
  } | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<Position>({ x: 0, y: 0 });

  const seatsByTable = useMemo(() => {
    const map = new Map<string, Seats>();
    for (const table of tables) map.set(table.id, tableSeats(guests, table));
    return map;
  }, [tables, guests]);
  const geometries = useMemo(() => tables.map(geometry), [tables]);
  const selected = guests.find((guest) => guest.id === selectedId) ?? null;
  const selectedTable = selected?.tableId
    ? tables.find((table) => table.id === selected.tableId)
    : undefined;
  const unassigned = guests.filter(
    (guest) => !guest.tableId && guest.attendance !== "declined",
  );
  const positions = tables.map((table, index) =>
    preview?.id === table.id
      ? preview.position
      : (table.position ?? defaultPosition(index)),
  );
  const width = Math.max(
    960,
    ...positions.map((pos, index) => pos.x + geometries[index].width + 40),
  );
  const height = Math.max(
    640,
    ...positions.map((pos, index) => pos.y + geometries[index].height + 40),
  );

  const placeGhost = useCallback((x: number, y: number) => {
    pointerRef.current = { x, y };
    if (ghostRef.current)
      ghostRef.current.style.transform = `translate(${x + 14}px, ${y + 14}px)`;
  }, []);
  const setGhost = useCallback(
    (element: HTMLDivElement | null) => {
      ghostRef.current = element;
      if (element) placeGhost(pointerRef.current.x, pointerRef.current.y);
    },
    [placeGhost],
  );
  const updateOver = useCallback((next: Over | null) => {
    if (sameOver(overRef.current, next)) return;
    overRef.current = next;
    setOver(next);
  }, []);

  const start = useCallback(
    (
      event: PointerEvent<HTMLElement>,
      id: string,
      kind: DragKind,
      origin: Position = { x: 0, y: 0 },
    ) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = {
        id,
        kind,
        origin,
        start: { x: event.clientX, y: event.clientY },
        moved: false,
      };
      if (kind === "guest") setSelectedId(id);
    },
    [],
  );
  const move = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const current = drag.current;
      if (!current) return;
      const dx = event.clientX - current.start.x;
      const dy = event.clientY - current.start.y;
      if (!current.moved && Math.hypot(dx, dy) < 5) return;
      current.moved = true;
      if (current.kind === "table") {
        const next = {
          id: current.id,
          position: {
            x: clamp(current.origin.x + dx / zoom),
            y: clamp(current.origin.y + dy / zoom),
          },
        };
        if (
          previewRef.current?.position.x === next.position.x &&
          previewRef.current?.position.y === next.position.y
        )
          return;
        previewRef.current = next;
        setPreview(next);
        return;
      }
      placeGhost(event.clientX, event.clientY);
      setDragGuest(
        (existing) =>
          existing ?? guests.find((guest) => guest.id === current.id) ?? null,
      );
      updateOver(readTarget(event.clientX, event.clientY));
    },
    [zoom, guests, placeGhost, updateOver],
  );
  const reset = useCallback(() => {
    drag.current = null;
    previewRef.current = null;
    setPreview(null);
    setDragGuest(null);
    updateOver(null);
  }, [updateOver]);
  const end = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const preview = previewRef.current;
      const current = drag.current;
      if (current?.moved) {
        if (current.kind === "table" && preview) {
          onMoveTable(current.id, preview.position);
          setAnnouncement("Posición de la mesa guardada.");
        } else if (current.kind === "guest") {
          const target = readTarget(event.clientX, event.clientY);
          const guest = guests.find((candidate) => candidate.id === current.id);
          if (target && guest) {
            if (target.tableId === null) {
              if (guest.tableId) onAssign(guest.id, null);
              setAnnouncement(`${guest.name} ya no tiene mesa.`);
            } else {
              const table = tables.find((t) => t.id === target.tableId);
              if (target.seat === null) onAssign(guest.id, target.tableId);
              else onSeat(guest.id, target.tableId, target.seat);
              setAnnouncement(
                `${guest.name} ahora en ${table?.name ?? "otra mesa"}${target.seat === null ? "" : `, asiento ${target.seat + 1}`}.`,
              );
            }
          }
        }
      }
      reset();
    },
    [guests, tables, onMoveTable, onAssign, onSeat, reset],
  );

  const handlers = useMemo(
    () => ({ start, move, end, cancel: reset }),
    [start, move, end, reset],
  );

  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Let open menus/dialogs consume Escape first.
      if (
        document.querySelector(
          "[data-slot='select-content'], [data-slot='dialog-content'], [data-slot='alert-dialog-content']",
        )
      )
        return;
      setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  const seatOfSelected =
    selected?.tableId && seatsByTable.get(selected.tableId)
      ? seatsByTable
          .get(selected.tableId)!
          .findIndex((guest) => guest?.id === selected.id)
      : -1;

  return (
    <div
      className={`sp-map ${dragGuest ? "sp-map--dragging" : ""} ${fullscreen ? "sp-map--fullscreen" : ""}`}
      role={fullscreen ? "dialog" : undefined}
      aria-modal={fullscreen || undefined}
      aria-label={fullscreen ? "Plano de mesas a pantalla completa" : undefined}
    >
      <div className="sp-map-bar">
        <div className="sp-map-selection">
          {selected ? (
            <>
              <span className="sp-map-selection__who">
                <i className="sp-avatar" aria-hidden="true">
                  {initials(selected.name)}
                </i>
                <strong>{selected.name}</strong>
              </span>
              <PlannerSelect
                aria-label={`Mesa para ${selected.name}`}
                value={selected.tableId ?? ""}
                onValueChange={(value) => onAssign(selected.id, value || null)}
              >
                <PlannerOption value="">Sin mesa</PlannerOption>
                {tables.map((table) => {
                  const taken = seatsByTable
                    .get(table.id)!
                    .filter(Boolean).length;
                  return (
                    <PlannerOption
                      key={table.id}
                      value={table.id}
                      disabled={
                        table.id !== selected.tableId && taken >= table.capacity
                      }
                    >
                      {table.name}
                    </PlannerOption>
                  );
                })}
              </PlannerSelect>
              {selectedTable && selected.tableId ? (
                <PlannerSelect
                  aria-label={`Asiento de ${selected.name} en ${selectedTable.name}`}
                  value={seatOfSelected >= 0 ? String(seatOfSelected) : ""}
                  onValueChange={(value) => {
                    if (value !== "" && selected.tableId)
                      onSeat(selected.id, selected.tableId, Number(value));
                  }}
                >
                  {seatsByTable
                    .get(selectedTable.id)!
                    .map((occupant, index) => (
                      <PlannerOption key={index} value={String(index)}>
                        Asiento {index + 1}
                        {occupant && occupant.id !== selected.id
                          ? ` · cambiar con ${occupant.name}`
                          : occupant
                            ? ""
                            : " · libre"}
                      </PlannerOption>
                    ))}
                </PlannerSelect>
              ) : null}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Deseleccionar invitado"
                onClick={() => setSelectedId(null)}
              >
                <X />
              </Button>
            </>
          ) : (
            <p>
              Arrastra un invitado hasta un asiento, en su mesa o en otra, para
              cambiarlo de sitio. Arrastra el centro de una mesa para moverla.
            </p>
          )}
        </div>
        <div className="sp-map-zoom" aria-label="Zoom del plano">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Alejar plano"
            disabled={zoom <= ZOOM_MIN}
            onClick={() =>
              setZoom((value) => Math.max(ZOOM_MIN, value - ZOOM_STEP))
            }
          >
            <ZoomOut />
          </Button>
          <button
            type="button"
            className="sp-map-zoom__value"
            title="Restablecer zoom"
            onClick={() => setZoom(0.75)}
          >
            {Math.round(zoom * 100)}%
          </button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Acercar plano"
            disabled={zoom >= ZOOM_MAX}
            onClick={() =>
              setZoom((value) => Math.min(ZOOM_MAX, value + ZOOM_STEP))
            }
          >
            <ZoomIn />
          </Button>
          <span className="sp-map-zoom__divider" aria-hidden="true" />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={
              fullscreen ? "Salir de pantalla completa" : "Pantalla completa"
            }
            title={
              fullscreen
                ? "Salir de pantalla completa (Esc)"
                : "Pantalla completa"
            }
            aria-pressed={fullscreen}
            onClick={() => setFullscreen((value) => !value)}
          >
            {fullscreen ? <Minimize2 /> : <Maximize2 />}
          </Button>
        </div>
      </div>

      <div
        className={`sp-map-tray ${over?.tableId === null ? "sp-map-tray--over" : ""}`}
        data-seat-target=""
      >
        <strong>
          Sin mesa <span className="sp-count">{unassigned.length}</span>
        </strong>
        <div>
          {unassigned.length ? (
            unassigned.map((guest) => (
              <GuestChip
                key={guest.id}
                guest={guest}
                selected={selectedId === guest.id}
                handlers={handlers}
                onSelect={setSelectedId}
              />
            ))
          ) : (
            <p>
              Todos tienen sitio. Suelta aquí a alguien para quitarle la mesa.
            </p>
          )}
        </div>
      </div>

      <div
        className="sp-map-scroll"
        tabIndex={0}
        role="region"
        aria-label="Plano de mesas, desplazable"
      >
        <div style={{ width: width * zoom, height: height * zoom }}>
          <div
            className="sp-map-canvas"
            style={{
              width,
              height,
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
          >
            {tables.map((table, index) => (
              <MapTable
                key={table.id}
                table={table}
                seats={seatsByTable.get(table.id)!}
                geometry={geometries[index]}
                x={positions[index].x}
                y={positions[index].y}
                moving={preview?.id === table.id}
                selectedId={selectedId}
                selectedName={selected?.name ?? null}
                over={over && over.tableId === table.id ? over.seat : undefined}
                handlers={handlers}
                onSelect={setSelectedId}
                onSeat={onSeat}
                onMoveTable={onMoveTable}
                onEditTable={onEditTable}
                setAnnouncement={setAnnouncement}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="sp-map-legend">
        <span>
          <i className="sp-legend-seat sp-legend-seat--taken" /> Ocupado
        </span>
        <span>
          <i className="sp-legend-seat" /> Libre
        </span>
        <span>
          <i className="sp-legend-seat sp-legend-seat--pending" /> Pendiente de
          confirmar
        </span>
      </div>

      {dragGuest ? (
        <div ref={setGhost} className="sp-map-ghost" aria-hidden="true">
          <i className="sp-avatar">{initials(dragGuest.name)}</i>
          {dragGuest.name}
        </div>
      ) : null}
      <p className="sr-only" role="status">
        {announcement}
      </p>
    </div>
  );
}

interface DragHandlers {
  start: (
    event: PointerEvent<HTMLElement>,
    id: string,
    kind: DragKind,
    origin?: Position,
  ) => void;
  move: (event: PointerEvent<HTMLElement>) => void;
  end: (event: PointerEvent<HTMLElement>) => void;
  cancel: () => void;
}

const GuestChip = memo(function GuestChip({
  guest,
  selected,
  handlers,
  onSelect,
}: {
  guest: PlannerGuest;
  selected: boolean;
  handlers: DragHandlers;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={`sp-map-chip ${selected ? "sp-map-chip--selected" : ""} ${guest.attendance === "pending" ? "sp-map-chip--pending" : ""}`}
      aria-label={`Mover a ${guest.name}`}
      aria-pressed={selected}
      onClick={() => onSelect(guest.id)}
      onPointerDown={(event) => handlers.start(event, guest.id, "guest")}
      onPointerMove={handlers.move}
      onPointerUp={handlers.end}
      onPointerCancel={handlers.cancel}
    >
      <i className="sp-avatar" aria-hidden="true">
        {initials(guest.name)}
      </i>
      <span>{guest.name}</span>
    </button>
  );
});

const MapTable = memo(function MapTable({
  table,
  seats,
  geometry,
  x,
  y,
  moving,
  selectedId,
  selectedName,
  over,
  handlers,
  onSelect,
  onSeat,
  onMoveTable,
  onEditTable,
  setAnnouncement,
}: {
  table: PlannerTable;
  seats: Seats;
  geometry: Geometry;
  x: number;
  y: number;
  moving: boolean;
  selectedId: string | null;
  selectedName: string | null;
  /** Hovered seat index while dragging; `null` = whole table; `undefined` = not hovered. */
  over: number | null | undefined;
  handlers: DragHandlers;
  onSelect: (id: string) => void;
  onSeat: (guestId: string, tableId: string, seat: number) => void;
  onMoveTable: (id: string, position: Position) => void;
  onEditTable: (table: PlannerTable) => void;
  setAnnouncement: (message: string) => void;
}) {
  const taken = seats.filter(Boolean).length;
  const free = table.capacity - taken;
  const [tableLabel, ...description] = table.name.split("·");

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const delta: Record<string, Position> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    const direction = delta[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? 50 : 10;
    onMoveTable(table.id, {
      x: clamp(x + direction.x * step),
      y: clamp(y + direction.y * step),
    });
    setAnnouncement(`${table.name}: posición actualizada.`);
  };

  return (
    <section
      data-seat-target={table.id}
      className={[
        "sp-map-table",
        `sp-map-table--${table.shape}`,
        moving ? "sp-map-table--moving" : "",
        over === null ? "sp-map-table--over" : "",
        free === 0 ? "sp-map-table--full" : "",
      ].join(" ")}
      style={{
        left: x,
        top: y,
        width: geometry.width,
        height: geometry.height,
      }}
      aria-label={`${table.name}, ${taken} de ${table.capacity} plazas`}
    >
      <button
        type="button"
        className="sp-map-surface"
        style={{
          left: geometry.cx,
          top: geometry.cy,
          width: geometry.surfaceW,
          height: geometry.surfaceH,
        }}
        aria-label={`Mover ${table.name}. Arrastra o usa las flechas (Mayús: paso grande).`}
        title="Arrastra para mover la mesa"
        onPointerDown={(event) =>
          handlers.start(event, table.id, "table", { x, y })
        }
        onPointerMove={handlers.move}
        onPointerUp={handlers.end}
        onPointerCancel={handlers.cancel}
        onKeyDown={onKeyDown}
      >
        <strong>{tableLabel.trim()}</strong>
        {description.length > 0 ? (
          <small>{description.join("·").trim()}</small>
        ) : null}
        <span className="sp-map-occupancy">
          {taken}/{table.capacity}
          <em>{free > 0 ? ` · ${free} libres` : " · completa"}</em>
        </span>
      </button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="sp-map-edit"
        aria-label={`Editar ${table.name}`}
        onClick={() => onEditTable(table)}
      >
        <Pencil />
      </Button>
      {geometry.seats.map((spot, index) => {
        const guest = seats[index] ?? null;
        const isOver = over === index;
        const position: CSSProperties = { left: spot.x, top: spot.y };
        if (!guest) {
          return (
            <button
              key={`free-${index}`}
              type="button"
              className={`sp-seat sp-seat--free ${isOver ? "sp-seat--over" : ""}`}
              style={position}
              data-seat-target={table.id}
              data-seat-index={index}
              disabled={selectedId === null}
              aria-label={
                selectedName
                  ? `Sentar a ${selectedName} en el asiento ${index + 1} de ${table.name}`
                  : `Asiento ${index + 1} de ${table.name}, libre`
              }
              onClick={() => {
                if (selectedId) onSeat(selectedId, table.id, index);
              }}
            >
              {index + 1}
            </button>
          );
        }
        const isSelected = guest.id === selectedId;
        return (
          <div key={guest.id} className="sp-seat-slot">
            <button
              type="button"
              className={[
                "sp-seat",
                "sp-seat--taken",
                isSelected ? "sp-seat--selected" : "",
                isOver ? "sp-seat--over" : "",
                guest.attendance === "pending" ? "sp-seat--pending" : "",
                guest.isChild ? "sp-seat--child" : "",
              ].join(" ")}
              style={position}
              data-seat-target={table.id}
              data-seat-index={index}
              title={guest.name}
              aria-label={`${guest.name}, asiento ${index + 1} de ${table.name}`}
              aria-pressed={isSelected}
              onClick={() => onSelect(guest.id)}
              onPointerDown={(event) =>
                handlers.start(event, guest.id, "guest")
              }
              onPointerMove={handlers.move}
              onPointerUp={handlers.end}
              onPointerCancel={handlers.cancel}
            >
              {initials(guest.name)}
            </button>
            <span
              className={`sp-seat-name sp-seat-name--${spot.anchor}`}
              aria-hidden="true"
              style={{
                left: spot.labelX,
                top: spot.labelY,
                width: spot.labelW,
              }}
            >
              {guest.name}
            </span>
          </div>
        );
      })}
      {seats.length > geometry.seats.length ? (
        <p className="sp-map-overflow" role="note">
          {seats.length - geometry.seats.length} invitados más de los que caben:
          amplía la mesa.
        </p>
      ) : null}
    </section>
  );
});
