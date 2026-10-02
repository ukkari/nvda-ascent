import * as THREE from 'three';

export const FONT_DISPLAY = '"Space Grotesk", "Noto Sans JP", system-ui, sans-serif';
export const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';

export interface LabelLine {
  text: string;
  size: number; // px at canvas resolution
  color: string;
  weight?: number;
  font?: string;
  letterSpacing?: number;
}

/**
 * Draw stacked lines of text into a canvas texture. Width is fixed, height is
 * derived from content so the returned aspect can size a plane or sprite.
 */
export function textTexture(
  lines: LabelLine[],
  opts: { width?: number; pad?: number; align?: CanvasTextAlign; bg?: string; border?: string; glow?: string } = {},
): { texture: THREE.CanvasTexture; aspect: number } {
  const width = opts.width ?? 1024;
  const pad = opts.pad ?? 28;
  const align = opts.align ?? 'center';
  const lineGap = 0.18;
  const height = Math.ceil(lines.reduce((h, l) => h + l.size * (1 + lineGap), 0) + pad * 2);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  if (opts.bg) {
    ctx.fillStyle = opts.bg;
    roundRect(ctx, 2, 2, width - 4, height - 4, 18);
    ctx.fill();
  }
  if (opts.border) {
    ctx.strokeStyle = opts.border;
    ctx.lineWidth = 3;
    roundRect(ctx, 2, 2, width - 4, height - 4, 18);
    ctx.stroke();
  }
  let y = pad;
  for (const l of lines) {
    ctx.font = `${l.weight ?? 600} ${l.size}px ${l.font ?? FONT_DISPLAY}`;
    ctx.fillStyle = l.color;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${l.letterSpacing ?? 0}px`;
    if (opts.glow) {
      ctx.shadowColor = opts.glow;
      ctx.shadowBlur = l.size * 0.35;
    }
    const x = align === 'center' ? width / 2 : align === 'right' ? width - pad : pad;
    ctx.fillText(fit(ctx, l.text, width - pad * 2), x, y);
    y += l.size * (1 + lineGap);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, aspect: width / height };
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Billboard sprite sized in world metres (height). */
export function labelSprite(lines: LabelLine[], worldHeight: number, opts?: Parameters<typeof textTexture>[1]): THREE.Sprite {
  const { texture, aspect } = textTexture(lines, opts);
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, fog: true });
  const s = new THREE.Sprite(mat);
  s.scale.set(worldHeight * aspect, worldHeight, 1);
  return s;
}

export function hex(c: number, a = 1): string {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  return `rgba(${r},${g},${b},${a})`;
}
