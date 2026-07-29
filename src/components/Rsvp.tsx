import { useEffect, useState } from "react";
import { actions } from "astro:actions";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";

type Attendance = "confirmed" | "declined" | "pending";
type DietaryRestriction = "omnivore" | "vegetarian" | "piscivegetarian";

type Guest = {
  id: number;
  name: string;
  attendance: Attendance | null;
  dietaryRestrictions: DietaryRestriction | null;
  allergies: string | null;
  notes: string | null;
  isChild: boolean;
  parentId: number | null;
};

type GuestGroup = Guest & {
  companions: Guest[];
};

const isAnswered = (guest: Guest) =>
  guest.attendance === "confirmed" || guest.attendance === "declined";

export default function Rsvp() {
  const [step, setStep] = useState<"search" | "review" | "success">("search");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Guest[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [mainGuest, setMainGuest] = useState<Guest | null>(null);
  const [guestDrafts, setGuestDrafts] = useState<Guest[]>([]);
  const [selectedName, setSelectedName] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingGroup, setIsLoadingGroup] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddingCompanion, setIsAddingCompanion] = useState(false);
  const [showAddCompanion, setShowAddCompanion] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const trimmedQuery = query.trim();
    let cancelled = false;

    if (trimmedQuery.length < 2) {
      setSearchResults([]);
      setHasSearched(false);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    const timer = window.setTimeout(async () => {
      const { data, error } = await actions.searchGuest({
        query: trimmedQuery,
      });

      if (cancelled) return;

      if (error) {
        setSearchResults([]);
        setSearchError("No hemos podido buscar tu nombre. Inténtalo de nuevo.");
      } else {
        setSearchResults((data ?? []) as Guest[]);
      }

      setHasSearched(true);
      setIsSearching(false);
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const updateGuestDraft = (id: number, changes: Partial<Guest>) => {
    setGuestDrafts((currentGuests) =>
      currentGuests.map((guest) =>
        guest.id === id ? { ...guest, ...changes } : guest,
      ),
    );
    setFormError(null);
  };

  const selectGuest = async (guest: Guest) => {
    setIsLoadingGroup(true);
    setSearchError(null);
    setSelectedName(guest.name);

    const { data, error } = await actions.getGuestWithCompanions({
      id: guest.id,
    });

    if (error || !data) {
      setSearchError(
        "No hemos podido cargar tu invitación. Inténtalo de nuevo.",
      );
      setIsLoadingGroup(false);
      return;
    }

    const group = data as GuestGroup;
    setMainGuest(group);
    setGuestDrafts([group, ...group.companions]);
    setStep("review");
    setIsLoadingGroup(false);
  };

  const handleAddCompanion = async (name: string, isChild: boolean) => {
    if (!mainGuest) return;

    setIsAddingCompanion(true);
    setFormError(null);

    const { error } = await actions.addCompanion({
      parentId: mainGuest.id,
      data: {
        name,
        isChild,
        dietaryRestrictions: "omnivore",
        allergies: "",
        notes: "",
      },
    });

    if (error) {
      setFormError(
        "No hemos podido añadir a esta persona. Inténtalo de nuevo.",
      );
      setIsAddingCompanion(false);
      return;
    }

    const { data: updatedGroup, error: refreshError } =
      await actions.getGuestWithCompanions({ id: mainGuest.id });

    if (refreshError || !updatedGroup) {
      setFormError(
        "La persona se ha añadido, pero no hemos podido actualizar la lista. Vuelve a buscar tu invitación.",
      );
      setIsAddingCompanion(false);
      return;
    }

    const group = updatedGroup as GuestGroup;
    const currentDrafts = new Map(
      guestDrafts.map((guest) => [guest.id, guest]),
    );
    const refreshedGuests = [group, ...group.companions].map(
      (guest) => currentDrafts.get(guest.id) ?? guest,
    );

    setMainGuest(group);
    setGuestDrafts(refreshedGuests);
    setShowAddCompanion(false);
    setIsAddingCompanion(false);
  };

  const handleSubmit = async () => {
    const pendingGuests = guestDrafts.filter((guest) => !isAnswered(guest));

    if (pendingGuests.length > 0) {
      setFormError(
        pendingGuests.length === 1
          ? `Indica si ${pendingGuests[0].name} asistirá.`
          : `Faltan ${pendingGuests.length} respuestas por completar.`,
      );

      window.requestAnimationFrame(() => {
        document
          .getElementById(`guest-${pendingGuests[0].id}`)
          ?.focus({ preventScroll: true });
        document
          .getElementById(`guest-${pendingGuests[0].id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const results = await Promise.all(
      guestDrafts.map((guest) =>
        actions.updateGuest({
          id: guest.id,
          data: {
            attendance: guest.attendance,
            dietaryRestrictions:
              guest.attendance === "confirmed"
                ? guest.dietaryRestrictions || "omnivore"
                : guest.dietaryRestrictions,
            allergies: guest.allergies,
            notes: guest.notes,
          },
        }),
      ),
    );

    if (results.some((result) => result.error)) {
      setFormError(
        "No hemos podido guardar todas las respuestas. Revisa tu conexión e inténtalo de nuevo.",
      );
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setStep("success");
  };

  const resetSearch = () => {
    setStep("search");
    setQuery("");
    setSearchResults([]);
    setHasSearched(false);
    setMainGuest(null);
    setGuestDrafts([]);
    setSelectedName("");
    setSearchError(null);
    setFormError(null);
    setShowAddCompanion(false);
  };

  const answeredCount = guestDrafts.filter(isAnswered).length;
  const greetingName = selectedName || mainGuest?.name || "";

  return (
    <section
      className="relative z-0 flex min-h-svh items-center justify-center overflow-hidden bg-wedding-beige px-4 py-12 sm:px-6 md:py-20"
      id="rsvp"
      aria-labelledby="rsvp-title"
    >
      <img
        src="/fondo2.jpg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover opacity-25"
      />

      <div className="relative w-full max-w-3xl rounded-3xl border border-white/80 bg-[#fffdf9]/95 px-5 py-8 shadow-[0_24px_70px_rgba(54,69,79,0.12)] backdrop-blur-sm sm:px-10 sm:py-12 md:px-14">
        <header className="mx-auto mb-8 max-w-xl text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-wedding-olive">
            Confirmación de asistencia
          </p>

          {step === "search" && (
            <>
              <h2
                id="rsvp-title"
                className="font-serif text-3xl leading-tight text-wedding-charcoal sm:text-4xl"
              >
                ¿Nos acompañas?
              </h2>
              <p className="mt-3 text-base leading-relaxed text-wedding-charcoal/75">
                Busca tu invitación para confirmar en menos de un minuto.
              </p>
            </>
          )}

          {step === "review" && (
            <>
              <h2
                id="rsvp-title"
                className="font-serif text-3xl leading-tight text-wedding-charcoal sm:text-4xl"
              >
                Hola, {greetingName}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-wedding-charcoal/75">
                Indica quiénes podrán venir y revisa sus datos para el banquete.
              </p>
            </>
          )}

          {step === "success" && (
            <h2
              id="rsvp-title"
              className="font-serif text-3xl leading-tight text-wedding-charcoal sm:text-4xl"
            >
              ¡Respuesta guardada!
            </h2>
          )}
        </header>

        {step === "search" && (
          <div className="mx-auto max-w-lg animate-fade-in">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-wedding-charcoal/55"
                aria-hidden="true"
              />
              <input
                id="guest-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoComplete="name"
                aria-describedby="guest-search-hint guest-search-status"
                className="min-h-14 w-full rounded-xl border border-wedding-sand/60 bg-white py-3 pl-12 pr-12 text-base text-wedding-charcoal shadow-sm outline-none placeholder:text-wedding-charcoal/60 focus:border-wedding-olive focus:ring-4 focus:ring-wedding-olive/15"
                placeholder="Nombre o Apellido"
              />
              {(isSearching || isLoadingGroup) && (
                <Loader2
                  className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-wedding-olive"
                  aria-hidden="true"
                />
              )}
            </div>

            <div
              id="guest-search-status"
              className="mt-4"
              role="status"
              aria-live="polite"
            >
              {searchError && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{searchError}</span>
                </div>
              )}

              {!searchError &&
                hasSearched &&
                !isSearching &&
                searchResults.length === 0 && (
                  <div className="rounded-xl bg-wedding-beige/70 px-4 py-4 text-sm leading-relaxed text-wedding-charcoal/75">
                    No encontramos ese nombre. Prueba solo con el nombre o con
                    uno de los apellidos.
                  </div>
                )}

              {!searchError && searchResults.length > 0 && (
                <span className="sr-only">
                  {searchResults.length}{" "}
                  {searchResults.length === 1
                    ? "invitación encontrada"
                    : "invitaciones encontradas"}
                  .
                </span>
              )}
            </div>

            {searchResults.length > 0 && (
              <ul
                id="guest-search-results"
                aria-label="Invitaciones encontradas"
                className="mt-3 overflow-hidden rounded-2xl border border-wedding-sand/35 bg-white shadow-lg"
              >
                {searchResults.map((guest) => (
                  <li key={guest.id}>
                    <button
                      type="button"
                      onClick={() => selectGuest(guest)}
                      disabled={isLoadingGroup}
                      className="flex min-h-14 w-full items-center justify-between gap-4 border-b border-wedding-sand/25 px-5 py-4 text-left outline-none transition-colors last:border-b-0 hover:bg-wedding-beige/60 focus-visible:bg-wedding-beige focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wedding-olive disabled:opacity-50"
                    >
                      <span className="font-serif text-lg font-medium text-wedding-charcoal">
                        {guest.name}
                      </span>
                      <span className="shrink-0 text-sm font-bold text-wedding-olive">
                        Es mi invitación
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === "review" && mainGuest && (
          <div
            className="animate-fade-in"
            aria-busy={isSubmitting || isAddingCompanion}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <p className="text-sm font-bold text-wedding-charcoal">
                Personas de la invitación
              </p>
              <p
                className="text-sm text-wedding-charcoal/70"
                aria-live="polite"
              >
                {answeredCount} de {guestDrafts.length}{" "}
                {guestDrafts.length === 1 ? "respuesta" : "respuestas"}
              </p>
            </div>

            <ol className="space-y-4">
              {guestDrafts.map((guest, index) => {
                const attendanceError =
                  Boolean(formError) && !isAnswered(guest);

                return (
                  <li key={guest.id}>
                    <article
                      id={`guest-${guest.id}`}
                      tabIndex={-1}
                      className={`rounded-2xl border bg-white p-5 outline-none transition-shadow sm:p-6 ${
                        attendanceError
                          ? "border-red-400 ring-4 ring-red-100"
                          : "border-wedding-sand/45 shadow-sm focus:ring-4 focus:ring-wedding-olive/15"
                      }`}
                    >
                      <div className="mb-5 flex items-center gap-3">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wedding-olive/10 text-sm font-bold text-wedding-olive"
                          aria-hidden="true"
                        >
                          {index + 1}
                        </span>
                        <h3 className="font-serif text-xl font-medium text-wedding-charcoal">
                          {guest.name}
                        </h3>
                        {guest.isChild && (
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">
                            Menor
                          </span>
                        )}
                      </div>

                      <fieldset>
                        <legend className="mb-3 text-sm font-bold text-wedding-charcoal">
                          ¿Asistirá a la boda?
                        </legend>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <label className="cursor-pointer">
                            <input
                              type="radio"
                              name={`attendance-${guest.id}`}
                              value="confirmed"
                              checked={guest.attendance === "confirmed"}
                              onChange={() =>
                                updateGuestDraft(guest.id, {
                                  attendance: "confirmed",
                                })
                              }
                              className="peer sr-only"
                            />
                            <span className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-wedding-sand/60 bg-white px-4 py-3 text-center text-sm font-bold text-wedding-charcoal outline-none transition-colors peer-checked:border-wedding-olive peer-checked:bg-wedding-olive peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-wedding-olive/25">
                              <Check className="h-4 w-4" aria-hidden="true" />
                              Sí, asistirá
                            </span>
                          </label>

                          <label className="cursor-pointer">
                            <input
                              type="radio"
                              name={`attendance-${guest.id}`}
                              value="declined"
                              checked={guest.attendance === "declined"}
                              onChange={() =>
                                updateGuestDraft(guest.id, {
                                  attendance: "declined",
                                })
                              }
                              className="peer sr-only"
                            />
                            <span className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-wedding-sand/60 bg-white px-4 py-3 text-center text-sm font-bold text-wedding-charcoal outline-none transition-colors peer-checked:border-wedding-charcoal peer-checked:bg-wedding-charcoal peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-wedding-charcoal/20">
                              <X className="h-4 w-4" aria-hidden="true" />
                              No podrá venir
                            </span>
                          </label>
                        </div>
                      </fieldset>

                      {guest.attendance === "confirmed" && (
                        <div className="mt-5 space-y-4 border-t border-wedding-sand/35 pt-5 animate-fade-in">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label
                                htmlFor={`dietary-${guest.id}`}
                                className="mb-2 block text-sm font-bold text-wedding-charcoal"
                              >
                                Menú
                              </label>
                              <select
                                id={`dietary-${guest.id}`}
                                value={guest.dietaryRestrictions || "omnivore"}
                                onChange={(event) =>
                                  updateGuestDraft(guest.id, {
                                    dietaryRestrictions: event.target
                                      .value as DietaryRestriction,
                                  })
                                }
                                className="min-h-12 w-full rounded-xl border border-wedding-sand/60 bg-white px-3 py-2 text-base text-wedding-charcoal outline-none focus:border-wedding-olive focus:ring-4 focus:ring-wedding-olive/15"
                              >
                                <option value="omnivore">Menú estándar</option>
                                <option value="vegetarian">
                                  Menú vegetariano
                                </option>
                                <option value="piscivegetarian">
                                  Menú pescetariano
                                </option>
                              </select>
                            </div>

                            <div>
                              <label
                                htmlFor={`allergies-${guest.id}`}
                                className="mb-2 block text-sm font-bold text-wedding-charcoal"
                              >
                                Alergias{" "}
                                <span className="font-normal text-wedding-charcoal/65">
                                  (opcional)
                                </span>
                              </label>
                              <input
                                id={`allergies-${guest.id}`}
                                type="text"
                                value={guest.allergies || ""}
                                onChange={(event) =>
                                  updateGuestDraft(guest.id, {
                                    allergies: event.target.value,
                                  })
                                }
                                autoComplete="off"
                                className="min-h-12 w-full rounded-xl border border-wedding-sand/60 bg-white px-3 py-2 text-base text-wedding-charcoal outline-none placeholder:text-wedding-charcoal/60 focus:border-wedding-olive focus:ring-4 focus:ring-wedding-olive/15"
                                placeholder="Ej. frutos secos"
                              />
                            </div>
                          </div>

                          <div>
                            <label
                              htmlFor={`notes-${guest.id}`}
                              className="mb-2 block text-sm font-bold text-wedding-charcoal"
                            >
                              ¿Necesita algo más?{" "}
                              <span className="font-normal text-wedding-charcoal/65">
                                (opcional)
                              </span>
                            </label>
                            <textarea
                              id={`notes-${guest.id}`}
                              value={guest.notes || ""}
                              onChange={(event) =>
                                updateGuestDraft(guest.id, {
                                  notes: event.target.value,
                                })
                              }
                              rows={2}
                              className="min-h-20 w-full resize-y rounded-xl border border-wedding-sand/60 bg-white px-3 py-3 text-base text-wedding-charcoal outline-none placeholder:text-wedding-charcoal/60 focus:border-wedding-olive focus:ring-4 focus:ring-wedding-olive/15"
                              placeholder="Ej. necesitamos una silla para bebé"
                            />
                          </div>
                        </div>
                      )}
                    </article>
                  </li>
                );
              })}
            </ol>

            <div className="mt-5">
              {!showAddCompanion ? (
                <button
                  type="button"
                  onClick={() => setShowAddCompanion(true)}
                  className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-wedding-olive outline-none hover:bg-wedding-olive/5 focus-visible:ring-4 focus-visible:ring-wedding-olive/20"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Añadir otra persona
                </button>
              ) : (
                <div className="rounded-2xl border border-wedding-sand/45 bg-wedding-beige/50 p-5 animate-fade-in">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <h3 className="font-serif text-lg text-wedding-charcoal">
                      Añadir otra persona
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowAddCompanion(false)}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-wedding-charcoal/70 outline-none hover:bg-white focus-visible:ring-4 focus-visible:ring-wedding-olive/20"
                      aria-label="Cerrar formulario"
                    >
                      <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>

                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const formData = new FormData(event.currentTarget);
                      const companionName = String(
                        formData.get("companionName") || "",
                      ).trim();
                      const isChild = formData.get("isChild") === "on";

                      if (companionName) {
                        handleAddCompanion(companionName, isChild);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setShowAddCompanion(false);
                      }
                    }}
                  >
                    <div>
                      <label
                        htmlFor="companion-name"
                        className="mb-2 block text-sm font-bold text-wedding-charcoal"
                      >
                        Nombre y apellidos
                      </label>
                      <input
                        id="companion-name"
                        name="companionName"
                        type="text"
                        required
                        autoFocus
                        className="min-h-12 w-full rounded-xl border border-wedding-sand/60 bg-white px-3 py-2 text-base text-wedding-charcoal outline-none focus:border-wedding-olive focus:ring-4 focus:ring-wedding-olive/15"
                      />
                    </div>

                    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-wedding-charcoal">
                      <input
                        type="checkbox"
                        name="isChild"
                        className="h-5 w-5 rounded border-wedding-sand text-wedding-olive accent-wedding-olive focus:ring-wedding-olive"
                      />
                      Es menor de edad
                    </label>

                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setShowAddCompanion(false)}
                        className="min-h-12 rounded-xl px-5 text-sm font-bold text-wedding-charcoal outline-none hover:bg-white focus-visible:ring-4 focus-visible:ring-wedding-charcoal/15"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isAddingCompanion}
                        className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-wedding-olive px-5 text-sm font-bold text-white shadow-sm outline-none hover:bg-[#5f5d30] focus-visible:ring-4 focus-visible:ring-wedding-olive/30 disabled:cursor-wait disabled:opacity-60"
                      >
                        {isAddingCompanion ? (
                          <>
                            <Loader2
                              className="h-4 w-4 animate-spin"
                              aria-hidden="true"
                            />
                            Añadiendo…
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            Añadir a la invitación
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            <div aria-live="assertive">
              {formError && (
                <div
                  className="mt-5 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
                  role="alert"
                >
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{formError}</span>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-wedding-sand/35 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={resetSearch}
                className="flex min-h-12 items-center justify-center gap-1 rounded-xl px-4 text-sm font-bold text-wedding-charcoal/75 outline-none hover:bg-wedding-beige focus-visible:ring-4 focus-visible:ring-wedding-charcoal/15 sm:justify-start"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Buscar otro nombre
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || isAddingCompanion}
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-wedding-olive px-8 py-3 font-bold text-white shadow-md outline-none transition-colors hover:bg-[#5f5d30] focus-visible:ring-4 focus-visible:ring-wedding-olive/30 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <Loader2
                      className="h-5 w-5 animate-spin"
                      aria-hidden="true"
                    />
                    Guardando…
                  </>
                ) : (
                  "Guardar respuestas"
                )}
              </button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="mx-auto max-w-md animate-fade-in py-4 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-wedding-olive/10">
              <Check
                className="h-8 w-8 text-wedding-olive"
                aria-hidden="true"
              />
            </div>
            <p className="text-base leading-relaxed text-wedding-charcoal/80">
              Gracias, {greetingName}. Hemos guardado{" "}
              {guestDrafts.length === 1
                ? "tu respuesta"
                : `las respuestas de ${guestDrafts.length} personas`}
              .
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setStep("review")}
                className="min-h-12 rounded-xl border border-wedding-olive/50 bg-white px-6 text-sm font-bold text-wedding-olive outline-none hover:bg-wedding-olive/5 focus-visible:ring-4 focus-visible:ring-wedding-olive/20"
              >
                Revisar o cambiar respuestas
              </button>
              <button
                type="button"
                onClick={resetSearch}
                className="min-h-11 rounded-xl px-6 text-sm font-bold text-wedding-charcoal/70 outline-none hover:bg-wedding-beige focus-visible:ring-4 focus-visible:ring-wedding-charcoal/15"
              >
                Buscar otra invitación
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
