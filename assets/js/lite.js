/* ==========================================================================
   Leichte Version / Lite version
   Für Geräte, denen die Effekte zu viel sind (WebGL-Verzerrung, Glas-Cursor,
   animiertes Korn, Unschärfe). Sieht ein Gerät langsam aus, wird einmal
   gefragt, ob es auf die leichte Version wechseln will. Die Antwort wird
   gemerkt; der Schalter im Footer schaltet jederzeit hin und zurück.
   main.js hört über LKLite.onChange() zu und startet/stoppt die Effekte.
   ========================================================================== */
(() => {
  "use strict";

  const KEY = "lk-lite";
  const root = document.documentElement;
  const I = window.LKI18N;
  const tr = I ? I.t : (k) => k;
  const get = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const save = (v) => { try { localStorage.setItem(KEY, v); } catch (e) { /* ignore */ } };

  const subs = [];
  const on = () => root.classList.contains("lite");
  function set(v) {
    root.classList.toggle("lite", !!v);
    save(v ? "1" : "0");
    paintToggle();
    subs.forEach((f) => f(!!v));
  }
  window.LKLite = { on, set, onChange: (f) => subs.push(f) };

  /* Footer switch */
  const btn = document.querySelector("[data-lite-toggle]");
  function paintToggle() {
    if (!btn) return;
    btn.setAttribute("aria-pressed", String(on()));
    const s = btn.querySelector("[data-lite-state]");
    if (s) s.textContent = tr(on() ? "on" : "off");
  }
  btn?.addEventListener("click", () => set(!on()));
  paintToggle();
  I?.onChange(paintToggle);

  /* ------------------------------------------------------------------------
     Detection. Only asks once: whatever the answer, it is remembered.
     ------------------------------------------------------------------------ */
  if (get() !== null || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Signs of a weak device that don't need measuring
  function weakHardware() {
    const n = navigator;
    if (n.deviceMemory && n.deviceMemory <= 2) return true;
    if (n.hardwareConcurrency && n.hardwareConcurrency <= 2) return true;
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
      if (!gl) return true;
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      // no graphics chip: the browser draws everything on the CPU
      if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer)) return true;
    } catch (e) { /* ignore */ }
    return false;
  }

  // Measures the frame rate in 1.5 s windows for the first 20 s. Two windows
  // that stutter (median under ~26 fps, or a quarter of the frames under
  // 20 fps) are enough to ask. Phones in power saving mode run at a steady
  // 30 fps, which stays below that line.
  function watchFrames(done) {
    const WINDOW = 1500, LIMIT = 20000;
    let t0 = 0, last = 0, winStart = 0, dts = [], bad = 0;
    const step = (now) => {
      if (on()) return;
      if (!t0) t0 = now;
      const dt = last ? now - last : 0;
      last = now;
      if (dt > 1000 || document.hidden) { dts = []; winStart = now; } // tab was in the background
      else if (dt) dts.push(dt);
      if (!winStart) winStart = now;
      if (now - winStart >= WINDOW) {
        if (dts.length < 8) bad++; // fewer than ~5 fps
        else {
          const s = [...dts].sort((a, b) => a - b);
          const median = s[s.length >> 1];
          const slow = dts.filter((d) => d > 50).length / dts.length;
          if (median > 38 || slow > 0.25) bad++;
        }
        dts = []; winStart = now;
        if (bad >= 2) return done();
      }
      if (now - t0 < LIMIT) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function ask() {
    if (on() || get() !== null || document.querySelector(".lite-ask")) return;
    // the expensive part of the cursor goes right away, whatever the answer
    root.classList.remove("has-lg");
    const box = document.createElement("div");
    box.className = "lite-ask";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-live", "polite");
    box.setAttribute("aria-label", tr("liteLabel"));
    box.innerHTML = `
      <p class="lite-ask__text"></p>
      <div class="lite-ask__actions">
        <button type="button" class="lite-ask__yes" data-yes></button>
        <button type="button" class="lite-ask__no" data-no></button>
      </div>`;
    let asked = true;
    const label = () => {
      box.querySelector(".lite-ask__text").textContent = tr(asked ? "liteAsk" : "liteDone");
      if (!asked) return;
      box.querySelector("[data-yes]").textContent = tr("liteYes");
      box.querySelector("[data-no]").textContent = tr("liteNo");
    };
    label();
    I?.onChange(() => box.isConnected && label());
    document.body.appendChild(box);
    requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add("is-in")));

    const close = (delay = 0) => setTimeout(() => {
      box.classList.remove("is-in");
      setTimeout(() => box.remove(), 500);
    }, delay);
    box.querySelector("[data-yes]").addEventListener("click", () => {
      set(true);
      asked = false;
      box.querySelector(".lite-ask__actions").remove();
      label();
      close(4200);
    });
    box.querySelector("[data-no]").addEventListener("click", () => { save("0"); close(); });
  }

  const start = () => setTimeout(() => {
    if (on()) return;
    if (weakHardware()) setTimeout(ask, 1200);
    else watchFrames(ask);
  }, 1500);
  if (document.readyState === "complete") start();
  else addEventListener("load", start, { once: true });
})();
