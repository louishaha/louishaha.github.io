/* ==========================================================================
   Lock in the nav → code prompt → /route/ (private Gapyear page)
   A curtain, not a vault: the route page itself is public on GitHub Pages.
   ========================================================================== */
(() => {
  "use strict";

  const KEY = "lk-route-key";
  const HASH = "c07e31de";
  const fnv = (s) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, "0");
  };
  const get = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const set = () => { try { localStorage.setItem(KEY, HASH); } catch (e) { /* ignore */ } };

  const btn = document.querySelector("[data-lock]");
  const modal = document.querySelector("[data-lock-modal]");
  if (!btn || !modal) return;
  const code = modal.querySelector("[data-lock-code]");
  const input = modal.querySelector("[data-lock-input]");
  const slots = [...code.querySelectorAll("span")];
  const hint = modal.querySelector("[data-lock-hint]");
  const target = "route/";

  const paint = () => {
    const n = input.value.length;
    slots.forEach((s, i) => {
      s.classList.toggle("is-filled", i < n);
      s.classList.toggle("is-caret", i === n && document.activeElement === input);
    });
  };
  const open = () => {
    if (get() === HASH) { location.href = target; return; }
    input.value = "";
    hint.textContent = "";
    modal.hidden = false;
    paint();
    setTimeout(() => input.focus(), 30);
  };
  const close = () => {
    modal.hidden = true;
    btn.focus();
  };

  btn.addEventListener("click", open);
  modal.querySelector("[data-lock-close]").addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) close(); });
  input.addEventListener("focus", paint);
  input.addEventListener("blur", paint);
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 4);
    code.classList.remove("is-wrong");
    paint();
    if (input.value.length < 4) return;
    if (fnv("lk-route:" + input.value) === HASH) {
      set();
      input.blur();
      location.href = target;
    } else {
      hint.textContent = "Falscher Code.";
      code.classList.add("is-wrong");
      setTimeout(() => { input.value = ""; paint(); }, 380);
    }
  });
})();
