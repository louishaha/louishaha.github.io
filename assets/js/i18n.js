/* ==========================================================================
   Sprache / Language
   Deutsch für Besucher mit deutschem Browser oder aus einer deutschsprachigen
   Zeitzone (Deutschland, Österreich, Schweiz), Englisch für alle anderen.
   Der DE/EN-Schalter oben in der Navigation überschreibt das und wird
   gemerkt. Statische Texte im HTML tragen data-i18n-Attribute, alles, was
   main.js erzeugt, holt sich die Texte über LKI18N.t().
   ========================================================================== */
(() => {
  "use strict";

  const KEY = "lk-lang";
  const DICT = {
    de: {
      title: "Louis Koller — Fotografie",
      description: "Louis Koller — Fotograf. Landschaft, Wildtiere und Stadt.",
      skip: "Zu den Fotos",
      developing: "Entwickeln",
      navPhotos: "Fotografien",
      navStills: "Stills",
      navInfo: "Info",
      lightTable: "Leuchttisch",
      darkroom: "Dunkelkammer",
      themeAria: "Leuchttisch-Modus umschalten",
      langAria: "Switch to English",
      lockAria: "Privater Bereich",
      lockTitle: "Privat",
      scroll: "Scrollen",
      photosTitle: "Foto&shy;grafien",
      frames: "{n} Aufnahmen",
      reel: "Rolle",
      filmType: "Art", filmYear: "Jahr", filmRuntime: "Laufzeit", filmRole: "Rolle", filmCamera: "Kamera", filmAspect: "Format",
      contact: "Kontakt",
      sayHello: "Schreib mir —",
      mailAria: "E-Mail schreiben",
      write: "Schreiben",
      backTop: "Nach oben ↑",
      imprint: "Impressum",
      privacy: "Datenschutz",
      viewer: "Bildansicht",
      close: "Schließen",
      prev: "Zurück",
      next: "Weiter",
      prevAria: "Vorheriges Bild",
      nextAria: "Nächstes Bild",
      closeAria: "Ansicht schließen",
      view: "Ansehen",
      open: "{t} öffnen",
      show: "{t} zeigen",
      stillFrom: "Standbild aus {t}",
      openStill: "Standbild aus {t} öffnen",
      local: "Ortszeit",
      lockDialog: "Code eingeben",
      lockInput: "Vierstelliger Code",
      wrongCode: "Falscher Code.",
      cancel: "Abbrechen",
      liteAsk: "Läuft’s bei dir etwas zäh? Wechsel zur leichten Version – gleiche Fotos, weniger Effekte.",
      liteYes: "Leichte Version",
      liteNo: "Passt so",
      liteDone: "Leichte Version ist an. Zurück geht’s jederzeit unten im Footer.",
      liteLabel: "Leichte Version",
      on: "an",
      off: "aus",
    },
    en: {
      title: "Louis Koller — Photography",
      description: "Louis Koller — photographer. Landscape, wildlife and city photographs.",
      skip: "Skip to work",
      developing: "Developing",
      navPhotos: "Photographs",
      navStills: "Stills",
      navInfo: "Info",
      lightTable: "Light table",
      darkroom: "Darkroom",
      themeAria: "Toggle light table mode",
      langAria: "Auf Deutsch wechseln",
      lockAria: "Private area",
      lockTitle: "Private",
      scroll: "Scroll",
      photosTitle: "Photo&shy;graphs",
      frames: "{n} Frames",
      reel: "Reel",
      filmType: "Type", filmYear: "Year", filmRuntime: "Runtime", filmRole: "Role", filmCamera: "Camera", filmAspect: "Aspect",
      contact: "Contact",
      sayHello: "Say hello —",
      mailAria: "Send an email",
      write: "Write",
      backTop: "Back to top ↑",
      imprint: "Imprint",
      privacy: "Privacy",
      viewer: "Image viewer",
      close: "Close",
      prev: "Prev",
      next: "Next",
      prevAria: "Previous image",
      nextAria: "Next image",
      closeAria: "Close viewer",
      view: "View",
      open: "Open {t}",
      show: "Show {t}",
      stillFrom: "Still from {t}",
      openStill: "Open still from {t}",
      local: "Local time",
      lockDialog: "Enter code",
      lockInput: "Four-digit code",
      wrongCode: "Wrong code.",
      cancel: "Cancel",
      liteAsk: "Things a bit choppy on your device? Switch to the lighter version – same photos, fewer effects.",
      liteYes: "Go lighter",
      liteNo: "I’m fine",
      liteDone: "Lighter version is on. You can switch back any time in the footer.",
      liteLabel: "Lite version",
      on: "on",
      off: "off",
    },
  };

  const get = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const save = (v) => { try { localStorage.setItem(KEY, v); } catch (e) { /* ignore */ } };

  function detect() {
    const saved = get();
    if (saved === "de" || saved === "en") return saved;
    const first = (navigator.languages && navigator.languages[0]) || navigator.language || "";
    if (/^de\b/i.test(first)) return "de";
    let tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { /* ignore */ }
    if (/^Europe\/(Berlin|Busingen|Vienna|Zurich|Vaduz)$/.test(tz)) return "de";
    return "en";
  }

  let lang = detect();
  const subs = [];

  const t = (key, vars) => {
    let s = DICT[lang][key] ?? DICT.en[key] ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? ""));
    return s;
  };
  // content.js may give a text as { de: "…", en: "…" } or as a plain string
  const tx = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v[lang] ?? v.en ?? v.de ?? "" : v);

  function apply() {
    const root = document.documentElement;
    root.lang = lang;
    document.title = t("title");
    document.querySelector('meta[name="description"]')?.setAttribute("content", t("description"));
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
    document.querySelectorAll("[data-i18n-title]").forEach((el) => el.setAttribute("title", t(el.dataset.i18nTitle)));
    document.querySelectorAll("[data-i18n-cursor]").forEach((el) => { el.dataset.cursor = t(el.dataset.i18nCursor); });
    document.querySelectorAll("[data-lang-toggle]").forEach((b) => {
      b.setAttribute("aria-label", t("langAria"));
      b.querySelectorAll("[data-lang]").forEach((s) => s.classList.toggle("is-on", s.dataset.lang === lang));
    });
  }

  function set(next) {
    if (next === lang || !DICT[next]) return;
    lang = next;
    save(next);
    apply();
    subs.forEach((f) => f(lang));
  }

  window.LKI18N = {
    get lang() { return lang; },
    t, tx, set,
    onChange: (f) => subs.push(f),
  };

  apply();
  document.querySelectorAll("[data-lang-toggle]").forEach((b) =>
    b.addEventListener("click", () => set(lang === "de" ? "en" : "de")));
})();
