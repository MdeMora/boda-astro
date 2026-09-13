import { Button } from "@/components/ui/button";
import { TriangleAlert } from "lucide-react";
import { downloadText } from "./utils";
import type { ConfirmRequest } from "./dialogs";
import type { StorageState } from "./usePlanStorage";

export function StorageBanners({
  storage,
  setConfirmRequest,
  onDiscardCorrupt,
}: {
  storage: { state: StorageState; corruptRaw?: string };
  setConfirmRequest: React.Dispatch<
    React.SetStateAction<ConfirmRequest | null>
  >;
  onDiscardCorrupt: () => void;
}) {
  return (
    <>
      {storage.state === "corrupt" ? (
        <div className="sp-banner sp-banner--warning" role="alert">
          <TriangleAlert aria-hidden="true" />
          <div className="sp-banner__text">
            <strong>Hay datos guardados con formato no válido.</strong> Para
            no perderlos, no se han cargado y este panel{" "}
            <em>no guardará encima automáticamente</em> hasta que decidas.
          </div>
          <div className="sp-banner__actions">
            <Button
              variant="ghost"
              type="button"
              className="sp-btn sp-btn--ghost sp-btn--small"
              onClick={() =>
                downloadText(
                  "plan-guardado-corrupto.json",
                  storage.corruptRaw ?? "",
                  "application/json",
                )
              }
            >
              Descargar copia de lo guardado
            </Button>
            <Button
              variant="ghost"
              type="button"
              className="sp-btn sp-btn--danger sp-btn--small"
              onClick={() =>
                setConfirmRequest({
                  title: "¿Descartar los datos corruptos?",
                  body: "Se borrará lo que había guardado en este navegador y se empezará con un plan vacío. Si crees que podrías necesitarlo, descarga antes la copia.",
                  confirmLabel: "Descartar y empezar de cero",
                  danger: true,
                  onConfirm: onDiscardCorrupt,
                })
              }
            >
              Descartar y empezar de cero
            </Button>
          </div>
        </div>
      ) : null}

      {storage.state === "unavailable" ? (
        <div className="sp-banner sp-banner--warning" role="alert">
          <TriangleAlert aria-hidden="true" />
          <div className="sp-banner__text">
            <strong>
              Este navegador no permite guardar (localStorage bloqueado).
            </strong>{" "}
            El plan funcionará, pero todo se perderá al cerrar la pestaña.
            Exporta copias JSON con frecuencia.
          </div>
        </div>
      ) : null}
    </>
  );
}
