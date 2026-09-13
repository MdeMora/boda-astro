import { memo, useMemo } from "react";
import type { SeatingPlan } from "@/lib/seating";
import { compareTables, formatLongDate } from "./utils";

export const PrintView = memo(function PrintView({
  plan,
}: {
  plan: SeatingPlan;
}) {
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
