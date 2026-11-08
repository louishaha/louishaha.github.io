/* ==========================================================================
   Lock in the nav → code prompt → /route/ (private Gapyear page)
   Only shown while the gap year mode is off (see admin). A curtain, not a
   vault: the route page itself is public.
   ========================================================================== */
(() => {
  "use strict";

  const KEY = "lk-route-key";
  const HASH = "c07e31de";
  const target = "/route/";
  const tr = (k) => (window.LKI18N ? window.LKI18N.t(k) : k);
  const fnv = (s) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, "0");
  };
  const get = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const set = () => { try { localStorage.setItem(KEY, HASH); } catch (e) { /* ignore */ } };

  const modal = document.createElement("div");
  modal.className = "lock";
  modal.hidden = true;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.dataset.i18nAria = "lockDialog";
  modal.innerHTML = `
    <div class="lock__box">
      <svg class="lock__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/></svg>
      <p class="lock__title">Gap<em>year</em></p>
      <div class="lock__code" data-lock-code>
        <input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="4" data-i18n-aria="lockInput" data-lock-input>
        <span></span><span></span><span></span><span></span>
      </div>
      <p class="lock__hint" data-lock-hint aria-live="polite"></p>
      <button type="button" class="lock__cancel" data-lock-close data-i18n="cancel"></button>
    </div>`;
  document.body.appendChild(modal);
  window.LKI18N?.apply(modal);
  window.LKI18N?.onChange(() => window.LKI18N.apply(modal));

  const code = modal.querySelector("[data-lock-code]");
  const input = modal.querySelector("[data-lock-input]");
  const slots = [...code.querySelectorAll("span")];
  const hint = modal.querySelector("[data-lock-hint]");
  let opener = null;

  const paint = () => {
    const n = input.value.length;
    slots.forEach((s, i) => {
      s.classList.toggle("is-filled", i < n);
      s.classList.toggle("is-caret", i === n && document.activeElement === input);
    });
  };
  const open = (btn) => {
    if (get() === HASH) { location.href = target; return; }
    opener = btn;
    input.value = "";
    hint.textContent = "";
    modal.hidden = false;
    paint();
    setTimeout(() => input.focus(), 30);
  };
  const close = () => {
    modal.hidden = true;
    opener?.focus?.();
  };

  document.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-lock]");
    if (b) open(b);
  });
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
      hint.textContent = tr("wrongCode");
      code.classList.add("is-wrong");
      setTimeout(() => { input.value = ""; paint(); }, 380);
    }
  });
})();
