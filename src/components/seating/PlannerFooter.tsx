import { Info } from "lucide-react";

export function PlannerFooter() {
  return (
    <footer className="sp-foot">
      <p>
        <Info aria-hidden="true" className="sp-minicon" />
        El plan se guarda solo en este navegador. Exporta una copia JSON para
        conservarlo o compartirlo. La copia JSON es portable: impórtala en otro
        navegador para continuar ahí.
      </p>
      <details className="sp-help">
        <summary>Cómo funciona el panel</summary>
        <ul>
          <li>
            <strong>Importar del RSVP</strong> lee los invitados del formulario
            público (protegido con usuario <code>admin</code>) y los mezcla con
            el plan actual, respetando lo que ya hay sentado a mano.
          </li>
          <li>
            <strong>CSV de invitados</strong> acepta las columnas{" "}
            <code>
              name,group,attendance,dietaryRestrictions,allergies,notes,isChild
            </code>{" "}
            con una primera fila de encabezados.
          </li>
          <li>
            <strong>Exportar CSV</strong> genera una hoja con todos los
            invitados y su mesa, con alergias y dietas, lista para el catering.
          </li>
          <li>
            <strong>Imprimir</strong> saca una lista por mesas con dietas,
            alergias y notas, pensada para dejarla en la cocina.
          </li>
        </ul>
      </details>
    </footer>
  );
}
