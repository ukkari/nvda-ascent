import type { Lang } from '../data/history';

const STRINGS = {
  kicker: { en: 'A 3D ride through 27 years of NVIDIA', ja: 'NVIDIA 27年の歴史を駆け抜ける 3D ライド' },
  lead: {
    en: 'The road <b>is</b> the stock chart. Every hill is a rally, every cliff a crash. Roll from a 2.5¢ IPO to the all-time high, collecting the chips and moments that built a $5 trillion company.',
    ja: 'この道は<b>株価チャートそのもの</b>。上り坂は上昇相場、断崖は暴落。上場時 2.5 セントから史上最高値まで転がり登り、5兆ドル企業を形づくった製品と出来事を集めよう。',
  },
  start: { en: 'Start the climb', ja: '登頂開始' },
  loading: { en: 'Loading assets', ja: 'アセットを読み込み中' },
  controls: { en: 'Controls', ja: '操作方法' },
  cAccel: { en: 'Accelerate', ja: '加速' },
  cBrake: { en: 'Brake / reverse', ja: 'ブレーキ / 後退' },
  cSteer: { en: 'Steer', ja: '左右移動' },
  cJump: { en: 'Jump', ja: 'ジャンプ' },
  cBoost: { en: 'Boost', ja: 'ブースト' },
  cCam: { en: 'Chart view', ja: 'チャート視点' },
  cPause: { en: 'Pause', ja: 'ポーズ' },
  cRespawn: { en: 'Respawn', ja: 'リスポーン' },
  dataNote: {
    en: 'Weekly NASDAQ:NVDA OHLC via TradingView · split-adjusted · log scale',
    ja: '週足 NASDAQ:NVDA（TradingView）· 分割調整済み · 対数スケール',
  },
  date: { en: 'Date', ja: '日付' },
  price: { en: 'Price', ja: '株価' },
  sinceIpo: { en: 'vs IPO', ja: 'IPO比' },
  fromAth: { en: 'from ATH', ja: '高値比' },
  speed: { en: 'km/h', ja: 'km/h' },
  boost: { en: 'Boost', ja: 'ブースト' },
  cores: { en: 'CUDA cores', ja: 'CUDA コア' },
  products: { en: 'Products', ja: '製品' },
  milestones: { en: 'Milestones', ja: '出来事' },
  time: { en: 'Time', ja: 'タイム' },
  bear: { en: 'Bear market', ja: '弱気相場' },
  ath: { en: 'New all-time high', ja: '史上最高値更新' },
  marginCall: { en: 'Margin call', ja: 'マージンコール' },
  bigAir: { en: 'Big air', ja: 'ビッグエア' },
  go: { en: 'GO', ja: 'GO' },
  paused: { en: 'Paused', ja: 'ポーズ中' },
  resume: { en: 'Resume', ja: '再開' },
  restart: { en: 'Restart', ja: 'リスタート' },
  quit: { en: 'Title screen', ja: 'タイトルへ' },
  summit: { en: 'Summit reached', ja: '登頂成功' },
  summitSub: { en: 'You rode NVDA from IPO to its all-time high.', ja: 'NVDA を上場から史上最高値まで駆け抜けた。' },
  invested: { en: '$1,000 invested at the $12 IPO would now be worth', ja: 'IPO（1株12ドル）に1,000ドル投資していたら、現在の価値は' },
  again: { en: 'Ride again', ja: 'もう一度' },
  maxSpeed: { en: 'Top speed', ja: '最高速度' },
  airTime: { en: 'Longest air', ja: '最長滞空' },
  marginCalls: { en: 'Margin calls', ja: 'マージンコール' },
  score: { en: 'Score', ja: 'スコア' },
  grade: { en: 'Rating', ja: '評価' },
  viewChase: { en: 'Chase cam', ja: '追従カメラ' },
  viewSide: { en: 'Chart view', ja: 'チャート視点' },
  disclaimer: {
    en: 'Fan-made portfolio project. Not affiliated with or endorsed by NVIDIA. Not investment advice.',
    ja: '個人制作のポートフォリオ作品です。NVIDIA とは無関係であり、投資助言ではありません。',
  },
} satisfies Record<string, Record<Lang, string>>;

export type StringKey = keyof typeof STRINGS;

let current: Lang = navigator.language?.startsWith('ja') ? 'ja' : 'en';

export const i18n = {
  get lang() {
    return current;
  },
  set(lang: Lang) {
    current = lang;
    document.documentElement.lang = lang;
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
      const k = el.dataset.i18n as StringKey;
      if (STRINGS[k]) el.innerHTML = STRINGS[k][lang];
    });
  },
  t(k: StringKey): string {
    return STRINGS[k][current];
  },
};
