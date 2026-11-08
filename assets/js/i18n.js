/* ==========================================================================
   Sprache / Language / 语言
   Deutsch für Besucher mit deutschem Browser oder aus einer deutschsprachigen
   Zeitzone, vereinfachtes Chinesisch für chinesische Browser, sonst Englisch.
   Der Schalter DE / EN / 中 in der Navigation überschreibt das und wird
   gemerkt. Statische Texte tragen data-i18n-Attribute, alles, was per JS
   entsteht, holt sich die Texte über LKI18N.t(). Inhalte aus data/site.json
   können { de, en, zh } sein, siehe LKI18N.tx().
   ========================================================================== */
(() => {
  "use strict";

  const KEY = "lk-lang";
  const LANGS = ["de", "en", "zh"];
  const DICT = {
    de: {
      title: "Louis Koller — Fotografie",
      description: "Louis Koller — Fotograf. Landschaft, Wildtiere und Stadt.",
      skip: "Zum Inhalt",
      navPhotos: "Fotografie",
      navFilm: "Film",
      navTrack: "Track me",
      navInfo: "Info",
      lightTable: "Leuchttisch",
      darkroom: "Dunkelkammer",
      themeAria: "Zwischen Dunkelkammer und Leuchttisch wechseln",
      langAria: "Sprache",
      lockAria: "Privater Bereich",
      lockTitle: "Privat",
      scroll: "Scrollen",
      selected: "Auswahl",
      series: "Serien",
      info: "Info",
      photos: "{n} Bilder",
      allSeries: "Alle Serien",
      nextSeries: "Nächste Serie",
      contact: "Kontakt",
      write: "Schreiben",
      backTop: "Nach oben",
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
      play: "Abspielen",
      pause: "Pause",
      mute: "Ton aus",
      unmute: "Ton an",
      fullscreen: "Vollbild",
      open: "{t} öffnen",
      show: "{t} zeigen",
      filmEmpty: "Hier kommen bald Clips hin.",
      ytNote: "Dieser Film liegt auf YouTube. Beim Abspielen werden Daten an YouTube (Google) übertragen.",
      ytPlay: "Auf YouTube abspielen",
      trackLead: "Meine aktuelle Reise, live.",
      nowIn: "Gerade in {place}",
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
      notFound: "Diese Serie gibt es nicht (mehr).",
    },
    en: {
      title: "Louis Koller — Photography",
      description: "Louis Koller — photographer. Landscape, wildlife and city.",
      skip: "Skip to content",
      navPhotos: "Photography",
      navFilm: "Film",
      navTrack: "Track me",
      navInfo: "Info",
      lightTable: "Light table",
      darkroom: "Darkroom",
      themeAria: "Switch between darkroom and light table",
      langAria: "Language",
      lockAria: "Private area",
      lockTitle: "Private",
      scroll: "Scroll",
      selected: "Selected",
      series: "Series",
      info: "Info",
      photos: "{n} photos",
      allSeries: "All series",
      nextSeries: "Next series",
      contact: "Contact",
      write: "Write",
      backTop: "Back to top",
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
      play: "Play",
      pause: "Pause",
      mute: "Mute",
      unmute: "Sound on",
      fullscreen: "Fullscreen",
      open: "Open {t}",
      show: "Show {t}",
      filmEmpty: "Clips are coming soon.",
      ytNote: "This film is hosted on YouTube. Playing it sends data to YouTube (Google).",
      ytPlay: "Play on YouTube",
      trackLead: "My current trip, live.",
      nowIn: "Now in {place}",
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
      notFound: "This series doesn’t exist (anymore).",
    },
    zh: {
      title: "Louis Koller — 摄影",
      description: "Louis Koller — 摄影师。风景、野生动物与城市。",
      skip: "跳到内容",
      navPhotos: "摄影",
      navFilm: "影像",
      navTrack: "Track me",
      navInfo: "关于",
      lightTable: "灯箱",
      darkroom: "暗房",
      themeAria: "在暗房和灯箱之间切换",
      langAria: "语言",
      lockAria: "私人区域",
      lockTitle: "私人",
      scroll: "向下",
      selected: "精选",
      series: "系列",
      info: "关于",
      photos: "{n} 张照片",
      allSeries: "全部系列",
      nextSeries: "下一个系列",
      contact: "联系",
      write: "写信",
      backTop: "回到顶部",
      imprint: "法律信息",
      privacy: "隐私",
      viewer: "图片浏览",
      close: "关闭",
      prev: "上一张",
      next: "下一张",
      prevAria: "上一张图片",
      nextAria: "下一张图片",
      closeAria: "关闭浏览",
      view: "查看",
      play: "播放",
      pause: "暂停",
      mute: "静音",
      unmute: "打开声音",
      fullscreen: "全屏",
      open: "打开 {t}",
      show: "显示 {t}",
      filmEmpty: "短片即将上线。",
      ytNote: "该影片托管在 YouTube 上。播放时会向 YouTube（Google）传输数据。",
      ytPlay: "在 YouTube 播放",
      trackLead: "我正在进行的旅程，实时更新。",
      nowIn: "现在在{place}",
      lockDialog: "输入密码",
      lockInput: "四位数密码",
      wrongCode: "密码错误。",
      cancel: "取消",
      liteAsk: "在你的设备上有点卡？切换到轻量版——同样的照片，更少的特效。",
      liteYes: "轻量版",
      liteNo: "不用了",
      liteDone: "轻量版已开启。随时可以在页面底部切换回来。",
      liteLabel: "轻量版",
      on: "开",
      off: "关",
      notFound: "这个系列不存在。",
    },
  };

  const get = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const save = (v) => { try { localStorage.setItem(KEY, v); } catch (e) { /* ignore */ } };

  function detect() {
    const saved = get();
    if (LANGS.includes(saved)) return saved;
    const first = (navigator.languages && navigator.languages[0]) || navigator.language || "";
    if (/^de\b/i.test(first)) return "de";
    if (/^zh\b/i.test(first)) return "zh";
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
  // content may be { de, en, zh } or a plain string (same in every language)
  const tx = (v) => {
    if (v && typeof v === "object" && !Array.isArray(v) && !("text" in v)) return v[lang] || v.en || v.de || "";
    return v ?? "";
  };

  function paintToggles() {
    document.querySelectorAll("[data-lang-toggle]").forEach((g) => {
      g.setAttribute("aria-label", t("langAria"));
      g.querySelectorAll("[data-lang]").forEach((b) => {
        const on = b.dataset.lang === lang;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-pressed", String(on));
      });
    });
  }

  function apply(scope = document) {
    const root = document.documentElement;
    root.lang = lang === "zh" ? "zh-Hans" : lang;
    if (scope === document) {
      const pageTitle = document.body?.dataset.title;
      document.title = pageTitle ? `${t(pageTitle)} — Louis Koller` : t("title");
      document.querySelector('meta[name="description"]')?.setAttribute("content", t("description"));
    }
    scope.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    scope.querySelectorAll("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
    scope.querySelectorAll("[data-i18n-title]").forEach((el) => el.setAttribute("title", t(el.dataset.i18nTitle)));
    scope.querySelectorAll("[data-i18n-cursor]").forEach((el) => { el.dataset.cursor = t(el.dataset.i18nCursor); });
    paintToggles();
  }

  function set(next) {
    if (next === lang || !DICT[next]) return;
    lang = next;
    save(next);
    apply();
    subs.forEach((f) => f(lang));
  }

  // one listener for all toggles, also those rendered later
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-lang-toggle] [data-lang]");
    if (b) set(b.dataset.lang);
  });

  window.LKI18N = {
    get lang() { return lang; },
    langs: LANGS,
    t, tx, set, apply,
    onChange: (f) => subs.push(f),
  };

  apply();
})();
