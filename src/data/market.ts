import { COURSE } from '../config';

export interface RawSeries {
  symbol: string;
  interval: string;
  source: string;
  t: number[];
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
}

/**
 * Weekly NVDA price history plus everything derived from it that the game
 * needs: log-scaled heights, drawdowns, all-time highs and date ↔ x mapping.
 */
export class Market {
  readonly n: number;
  readonly t: Float64Array;
  readonly o: Float32Array;
  readonly h: Float32Array;
  readonly l: Float32Array;
  readonly c: Float32Array;
  readonly v: Float64Array;
  /** close / running max close − 1 (≤ 0) */
  readonly drawdown: Float32Array;
  /** true when the week's close is a new all-time closing high */
  readonly isATH: Uint8Array;
  readonly minLow: number;
  readonly maxHigh: number;
  readonly symbol: string;

  constructor(raw: RawSeries) {
    this.symbol = raw.symbol;
    this.n = raw.t.length;
    this.t = Float64Array.from(raw.t);
    this.o = Float32Array.from(raw.o);
    this.h = Float32Array.from(raw.h);
    this.l = Float32Array.from(raw.l);
    this.c = Float32Array.from(raw.c);
    this.v = Float64Array.from(raw.v);
    this.drawdown = new Float32Array(this.n);
    this.isATH = new Uint8Array(this.n);
    let peak = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.c[i] > peak) {
        peak = this.c[i];
        this.isATH[i] = 1;
      }
      this.drawdown[i] = this.c[i] / peak - 1;
    }
    this.minLow = Math.min(...raw.l);
    this.maxHigh = Math.max(...raw.h);
  }

  static async load(url: string): Promise<Market> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    return new Market((await res.json()) as RawSeries);
  }

  /** Height (metres) of a price on the log-scaled course. */
  priceToY(price: number): number {
    return (Math.log10(price) - Math.log10(this.minLow)) * COURSE.yPerDecade + COURSE.baseY;
  }

  yToPrice(y: number): number {
    return Math.pow(10, (y - COURSE.baseY) / COURSE.yPerDecade + Math.log10(this.minLow));
  }

  /** Course x (metres) for a week index (can be fractional). */
  weekToX(week: number): number {
    return week * COURSE.xPerWeek;
  }

  xToWeek(x: number): number {
    return x / COURSE.xPerWeek;
  }

  /** Fractional week index for a unix-seconds timestamp (extrapolates before IPO). */
  timeToWeek(sec: number): number {
    const t0 = this.t[0];
    if (sec <= t0) return (sec - t0) / (7 * 86400);
    const last = this.n - 1;
    if (sec >= this.t[last]) return last + (sec - this.t[last]) / (7 * 86400);
    let lo = 0;
    let hi = last;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.t[mid] <= sec) lo = mid;
      else hi = mid;
    }
    return lo + (sec - this.t[lo]) / (this.t[hi] - this.t[lo]);
  }

  dateToWeek(iso: string): number {
    return this.timeToWeek(Date.parse(iso + 'T14:30:00Z') / 1000);
  }

  /** Clamped integer week index. */
  idx(week: number): number {
    return Math.max(0, Math.min(this.n - 1, Math.floor(week)));
  }

  /** Close price interpolated at a fractional week (log-linear). */
  priceAt(week: number): number {
    if (week <= 0) return this.c[0];
    if (week >= this.n - 1) return this.c[this.n - 1];
    const i = Math.floor(week);
    const f = week - i;
    return Math.exp(Math.log(this.c[i]) * (1 - f) + Math.log(this.c[i + 1]) * f);
  }

  dateOf(week: number): Date {
    const i = this.idx(week);
    return new Date(this.t[i] * 1000);
  }

  /** Indices of the first trading week of every calendar year. */
  yearStarts(): { week: number; year: number }[] {
    const out: { week: number; year: number }[] = [];
    let prev = -1;
    for (let i = 0; i < this.n; i++) {
      const y = new Date(this.t[i] * 1000).getUTCFullYear();
      if (y !== prev) {
        if (prev !== -1) out.push({ week: i, year: y });
        prev = y;
      }
    }
    return out;
  }
}
