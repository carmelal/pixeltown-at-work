export const rnd = (a, b) => a + Math.random() * (b - a);
export const ri = (a, b) => Math.floor(rnd(a, b + 1));
export const pick = a => a[ri(0, a.length - 1)];
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const key = (c, r) => c + ',' + r;
export function hash(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

export function weighted(items) {
  let total = 0; for (const it of items) total += Math.max(0, it.w);
  let r = Math.random() * total;
  for (const it of items) { r -= Math.max(0, it.w); if (r < 0) return it; }
  return items.at(-1);
}

export function moveToward(e, tx, ty, speed, dt, snap = 1) {
  const dx = tx - e.x, dy = ty - e.y, L = Math.hypot(dx, dy);
  if (dx) e.flip = dx < 0;
  if (L <= Math.max(speed * dt, snap)) { e.x = tx; e.y = ty; return true; }
  e.x += dx / L * speed * dt; e.y += dy / L * speed * dt; return false;
}
