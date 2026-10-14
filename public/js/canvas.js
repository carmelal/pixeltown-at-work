// the two canvases: a pixel canvas for the world and a device-resolution overlay for crisp text and emoji
import { W } from './world.js';

export const cv = document.getElementById('c'), ctx = cv.getContext('2d');
export const hi = document.getElementById('hi'), hctx = hi.getContext('2d');
export let S = 1;                                              // overlay pixels per world pixel
export function fitOverlay() { const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1; hi.width = Math.round(r.width * d); hi.height = Math.round(r.height * d); S = hi.width / W; }
addEventListener('resize', fitOverlay);

export const px = (x, y, c, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
export const shade = (l, n) => Math.max(8, l - 28 * n);                                  // hsl lightness dimmed by night 0..1
export const rgbn = ([r, g, b], n, k = 0.55) => `rgb(${r * (1 - k * n)},${g * (1 - k * n)},${b * (1 - k * n)})`;
export const grey = (v, n) => `rgb(${v - 40 * n},${v - 40 * n},${v + 4 - 40 * n})`;

// text on the crisp overlay; (x, y) are world coordinates, size in world pixels
export function label(text, x, y, color, size = 6, align = 'center', outline = true) {
  hctx.font = `${Math.round(size * S)}px ui-monospace, Menlo, 'Apple Color Emoji', 'Segoe UI Emoji', monospace`; hctx.textAlign = align; hctx.textBaseline = 'middle';
  if (outline) { hctx.lineWidth = Math.max(1, S * 0.45); hctx.lineJoin = 'round'; hctx.strokeStyle = 'rgba(0,0,0,0.8)'; hctx.strokeText(text, x * S, y * S); }
  hctx.fillStyle = color; hctx.fillText(text, x * S, y * S);
}
export const bubble = (text, x, y, size = 4.5) => text && label(text, x, y, '#fff', size, 'center', false);
