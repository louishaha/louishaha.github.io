/* ==========================================================================
   Route — shared code for index.html (Ansicht) and admin.html (Bearbeiten)
   Exposes window.RT
   ========================================================================== */
(() => {
  "use strict";

  const RT = (window.RT = {});

  /* ---------------------------------------------------------------- Config */
  RT.REPO = "louishaha/louishaha.github.io";
  RT.DATA_PATH = "route/data/trip.json"; // path inside the repo
  RT.DATA_URL = "data/trip.json"; // path relative to /route/
  RT.SITE = "https://www.louiskoller.cc/route/";

  /* --------------------------------------------------------------- Helpers */
  RT.$ = (s, el = document) => el.querySelector(s);
  RT.$$ = (s, el = document) => [...el.querySelectorAll(s)];
  RT.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  RT.store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  RT.uid = (prefix) => prefix + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  let toastTimer;
  RT.toast = (msg, ms = 2600) => {
    let el = RT.$(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    requestAnimationFrame(() => el.classList.add("is-on"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-on"), ms);
  };

  /* --------------------------------------------------------------- Motion
     Springs keep velocity, can be grabbed mid-flight and re-targeted.
     response = seconds to (almost) reach the target, damping 1 = no bounce. */
  RT.spring = ({ from, to, velocity = 0, response = 0.4, damping = 1, rest = 0.4, onUpdate, onDone }) => {
    const w = (2 * Math.PI) / response;
    const k = w * w, c = 2 * damping * w;
    let x = from, v = velocity, raf = 0, stopped = false, last = performance.now();
    const step = (t) => {
      if (stopped) return;
      const dt = Math.min(0.064, Math.max(0, (t - last) / 1000));
      last = t;
      const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
      for (let i = 0; i < n; i++) { v += (-k * (x - to) - c * v) * h; x += v * h; }
      if (Math.abs(x - to) < rest && Math.abs(v) < rest * 12) {
        stopped = true;
        onUpdate(to);
        onDone && onDone();
        return;
      }
      onUpdate(x);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return { stop() { stopped = true; cancelAnimationFrame(raf); }, get running() { return !stopped; }, get value() { return x; } };
  };
  // Where a flick ends up if it were left to decelerate (px/s -> px)
  RT.project = (velocity, rate = 0.99) => ((velocity / 1000) * rate) / (1 - rate);
  // Progressive resistance past an edge
  RT.rubberband = (over, dim, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));

  /* ------------------------------------------------------------------ Gate
     A curtain, not a vault: everything here is public on GitHub Pages.    */
  const fnv = (s) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, "0");
  };
  const GATE_KEY = "lk-route-key";
  const GATE_HASH = "c07e31de";
  RT.isUnlocked = () => RT.store.get(GATE_KEY) === GATE_HASH;

  // Wires a .code widget (one input + four slots). onDone(code) -> bool
  RT.codeField = (root, onDone) => {
    const input = RT.$("input", root);
    const slots = RT.$$(".code__slot", root);
    const paint = () => {
      const v = input.value;
      slots.forEach((s, i) => {
        s.classList.toggle("is-filled", i < v.length);
        s.classList.toggle("is-caret", i === v.length && document.activeElement === input);
      });
    };
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 4);
      root.classList.remove("is-wrong");
      paint();
      if (input.value.length === 4) {
        const ok = onDone(input.value);
        if (ok) {
          root.classList.add("is-right");
          input.blur();
        } else {
          root.classList.add("is-wrong");
          setTimeout(() => { input.value = ""; paint(); }, 380);
        }
      }
    });
    input.addEventListener("focus", paint);
    input.addEventListener("blur", paint);
    paint();
    return input;
  };

  RT.gate = (onOpen) => {
    const gate = RT.$("[data-gate]");
    if (RT.isUnlocked()) {
      document.documentElement.classList.add("unlocked");
      if (gate) gate.remove();
      onOpen();
      return;
    }
    const hint = RT.$("[data-gate-hint]", gate);
    const input = RT.codeField(RT.$(".code", gate), (code) => {
      if (fnv("lk-route:" + code) !== GATE_HASH) {
        hint.textContent = "Falscher Code.";
        return false;
      }
      RT.store.set(GATE_KEY, GATE_HASH);
      hint.textContent = "";
      setTimeout(() => {
        gate.classList.add("is-leaving");
        onOpen();
        setTimeout(() => gate.remove(), 700);
      }, 260);
      return true;
    });
    gate.addEventListener("click", () => input.focus());
    setTimeout(() => input.focus(), 50);
  };

  /* ----------------------------------------------------------------- Dates */
  const dayMs = 86400000;
  RT.today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const parseDay = (s) => {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  RT.daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / dayMs);
  const fmtLong = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const fmtShort = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", timeZone: "UTC" });
  const fmtMonth = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
  RT.fmtDate = (s) => (parseDay(s) == null ? "" : fmtLong.format(parseDay(s)));
  RT.fmtShort = (s) => (parseDay(s) == null ? "" : fmtShort.format(parseDay(s)));
  RT.fmtMonth = (s) => (parseDay(s) == null ? "" : fmtMonth.format(parseDay(s)));
  RT.fmtRange = (a, b) => {
    if (a && b && a !== b) return `${RT.fmtShort(a)} – ${RT.fmtDate(b)}`;
    return RT.fmtDate(a || b);
  };

  /* --------------------------------------------------------- Transport */
  const ic = (d, fill) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true" fill="${fill ? "currentColor" : "none"}" stroke="${fill ? "none" : "currentColor"}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  RT.MODES = {
    plane: { label: "Flug", icon: ic('<path d="M21 15.5v-2l-8-5V3.6a1.5 1.5 0 0 0-3 0V8.5l-8 5v2l8-2.5V18l-2.2 1.6V21l3.7-1 3.7 1v-1.4L13 18v-5z"/>', true) },
    train: { label: "Zug", icon: ic('<rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 10h14M9 13.2h.01M15 13.2h.01M8 21l2-5M16 21l-2-5"/>') },
    bus: { label: "Bus", icon: ic('<rect x="4" y="3" width="16" height="14" rx="2.5"/><path d="M4 11h16M7.5 14h.01M16.5 14h.01M7 17v3M17 17v3"/>') },
    car: { label: "Auto", icon: ic('<path d="M4 17v-5l2.3-5h11.4L20 12v5z"/><path d="M4 12h16M7.5 14.5h.01M16.5 14.5h.01M6.5 17v2.5M17.5 17v2.5"/>') },
    boat: { label: "Boot / Fähre", icon: ic('<path d="M3 14h18l-2.5 6h-13z"/><path d="M6 14V9h12v5M12 9V4"/>') },
    moto: { label: "Roller / Motorrad", icon: ic('<circle cx="5.5" cy="17" r="2.5"/><circle cx="18.5" cy="17" r="2.5"/><path d="M8 17h5l3-6h-4M16 11l2.5 6M12 7h3"/>') },
    walk: { label: "Zu Fuß", icon: ic('<circle cx="13" cy="4.5" r="1.6"/><path d="M10 21l2-6 3 3v3M12 15l-1-5.5 4 1.5 2 3M11 9.5l-3 2.5v3"/>') },
    other: { label: "Sonstiges", icon: ic('<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>', true) },
  };
  RT.ICON = {
    lock: ic('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>'),
    pin: ic('<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>'),
    play: ic('<path d="M7 4.5v15l13-7.5z"/>', true),
    share: ic('<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>'),
    text: ic('<path d="M5 6h14M5 11h14M5 16h9"/>'),
    chev: ic('<path d="M14.5 5.5 8 12l6.5 6.5"/>'),
    next: ic('<path d="M9.5 5.5 16 12l-6.5 6.5"/>'),
    close: ic('<path d="M6 6l12 12M18 6 6 18"/>'),
    stack: ic('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M5 15.5V7a2 2 0 0 1 2-2h8.5"/>'),
  };

  /* ------------------------------------------------------------ Geometry */
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  RT.km = (a, b) => {
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  const mercY = (lat) => (Math.log(Math.tan(Math.PI / 4 + rad(Math.max(-85, Math.min(85, lat))) / 2)) * 180) / Math.PI;
  const invY = (y) => (360 / Math.PI) * Math.atan(Math.exp((y * Math.PI) / 180)) - 90;
  // Bring lng within ±180° of ref so lines never take the long way round
  const near = (lng, ref) => {
    while (lng - ref > 180) lng -= 360;
    while (lng - ref < -180) lng += 360;
    return lng;
  };

  // Points along a straight (mercator) line, or a bowed arc for flights
  const legLine = (a, b, bow) => {
    const ax = a[0], ay = mercY(a[1]), bx = b[0], by = mercY(b[1]);
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    if (!len) return { coords: [a, b], mid: a };
    let px = -dy / len, py = dx / len;
    if (py < 0) { px = -px; py = -py; }
    const k = bow ? len * 0.2 : 0;
    const cx = (ax + bx) / 2 + px * k, cy = (ay + by) / 2 + py * k;
    const n = Math.max(8, Math.min(96, Math.round(len * 2)));
    const coords = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      const x = u * u * ax + 2 * u * t * cx + t * t * bx;
      const y = u * u * ay + 2 * u * t * cy + t * t * by;
      coords.push([x, invY(Math.max(-85, Math.min(85, y)))]);
    }
    return { coords, mid: coords[Math.floor(n / 2)] };
  };

  /* --------------------------------------------------------------- Model */
  RT.emptyTrip = () => ({ version: 1, rev: 0, title: "Gapyear", subtitle: "", start: "", current: null, here: null, stops: [], posts: [], updated: null });

  RT.normalize = (t) => {
    const trip = Object.assign(RT.emptyTrip(), t || {});
    trip.stops = Array.isArray(trip.stops) ? trip.stops.filter((s) => s && isFinite(s.lat) && isFinite(s.lng)) : [];
    trip.posts = Array.isArray(trip.posts) ? trip.posts.filter((p) => p && p.id) : [];
    trip.posts.forEach((p) => { p.media = Array.isArray(p.media) ? p.media : []; });
    return trip;
  };

  // Everything the views need, derived from the raw trip
  RT.model = (trip) => {
    const ci = trip.stops.findIndex((s) => s.id === trip.current);
    let prev = null;
    const stops = trip.stops.map((s, i) => {
      const lng = prev == null ? +s.lng : near(+s.lng, prev);
      prev = lng;
      return {
        ...s,
        idx: i,
        x: lng,
        lat: +s.lat,
        lng: +s.lng,
        status: ci < 0 ? "plan" : i < ci ? "done" : i === ci ? "now" : "plan",
        posts: trip.posts.filter((p) => p.stop === s.id),
      };
    });
    const legs = [];
    for (let i = 1; i < stops.length; i++) {
      const a = stops[i - 1], b = stops[i];
      const mode = RT.MODES[b.by] ? b.by : "other";
      const line = legLine([a.x, a.lat], [b.x, b.lat], mode === "plane");
      legs.push({ from: a, to: b, mode, status: ci >= 0 && i <= ci ? "done" : "plan", km: RT.km(a, b), ...line });
    }

    let here = null;
    if (trip.here && isFinite(trip.here.lat) && isFinite(trip.here.lng)) {
      const ref = ci >= 0 ? stops[ci].x : stops.length ? stops[stops.length - 1].x : 0;
      here = { ...trip.here, x: near(+trip.here.lng, ref), lat: +trip.here.lat };
    }

    // Stats
    const visited = stops.filter((s) => s.status !== "plan");
    const cc = (list) => new Set(list.map((s) => (s.country || s.cc || "").trim().toLowerCase()).filter(Boolean)).size;
    const kmDone = legs.filter((l) => l.status === "done").reduce((a, l) => a + l.km, 0);
    const kmAll = legs.reduce((a, l) => a + l.km, 0);
    const start = trip.start || (stops[0] && (stops[0].from || stops[0].to)) || "";
    const today = RT.today();
    let days = null, daysLabel = "Tage";
    if (start) {
      const d = RT.daysBetween(start, today);
      if (d < 0) { days = -d; daysLabel = "bis Start"; }
      else {
        const last = stops[stops.length - 1];
        const end = ci === stops.length - 1 && last && last.to && last.to < today ? last.to : today;
        days = RT.daysBetween(start, end) + 1;
      }
    }
    const stats = {
      days, daysLabel,
      countries: cc(visited), countriesAll: cc(stops),
      km: kmDone, kmAll,
      places: visited.length, placesAll: stops.length,
      posts: trip.posts.length,
    };

    const posts = trip.posts
      .map((p) => ({ ...p, stopObj: stops.find((s) => s.id === p.stop) || null }))
      .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.published || "").localeCompare(b.published || ""));

    return { trip, stops, legs, here, current: ci >= 0 ? stops[ci] : null, stats, posts };
  };

  RT.fmtKm = (n) => (n >= 10000 ? Math.round(n / 1000) + "k" : Math.round(n).toLocaleString("de-DE"));

  /* ------------------------------------------------------------- Text
     Tiny markdown: paragraphs, line breaks, **bold**, *italic*, [a](url) */
  RT.prose = (src) => {
    const inline = (s) =>
      RT.esc(s)
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    return String(src || "")
      .replace(/\r\n?/g, "\n")
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${inline(p).replace(/\n/g, "<br>")}</p>`)
      .join("");
  };
  RT.excerpt = (src, n = 140) => {
    const t = String(src || "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_#>]/g, "").replace(/\s+/g, " ").trim();
    return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + " …" : t;
  };

  /* ------------------------------------------------------------- Media */
  RT.ytId = (url) => {
    const m = String(url || "").match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
    return m ? m[1] : /^[\w-]{11}$/.test(url) ? url : null;
  };
  // URL for a media file; admin may hand over a local preview
  RT.mediaSrc = (m, thumb) => m._preview && (thumb ? m._previewThumb || m._preview : m._preview) || (thumb && m.thumb) || m.src;
  RT.mediaThumb = (m) => {
    if (m.type === "yt") return `https://i.ytimg.com/vi/${m.id}/hqdefault.jpg`;
    if (m.type === "video") return m.poster || "";
    return RT.mediaSrc(m, true);
  };
  RT.cover = (p) => {
    const m = p.media.find((x) => x.type === "img") || p.media.find((x) => x.type === "yt") || p.media.find((x) => x.poster);
    return m ? RT.mediaThumb(m) : "";
  };

  /* --------------------------------------------------------------- Map */
  const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/";
  RT.STYLE = {
    version: 8,
    projection: { type: "globe" },
    sky: {
      "sky-color": "#000000",
      "horizon-color": "#1b3358",
      "fog-color": "#000000",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.5,
      "fog-ground-blend": 0.8,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.9, 4, 0.6, 7, 0],
    },
    sources: {
      sat: {
        type: "raster",
        tiles: [ESRI + "World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        maxzoom: 18,
        attribution: 'Imagery © <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics',
      },
      labels: {
        type: "raster",
        tiles: [ESRI + "Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        maxzoom: 16,
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#000000" } },
      {
        id: "sat",
        type: "raster",
        source: "sat",
        paint: {
          "raster-brightness-max": 0.62,
          "raster-saturation": -0.35,
          "raster-contrast": 0.12,
          "raster-fade-duration": 250,
        },
      },
      {
        id: "labels",
        type: "raster",
        source: "labels",
        paint: {
          "raster-opacity": ["interpolate", ["linear"], ["zoom"], 1, 0.35, 4, 0.6, 8, 0.8],
          "raster-fade-duration": 250,
        },
      },
    ],
  };

  RT.createMap = (container, opts = {}) => {
    const map = new maplibregl.Map({
      container,
      style: RT.STYLE,
      center: opts.center || [30, 22],
      zoom: opts.zoom ?? 1.4,
      minZoom: 0.6,
      maxZoom: 17,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      renderWorldCopies: true,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new maplibregl.AttributionControl({ compact: true }), opts.attribution || "bottom-left");
    if (opts.controls !== false) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), opts.controlsAt || "bottom-left");
    return map;
  };

  RT.onLoad = (map, fn) => (map.loaded() && map.isStyleLoaded() ? fn() : map.once("load", fn));

  /* Route layer: legs, stops, transport badges, live position */
  RT.RouteLayer = class {
    constructor(map, { onStop } = {}) {
      this.map = map;
      this.onStop = onStop;
      this.markers = [];
      this.modeMarkers = [];
      this.here = null;
      this.active = null;
      this.ready = false;
      RT.onLoad(map, () => {
        map.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] }, lineMetrics: false });
        map.addLayer({
          id: "leg-plan", type: "line", source: "route",
          filter: ["==", ["get", "status"], "plan"],
          layout: { "line-cap": "butt", "line-join": "round" },
          paint: { "line-color": "rgba(235,229,217,0.75)", "line-width": 1.4, "line-dasharray": [2, 2.2] },
        });
        map.addLayer({
          id: "leg-glow", type: "line", source: "route",
          filter: ["==", ["get", "status"], "done"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#ff453a", "line-width": 9, "line-blur": 7, "line-opacity": 0.4 },
        });
        map.addLayer({
          id: "leg-done", type: "line", source: "route",
          filter: ["==", ["get", "status"], "done"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#ff453a", "line-width": ["case", ["==", ["get", "mode"], "plane"], 1.6, 2.4] },
        });
        this.ready = true;
        if (this.model) this.set(this.model);
        map.on("zoom", () => { this.zoomClass(); this.placeModes(); });
        map.on("moveend", () => this.placeModes());
      });
    }

    set(model) {
      this.model = model;
      if (!this.ready) return;
      const map = this.map;
      map.getSource("route").setData({
        type: "FeatureCollection",
        features: model.legs.map((l) => ({
          type: "Feature",
          properties: { status: l.status, mode: l.mode },
          geometry: { type: "LineString", coordinates: l.coords },
        })),
      });

      this.markers.forEach((m) => m.remove());
      this.modeMarkers.forEach((m) => m.marker.remove());
      if (this.here) this.here.remove();

      this.markers = model.stops.map((s) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = `stop stop--${s.status}`;
        el.dataset.id = s.id;
        el.setAttribute("aria-label", s.name);
        const n = s.posts.length;
        el.innerHTML = `<span class="stop__dot"></span><span class="stop__label">${RT.esc(s.name)}${n ? `<i>${n}</i>` : ""}</span>`;
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          this.onStop && this.onStop(s.id);
        });
        const mk = new maplibregl.Marker({ element: el, anchor: "center", opacityWhenCovered: "0" }).setLngLat([s.x, s.lat]).addTo(map);
        mk._stopId = s.id;
        return mk;
      });

      this.modeMarkers = model.legs.map((l) => {
        const el = document.createElement("div");
        el.className = `mode mode--${l.status}`;
        el.title = RT.MODES[l.mode].label;
        el.innerHTML = RT.MODES[l.mode].icon;
        return { leg: l, el, marker: new maplibregl.Marker({ element: el, anchor: "center", opacityWhenCovered: "0" }).setLngLat(l.mid).addTo(map) };
      });

      this.here = null;
      if (model.here) {
        const el = document.createElement("div");
        el.className = "here";
        el.innerHTML = '<span class="here__dot"></span>';
        this.here = new maplibregl.Marker({ element: el, anchor: "center", opacityWhenCovered: "0" }).setLngLat([model.here.x, model.here.lat]).addTo(map);
      }
      this.setActive(this.active);
      this.zoomClass();
      this.placeModes();
    }

    setActive(id) {
      this.active = id;
      this.markers.forEach((m) => m.getElement().classList.toggle("is-active", m._stopId === id));
    }

    zoomClass() {
      this.map.getContainer().classList.toggle("zoomed", this.map.getZoom() >= 5);
    }

    // Hide transport badges on legs that are too short on screen
    placeModes() {
      const map = this.map;
      this.modeMarkers.forEach(({ leg, el }) => {
        const a = map.project([leg.from.x, leg.from.lat]);
        const b = map.project([leg.to.x, leg.to.lat]);
        el.classList.toggle("is-hidden", Math.hypot(a.x - b.x, a.y - b.y) < 70);
      });
    }

    // Frame the whole route (or a sensible default)
    fit(padding, animate = false) {
      const model = this.model;
      const map = this.map;
      const pts = model.stops.map((s) => [s.x, s.lat]);
      if (model.here) pts.push([model.here.x, model.here.lat]);
      if (!pts.length) return;
      if (pts.length === 1) {
        map.jumpTo({ center: pts[0], zoom: 4, padding });
        return;
      }
      const b = new maplibregl.LngLatBounds(pts[0], pts[0]);
      pts.forEach((p) => b.extend(p));
      model.legs.forEach((l) => l.mode === "plane" && b.extend(l.mid));
      const spanX = b.getEast() - b.getWest(), spanY = b.getNorth() - b.getSouth();
      if (spanX > 70 || spanY > 50) {
        // Route spans a good part of the planet: show the whole globe, turned towards it
        let x = 0, y = 0, z = 0;
        pts.forEach(([lng, lat]) => {
          const a = rad(lat), o = rad(lng);
          x += Math.cos(a) * Math.cos(o); y += Math.cos(a) * Math.sin(o); z += Math.sin(a);
        });
        const center = [(Math.atan2(y, x) * 180) / Math.PI, (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI];
        const c = map.getContainer();
        const free = Math.min(c.clientWidth - padding.left - padding.right, c.clientHeight - padding.top - padding.bottom);
        const zoom = Math.max(0.6, Math.min(2.6, Math.log2((free * 0.92) / 163)));
        map.easeTo({ center, zoom, padding, duration: animate ? 1600 : 0 });
        return;
      }
      map.fitBounds(b, { padding, maxZoom: 6, duration: animate ? 1600 : 0 });
    }

    flyTo(stopId, padding) {
      const s = this.model.stops.find((x) => x.id === stopId);
      if (!s) return;
      this.map.flyTo({ center: [s.x, s.lat], zoom: Math.max(this.map.getZoom(), 5.5), padding, duration: 1800, essential: true });
    }
  };

  /* Idle rotation for an empty globe */
  RT.spin = (map) => {
    let on = true, raf;
    map._spinning = true;
    const stop = () => { on = false; map._spinning = false; cancelAnimationFrame(raf); };
    ["mousedown", "touchstart", "wheel", "dragstart"].forEach((e) => map.on(e, stop));
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return stop;
    let last = performance.now();
    const step = (t) => {
      if (!on) return;
      const dt = Math.min(64, t - last);
      last = t;
      const c = map.getCenter();
      map.setCenter([c.lng + dt * 0.003, c.lat]);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return stop;
  };
})();
