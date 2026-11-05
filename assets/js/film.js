/* ==========================================================================
   Film — short clips, uploaded (mp4) or on YouTube
   The reel lays clips out in justified rows whatever their format (16:9,
   9:16, 2.39:1 …). Uploaded clips play silently while they are on screen
   (phones: only the one most in view, to save data). Clicking opens the
   viewer with sound and our own controls. YouTube clips only load after a
   click (privacy) and play behind our own controls, cropped so YouTube's
   title bar and logo stay outside the frame; whenever the video is paused
   or ends, our poster covers YouTube's "more videos" wall.
   ========================================================================== */
(() => {
  "use strict";
  const LK = window.LK;
  const { $, $$, esc, tr, tx, I, url } = LK;

  const fmt = (s) => {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60), r = Math.floor(s % 60);
    return `${m}:${String(r).padStart(2, "0")}`;
  };
  const ytId = (v) => {
    const s = String(v || "").trim();
    const m = s.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
    return m ? m[1] : /^[\w-]{11}$/.test(s) ? s : "";
  };

  LK.ready.then((site) => {
    const films = (site.films || []).map((f) => ({
      ...f,
      ratio: f.w && f.h ? f.w / f.h : 16 / 9,
      poster: url(f.poster),
      file: f.kind === "youtube" ? "" : url(f.src),
      yt: f.kind === "youtube" ? ytId(f.youtube || f.src) : "",
    })).filter((f) => f.file || f.yt);

    const reel = $("[data-reel]");
    $("[data-reel-empty]").hidden = !!films.length;
    if (!films.length) return;

    reel.innerHTML = films.map((f, i) => `
      <figure class="clip" style="--r:${f.ratio}">
        <button class="clip__btn" type="button" data-clip="${i}" data-cursor="${esc(tr("play"))}" aria-label="${esc(tr("play"))}: ${esc(tx(f.title))}">
          <div class="clip__frame">
            ${f.file
              ? `<video muted loop playsinline preload="none" ${f.poster ? `poster="${esc(f.poster)}"` : ""} data-src="${esc(f.file)}"></video>`
              : `<img src="${esc(f.poster)}" alt="" loading="lazy">`}
            <span class="clip__play" aria-hidden="true"></span>
          </div>
        </button>
        <figcaption class="clip__cap">
          <span class="clip__title">${esc(tx(f.title))}</span>
          <span class="clip__meta">${[f.year, f.duration ? fmt(f.duration) : ""].filter(Boolean).map(esc).join(" · ")}</span>
        </figcaption>
      </figure>`).join("");
    const clips = $$(".clip", reel);

    /* Rows: as many clips as fit a target height, then stretched to the
       full width. Portrait clips sit next to landscape ones. */
    let laidOut = 0;
    function layout() {
      const W = reel.clientWidth;
      if (!W || W === laidOut) return;
      laidOut = W;
      const gap = parseFloat(getComputedStyle(reel).getPropertyValue("--gap")) || 10;
      const want = W < 700 ? 1.25 : W < 1100 ? 2.1 : 2.8; // row width / row height
      reel.textContent = "";
      let row = [], sum = 0;
      const flush = (last) => {
        if (!row.length) return;
        const el = document.createElement("div");
        el.className = "reel__row";
        // a lonely last clip should not blow up to the full width
        if (last && sum < want * 0.6) el.style.width = `${Math.max(40, (sum / want) * 100)}%`;
        row.forEach((c) => el.appendChild(c));
        reel.appendChild(el);
        row = []; sum = 0;
      };
      clips.forEach((c, i) => {
        const r = films[i].ratio;
        if (row.length && Math.abs(Math.log((sum + r) / want)) > Math.abs(Math.log(sum / want))) flush();
        row.push(c); sum += r;
      });
      flush(true);
      void gap;
    }
    layout();
    addEventListener("resize", () => requestAnimationFrame(layout));

    /* Silent previews while on screen */
    const previews = clips.map((c) => $("video", c)).filter(Boolean);
    const shown = new Map();
    const one = LK.touchScroll; // phones: one at a time
    const canPreview = () => !LK.Lite.on() && !LK.reduceMotion && !document.documentElement.classList.contains("film-open");
    function updatePreviews() {
      let best = null, bestR = 0;
      previews.forEach((v) => {
        const r = shown.get(v) || 0;
        if (r > bestR) { best = v; bestR = r; }
      });
      previews.forEach((v) => {
        const on = canPreview() && (one ? v === best && bestR > 0.5 : (shown.get(v) || 0) > 0.25);
        if (on) {
          if (!v.src) { v.src = v.dataset.src; v.preload = "auto"; }
          v.play().catch(() => {});
        } else if (!v.paused) v.pause();
      });
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => shown.set(e.target, e.intersectionRatio));
      updatePreviews();
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    previews.forEach((v) => io.observe(v));
    LK.onEffects(updatePreviews);
    document.addEventListener("visibilitychange", () => { if (document.hidden) previews.forEach((v) => v.pause()); else updatePreviews(); });

    reel.addEventListener("click", (e) => {
      const b = e.target.closest("[data-clip]");
      if (b) openViewer(+b.dataset.clip);
    });

    /* ------------------------------------------------------------------
       Viewer
       ------------------------------------------------------------------ */
    const fv = document.createElement("div");
    fv.className = "fv";
    fv.hidden = true;
    fv.setAttribute("role", "dialog");
    fv.setAttribute("aria-modal", "true");
    fv.innerHTML = `
      <div class="fv__top">
        <span class="fv__count" data-fv-count></span>
        <button type="button" class="fv__close" data-fv-close><span data-i18n="close"></span> <span aria-hidden="true">✕</span></button>
      </div>
      <div class="fv__stage" data-fv-stage>
        <div class="fv__screen" data-fv-screen></div>
      </div>
      <div class="fv__bar" data-fv-bar>
        <button type="button" class="fv__btn" data-fv-play></button>
        <span class="fv__time" data-fv-time>0:00</span>
        <div class="fv__track" data-fv-track><span data-fv-buf></span><span data-fv-prog></span><i data-fv-knob></i></div>
        <span class="fv__time" data-fv-dur>0:00</span>
        <button type="button" class="fv__btn" data-fv-mute></button>
        <button type="button" class="fv__btn" data-fv-fs></button>
      </div>
      <div class="fv__info">
        <h2 class="fv__title" data-fv-title></h2>
        <p class="fv__meta" data-fv-meta></p>
        <p class="fv__text" data-fv-text></p>
      </div>`;
    document.body.appendChild(fv);
    I.apply(fv);
    const screen = $("[data-fv-screen]", fv);
    const track = $("[data-fv-track]", fv);
    let cur = -1, player = null;

    const ICON = {
      play: '<svg viewBox="0 0 20 20"><path d="M6 4l10 6-10 6z" fill="currentColor"/></svg>',
      pause: '<svg viewBox="0 0 20 20"><path d="M5 4h3.5v12H5zM11.5 4H15v12h-3.5z" fill="currentColor"/></svg>',
      sound: '<svg viewBox="0 0 20 20"><path d="M3 8h3l4-3.5v11L6 12H3z" fill="currentColor"/><path d="M13 7.2a4 4 0 0 1 0 5.6M15.2 5a7 7 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      muted: '<svg viewBox="0 0 20 20"><path d="M3 8h3l4-3.5v11L6 12H3z" fill="currentColor"/><path d="M13 7.5l5 5M18 7.5l-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      fs: '<svg viewBox="0 0 20 20"><path d="M3 8V3h5M12 3h5v5M17 12v5h-5M8 17H3v-5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    };
    $("[data-fv-fs]", fv).innerHTML = ICON.fs;

    function paintBar() {
      if (!player) return;
      const t = player.time(), d = player.duration();
      $("[data-fv-time]", fv).textContent = fmt(t);
      $("[data-fv-dur]", fv).textContent = fmt(d);
      const p = d ? Math.min(1, t / d) : 0;
      $("[data-fv-prog]", fv).style.transform = `scaleX(${p})`;
      $("[data-fv-knob]", fv).style.left = `${p * 100}%`;
      $("[data-fv-buf]", fv).style.transform = `scaleX(${player.buffered()})`;
      const playing = player.playing();
      const pb = $("[data-fv-play]", fv);
      pb.innerHTML = playing ? ICON.pause : ICON.play;
      pb.setAttribute("aria-label", tr(playing ? "pause" : "play"));
      const mb = $("[data-fv-mute]", fv);
      mb.innerHTML = player.muted() ? ICON.muted : ICON.sound;
      mb.setAttribute("aria-label", tr(player.muted() ? "unmute" : "mute"));
      $("[data-fv-fs]", fv).setAttribute("aria-label", tr("fullscreen"));
      fv.classList.toggle("is-paused", !playing);
    }
    let barTimer = 0;
    const startBar = () => { clearInterval(barTimer); barTimer = setInterval(paintBar, 200); paintBar(); };

    /* An uploaded clip: a plain <video> */
    function filePlayer(f) {
      const v = document.createElement("video");
      v.playsInline = true;
      v.preload = "auto";
      if (f.poster) v.poster = f.poster;
      v.src = f.file;
      screen.appendChild(v);
      v.addEventListener("click", () => (v.paused ? v.play() : v.pause()));
      v.addEventListener("ended", paintBar);
      v.play().catch(() => paintBar());
      return {
        time: () => v.currentTime,
        duration: () => v.duration || f.duration || 0,
        buffered: () => (v.buffered.length && v.duration ? v.buffered.end(v.buffered.length - 1) / v.duration : 0),
        playing: () => !v.paused && !v.ended,
        muted: () => v.muted,
        toggle: () => (v.paused ? v.play() : v.pause()),
        mute: () => { v.muted = !v.muted; },
        seek: (p) => { if (v.duration) v.currentTime = p * v.duration; },
        fullscreen: () => (v.requestFullscreen ? v.requestFullscreen() : v.webkitEnterFullscreen?.()),
        destroy: () => { v.pause(); v.removeAttribute("src"); v.load(); v.remove(); },
      };
    }

    /* A YouTube clip: consent first, then the IFrame API without its UI */
    let ytApi = null;
    const loadYT = () => ytApi || (ytApi = new Promise((res, rej) => {
      if (window.YT?.Player) return res(window.YT);
      window.onYouTubeIframeAPIReady = () => res(window.YT);
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.onerror = () => { ytApi = null; rej(new Error("YouTube")); };
      document.head.appendChild(s);
    }));
    function ytPlayer(f) {
      const wrap = document.createElement("div");
      wrap.className = "yt";
      wrap.innerHTML = `
        <div class="yt__crop"><div data-yt-mount></div></div>
        <div class="yt__shield" data-yt-shield></div>
        <div class="yt__cover" data-yt-cover>${f.poster ? `<img src="${esc(f.poster)}" alt="">` : ""}
          <div class="yt__consent">
            <button type="button" class="yt__go" data-yt-go><span class="clip__play"></span><span>${esc(tr("ytPlay"))}</span></button>
            <p>${esc(tr("ytNote"))}</p>
          </div>
        </div>`;
      screen.appendChild(wrap);
      const cover = $("[data-yt-cover]", wrap);
      const shield = $("[data-yt-shield]", wrap);
      let yt = null, ready = false, state = -1, dead = false;
      const go = () => {
        $("[data-yt-go]", wrap).disabled = true;
        loadYT().then((YT) => {
          if (dead) return;
          yt = new YT.Player($("[data-yt-mount]", wrap), {
            host: "https://www.youtube-nocookie.com",
            videoId: f.yt,
            playerVars: { autoplay: 1, controls: 0, rel: 0, playsinline: 1, iv_load_policy: 3, modestbranding: 1, disablekb: 1, fs: 0, cc_load_policy: 0 },
            events: {
              onReady: () => { ready = true; yt.playVideo(); startBar(); },
              onStateChange: (e) => {
                state = e.data;
                // playing: show the picture; paused/ended: our poster again
                cover.classList.toggle("is-off", state === 1 || state === 3);
                wrap.classList.add("is-started");
                paintBar();
              },
            },
          });
          // a phone may refuse to start with sound from a script: then let
          // the tap go through to YouTube's own start button once
          setTimeout(() => { if (!dead && state !== 1 && state !== 3) { cover.classList.add("is-off"); shield.hidden = true; } }, 2500);
        }).catch(() => { $("[data-yt-go]", wrap).disabled = false; });
      };
      $("[data-yt-go]", wrap).addEventListener("click", go);
      shield.addEventListener("click", () => api.toggle());
      cover.addEventListener("click", (e) => { if (ready && !e.target.closest("[data-yt-go]")) api.toggle(); });
      const api = {
        time: () => (ready ? yt.getCurrentTime() : 0),
        duration: () => (ready ? yt.getDuration() : f.duration || 0),
        buffered: () => (ready ? yt.getVideoLoadedFraction() : 0),
        playing: () => state === 1 || state === 3,
        muted: () => (ready ? yt.isMuted() : false),
        toggle: () => { if (!ready) return go(); shield.hidden = false; api.playing() ? yt.pauseVideo() : yt.playVideo(); },
        mute: () => { if (ready) (yt.isMuted() ? yt.unMute() : yt.mute()); setTimeout(paintBar, 60); },
        seek: (p) => { if (ready) yt.seekTo(p * yt.getDuration(), true); },
        fullscreen: () => (wrap.requestFullscreen ? wrap.requestFullscreen() : null),
        destroy: () => { dead = true; try { yt?.destroy(); } catch (e) { /* ignore */ } wrap.remove(); },
      };
      return api;
    }

    function openViewer(i) {
      const f = films[i];
      if (!f) return;
      cur = i;
      previews.forEach((v) => v.pause());
      player?.destroy();
      screen.textContent = "";
      screen.style.setProperty("--r", f.ratio);
      fv.classList.toggle("is-portrait", f.ratio < 1);
      $("[data-fv-count]", fv).textContent = `${i + 1} / ${films.length}`;
      $("[data-fv-title]", fv).textContent = tx(f.title);
      $("[data-fv-meta]", fv).textContent = [f.year, f.duration ? fmt(f.duration) : ""].filter(Boolean).join(" · ");
      $("[data-fv-text]", fv).textContent = tx(f.text) || "";
      player = f.yt ? ytPlayer(f) : filePlayer(f);
      fv.hidden = false;
      document.documentElement.classList.add("film-open");
      requestAnimationFrame(() => fv.classList.add("is-open"));
      startBar();
      $("[data-fv-close]", fv).focus({ preventScroll: true });
    }
    function closeViewer() {
      clearInterval(barTimer);
      player?.destroy();
      player = null;
      fv.classList.remove("is-open");
      document.documentElement.classList.remove("film-open");
      setTimeout(() => { fv.hidden = true; LK.refreshCursor(); updatePreviews(); }, 400);
    }
    $("[data-fv-close]", fv).addEventListener("click", closeViewer);
    $("[data-fv-play]", fv).addEventListener("click", () => { player?.toggle(); setTimeout(paintBar, 60); });
    $("[data-fv-mute]", fv).addEventListener("click", () => { player?.mute(); paintBar(); });
    $("[data-fv-fs]", fv).addEventListener("click", () => player?.fullscreen());
    // scrubbing
    const seekAt = (x) => {
      const r = track.getBoundingClientRect();
      player?.seek(Math.min(1, Math.max(0, (x - r.left) / r.width)));
      setTimeout(paintBar, 60);
    };
    track.addEventListener("pointerdown", (e) => {
      track.setPointerCapture(e.pointerId);
      seekAt(e.clientX);
      const move = (ev) => seekAt(ev.clientX);
      track.addEventListener("pointermove", move);
      track.addEventListener("pointerup", () => track.removeEventListener("pointermove", move), { once: true });
    });
    addEventListener("keydown", (e) => {
      if (fv.hidden) return;
      if (e.key === "Escape") closeViewer();
      else if (e.key === " " && !e.target.closest("button")) { e.preventDefault(); player?.toggle(); }
      else if (e.key === "ArrowRight") openViewer((cur + 1) % films.length);
      else if (e.key === "ArrowLeft") openViewer((cur - 1 + films.length) % films.length);
    });

    I.onChange(() => {
      clips.forEach((c, i) => {
        const b = $("[data-clip]", c);
        b.dataset.cursor = tr("play");
        b.setAttribute("aria-label", `${tr("play")}: ${tx(films[i].title)}`);
        $(".clip__title", c).textContent = tx(films[i].title);
      });
      I.apply(fv);
      if (!fv.hidden && cur >= 0) {
        $("[data-fv-title]", fv).textContent = tx(films[cur].title);
        $("[data-fv-text]", fv).textContent = tx(films[cur].text) || "";
      }
    });
  }).catch((e) => console.error(e));
})();
