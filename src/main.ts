import './styles.css';
import type { Lang } from './data/history';
import { Market } from './data/market';
import { Game } from './game/Game';
import { i18n } from './ui/i18n';
import { loadModels } from './world/assets';

const $ = (id: string) => document.getElementById(id)!;
const BASE = import.meta.env.BASE_URL;

async function boot() {
  i18n.set(i18n.lang);
  syncLangButtons();
  const bar = $('loadBar');
  const progress = (p: number) => (bar.style.width = `${Math.round(p * 100)}%`);

  // Fonts first — canvas labels are rasterised once and need the real glyphs.
  const fonts = Promise.all([
    document.fonts.load('700 64px "Space Grotesk"'),
    document.fonts.load('700 64px "JetBrains Mono"'),
    document.fonts.load('700 64px "Noto Sans JP"'),
  ]).catch(() => undefined);

  const [market, models] = await Promise.all([
    Market.load(`${BASE}data/nvda_weekly.json`),
    loadModels(BASE, (p) => progress(0.1 + p * 0.8)),
    fonts,
  ]);
  progress(0.95);

  const game = new Game($('gl') as HTMLCanvasElement, market, models);
  game.setLang(i18n.lang);
  (window as unknown as { game: Game }).game = game; // handy for debugging
  progress(1);

  const start = $('btnStart') as HTMLButtonElement;
  start.disabled = false;
  start.querySelector('.cta-label')!.setAttribute('data-i18n', 'start');
  i18n.set(i18n.lang);

  const title = $('title');
  const pause = $('pause');
  const finish = $('finish');

  const begin = () => {
    title.classList.add('leaving');
    setTimeout(() => {
      title.hidden = true;
      title.classList.remove('leaving');
    }, 650);
    game.start();
  };
  start.addEventListener('click', begin);
  addEventListener('keydown', (e) => {
    if (e.code === 'Enter' && !title.hidden && !start.disabled) begin();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) =>
    b.addEventListener('click', () => {
      game.setLang(b.dataset.lang as Lang);
      syncLangButtons();
    }),
  );

  game.onPauseChange = (p) => (pause.hidden = !p);
  $('btnPause').addEventListener('click', () => game.setPaused(true));
  $('btnCam').addEventListener('click', () => game.toggleCamera());
  $('btnMute').addEventListener('click', () => game.toggleMute());
  $('btnResume').addEventListener('click', () => game.setPaused(false));
  $('btnRestart').addEventListener('click', () => {
    pause.hidden = true;
    game.start();
  });
  $('btnQuit').addEventListener('click', () => {
    pause.hidden = true;
    game.toTitle();
    title.hidden = false;
  });

  game.onFinish = () => {
    const r = game.results();
    const fmt = new Intl.DateTimeFormat(i18n.lang === 'ja' ? 'ja-JP' : 'en-US', { dateStyle: 'long', timeZone: 'UTC' });
    $('fDate').textContent = fmt.format(r.date).toUpperCase();
    $('fInvest').textContent = `$${Math.round(r.invest).toLocaleString('en-US')}`;
    $('fGrade').textContent = r.grade;
    $('fStats').innerHTML = r.rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    finish.hidden = false;
  };
  $('btnAgain').addEventListener('click', () => {
    finish.hidden = true;
    game.start();
  });
}

function syncLangButtons() {
  document.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => b.classList.toggle('on', b.dataset.lang === i18n.lang));
}

boot().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div style="position:fixed;inset:auto 0 40px;text-align:center;color:#ff5577;font-family:monospace">Failed to start: ${String(err)}</div>`,
  );
});
