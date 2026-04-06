import { useState, useEffect, useRef } from "react";
import { actions } from "astro:actions";
import { Loader2, Plus, Check, X, Search } from "lucide-react";

type Guest = {
  id: number;
  name: string;
  attendance: "confirmed" | "declined" | "pending" | null;
  dietaryRestrictions: "omnivore" | "vegetarian" | "piscivegetarian" | null;
  allergies: string | null;
  notes: string | null;
  isChild: boolean;
  parentId: number | null;
};

type GuestNoteInputProps = {
  initialNote: string | null;
  guestId: number;
  onSave: (id: number, note: string) => Promise<void>;
};

function GuestNoteInput({ initialNote, guestId, onSave }: GuestNoteInputProps) {
  const [note, setNote] = useState(initialNote || "");
  const [isSaving, setIsSaving] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      setIsSaving(true);
      await onSave(guestId, note);
      setIsSaving(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [note, guestId]);

  return (
    <div className="relative">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Ej: Estoy embarazada, necesito silla de bebé..."
        className="w-full bg-transparent text-sm text-wedding-charcoal placeholder:text-wedding-charcoal/30 border-none p-0 focus:ring-0 resize-none h-auto min-h-[1.5em]"
        rows={1}
      />
      {isSaving && (
        <div className="absolute right-0 bottom-0">
          <Loader2 className="w-3 h-3 animate-spin text-wedding-olive" />
        </div>
      )}
    </div>
  );
}

export default function Rsvp() {
  const [step, setStep] = useState<"search" | "review" | "success">("search");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Guest[]>([]);
  const [mainGuest, setMainGuest] = useState<Guest | null>(null);
  const [companions, setCompanions] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [showAddCompanion, setShowAddCompanion] = useState(false);
  const [selectedName, setSelectedName] = useState<string>("");

  // Search Step
  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (val.length >= 2) {
      setIsLoading(true);
      const { data } = await actions.searchGuest({ query: val });
      setSearchResults((data ?? []) as Guest[]);
      setIsLoading(false);
    } else {
      setSearchResults([]);
    }
  };

  const selectGuest = async (guest: Guest) => {
    setIsLoading(true);
    setSelectedName(guest.name);
    const { data: fullGuest } = await actions.getGuestWithCompanions({
      id: guest.id,
    });
    if (fullGuest) {
      setMainGuest(fullGuest as Guest);
      setCompanions(fullGuest.companions as Guest[]);
      setStep("review");
    }
    setIsLoading(false);
  };

  // Review Step Actions
  const handleSaveGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGuest) return;

    setIsLoading(true);
    await actions.updateGuest({
      id: editingGuest.id,
      data: {
        attendance: editingGuest.attendance,
        dietaryRestrictions: editingGuest.dietaryRestrictions,
        allergies: editingGuest.allergies,
        notes: editingGuest.notes,
      },
    });

    // Refresh data
    if (mainGuest) {
      const { data: updated } = await actions.getGuestWithCompanions({
        id: mainGuest.id,
      });
      if (updated) {
        setMainGuest(updated as Guest);
        setCompanions(updated.companions as Guest[]);
      }
    }
    setEditingGuest(null);
    setIsLoading(false);
  };

  const handleAddCompanion = async (
    name: string,
    isChild: boolean,
    dietary: "omnivore" | "vegetarian" | "piscivegetarian",
    allergies: string,
    notes: string,
  ) => {
    if (!mainGuest) return;
    setIsLoading(true);
    await actions.addCompanion({
      parentId: mainGuest.id,
      data: {
        name,
        isChild,
        dietaryRestrictions: dietary,
        allergies: allergies,
        notes: notes,
      },
    });
    // Refresh companions list
    const { data: updated } = await actions.getGuestWithCompanions({
      id: mainGuest.id,
    });
    if (updated) setCompanions(updated.companions as Guest[]);
    setIsLoading(false);
  };

  const allGuests = mainGuest ? [mainGuest, ...companions] : [];

  return (
    <section
      className="relative z-0 px-4 py-12 min-h-svh bg-wedding-beige flex flex-col justify-center items-center"
      id="rsvp"
    >
      <div className="w-full max-w-2xl bg-white/30 backdrop-blur-md p-8 md:p-16 rounded-3xl shadow-xl border border-white/50 min-h-[400px]">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-serif text-wedding-charcoal">
            Confirmar Asistencia
          </h2>
        </div>

        {step === "search" && (
          <div className="space-y-8 animate-fade-in max-w-lg mx-auto">
            <div>
              <label className="block text-sm font-medium text-wedding-charcoal/60 mb-3 text-center uppercase tracking-wider">
                Busca tu nombre
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-wedding-olive/50 group-focus-within:text-wedding-olive transition-colors">
                  <Search className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={handleSearch}
                  className="w-full pl-12 pr-4 py-4 bg-white/60 border-2 border-transparent focus:border-wedding-olive/20 rounded-full shadow-sm focus:shadow-md focus:outline-none transition-all placeholder:text-wedding-charcoal/30 text-lg"
                  placeholder="Busca tu nombre..."
                />
                {isLoading && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-5 h-5 animate-spin text-wedding-olive" />
                  </div>
                )}
              </div>
            </div>

            {searchResults.length > 0 && (
              <ul className="divide-y divide-wedding-sand/10 bg-white/80 backdrop-blur-sm rounded-2xl border border-white/40 shadow-lg overflow-hidden">
                {searchResults.map((guest) => (
                  <li key={guest.id}>
                    <button
                      onClick={() => selectGuest(guest)}
                      className="w-full px-6 py-4 text-left hover:bg-wedding-olive/5 transition-colors flex items-center justify-between group"
                    >
                      <span className="font-serif text-lg text-wedding-charcoal group-hover:text-wedding-olive transition-colors">
                        {guest.name}
                      </span>
                      <span className="text-xs text-wedding-olive/60 uppercase tracking-wider group-hover:text-wedding-olive transition-colors">
                        Seleccionar
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === "review" && mainGuest && (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center">
              <h3 className="text-xl font-serif text-wedding-charcoal">
                Hola, {selectedName || mainGuest.name}
              </h3>
              <p className="text-wedding-charcoal/60">
                Por favor, revisa los datos de tus acompañantes.
              </p>
            </div>

            <div className="space-y-4">
              {allGuests.map((guest) => (
                <div
                  key={guest.id}
                  className="bg-white/60 rounded border border-wedding-sand/20 overflow-hidden"
                >
                  {editingGuest?.id === guest.id ? (
                    <form
                      onSubmit={handleSaveGuest}
                      className="p-4 space-y-4 bg-white"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-serif font-medium">{guest.name}</h4>
                        <button
                          type="button"
                          onClick={() => setEditingGuest(null)}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingGuest({
                              ...editingGuest,
                              attendance: "confirmed",
                            })
                          }
                          className={`p-2 text-sm rounded border text-center ${editingGuest.attendance === "confirmed" ? "bg-wedding-olive text-white" : "bg-gray-50"}`}
                        >
                          Asistiré
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingGuest({
                              ...editingGuest,
                              attendance: "declined",
                            })
                          }
                          className={`p-2 text-sm rounded border text-center ${editingGuest.attendance === "declined" ? "bg-wedding-charcoal text-white" : "bg-gray-50"}`}
                        >
                          No asistiré
                        </button>
                      </div>

                      {editingGuest.attendance === "confirmed" && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-wedding-charcoal/80 mb-1">
                              Restricciones alimentarias
                            </label>
                            <select
                              value={
                                editingGuest.dietaryRestrictions || "omnivore"
                              }
                              onChange={(e) =>
                                setEditingGuest({
                                  ...editingGuest,
                                  dietaryRestrictions: e.target.value as any,
                                })
                              }
                              className="w-full p-2 text-sm border rounded bg-white"
                            >
                              <option value="omnivore">Omnívoro</option>
                              <option value="vegetarian">Vegetariano</option>
                              <option value="piscivegetarian">
                                Piscivegetariano
                              </option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-wedding-charcoal/80 mb-1">
                              Alergias
                            </label>
                            <input
                              type="text"
                              value={editingGuest.allergies || ""}
                              onChange={(e) =>
                                setEditingGuest({
                                  ...editingGuest,
                                  allergies: e.target.value,
                                })
                              }
                              placeholder="Ej: Nueces, Gluten (o 'Ninguna')"
                              className="w-full p-2 text-sm border rounded"
                            />
                          </div>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-2 bg-wedding-olive text-white rounded text-sm"
                      >
                        Guardar
                      </button>
                    </form>
                  ) : (
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-serif text-wedding-charcoal font-medium text-lg">
                              {guest.name}
                            </p>
                            {guest.isChild && (
                              <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                                Niño
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-wedding-charcoal/60 mt-1 space-x-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs ${guest.attendance === "confirmed" ? "bg-green-100 text-green-700" : guest.attendance === "declined" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}
                            >
                              {guest.attendance === "confirmed"
                                ? "Confirmado"
                                : guest.attendance === "declined"
                                  ? "Rechazado"
                                  : "Pendiente"}
                            </span>
                            {(guest.attendance === "confirmed" ||
                              guest.attendance === "pending") && (
                              <>
                                {guest.dietaryRestrictions &&
                                  guest.dietaryRestrictions !== "omnivore" && (
                                    <span>
                                      • 🥗{" "}
                                      {guest.dietaryRestrictions ===
                                      "vegetarian"
                                        ? "Vegetariano"
                                        : "Piscivegetariano"}
                                    </span>
                                  )}
                                {guest.allergies && (
                                  <span>• ⚠️ {guest.allergies}</span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            setEditingGuest({
                              ...guest,
                              attendance:
                                guest.attendance === "declined"
                                  ? "declined"
                                  : "confirmed",
                            })
                          }
                          className="text-sm text-wedding-olive hover:underline px-3 py-1 font-medium"
                        >
                          Editar
                        </button>
                      </div>

                      {/* Notes field outside of edit mode */}
                      <div className="mt-2 pt-2 border-t border-dashed border-wedding-sand/30">
                        <label className="block text-xs text-wedding-charcoal/50 mb-1 italic">
                          ¿Alguna nota o petición especial?
                        </label>
                        <GuestNoteInput
                          initialNote={guest.notes}
                          guestId={guest.id}
                          onSave={async (id, note) => {
                            await actions.updateGuest({
                              id,
                              data: { notes: note },
                            });
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-wedding-sand/20 text-center">
              {!showAddCompanion ? (
                <button
                  onClick={() => setShowAddCompanion(true)}
                  className="text-sm text-wedding-olive hover:text-wedding-olive/80 flex items-center gap-2 mx-auto border border-wedding-olive/30 px-4 py-2 rounded-full hover:bg-wedding-olive/5 transition-colors"
                >
                  <Plus className="w-4 h-4" /> ¿Falta alguien? Añadir
                  acompañante
                </button>
              ) : (
                <div className="animate-fade-in bg-white/40 p-6 rounded-xl border border-wedding-sand/20 text-left">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm font-medium text-wedding-charcoal/80">
                      Añadir Acompañante
                    </p>
                    <button
                      onClick={() => setShowAddCompanion(false)}
                      className="text-wedding-charcoal/40 hover:text-wedding-charcoal"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const formData = new FormData(form);
                      const name = formData.get("compName") as string;
                      const isChild = formData.get("isChild") === "on";
                      const dietary = formData.get("dietary") as any;
                      const allergies = formData.get("allergies") as string;
                      const notes = formData.get("notes") as string;

                      if (name) {
                        handleAddCompanion(
                          name,
                          isChild,
                          dietary,
                          allergies,
                          notes,
                        );
                        form.reset();
                        setShowAddCompanion(false);
                      }
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          name="compName"
                          type="text"
                          placeholder="Nombre completo"
                          required
                          className="flex-1 px-3 py-2 bg-white/80 border border-wedding-sand/30 rounded text-sm focus:outline-none focus:ring-1 focus:ring-wedding-olive/50"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <select
                          name="dietary"
                          className="px-3 py-2 bg-white/80 border border-wedding-sand/30 rounded text-sm focus:outline-none focus:ring-1 focus:ring-wedding-olive/50"
                        >
                          <option value="omnivore">Omnívoro</option>
                          <option value="vegetarian">Vegetariano</option>
                          <option value="piscivegetarian">
                            Piscivegetariano
                          </option>
                        </select>
                        <input
                          name="allergies"
                          type="text"
                          placeholder="Alergias"
                          className="px-3 py-2 bg-white/80 border border-wedding-sand/30 rounded text-sm focus:outline-none focus:ring-1 focus:ring-wedding-olive/50"
                        />
                      </div>

                      <textarea
                        name="notes"
                        placeholder="Nota o petición especial..."
                        className="w-full px-3 py-2 bg-white/80 border border-wedding-sand/30 rounded text-sm focus:outline-none focus:ring-1 focus:ring-wedding-olive/50 h-20 resize-none"
                      />

                      <div className="flex items-center justify-between">
                        <label className="flex items-center space-x-2 cursor-pointer text-xs text-wedding-charcoal/60">
                          <input
                            type="checkbox"
                            name="isChild"
                            className="text-wedding-olive focus:ring-wedding-olive"
                          />
                          <span>Es niño/a</span>
                        </label>
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="px-4 py-2 bg-wedding-olive text-white rounded hover:bg-wedding-olive/90 text-sm flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" /> Agregar a la lista
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-6">
              <button
                onClick={() => setStep("search")}
                className="text-sm text-wedding-charcoal/60 hover:text-wedding-charcoal"
              >
                Atrás
              </button>
              <button
                onClick={async () => {
                  setIsLoading(true);
                  const ids = allGuests.map((g) => g.id);
                  await actions.confirmGroupAttendance({ guestIds: ids });
                  setIsLoading(false);
                  setStep("success");
                }}
                disabled={isLoading}
                className="px-8 py-3 bg-wedding-olive text-white font-serif tracking-wide rounded hover:bg-wedding-olive/90 shadow-sm disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  "Confirmar Todo"
                )}
              </button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="text-center py-10 space-y-4 animate-fade-in">
            <div className="w-16 h-16 bg-wedding-olive/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-wedding-olive" />
            </div>
            <p className="text-2xl font-serif text-wedding-olive">¡Gracias!</p>
            <p className="text-wedding-charcoal/80">
              Hemos guardado tu respuesta y la de tus acompañantes.
            </p>
            <button
              onClick={() => {
                setStep("search");
                setQuery("");
                setSearchResults([]);
                setMainGuest(null);
                setCompanions([]);
              }}
              className="mt-6 text-sm text-wedding-charcoal/60 underline hover:text-wedding-olive"
            >
              Volver al inicio
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
