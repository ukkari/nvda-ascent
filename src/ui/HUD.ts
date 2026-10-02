import type { Milestone, MilestoneKind, Product } from '../data/history';
import { i18n } from './i18n';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const KIND_LABEL: Record<MilestoneKind, { en: string; ja: string }> = {
  origin: { en: 'Origin', ja: '原点' },
  milestone: { en: 'Milestone', ja: '転換点' },
  crash: { en: 'Crash', ja: '暴落' },
  record: { en: 'Record', ja: '記録' },
  deal: { en: 'Deal', ja: '提携・買収' },
};

export function fmtPrice(p: number): string {
  if (p < 1) return `$${p.toFixed(p < 0.1 ? 4 : 3)}`;
  if (p < 100) return `$${p.toFixed(2)}`;
  return `$${p.toFixed(2)}`;
}

export function fmtPct(r: number): string {
  const pct = r * 100;
  const abs = Math.abs(pct);
  const s = abs >= 10000 ? Math.round(abs).toLocaleString('en-US') : abs >= 100 ? abs.toFixed(0) : abs.toFixed(1);
  return `${pct >= 0 ? '+' : '−'}${s}%`;
}

export function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export class HUD {
  private el = {
    hud: $('hud'),
    date: $('hDate'),
    price: $('hPrice'),
    ipo: $('hIpo'),
    ath: $('hAth'),
    athRow: $('hAthRow'),
    speed: $('hSpeed'),
    boost: $('hBoost'),
    cores: $('sCores'),
    products: $('sProducts'),
    gates: $('sGates'),
    time: $('sTime'),
    story: $('story'),
    toasts: $('toasts'),
    banner: $('banner'),
    countdown: $('countdown'),
  };
  private storyTimer = 0;
  private bannerTimer = 0;
  private last = { cores: -1, products: -1, gates: -1 };

  show(v: boolean) {
    this.el.hud.hidden = !v;
  }

  legend() {
    document.querySelectorAll<HTMLElement>('.legend .chip').forEach((el) => {
      const k = (['milestone', 'crash', 'record', 'deal', 'origin'] as MilestoneKind[]).find((k) => el.classList.contains(`k-${k}`))!;
      el.textContent = KIND_LABEL[k][i18n.lang];
    });
  }

  telemetry(o: { date: Date; price: number; vsIpo: number; drawdown: number; speed: number; energy: number; boosting: boolean; preIpo: boolean }) {
    const fmt = new Intl.DateTimeFormat(i18n.lang === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
    this.el.date.textContent = o.preIpo ? String(o.date.getUTCFullYear()) : fmt.format(o.date);
    this.el.price.textContent = o.preIpo ? (i18n.lang === 'ja' ? '未上場' : 'PRE-IPO') : fmtPrice(o.price);
    this.el.ipo.textContent = o.preIpo ? '—' : fmtPct(o.vsIpo);
    this.el.ipo.className = `mono ${o.vsIpo >= 0 ? 'up' : 'down'}`;
    this.el.ath.textContent = o.drawdown > -0.0005 ? 'ATH' : fmtPct(o.drawdown);
    this.el.ath.className = `mono ${o.drawdown > -0.0005 ? 'up' : o.drawdown < -0.2 ? 'down' : ''}`;
    this.el.speed.textContent = String(Math.round(o.speed * 3.6));
    this.el.boost.style.width = `${o.energy.toFixed(1)}%`;
    this.el.boost.classList.toggle('on', o.boosting);
  }

  stats(cores: number, products: number, productTotal: number, gates: number, gateTotal: number, time: number) {
    const set = (el: HTMLElement, key: keyof typeof this.last, v: number, text: string) => {
      if (this.last[key] !== v) {
        el.textContent = text;
        if (this.last[key] >= 0 && v > this.last[key]) {
          el.classList.remove('pop');
          void el.offsetWidth;
          el.classList.add('pop');
        }
        this.last[key] = v;
      }
    };
    set(this.el.cores, 'cores', cores, cores.toLocaleString('en-US'));
    set(this.el.products, 'products', products, `${products}/${productTotal}`);
    set(this.el.gates, 'gates', gates, `${gates}/${gateTotal}`);
    this.el.time.textContent = fmtTime(time);
  }

  resetStats() {
    this.last = { cores: -1, products: -1, gates: -1 };
    this.el.story.innerHTML = '';
    this.el.toasts.innerHTML = '';
  }

  story(m: Milestone, price: number | null) {
    const lang = i18n.lang;
    const fmt = new Intl.DateTimeFormat(lang === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
    this.el.story.querySelectorAll('.card').forEach((old) => {
      if (old.classList.contains('out')) return;
      old.classList.add('out');
      setTimeout(() => old.remove(), 500);
    });
    const card = document.createElement('div');
    card.className = `card k-${m.kind}`;
    card.innerHTML = `
      <div class="card-top"><span class="card-kind">${KIND_LABEL[m.kind][lang]}</span><span class="card-date">${fmt.format(new Date(m.date + 'T00:00:00Z'))}</span></div>
      <h4></h4><p></p>
      ${price !== null ? `<div class="card-price">NVDA <b>${fmtPrice(price)}</b> <span>(split-adj.)</span></div>` : ''}`;
    card.querySelector('h4')!.textContent = m.title[lang];
    card.querySelector('p')!.textContent = m.body[lang];
    this.el.story.appendChild(card);
    clearTimeout(this.storyTimer);
    this.storyTimer = window.setTimeout(() => {
      card.classList.add('out');
      setTimeout(() => card.remove(), 500);
    }, 9000);
  }

  toast(p: Product) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<div class="toast-icon">${p.model === 'card' ? 'GPU' : 'DC'}</div><div><b></b><small></small></div>`;
    t.querySelector('b')!.textContent = p.name;
    t.querySelector('small')!.textContent = `${p.date.slice(0, 4)} · ${p.tag[i18n.lang]}`;
    this.el.toasts.prepend(t);
    while (this.el.toasts.children.length > 3) this.el.toasts.lastElementChild!.remove();
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 450);
    }, 3800);
  }

  banner(text: string, sub = '', kind: 'crash' | 'record' | 'air' | '' = '') {
    const b = this.el.banner;
    b.className = 'banner';
    b.innerHTML = '';
    b.append(text);
    if (sub) {
      const s = document.createElement('small');
      s.textContent = sub;
      b.append(s);
    }
    void b.offsetWidth;
    b.className = `banner show ${kind ? 'k-' + kind : ''}`;
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => (b.className = 'banner'), 2300);
  }

  async countdown(): Promise<void> {
    const el = this.el.countdown;
    for (const s of ['3', '2', '1', i18n.t('go')]) {
      el.innerHTML = `<span>${s}</span>`;
      await new Promise((r) => setTimeout(r, s === i18n.t('go') ? 500 : 800));
    }
    setTimeout(() => (el.innerHTML = ''), 500);
  }
}
