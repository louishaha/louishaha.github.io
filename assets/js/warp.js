/* ==========================================================================
   Scroll warp — draws the grid photos with WebGL and bends them like a sheet
   of paper while you scroll (the faster, the stronger).
   The DOM <img> elements stay in place for layout, loading, clicks and
   screen readers; they are only hidden visually while WebGL is running.
   Without WebGL (or with reduced motion) nothing happens and the plain
   images are shown.
   ========================================================================== */
window.LKWarp = function LKWarp({ items, hovered }) {

  const canvas = document.createElement("canvas");
  canvas.className = "gl";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: true });
  if (!gl) return null;

  /* ---------------------------------------------------------------- shaders */
  const VS = `
    attribute vec2 aPos;
    uniform vec4 uRect;   // x, y, w, h in CSS px (viewport space)
    uniform vec2 uView;   // viewport size
    uniform mediump float uVel; // smoothed scroll velocity, -1..1 (shared with the fragment shader)
    varying vec2 vUv;
    void main() {
      vUv = aPos;
      vec2 p = uRect.xy + aPos * uRect.zw;
      vec2 n = p / uView * 2.0 - 1.0;                       // -1..1, y down
      // the page swings sideways, more the further from the vertical centre
      p.x -= uVel * n.y * n.y * uView.x * 0.072;
      // rows bow against the scroll direction, strongest in the middle
      p.y -= uVel * (1.0 - n.x * n.x) * uView.y * 0.058;
      vec2 c = p / uView * 2.0 - 1.0;
      gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
    }`;

  const FS = `
    precision mediump float;
    uniform sampler2D uTex;
    uniform vec2 uSize;        // frame size in px
    uniform float uRadius;
    uniform float uReveal;     // 0..1, wipes in from the bottom
    uniform float uZoom;       // image scale inside the frame
    uniform float uAlpha;
    uniform float uVel;
    uniform float uLoaded;     // 0..1 texture fade-in
    uniform float uImgAspect;
    uniform vec3 uTile;
    varying vec2 vUv;

    float sdRound(vec2 p, vec2 b, float r) {
      vec2 q = abs(p) - b + r;
      return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
    }
    void main() {
      vec2 px = (vUv - 0.5) * uSize;
      float a = clamp(0.5 - sdRound(px, uSize * 0.5, uRadius), 0.0, 1.0);
      a *= clamp(vUv.y * uSize.y - (1.0 - uReveal) * uSize.y + 0.5, 0.0, 1.0);

      // cover-fit, then zoom around the centre
      vec2 uv = vUv - 0.5;
      float fa = uSize.x / uSize.y;
      if (uImgAspect > fa) uv.x *= fa / uImgAspect; else uv.y *= uImgAspect / fa;
      uv = uv / uZoom + 0.5;

      // a touch of chromatic split while moving
      float s = uVel * 0.008;
      vec3 col = vec3(
        texture2D(uTex, uv + vec2(0.0, s)).r,
        texture2D(uTex, uv).g,
        texture2D(uTex, uv - vec2(0.0, s)).b
      );
      col = mix(uTile, col, uLoaded);
      float A = a * uAlpha;
      gl_FragColor = vec4(col * A, A);
    }`;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) {
    console.warn("warp disabled:", e);
    return null;
  }
  gl.useProgram(prog);

  /* ------------------------------------------------------- subdivided plane */
  const SEG = 24;
  const verts = [];
  for (let y = 0; y <= SEG; y++) for (let x = 0; x <= SEG; x++) verts.push(x / SEG, y / SEG);
  const idx = [];
  for (let y = 0; y < SEG; y++) {
    for (let x = 0; x < SEG; x++) {
      const i = y * (SEG + 1) + x;
      idx.push(i, i + 1, i + SEG + 1, i + 1, i + SEG + 2, i + SEG + 1);
    }
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ["uRect", "uView", "uVel", "uSize", "uRadius", "uReveal", "uZoom", "uAlpha", "uLoaded", "uImgAspect", "uTile", "uTex"]
    .forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

  /* ------------------------------------------------------------------ state */
  const planes = items.map((it) => ({
    ...it,
    tex: null,
    aspect: 1,
    reveal: 0,
    zoom: 1.14,
    alpha: 1,
    loaded: 0,
  }));

  function upload(p) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, p.img);
    } catch (e) {
      return; // not ready / not allowed — try again next frame
    }
    p.tex = t;
    p.aspect = p.img.naturalWidth / p.img.naturalHeight;
  }

  let tile = [0.1, 0.09, 0.08];
  function readTile() {
    const c = getComputedStyle(document.documentElement).getPropertyValue("--tile").trim();
    const m = c.match(/^#([0-9a-f]{6})$/i);
    if (m) {
      const n = parseInt(m[1], 16);
      tile = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
  }
  readTile();
  new MutationObserver(readTile).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  /* ------------------------------------------------------------------- loop */
  let lastY = scrollY, vel = 0, lastT = performance.now();
  const ease = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.pow(1 - k, dt / 16.67));

  function frame(now) {
    const dt = Math.min(64, now - lastT);
    lastT = now;
    if (innerWidth !== W || innerHeight !== H) resize();

    const y = scrollY;
    const dy = y - lastY;
    lastY = y;
    const target = Math.max(-1, Math.min(1, dy / (H * 0.09)));
    vel = ease(vel, target, 0.1, dt);
    if (Math.abs(vel) < 0.0005) vel = 0;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(U.uView, W, H);
    gl.uniform1f(U.uVel, vel);
    gl.uniform3f(U.uTile, tile[0], tile[1], tile[2]);

    const hov = hovered();
    const margin = H * 0.25;
    for (const p of planes) {
      const r = p.frame.getBoundingClientRect();
      if (!r.width || r.bottom < -margin || r.top > H + margin) continue;

      if (!p.tex && p.img.complete && p.img.naturalWidth) upload(p);
      const inView = p.fig.classList.contains("is-in");
      p.reveal = ease(p.reveal, inView ? 1 : 0, 0.06, dt);
      p.zoom = ease(p.zoom, inView ? (hov === p.i ? 1.04 : 1) : 1.14, 0.05, dt);
      p.alpha = ease(p.alpha, hov >= 0 && hov !== p.i ? 0.4 : 1, 0.1, dt);
      p.loaded = ease(p.loaded, p.tex ? 1 : 0, 0.08, dt);
      if (p.reveal < 0.002) continue;

      gl.uniform4f(U.uRect, r.left, r.top, r.width, r.height);
      gl.uniform2f(U.uSize, r.width, r.height);
      gl.uniform1f(U.uRadius, p.radius());
      gl.uniform1f(U.uReveal, p.reveal);
      gl.uniform1f(U.uZoom, p.zoom);
      gl.uniform1f(U.uAlpha, p.alpha);
      gl.uniform1f(U.uLoaded, p.loaded);
      gl.uniform1f(U.uImgAspect, p.tex ? p.aspect : r.width / r.height);
      if (p.tex) gl.bindTexture(gl.TEXTURE_2D, p.tex);
      gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
    }
    raf = requestAnimationFrame(frame);
  }

  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    document.documentElement.classList.remove("gl-on");
    canvas.remove();
  });

  document.body.prepend(canvas);
  resize();
  document.documentElement.classList.add("gl-on");
  let raf = requestAnimationFrame(frame);
  return { canvas };
};
