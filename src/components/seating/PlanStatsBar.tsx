type PlanStats = {
  confirmed: number;
  seated: number;
  unassigned: number;
  places: number;
  pending: number;
  declined: number;
  freePlaces: number;
};

export function PlanStatsBar({ stats }: { stats: PlanStats }) {
  return (
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
            {stats.pending === 1 ? "pendiente" : "pendientes"} de confirmar ·{" "}
            {stats.declined}{" "}
            {stats.declined === 1 ? "ha declinado" : "han declinado"}
          </p>
        ) : null}
      </div>
    </div>
  );
}
