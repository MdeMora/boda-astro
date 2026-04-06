import { c as createComponent } from './astro-component_DDBJylZc.mjs';
import 'piccolore';
import { o as createRenderInstruction, p as renderHead, q as renderSlot, r as renderTemplate, m as maybeRenderHead, k as addAttribute, v as renderComponent } from './entrypoint_DDdUuEDv.mjs';
import 'clsx';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { useState, useRef, useEffect } from 'react';
import { a as actions } from './server_BtU2nq7A.mjs';
import { Search, Loader2, X, Plus, Check } from 'lucide-react';

async function renderScript(result, id) {
  const inlined = result.inlinedScripts.get(id);
  let content = "";
  if (inlined != null) {
    if (inlined) {
      content = `<script type="module">${inlined}</script>`;
    }
  } else {
    const resolved = await result.resolve(id);
    content = `<script type="module" src="${result.userAssetsBase ? (result.base === "/" ? "" : result.base) + result.userAssetsBase : ""}${resolved}"></script>`;
  }
  return createRenderInstruction({ type: "script", id, content });
}

const $$Layout = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`<html lang="es"> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><meta name="description" content="Boda de Cristina y Miguel"><title>Cristina y Miguel | 2 de Octubre</title>${renderHead()}</head> <body class="antialiased bg-wedding-beige text-wedding-charcoal font-sans"> ${renderSlot($$result, $$slots["default"])} </body></html>`;
}, "/Users/migueldemora/Work/boda-astro/src/layouts/Layout.astro", void 0);

const $$Hero = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${maybeRenderHead()}<section class="relative z-0 h-screen overflow-hidden w-full flex flex-col items-center justify-center text-center px-4"> <div class="relative z-10 animate-fade-in-up space-y-6"> <p class="text-wedding-olive tracking-[0.2em] uppercase text-sm md:text-base font-sans">
Nos casamos
</p> <h1 class="text-5xl md:text-7xl lg:text-8xl font-serif text-wedding-charcoal">
Cristina <span class="text-wedding-olive italic">&</span> Miguel
</h1> <div class="w-24 h-[1px] bg-wedding-olive/30 mx-auto my-8"></div> <p class="text-xl md:text-2xl font-serif text-wedding-charcoal/80">
2 de Octubre, 2026
</p> </div> <div class="absolute bottom-10 animate-bounce"> <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8 text-wedding-olive/50"><path d="m6 9 6 6 6-6"></path></svg> </div> <img src="/boda-flores.png" class="absolute left-0 right-0 mx-auto rotate-90 scale-[0.4] -top-[240px] md:rotate-0 md:scale-100 md:top-auto md:left-4 md:right-auto md:mx-0"> <img src="/boda-flores.png" class="absolute left-0 right-0 mx-auto -rotate-90 scale-[0.4] -bottom-[240px] md:rotate-0 md:scale-100 md:bottom-auto md:left-auto md:right-4 md:mx-0 md:-scale-x-100"> </section>`;
}, "/Users/migueldemora/Work/boda-astro/src/components/Hero.astro", void 0);

const $$EventDetails = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${maybeRenderHead()}<section class="relative z-10 py-20 px-4 bg-wedding-cream/30 shadow-[0_-10px_40px_-10px_rgba(54,69,79,0.1),0_16px_48px_-12px_rgba(54,69,79,0.14)]"> <div class="max-w-4xl mx-auto text-center"> <h2 class="text-5xl md:text-6xl font-serif mb-12 text-wedding-charcoal">
Cuándo y Dónde
</h2> <div class="grid md:grid-cols-3 gap-8 md:gap-12"> <div class="flex flex-col items-center space-y-4"> <div class="w-12 h-12 rounded-full bg-wedding-sand/20 flex items-center justify-center text-wedding-olive"> <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path></svg> </div> <h3 class="text-2xl font-serif">La Fecha</h3> <p class="text-xl text-wedding-charcoal/80 font-sans">
2 de Octubre, 2026
</p> </div> <div class="flex flex-col items-center space-y-4"> <div class="w-12 h-12 rounded-full bg-wedding-sand/20 flex items-center justify-center text-wedding-olive"> <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M12 6v6l4 2"></path><circle cx="12" cy="12" r="10"></circle></svg> </div> <h3 class="text-2xl font-serif">La Hora</h3> <p class="text-xl text-wedding-charcoal/80 font-sans">
Llegada: 18:00
<br>
Ceremonia: 18:30
</p> </div> <div class="flex flex-col items-center "> <div class="w-12 h-12 mb-4 rounded-full bg-wedding-sand/20 flex items-center justify-center text-wedding-olive"> <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle></svg> </div> <h3 class="text-2xl font-serif mb-4">El Lugar</h3> <p class="text-xl text-wedding-charcoal/80 font-sans">
Bodegas Casa del Valle
</p> <p class="text-xl text-wedding-charcoal/80 font-sans">Yepes</p> </div> </div> <div class="mt-16 w-full rounded-lg overflow-hidden shadow-sm border border-wedding-sand/20"> <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3791.972874285178!2d-3.716890623334982!3d39.93981147152036!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd4200687d7a7329%3A0x28995a5eef20e2d0!2sBodegas%20y%20Vi%C3%B1edos%20Casa%20del%20Valle!5e1!3m2!1ses!2ses!4v1764978976242!5m2!1ses!2ses" width="100%" height="450" style="border: 0" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe> </div> </div> </section>`;
}, "/Users/migueldemora/Work/boda-astro/src/components/EventDetails.astro", void 0);

const $$Organization = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${maybeRenderHead()}<section class="py-20 px-4 bg-white relative" id="fotos"> <div class="max-w-4xl mx-auto text-center animate-fade-in"> <h2 class="text-5xl md:text-6xl font-serif text-wedding-charcoal mb-8">
Organización
</h2> <p class="text-wedding-charcoal/80 font-sans max-w-2xl mx-auto text-2xl leading-relaxed">
Si el tiempo acompaña realizaremos el cóctel, el banquete y la fiesta
      fuera.
</p> <p class="text-wedding-charcoal/80 font-sans max-w-2xl mx-auto text-2xl leading-relaxed">
Al ser octubre puede ser que refresque, ¡estad prevenidos!
</p> <p class="text-2xl font-serif my-4 text-wedding-olive italic">&</p> <p class="text-wedding-charcoal/80 font-sans max-w-2xl mx-auto text-2xl leading-relaxed">
¡Si tenéis alguna pregunta sobre el alojamiento no dudéis en
      escribirnos!
</p> <p class="text-wedding-charcoal/80 font-sans max-w-2xl mx-auto text-2xl leading-relaxed">
Os echaremos una mano para encontrar alguna casa donde alojaros o en
      su defecto algún hotel donde hacer noche.
</p> <p class="text-2xl font-serif my-4 text-wedding-olive italic">&</p> </div> </section>`;
}, "/Users/migueldemora/Work/boda-astro/src/components/Organization.astro", void 0);

const $$Photos = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${maybeRenderHead()}<section class="py-20 px-4 bg-white" id="fotos"> <div class="max-w-4xl mx-auto text-center space-y-8 animate-fade-in"> <div class="w-16 h-16 bg-wedding-olive/10 rounded-full flex items-center justify-center mx-auto text-wedding-olive"> <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8"><path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"></path><circle cx="12" cy="13" r="3"></circle></svg> </div> <div class="space-y-4"> <h2 class="text-5xl md:text-6xl font-serif text-wedding-charcoal mb-8">
Recuerdos Compartidos
</h2> <p class="text-wedding-charcoal/80 font-sans max-w-2xl mx-auto text-2xl leading-relaxed">
Queremos ver la boda a través de vuestros ojos. Hemos creado un álbum compartido para que podáis subir todas las fotos y vídeos que hagáis durante el día.
</p> </div> <button disabled class="inline-flex items-center gap-2 px-8 py-3 bg-wedding-olive/40 text-white font-serif tracking-wide rounded shadow-sm cursor-not-allowed"> <span>Próximamente</span> </button> </div> </section>`;
}, "/Users/migueldemora/Work/boda-astro/src/components/Photos.astro", void 0);

const $$Faq = createComponent(($$result, $$props, $$slots) => {
  const faqs = [
    {
      question: "¿La ceremonia, el banquete y la fiesta se celebran en el mismo lugar?",
      answer: "Sí, toda la boda se celebra en el mismo lugar."
    },
    {
      question: "¿Hay aparcamiento disponible?",
      answer: "Sí, las Bodegas Casa del Valle dispone de amplio aparcamiento para todos los invitados."
    },
    {
      question: "¿A qué hora debo llegar?",
      answer: "A las 18:00. La ceremonia empieza puntualmente a las 18:30."
    },
    {
      question: "¿Son bienvenidos los niños?",
      answer: "¡Sí, claro!"
    },
    {
      question: "¿Necesitas alojamiento?",
      answer: "Escríbenos y te ayudamos a encontrar sitio."
    },
    {
      question: "¿Hasta cuándo se puede confirmar la asistencia?",
      answer: "Hasta el 2 de septiembre, un mes antes de la boda."
    },
    {
      question: "¿Cómo vuelvo a casa después de la boda?",
      answer: "Hemos avisado a taxis para que estén disponibles. Si bebes, no conduzcas."
    },
    {
      question: "¿Puedo llevar confeti?",
      answer: "Sí, siempre que sea biodegradable."
    },
    {
      question: "¿Hay código de vestimenta?",
      answer: "No hay dress code, ven con lo que te haga sentir cómodo/a."
    },
    {
      question: "¿Puedo llevarme las magic?",
      answer: "Me encantaría echar unas manos, pero mejor otro día."
    },
    {
      question: "¿Puedo ir de blanco?",
      answer: "Solo si eres la novia."
    }
  ];
  return renderTemplate`${maybeRenderHead()}<section class="py-20 px-4 bg-wedding-cream/30" data-astro-cid-z6gx6xcw> <div class="max-w-3xl mx-auto" data-astro-cid-z6gx6xcw> <header class="text-center mb-14 md:mb-16" data-astro-cid-z6gx6xcw> <p class="text-wedding-olive tracking-[0.2em] uppercase text-sm md:text-base font-sans mb-4" data-astro-cid-z6gx6xcw>
Dudas
</p> <h2 class="text-5xl md:text-6xl font-serif text-wedding-charcoal mb-6" data-astro-cid-z6gx6xcw>
Preguntas
</h2> <div class="w-16 h-px bg-wedding-olive/25 mx-auto" aria-hidden="true" data-astro-cid-z6gx6xcw></div> </header> <div class="flex flex-col gap-2 md:gap-3" data-astro-cid-z6gx6xcw> ${faqs.map((faq, index) => renderTemplate`<div class="faq-item"${addAttribute(index === 0 ? "true" : "false", "data-open")} data-astro-cid-z6gx6xcw> <button type="button" class="faq-toggle group w-full min-h-14 py-6 md:py-7 flex items-start justify-between gap-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wedding-olive/25 focus-visible:ring-offset-4 focus-visible:ring-offset-wedding-cream/30 rounded-sm"${addAttribute(index === 0 ? "true" : "false", "aria-expanded")} data-astro-cid-z6gx6xcw> <span class="faq-question font-serif text-2xl md:text-3xl leading-snug transition-colors duration-300 text-wedding-charcoal group-hover:text-wedding-charcoal/75" data-astro-cid-z6gx6xcw> ${faq.question} </span> <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" class="faq-chevron w-7 h-7 md:w-8 md:h-8 shrink-0 mt-0.5 text-wedding-olive/45 transition-transform duration-300 ease-out" aria-hidden="true" data-astro-cid-z6gx6xcw><path d="m6 9 6 6 6-6" data-astro-cid-z6gx6xcw></path></svg> </button> <div class="faq-answer pb-7 md:pb-8 -mt-1 pl-0 md:pl-1 border-l-2 border-wedding-olive/20 ml-1 md:ml-2"${addAttribute(index !== 0, "hidden")} data-astro-cid-z6gx6xcw> <p class="pl-5 md:pl-6 font-sans text-xl md:text-2xl text-wedding-charcoal/80 leading-relaxed max-w-[52ch] animate-fade-in" data-astro-cid-z6gx6xcw> ${faq.answer} </p> </div> </div>`)} </div> </div> </section>  ${renderScript($$result, "/Users/migueldemora/Work/boda-astro/src/components/Faq.astro?astro&type=script&index=0&lang.ts")}`;
}, "/Users/migueldemora/Work/boda-astro/src/components/Faq.astro", void 0);

const $$Footer = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${maybeRenderHead()}<footer class="py-8 text-center text-wedding-charcoal/60 text-sm bg-wedding-beige border-t border-wedding-sand/20"> <p class="font-serif italic">Cristina y Miguel</p> <p class="font-serif text-xs mt-2">
si os ha gustado la web el día de la boda me lo decis que la he hecho
    yo, un beso a todos - Miguel
</p> </footer>`;
}, "/Users/migueldemora/Work/boda-astro/src/components/Footer.astro", void 0);

function GuestNoteInput({ initialNote, guestId, onSave }) {
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
    }, 1e3);
    return () => clearTimeout(timer);
  }, [note, guestId]);
  return /* @__PURE__ */ jsxs("div", { className: "relative", children: [
    /* @__PURE__ */ jsx(
      "textarea",
      {
        value: note,
        onChange: (e) => setNote(e.target.value),
        placeholder: "Ej: Estoy embarazada, necesito silla de bebé...",
        className: "w-full bg-transparent text-sm text-wedding-charcoal placeholder:text-wedding-charcoal/30 border-none p-0 focus:ring-0 resize-none h-auto min-h-[1.5em]",
        rows: 1
      }
    ),
    isSaving && /* @__PURE__ */ jsx("div", { className: "absolute right-0 bottom-0", children: /* @__PURE__ */ jsx(Loader2, { className: "w-3 h-3 animate-spin text-wedding-olive" }) })
  ] });
}
function Rsvp() {
  const [step, setStep] = useState("search");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [mainGuest, setMainGuest] = useState(null);
  const [companions, setCompanions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingGuest, setEditingGuest] = useState(null);
  const [showAddCompanion, setShowAddCompanion] = useState(false);
  const [selectedName, setSelectedName] = useState("");
  const handleSearch = async (e) => {
    const val = e.target.value;
    setQuery(val);
    if (val.length >= 2) {
      setIsLoading(true);
      const { data } = await actions.searchGuest({ query: val });
      setSearchResults(data ?? []);
      setIsLoading(false);
    } else {
      setSearchResults([]);
    }
  };
  const selectGuest = async (guest) => {
    setIsLoading(true);
    setSelectedName(guest.name);
    const { data: fullGuest } = await actions.getGuestWithCompanions({ id: guest.id });
    if (fullGuest) {
      setMainGuest(fullGuest);
      setCompanions(fullGuest.companions);
      setStep("review");
    }
    setIsLoading(false);
  };
  const handleSaveGuest = async (e) => {
    e.preventDefault();
    if (!editingGuest) return;
    setIsLoading(true);
    await actions.updateGuest({
      id: editingGuest.id,
      data: {
        attendance: editingGuest.attendance,
        dietaryRestrictions: editingGuest.dietaryRestrictions,
        allergies: editingGuest.allergies,
        notes: editingGuest.notes
      }
    });
    if (mainGuest) {
      const { data: updated } = await actions.getGuestWithCompanions({ id: mainGuest.id });
      if (updated) {
        setMainGuest(updated);
        setCompanions(updated.companions);
      }
    }
    setEditingGuest(null);
    setIsLoading(false);
  };
  const handleAddCompanion = async (name, isChild, dietary, allergies, notes) => {
    if (!mainGuest) return;
    setIsLoading(true);
    await actions.addCompanion({
      parentId: mainGuest.id,
      data: {
        name,
        isChild,
        dietaryRestrictions: dietary,
        allergies,
        notes
      }
    });
    const { data: updated } = await actions.getGuestWithCompanions({ id: mainGuest.id });
    if (updated) setCompanions(updated.companions);
    setIsLoading(false);
  };
  const allGuests = mainGuest ? [mainGuest, ...companions] : [];
  return /* @__PURE__ */ jsx(
    "section",
    {
      className: "relative z-0 px-4 py-12 min-h-svh bg-wedding-beige flex flex-col justify-center items-center",
      id: "rsvp",
      children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-2xl bg-white/30 backdrop-blur-md p-8 md:p-16 rounded-3xl shadow-xl border border-white/50 min-h-[400px]", children: [
        /* @__PURE__ */ jsx("div", { className: "text-center mb-12", children: /* @__PURE__ */ jsx("h2", { className: "text-4xl md:text-5xl font-serif text-wedding-charcoal", children: "Confirmar Asistencia" }) }),
        step === "search" && /* @__PURE__ */ jsxs("div", { className: "space-y-8 animate-fade-in max-w-lg mx-auto", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-wedding-charcoal/60 mb-3 text-center uppercase tracking-wider", children: "Busca tu nombre" }),
            /* @__PURE__ */ jsxs("div", { className: "relative group", children: [
              /* @__PURE__ */ jsx("div", { className: "absolute left-4 top-1/2 -translate-y-1/2 text-wedding-olive/50 group-focus-within:text-wedding-olive transition-colors", children: /* @__PURE__ */ jsx(Search, { className: "w-5 h-5" }) }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "text",
                  value: query,
                  onChange: handleSearch,
                  className: "w-full pl-12 pr-4 py-4 bg-white/60 border-2 border-transparent focus:border-wedding-olive/20 rounded-full shadow-sm focus:shadow-md focus:outline-none transition-all placeholder:text-wedding-charcoal/30 text-lg",
                  placeholder: "Escribe tu nombre..."
                }
              ),
              isLoading && /* @__PURE__ */ jsx("div", { className: "absolute right-4 top-1/2 -translate-y-1/2", children: /* @__PURE__ */ jsx(Loader2, { className: "w-5 h-5 animate-spin text-wedding-olive" }) })
            ] })
          ] }),
          searchResults.length > 0 && /* @__PURE__ */ jsx("ul", { className: "divide-y divide-wedding-sand/10 bg-white/80 backdrop-blur-sm rounded-2xl border border-white/40 shadow-lg overflow-hidden", children: searchResults.map((guest) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => selectGuest(guest),
              className: "w-full px-6 py-4 text-left hover:bg-wedding-olive/5 transition-colors flex items-center justify-between group",
              children: [
                /* @__PURE__ */ jsx("span", { className: "font-serif text-lg text-wedding-charcoal group-hover:text-wedding-olive transition-colors", children: guest.name }),
                /* @__PURE__ */ jsx("span", { className: "text-xs text-wedding-olive/60 uppercase tracking-wider group-hover:text-wedding-olive transition-colors", children: "Seleccionar" })
              ]
            }
          ) }, guest.id)) })
        ] }),
        step === "review" && mainGuest && /* @__PURE__ */ jsxs("div", { className: "space-y-8 animate-fade-in", children: [
          /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
            /* @__PURE__ */ jsxs("h3", { className: "text-xl font-serif text-wedding-charcoal", children: [
              "Hola, ",
              selectedName || mainGuest.name
            ] }),
            /* @__PURE__ */ jsx("p", { className: "text-wedding-charcoal/60", children: "Por favor, revisa los datos de tus acompañantes." })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "space-y-4", children: allGuests.map((guest) => /* @__PURE__ */ jsx(
            "div",
            {
              className: "bg-white/60 rounded border border-wedding-sand/20 overflow-hidden",
              children: editingGuest?.id === guest.id ? /* @__PURE__ */ jsxs(
                "form",
                {
                  onSubmit: handleSaveGuest,
                  className: "p-4 space-y-4 bg-white",
                  children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center mb-2", children: [
                      /* @__PURE__ */ jsx("h4", { className: "font-serif font-medium", children: guest.name }),
                      /* @__PURE__ */ jsx(
                        "button",
                        {
                          type: "button",
                          onClick: () => setEditingGuest(null),
                          children: /* @__PURE__ */ jsx(X, { className: "w-4 h-4" })
                        }
                      )
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
                      /* @__PURE__ */ jsx(
                        "button",
                        {
                          type: "button",
                          onClick: () => setEditingGuest({
                            ...editingGuest,
                            attendance: "confirmed"
                          }),
                          className: `p-2 text-sm rounded border text-center ${editingGuest.attendance === "confirmed" ? "bg-wedding-olive text-white" : "bg-gray-50"}`,
                          children: "Asistiré"
                        }
                      ),
                      /* @__PURE__ */ jsx(
                        "button",
                        {
                          type: "button",
                          onClick: () => setEditingGuest({
                            ...editingGuest,
                            attendance: "declined"
                          }),
                          className: `p-2 text-sm rounded border text-center ${editingGuest.attendance === "declined" ? "bg-wedding-charcoal text-white" : "bg-gray-50"}`,
                          children: "No asistiré"
                        }
                      )
                    ] }),
                    editingGuest.attendance === "confirmed" && /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
                      /* @__PURE__ */ jsxs("div", { children: [
                        /* @__PURE__ */ jsx("label", { className: "block text-xs font-medium text-wedding-charcoal/80 mb-1", children: "Restricciones alimentarias" }),
                        /* @__PURE__ */ jsxs(
                          "select",
                          {
                            value: editingGuest.dietaryRestrictions || "omnivore",
                            onChange: (e) => setEditingGuest({
                              ...editingGuest,
                              dietaryRestrictions: e.target.value
                            }),
                            className: "w-full p-2 text-sm border rounded bg-white",
                            children: [
                              /* @__PURE__ */ jsx("option", { value: "omnivore", children: "Omnívoro" }),
                              /* @__PURE__ */ jsx("option", { value: "vegetarian", children: "Vegetariano" }),
                              /* @__PURE__ */ jsx("option", { value: "piscivegetarian", children: "Piscivegetariano" })
                            ]
                          }
                        )
                      ] }),
                      /* @__PURE__ */ jsxs("div", { children: [
                        /* @__PURE__ */ jsx("label", { className: "block text-xs font-medium text-wedding-charcoal/80 mb-1", children: "Alergias" }),
                        /* @__PURE__ */ jsx(
                          "input",
                          {
                            type: "text",
                            value: editingGuest.allergies || "",
                            onChange: (e) => setEditingGuest({
                              ...editingGuest,
                              allergies: e.target.value
                            }),
                            placeholder: "Ej: Nueces, Gluten (o 'Ninguna')",
                            className: "w-full p-2 text-sm border rounded"
                          }
                        )
                      ] })
                    ] }),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        type: "submit",
                        disabled: isLoading,
                        className: "w-full py-2 bg-wedding-olive text-white rounded text-sm",
                        children: "Guardar"
                      }
                    )
                  ]
                }
              ) : /* @__PURE__ */ jsxs("div", { className: "p-4", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-3", children: [
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                      /* @__PURE__ */ jsx("p", { className: "font-serif text-wedding-charcoal font-medium text-lg", children: guest.name }),
                      guest.isChild && /* @__PURE__ */ jsx("span", { className: "text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded", children: "Niño" })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "text-sm text-wedding-charcoal/60 mt-1 space-x-3", children: [
                      /* @__PURE__ */ jsx(
                        "span",
                        {
                          className: `px-2 py-0.5 rounded-full text-xs ${guest.attendance === "confirmed" ? "bg-green-100 text-green-700" : guest.attendance === "declined" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`,
                          children: guest.attendance === "confirmed" ? "Confirmado" : guest.attendance === "declined" ? "Rechazado" : "Pendiente"
                        }
                      ),
                      (guest.attendance === "confirmed" || guest.attendance === "pending") && /* @__PURE__ */ jsxs(Fragment, { children: [
                        guest.dietaryRestrictions && guest.dietaryRestrictions !== "omnivore" && /* @__PURE__ */ jsxs("span", { children: [
                          "• 🥗",
                          " ",
                          guest.dietaryRestrictions === "vegetarian" ? "Vegetariano" : "Piscivegetariano"
                        ] }),
                        guest.allergies && /* @__PURE__ */ jsxs("span", { children: [
                          "• ⚠️ ",
                          guest.allergies
                        ] })
                      ] })
                    ] })
                  ] }),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      onClick: () => setEditingGuest({
                        ...guest,
                        attendance: guest.attendance === "declined" ? "declined" : "confirmed"
                      }),
                      className: "text-sm text-wedding-olive hover:underline px-3 py-1 font-medium",
                      children: "Editar"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "mt-2 pt-2 border-t border-dashed border-wedding-sand/30", children: [
                  /* @__PURE__ */ jsx("label", { className: "block text-xs text-wedding-charcoal/50 mb-1 italic", children: "¿Alguna nota o petición especial?" }),
                  /* @__PURE__ */ jsx(
                    GuestNoteInput,
                    {
                      initialNote: guest.notes,
                      guestId: guest.id,
                      onSave: async (id, note) => {
                        await actions.updateGuest({ id, data: { notes: note } });
                      }
                    }
                  )
                ] })
              ] })
            },
            guest.id
          )) }),
          /* @__PURE__ */ jsx("div", { className: "pt-4 border-t border-wedding-sand/20 text-center", children: !showAddCompanion ? /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => setShowAddCompanion(true),
              className: "text-sm text-wedding-olive hover:text-wedding-olive/80 flex items-center gap-2 mx-auto border border-wedding-olive/30 px-4 py-2 rounded-full hover:bg-wedding-olive/5 transition-colors",
              children: [
                /* @__PURE__ */ jsx(Plus, { className: "w-4 h-4" }),
                " ¿Falta alguien? Añadir acompañante"
              ]
            }
          ) : /* @__PURE__ */ jsxs("div", { className: "animate-fade-in bg-white/40 p-6 rounded-xl border border-wedding-sand/20 text-left", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center mb-4", children: [
              /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-wedding-charcoal/80", children: "Añadir Acompañante" }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => setShowAddCompanion(false),
                  className: "text-wedding-charcoal/40 hover:text-wedding-charcoal",
                  children: /* @__PURE__ */ jsx(X, { className: "w-4 h-4" })
                }
              )
            ] }),
            /* @__PURE__ */ jsx(
              "form",
              {
                onSubmit: (e) => {
                  e.preventDefault();
                  const form = e.target;
                  const formData = new FormData(form);
                  const name = formData.get("compName");
                  const isChild = formData.get("isChild") === "on";
                  const dietary = formData.get("dietary");
                  const allergies = formData.get("allergies");
                  const notes = formData.get("notes");
                  if (name) {
                    handleAddCompanion(
                      name,
                      isChild,
                      dietary,
                      allergies,
                      notes
                    );
                    form.reset();
                    setShowAddCompanion(false);
                  }
                },
                className: "space-y-4",
                children: /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
                  /* @__PURE__ */ jsx("div", { className: "flex gap-2", children: /* @__PURE__ */ jsx(
                    "input",
                    {
                      name: "compName",
                      type: "text",
                      placeholder: "Nombre completo",
                      required: true,
                      className: "flex-1 px-3 py-2 bg-white/80 border border-wedding-sand/30 rounded text-sm focus:outline-none focus:ring-1 focus:ring-wedding-olive/50"
                    }
                  ) }),
                  /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-2", children: [
                    /* @__PURE__ */ jsxs(
                      "select",
                      {
                        name: "dietary",
                        className: "px-3 py-2 bg-white/80 border border-wedding-sand/30 rounded text-sm focus:outline-none focus:ring-1 focus:ring-wedding-olive/50",
                        children: [
                          /* @__PURE__ */ jsx("option", { value: "omnivore", children: "Omnívoro" }),
                          /* @__PURE__ */ jsx("option", { value: "vegetarian", children: "Vegetariano" }),
                          /* @__PURE__ */ jsx("option", { value: "piscivegetarian", children: "Piscivegetariano" })
                        ]
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      "input",
                      {
                        name: "allergies",
                        type: "text",
                        placeholder: "Alergias",
                        className: "px-3 py-2 bg-white/80 border border-wedding-sand/30 rounded text-sm focus:outline-none focus:ring-1 focus:ring-wedding-olive/50"
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsx(
                    "textarea",
                    {
                      name: "notes",
                      placeholder: "Nota o petición especial...",
                      className: "w-full px-3 py-2 bg-white/80 border border-wedding-sand/30 rounded text-sm focus:outline-none focus:ring-1 focus:ring-wedding-olive/50 h-20 resize-none"
                    }
                  ),
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
                    /* @__PURE__ */ jsxs("label", { className: "flex items-center space-x-2 cursor-pointer text-xs text-wedding-charcoal/60", children: [
                      /* @__PURE__ */ jsx(
                        "input",
                        {
                          type: "checkbox",
                          name: "isChild",
                          className: "text-wedding-olive focus:ring-wedding-olive"
                        }
                      ),
                      /* @__PURE__ */ jsx("span", { children: "Es niño/a" })
                    ] }),
                    /* @__PURE__ */ jsxs(
                      "button",
                      {
                        type: "submit",
                        disabled: isLoading,
                        className: "px-4 py-2 bg-wedding-olive text-white rounded hover:bg-wedding-olive/90 text-sm flex items-center gap-2",
                        children: [
                          /* @__PURE__ */ jsx(Plus, { className: "w-4 h-4" }),
                          " Agregar a la lista"
                        ]
                      }
                    )
                  ] })
                ] })
              }
            )
          ] }) }),
          /* @__PURE__ */ jsxs("div", { className: "flex justify-between pt-6", children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => setStep("search"),
                className: "text-sm text-wedding-charcoal/60 hover:text-wedding-charcoal",
                children: "Atrás"
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: async () => {
                  setIsLoading(true);
                  const ids = allGuests.map((g) => g.id);
                  await actions.confirmGroupAttendance({ guestIds: ids });
                  setIsLoading(false);
                  setStep("success");
                },
                disabled: isLoading,
                className: "px-8 py-3 bg-wedding-olive text-white font-serif tracking-wide rounded hover:bg-wedding-olive/90 shadow-sm disabled:opacity-50",
                children: isLoading ? /* @__PURE__ */ jsx(Loader2, { className: "animate-spin" }) : "Confirmar Todo"
              }
            )
          ] })
        ] }),
        step === "success" && /* @__PURE__ */ jsxs("div", { className: "text-center py-10 space-y-4 animate-fade-in", children: [
          /* @__PURE__ */ jsx("div", { className: "w-16 h-16 bg-wedding-olive/10 rounded-full flex items-center justify-center mx-auto mb-6", children: /* @__PURE__ */ jsx(Check, { className: "w-8 h-8 text-wedding-olive" }) }),
          /* @__PURE__ */ jsx("p", { className: "text-2xl font-serif text-wedding-olive", children: "¡Gracias!" }),
          /* @__PURE__ */ jsx("p", { className: "text-wedding-charcoal/80", children: "Hemos guardado tu respuesta y la de tus acompañantes." }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                setStep("search");
                setQuery("");
                setSearchResults([]);
                setMainGuest(null);
                setCompanions([]);
              },
              className: "mt-6 text-sm text-wedding-charcoal/60 underline hover:text-wedding-olive",
              children: "Volver al inicio"
            }
          )
        ] })
      ] })
    }
  );
}

const $$Index = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, {}, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<main class="min-h-screen font-sans"> ${renderComponent($$result2, "Hero", $$Hero, {})} ${renderComponent($$result2, "EventDetails", $$EventDetails, {})} ${renderComponent($$result2, "Rsvp", Rsvp, { "client:load": true, "client:component-hydration": "load", "client:component-path": "/Users/migueldemora/Work/boda-astro/src/components/Rsvp.tsx", "client:component-export": "default" })} ${renderComponent($$result2, "Organization", $$Organization, {})} ${renderComponent($$result2, "Photos", $$Photos, {})} ${renderComponent($$result2, "Faq", $$Faq, {})} ${renderComponent($$result2, "Footer", $$Footer, {})} </main> ` })}`;
}, "/Users/migueldemora/Work/boda-astro/src/pages/index.astro", void 0);

const $$file = "/Users/migueldemora/Work/boda-astro/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
