import { W, calm } from './world.js';

export const cv = document.getElementById('c'), ctx = cv.getContext('2d');
export const hi = document.getElementById('hi'), hctx = hi.getContext('2d');
export let S = 1;
export function fitOverlay() { const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1; hi.width = Math.round(r.width * d); hi.height = Math.round(r.height * d); S = hi.width / W; }
addEventListener('resize', fitOverlay);

export const px = (x, y, c, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
export const shade = (l, n) => Math.max(8, l - 28 * n);
export const rgbn = ([r, g, b], n, k = 0.55) => `rgb(${r * (1 - k * n)},${g * (1 - k * n)},${b * (1 - k * n)})`;
export const grey = (v, n) => `rgb(${v - 40 * n},${v - 40 * n},${v + 4 - 40 * n})`;

export function label(text, x, y, color, size = 6, align = 'center', outline = true) {
  hctx.font = `${Math.round(size * S)}px ui-monospace, Menlo, 'Apple Color Emoji', 'Segoe UI Emoji', monospace`; hctx.textAlign = align; hctx.textBaseline = 'middle';
  if (outline) { hctx.lineWidth = Math.max(1, S * 0.45); hctx.lineJoin = 'round'; hctx.strokeStyle = 'rgba(0,0,0,0.8)'; hctx.strokeText(text, x * S, y * S); }
  hctx.fillStyle = color; hctx.fillText(text, x * S, y * S);
}
export const bubble = (text, x, y, size = 4.5) => text && !calm.on && label(text, x, y, '#fff', size, 'center', false);

export function blit(rows, left, top, pal, mirror = false) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r], w = row.length;
    for (let c = 0; c < w; c++) { const ch = row[c]; if (ch === '.') continue; const col = pal[ch]; if (col) px(left + (mirror ? w - 1 - c : c), top + r, col); }
  }
}
