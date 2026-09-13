import { Button } from "@/components/ui/button";
import { Circle, Loader2, Plus, Sparkles, UserPlus } from "lucide-react";

export function EmptyPlanHero({
  onCreateTable,
  onLoadDemo,
  onImportRsvp,
  importingRsvp,
}: {
  onCreateTable: () => void;
  onLoadDemo: () => void;
  onImportRsvp: () => void;
  importingRsvp: boolean;
}) {
  return (
    <div className="sp-empty sp-empty--hero">
      <Circle aria-hidden="true" className="sp-empty__ornament" />
      <h2>Este es tu plan de mesa</h2>
      <p>
        Empieza cargando un plan de ejemplo para ver cómo funciona, importa a
        los invitados del formulario RSVP o crea tus mesas desde cero.
      </p>
      <div className="sp-empty__actions">
        <Button className="sp-btn sp-btn--primary" onClick={onCreateTable}>
          <Plus aria-hidden="true" />
          Crear primera mesa
        </Button>
        <Button
          variant="ghost"
          type="button"
          className="sp-btn sp-btn--ghost"
          onClick={onLoadDemo}
        >
          <Sparkles aria-hidden="true" />
          Cargar plan de ejemplo
        </Button>
        <Button
          variant="ghost"
          type="button"
          className="sp-btn sp-btn--ghost"
          onClick={onImportRsvp}
          disabled={importingRsvp}
        >
          {importingRsvp ? (
            <Loader2 aria-hidden="true" className="sp-spin" />
          ) : (
            <UserPlus aria-hidden="true" />
          )}
          Importar del formulario RSVP
        </Button>
      </div>
      <p className="sp-empty__note">
        El plan se guarda automáticamente en este navegador (localStorage) y no
        se sube a ningún servidor. Para llevarlo a otro dispositivo, usa
        «Exportar copia JSON».
      </p>
    </div>
  );
}
