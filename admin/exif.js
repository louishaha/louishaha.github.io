/* ==========================================================================
   Tiny EXIF reader for JPEGs: camera, lens, exposure, date.
   Runs on the original file before it is scaled down (scaling throws the
   EXIF data away). Returns {} for anything it can't read.
   ========================================================================== */
window.readExif = async function readExif(file) {
  try {
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    const v = new DataView(buf);
    if (v.getUint16(0) !== 0xffd8) return {};
    let o = 2;
    while (o + 4 < v.byteLength) {
      const marker = v.getUint16(o);
      const len = v.getUint16(o + 2);
      if (marker === 0xffe1 && v.getUint32(o + 4) === 0x45786966) return parse(v, o + 10);
      if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break;
      o += 2 + len;
    }
  } catch (e) { /* not readable */ }
  return {};

  function parse(v, t) {
    const le = v.getUint16(t) === 0x4949;
    const u16 = (p) => v.getUint16(p, le);
    const u32 = (p) => v.getUint32(p, le);
    const SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
    const value = (e) => {
      const type = u16(e + 2), n = u32(e + 4);
      const bytes = (SIZE[type] || 1) * n;
      const at = bytes > 4 ? t + u32(e + 8) : e + 8;
      if (at + bytes > v.byteLength) return undefined;
      if (type === 2) { let s = ""; for (let i = 0; i < n - 1; i++) s += String.fromCharCode(v.getUint8(at + i)); return s.trim(); }
      if (type === 3) return u16(at);
      if (type === 4) return u32(at);
      if (type === 5) { const d = u32(at + 4); return d ? u32(at) / d : 0; }
      if (type === 10) { const d = v.getInt32(at + 4, le); return d ? v.getInt32(at, le) / d : 0; }
      return undefined;
    };
    const ifd = (start) => {
      const out = {};
      if (start + 2 > v.byteLength) return out;
      const n = u16(start);
      for (let i = 0; i < n; i++) {
        const e = start + 2 + i * 12;
        if (e + 12 > v.byteLength) break;
        out[u16(e)] = value(e);
      }
      return out;
    };
    const zero = ifd(t + u32(t + 4));
    const ex = zero[0x8769] ? ifd(t + zero[0x8769]) : {};
    const make = zero[0x010f] || "";
    let model = zero[0x0110] || "";
    if (make && model && !model.toLowerCase().startsWith(make.split(" ")[0].toLowerCase())) model = `${make.split(" ")[0]} ${model}`;
    const et = ex[0x829a];
    const date = ex[0x9003] || zero[0x0132] || "";
    return {
      camera: model.replace(/\s+/g, " ").trim(),
      lens: (ex[0xa434] || "").replace(/\s+/g, " ").trim(),
      shutter: et ? (et >= 1 ? String(Math.round(et * 10) / 10) : `1/${Math.round(1 / et)}`) : "",
      aperture: ex[0x829d] ? String(Math.round(ex[0x829d] * 10) / 10) : "",
      iso: ex[0x8827] ? String(ex[0x8827]) : "",
      focal: ex[0x920a] ? String(Math.round(ex[0x920a])) : "",
      year: /^\d{4}/.test(date) ? date.slice(0, 4) : "",
    };
  }
};
