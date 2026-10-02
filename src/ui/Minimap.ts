import { COURSE } from '../config';
import type { Market } from '../data/market';
import type { Course } from '../world/Course';
import type { Gates } from '../world/Gates';
import { KIND_COLOR } from '../world/Gates';
import { hex } from './labels';

/** Full-history log chart with the player's position and milestone ticks. */
export class Minimap {
  private ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement;
  private w = 0;
  private h = 0;
  private dpr = Math.min(2, devicePixelRatio || 1);

  constructor(
    private canvas: HTMLCanvasElement,
    private market: Market,
    private course: Course,
    private gates: Gates,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.bg = document.createElement('canvas');
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(10, Math.round(r.width * this.dpr));
    this.h = Math.max(10, Math.round(r.height * this.dpr));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.bg.width = this.w;
    this.bg.height = this.h;
    this.drawBackground();
  }

  private sx(x: number) {
    return ((x - this.course.xStart) / (this.course.xEnd - this.course.xStart)) * this.w;
  }

  private sy(y: number) {
    const lo = this.market.priceToY(this.market.minLow) - 10;
    const hi = this.market.priceToY(this.market.maxHigh) + 20;
    const pad = 6 * this.dpr;
    return this.h - pad - ((y - lo) / (hi - lo)) * (this.h - pad * 2);
  }

  private drawBackground() {
    const g = this.bg.getContext('2d')!;
    const { w, h } = this;
    g.clearRect(0, 0, w, h);
    // area fill
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(118,185,0,0.45)');
    grad.addColorStop(1, 'rgba(118,185,0,0.02)');
    g.beginPath();
    g.moveTo(0, h);
    const steps = Math.min(1600, w);
    for (let i = 0; i <= steps; i++) {
      const x = this.course.xStart + (i / steps) * (this.course.xEnd - this.course.xStart);
      g.lineTo(this.sx(x), this.sy(this.course.height(x)));
    }
    g.lineTo(w, h);
    g.closePath();
    g.fillStyle = grad;
    g.fill();
    // price line
    g.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = this.course.xStart + (i / steps) * (this.course.xEnd - this.course.xStart);
      const px = this.sx(x);
      const py = this.sy(this.course.height(x));
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.strokeStyle = '#9cff3a';
    g.lineWidth = 1.5 * this.dpr;
    g.stroke();
    // years
    g.font = `${10 * this.dpr}px "JetBrains Mono", monospace`;
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (const { week, year } of this.market.yearStarts()) {
      if (year % 5 !== 0) continue;
      const px = this.sx(week * COURSE.xPerWeek);
      g.fillRect(px, 0, 1, h);
      g.fillText(String(year), px + 3 * this.dpr, 11 * this.dpr);
    }
  }

  draw(playerX: number) {
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    c.drawImage(this.bg, 0, 0);
    // ticks
    for (const g of this.gates.list) {
      const px = this.sx(g.x);
      c.fillStyle = hex(KIND_COLOR[g.milestone.kind], g.passed ? 1 : 0.45);
      c.fillRect(px - 1 * this.dpr, this.h - 6 * this.dpr, 2 * this.dpr, 6 * this.dpr);
    }
    // traversed overlay
    const px = this.sx(playerX);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(px, 0, this.w - px, this.h);
    // player marker
    const py = this.sy(this.course.height(playerX));
    c.strokeStyle = 'rgba(255,255,255,0.7)';
    c.lineWidth = this.dpr;
    c.beginPath();
    c.moveTo(px, 0);
    c.lineTo(px, this.h);
    c.stroke();
    c.beginPath();
    c.arc(px, py, 4.5 * this.dpr, 0, Math.PI * 2);
    c.fillStyle = '#c6ff6b';
    c.shadowColor = '#76b900';
    c.shadowBlur = 12 * this.dpr;
    c.fill();
    c.shadowBlur = 0;
  }
}
