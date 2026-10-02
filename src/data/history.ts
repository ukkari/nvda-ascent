/**
 * Company history that is woven into the course.
 *
 * - Milestones become gates the player rolls through (and HUD story cards).
 * - Products become collectible pickups placed at their launch week.
 *
 * Dates before the IPO (1999-01-22) are placed on the prologue runway.
 * All copy is bilingual (EN / JA).
 */

export type Lang = 'en' | 'ja';
export type L10n = Record<Lang, string>;

export type MilestoneKind = 'origin' | 'milestone' | 'crash' | 'record' | 'deal';

export interface Milestone {
  date: string; // ISO yyyy-mm-dd
  kind: MilestoneKind;
  title: L10n;
  body: L10n;
}

export type ProductModel = 'card' | 'module';

export interface Product {
  date: string;
  name: string;
  model: ProductModel;
  tag: L10n; // one-liner shown on pickup
}

export const MILESTONES: Milestone[] = [
  // ── Prologue (pre-IPO runway) ────────────────────────────────────────────
  {
    date: '1993-04-05',
    kind: 'origin',
    title: { en: 'NVIDIA is founded', ja: 'NVIDIA 創業' },
    body: {
      en: 'Jensen Huang, Chris Malachowsky and Curtis Priem start NVIDIA — the plan famously sketched in a Denny\'s booth in San Jose — betting that accelerated computing could solve problems CPUs never would.',
      ja: 'ジェンスン・フアン、クリス・マラコウスキー、カーティス・プリエムが創業。構想はサンノゼのデニーズで練られた。「CPU では解けない問題を、アクセラレーテッド・コンピューティングで解く」という賭けが始まる。',
    },
  },
  {
    date: '1995-05-22',
    kind: 'crash',
    title: { en: 'NV1 stumbles', ja: '初号機 NV1 の苦戦' },
    body: {
      en: 'The first chip, NV1, bets on quadratic surfaces just as the industry standardises on triangles. Sales disappoint and the young company nearly runs out of money.',
      ja: '初の製品 NV1 は二次曲面レンダリングに賭けたが、業界はポリゴン（三角形）に標準化。販売は振るわず、会社は資金難で倒産寸前に。',
    },
  },
  {
    date: '1997-08-25',
    kind: 'milestone',
    title: { en: 'RIVA 128 saves the company', ja: 'RIVA 128 が会社を救う' },
    body: {
      en: 'A pivot to Direct3D-friendly triangles pays off: RIVA 128 ships around a million units in its first four months and puts NVIDIA back in the game.',
      ja: 'Direct3D 準拠の三角形レンダリングへ方針転換。RIVA 128 は発売から4か月で約100万個を出荷し、NVIDIA は息を吹き返す。',
    },
  },
  // ── On the chart ─────────────────────────────────────────────────────────
  {
    date: '1999-01-22',
    kind: 'milestone',
    title: { en: 'IPO on NASDAQ', ja: 'NASDAQ に上場' },
    body: {
      en: 'NVIDIA lists at $12 a share. After six stock splits that is roughly 2.5¢ in today\'s terms — the starting line of this course.',
      ja: '1株12ドルで新規上場。その後6回の株式分割を経た現在の基準では約2.5セント。ここがこのコースのスタートライン。',
    },
  },
  {
    date: '1999-08-31',
    kind: 'milestone',
    title: { en: '"The world\'s first GPU"', ja: '「世界初の GPU」' },
    body: {
      en: 'GeForce 256 moves transform & lighting onto the graphics chip. NVIDIA coins the term GPU — and a category is born.',
      ja: 'GeForce 256 はジオメトリ変換とライティングをグラフィックスチップ上で処理。NVIDIA は「GPU」という言葉を生み出し、新たなカテゴリーが誕生した。',
    },
  },
  {
    date: '2000-03-06',
    kind: 'deal',
    title: { en: 'Inside the Xbox', ja: 'Xbox への採用' },
    body: {
      en: 'Microsoft picks NVIDIA to design the graphics processor for its first game console, the original Xbox.',
      ja: 'マイクロソフトが初の家庭用ゲーム機「Xbox」のグラフィックスプロセッサ開発に NVIDIA を選定。',
    },
  },
  {
    date: '2000-12-15',
    kind: 'deal',
    title: { en: 'Rival 3dfx acquired', ja: 'ライバル 3dfx を買収' },
    body: {
      en: 'NVIDIA buys the graphics assets of 3dfx, the Voodoo pioneer that once dominated PC gaming. The 3D-accelerator wars are effectively over.',
      ja: 'かつて PC ゲームを席巻した Voodoo の 3dfx からグラフィックス資産を取得。3D アクセラレータ戦争は事実上の決着を迎える。',
    },
  },
  {
    date: '2001-11-30',
    kind: 'record',
    title: { en: 'Joins the S&P 500', ja: 'S&P 500 に採用' },
    body: {
      en: 'NVIDIA enters the S&P 500 — taking the seat vacated by a collapsing Enron.',
      ja: '経営破綻した Enron に代わり、S&P 500 の構成銘柄に採用される。',
    },
  },
  {
    date: '2002-07-08',
    kind: 'crash',
    title: { en: 'Dot-com bust: −90%', ja: 'ドットコム崩壊：−90%' },
    body: {
      en: 'From its January 2002 peak the stock collapses about 90% by October as the tech bubble deflates and an accounting review spooks investors. Hold on tight.',
      ja: '2002年1月の高値から10月までに株価は約90%下落。ITバブル崩壊と会計問題への懸念が重なった。しっかりつかまって。',
    },
  },
  {
    date: '2004-12-07',
    kind: 'deal',
    title: { en: 'PlayStation 3 deal', ja: 'PlayStation 3 に採用' },
    body: {
      en: 'Sony taps NVIDIA to co-develop the RSX "Reality Synthesizer" GPU for the PlayStation 3.',
      ja: 'ソニーが PlayStation 3 の GPU「RSX Reality Synthesizer」の共同開発パートナーに NVIDIA を選ぶ。',
    },
  },
  {
    date: '2006-11-08',
    kind: 'milestone',
    title: { en: 'CUDA changes everything', ja: 'CUDA 登場' },
    body: {
      en: 'With GeForce 8800 NVIDIA unveils CUDA, letting programmers use the GPU as a massively parallel general-purpose processor. Wall Street shrugs; scientists don\'t.',
      ja: 'GeForce 8800 と同時に CUDA を発表。GPU を超並列の汎用プロセッサとしてプログラムできるようになった。ウォール街は冷ややかだったが、研究者たちは飛びついた。',
    },
  },
  {
    date: '2007-06-20',
    kind: 'milestone',
    title: { en: 'Tesla: GPUs for science', ja: 'Tesla：科学のための GPU' },
    body: {
      en: 'The Tesla line brings GPU computing to workstations and supercomputers — the seed of NVIDIA\'s data-center business.',
      ja: 'Tesla 製品群で GPU コンピューティングをワークステーションとスパコンへ。これが後のデータセンター事業の種となる。',
    },
  },
  {
    date: '2008-07-07',
    kind: 'crash',
    title: { en: 'Financial crisis: −86%', ja: '金融危機：−86%' },
    body: {
      en: 'A costly charge for defective laptop chips lands just as the global financial crisis hits. From the late-2007 peak the stock sheds ~86% by November 2008.',
      ja: 'ノートPC向けチップの不具合による巨額の費用計上に、世界金融危機が重なる。2007年末の高値から2008年11月までに約86%下落。',
    },
  },
  {
    date: '2010-11-15',
    kind: 'record',
    title: { en: 'World\'s fastest supercomputer', ja: '世界最速のスパコン' },
    body: {
      en: 'China\'s Tianhe-1A, accelerated by NVIDIA Tesla GPUs, tops the TOP500 list of the world\'s fastest supercomputers.',
      ja: 'NVIDIA Tesla GPU を搭載した中国の「天河1A」がスーパーコンピュータ TOP500 で世界1位に。',
    },
  },
  {
    date: '2012-09-30',
    kind: 'milestone',
    title: { en: 'AlexNet: deep learning\'s Big Bang', ja: 'AlexNet：深層学習のビッグバン' },
    body: {
      en: 'Krizhevsky, Sutskever and Hinton train AlexNet on two GeForce GTX 580s and win ImageNet by a landslide. The AI era quietly begins — on NVIDIA hardware.',
      ja: 'クリジェフスキー、サツキヴァー、ヒントンが GeForce GTX 580 ×2 で AlexNet を学習させ、ImageNet で圧勝。AI の時代が NVIDIA のハードウェア上で静かに幕を開けた。',
    },
  },
  {
    date: '2012-11-12',
    kind: 'record',
    title: { en: 'Titan takes #1', ja: 'Titan が世界1位' },
    body: {
      en: 'Oak Ridge\'s Titan, with 18,688 Tesla K20X GPUs, becomes the world\'s fastest supercomputer.',
      ja: 'Tesla K20X を18,688基搭載したオークリッジ国立研究所の「Titan」が世界最速のスパコンに。',
    },
  },
  {
    date: '2016-04-05',
    kind: 'milestone',
    title: { en: 'DGX-1: AI supercomputer in a box', ja: 'DGX-1：箱に入った AI スパコン' },
    body: {
      en: 'NVIDIA launches DGX-1. That August Jensen Huang hand-delivers the first unit to a young non-profit lab called OpenAI.',
      ja: 'DGX-1 を発表。同年8月、ジェンスン・フアンは最初の1台を創業間もない非営利団体 OpenAI に自ら届けた。',
    },
  },
  {
    date: '2016-12-27',
    kind: 'record',
    title: { en: '2016: best stock in the S&P 500', ja: '2016年 S&P 500 の最優秀銘柄' },
    body: {
      en: 'Gaming, data center and self-driving hype combine: NVDA more than triples in 2016, the top performer in the S&P 500.',
      ja: 'ゲーム、データセンター、自動運転への期待が重なり、株価は1年で3倍超に。2016年の S&P 500 で最高の上昇率を記録。',
    },
  },
  {
    date: '2017-05-10',
    kind: 'milestone',
    title: { en: 'Volta & Tensor Cores', ja: 'Volta と Tensor コア' },
    body: {
      en: 'Tesla V100 introduces Tensor Cores — silicon purpose-built for the matrix math at the heart of deep learning.',
      ja: 'Tesla V100 で Tensor コアを導入。深層学習の核心である行列演算に特化した回路だ。',
    },
  },
  {
    date: '2018-08-20',
    kind: 'milestone',
    title: { en: 'RTX: real-time ray tracing', ja: 'RTX：リアルタイム・レイトレーシング' },
    body: {
      en: 'Turing-based GeForce RTX brings real-time ray tracing and AI upscaling (DLSS) to gamers — a "holy grail" of graphics.',
      ja: 'Turing 世代の GeForce RTX がリアルタイム・レイトレーシングと AI 超解像（DLSS）をゲーマーに。グラフィックスの「聖杯」と呼ばれた技術だ。',
    },
  },
  {
    date: '2018-11-19',
    kind: 'crash',
    title: { en: 'Crypto hangover: −57%', ja: '仮想通貨バブルの反動：−57%' },
    body: {
      en: 'Mining demand evaporates and channel inventory piles up. Between October and December 2018 the stock loses more than half its value.',
      ja: 'マイニング需要が消え、流通在庫が積み上がる。2018年10月から12月の間に株価は半値以下に。',
    },
  },
  {
    date: '2019-03-11',
    kind: 'deal',
    title: { en: 'Mellanox for $6.9B', ja: 'Mellanox を69億ドルで買収' },
    body: {
      en: 'NVIDIA agrees to buy Mellanox, the high-speed networking specialist. Data centers become a single giant computer.',
      ja: '高速ネットワークの雄 Mellanox の買収で合意。データセンター全体を1台の巨大コンピュータとして設計する道が開く。',
    },
  },
  {
    date: '2020-05-14',
    kind: 'milestone',
    title: { en: 'Ampere A100', ja: 'Ampere A100' },
    body: {
      en: 'Announced from Jensen\'s kitchen during the pandemic, the A100 becomes the workhorse of the coming AI boom.',
      ja: 'コロナ禍、ジェンスンの自宅キッチンから発表された A100。後の AI ブームを支える主力機となる。',
    },
  },
  {
    date: '2020-07-08',
    kind: 'record',
    title: { en: 'Bigger than Intel', ja: 'インテルを時価総額で逆転' },
    body: {
      en: 'For the first time NVIDIA\'s market value surpasses Intel\'s, making it America\'s most valuable chipmaker.',
      ja: '時価総額で初めてインテルを上回り、米国で最も価値ある半導体企業に。',
    },
  },
  {
    date: '2020-09-14',
    kind: 'deal',
    title: { en: 'The $40B Arm bid', ja: '400億ドルの Arm 買収計画' },
    body: {
      en: 'NVIDIA announces a $40B deal to buy Arm. Regulators push back worldwide and the deal is abandoned in February 2022.',
      ja: 'Arm を400億ドルで買収すると発表。しかし各国規制当局の反発を受け、2022年2月に断念。',
    },
  },
  {
    date: '2021-07-20',
    kind: 'record',
    title: { en: '4-for-1 stock split', ja: '1対4 の株式分割' },
    body: {
      en: 'Shares split four-for-one as the stock tops $700 pre-split.',
      ja: '分割前株価が700ドルを超え、1株を4株に分割。',
    },
  },
  {
    date: '2022-06-13',
    kind: 'crash',
    title: { en: '2022 bear market: −69%', ja: '2022年 弱気相場：−69%' },
    body: {
      en: 'Rate hikes, a crypto crash, a gaming slump and new US export curbs on China: from November 2021 to October 2022 the stock falls ~69%.',
      ja: '利上げ、仮想通貨の暴落、ゲーム需要の失速、対中輸出規制。2021年11月から2022年10月で株価は約69%下落。',
    },
  },
  {
    date: '2022-11-30',
    kind: 'milestone',
    title: { en: 'ChatGPT arrives', ja: 'ChatGPT 公開' },
    body: {
      en: 'OpenAI releases ChatGPT, trained on NVIDIA GPUs. Within months every company on earth wants an AI strategy — and GPUs to run it.',
      ja: 'NVIDIA GPU で学習された ChatGPT を OpenAI が公開。数か月のうちに世界中の企業が AI 戦略を求め、それを動かす GPU を求めた。',
    },
  },
  {
    date: '2023-05-25',
    kind: 'record',
    title: { en: 'The guidance heard round the world', ja: '世界を驚かせた業績見通し' },
    body: {
      en: 'NVIDIA forecasts $11B in quarterly revenue, billions above estimates. The stock jumps ~24% in a day and days later NVIDIA becomes the first chipmaker worth $1 trillion.',
      ja: '四半期売上高110億ドルという市場予想を大幅に上回る見通しを発表。株価は1日で約24%上昇し、数日後には半導体企業として初めて時価総額1兆ドルに到達。',
    },
  },
  {
    date: '2024-03-18',
    kind: 'milestone',
    title: { en: 'Blackwell unveiled', ja: 'Blackwell 発表' },
    body: {
      en: 'At GTC, NVIDIA reveals Blackwell: two reticle-limit dies fused into one GPU with 208 billion transistors.',
      ja: 'GTC で Blackwell を発表。製造限界サイズのダイ2枚を1つの GPU として統合し、トランジスタ数は2,080億個。',
    },
  },
  {
    date: '2024-06-10',
    kind: 'record',
    title: { en: '10-for-1 split', ja: '1対10 の株式分割' },
    body: {
      en: 'A ten-for-one split makes shares more accessible. Every price on this course is adjusted for it.',
      ja: '1株を10株に分割。このコースの価格はすべて分割調整済み。',
    },
  },
  {
    date: '2024-06-18',
    kind: 'record',
    title: { en: 'World\'s most valuable company', ja: '世界で最も価値ある企業に' },
    body: {
      en: 'NVIDIA briefly passes Microsoft and Apple to become the most valuable public company on earth.',
      ja: 'マイクロソフトとアップルを抜き、一時的に世界で最も時価総額の大きい上場企業に。',
    },
  },
  {
    date: '2025-01-27',
    kind: 'crash',
    title: { en: 'The DeepSeek shock', ja: 'DeepSeek ショック' },
    body: {
      en: 'A cheap, capable model from Chinese lab DeepSeek rattles investors: NVDA falls ~17% in a day, erasing about $589B — the largest one-day loss of market value in US history.',
      ja: '中国の DeepSeek が低コストで高性能なモデルを公開し投資家が動揺。株価は1日で約17%下落し、約5,890億ドルが消失。米国史上最大の1日の時価総額減少となった。',
    },
  },
  {
    date: '2025-04-07',
    kind: 'crash',
    title: { en: 'Tariff turmoil', ja: '関税ショック' },
    body: {
      en: 'Sweeping US tariffs and a new export licence requirement on the China-only H20 chip (a $5.5B charge) send the stock ~43% below its January high.',
      ja: '米国の大規模関税と、中国向け H20 への輸出許可要件（55億ドルの費用計上）が重なり、株価は1月の高値から約43%下落。',
    },
  },
  {
    date: '2025-07-09',
    kind: 'record',
    title: { en: 'First $4 trillion company', ja: '史上初の時価総額4兆ドル' },
    body: {
      en: 'NVIDIA becomes the first public company ever to be valued at $4 trillion.',
      ja: '史上初めて時価総額4兆ドルに到達した上場企業となる。',
    },
  },
  {
    date: '2025-09-22',
    kind: 'deal',
    title: { en: 'OpenAI: 10 gigawatts', ja: 'OpenAI と10ギガワット' },
    body: {
      en: 'NVIDIA and OpenAI announce plans to deploy at least 10 gigawatts of NVIDIA systems, with NVIDIA intending to invest up to $100B — days after taking a $5B stake in Intel.',
      ja: 'OpenAI と少なくとも10ギガワット規模のシステム導入計画を発表し、最大1,000億ドルの投資意向を表明。その数日前にはインテルへの50億ドル出資も発表していた。',
    },
  },
  {
    date: '2025-10-29',
    kind: 'record',
    title: { en: 'First $5 trillion company', ja: '史上初の時価総額5兆ドル' },
    body: {
      en: 'Less than four months later, NVIDIA becomes the first company to cross $5 trillion.',
      ja: 'わずか4か月足らずで、史上初の時価総額5兆ドル企業に。',
    },
  },
  {
    date: '2026-01-05',
    kind: 'milestone',
    title: { en: 'Vera Rubin in production', ja: 'Vera Rubin 量産へ' },
    body: {
      en: 'At CES, NVIDIA says its next platform — the Rubin GPU paired with the Vera CPU — is in full production.',
      ja: 'CES にて、次世代プラットフォーム（Rubin GPU と Vera CPU の組み合わせ）が本格量産に入ったと発表。',
    },
  },
];

export const PRODUCTS: Product[] = [
  { date: '1999-03-15', name: 'RIVA TNT2', model: 'card', tag: { en: 'Twin-texel engine, 32-bit color', ja: 'ツインテクセル、32bitカラー' } },
  { date: '1999-10-11', name: 'GeForce 256', model: 'card', tag: { en: 'The first "GPU": hardware T&L', ja: '最初の「GPU」— ハードウェア T&L' } },
  { date: '2000-04-26', name: 'GeForce2 GTS', model: 'card', tag: { en: 'First gigatexel-class GPU', ja: '初のギガテクセル級 GPU' } },
  { date: '2001-02-27', name: 'GeForce3', model: 'card', tag: { en: 'First programmable shaders', ja: '初のプログラマブル・シェーダ' } },
  { date: '2001-11-15', name: 'Xbox NV2A', model: 'module', tag: { en: 'Graphics for the original Xbox', ja: '初代 Xbox のグラフィックス' } },
  { date: '2002-02-06', name: 'GeForce4 Ti 4600', model: 'card', tag: { en: 'Dual vertex shaders', ja: 'デュアル頂点シェーダ' } },
  { date: '2003-01-27', name: 'GeForce FX 5800', model: 'card', tag: { en: 'The "Dustbuster" — loud but bold', ja: '通称「掃除機」— 爆音だが野心作' } },
  { date: '2004-04-14', name: 'GeForce 6800 Ultra', model: 'card', tag: { en: 'Shader Model 3.0 + SLI', ja: 'Shader Model 3.0 と SLI' } },
  { date: '2005-06-22', name: 'GeForce 7800 GTX', model: 'card', tag: { en: '24 pixel pipelines', ja: '24 ピクセルパイプライン' } },
  { date: '2006-11-08', name: 'GeForce 8800 GTX', model: 'card', tag: { en: 'Unified shaders + CUDA', ja: '統合シェーダと CUDA' } },
  { date: '2006-11-17', name: 'PS3 RSX', model: 'module', tag: { en: 'PlayStation 3 "Reality Synthesizer"', ja: 'PS3「Reality Synthesizer」' } },
  { date: '2007-06-20', name: 'Tesla C870', model: 'module', tag: { en: 'The first Tesla GPU-computing board', ja: '初の Tesla 演算ボード' } },
  { date: '2008-06-02', name: 'Tegra', model: 'module', tag: { en: 'Mobile system-on-chip', ja: 'モバイル向け SoC' } },
  { date: '2008-06-16', name: 'GeForce GTX 280', model: 'card', tag: { en: '1.4B transistors, double-precision', ja: '14億トランジスタ、倍精度対応' } },
  { date: '2010-03-26', name: 'GeForce GTX 480', model: 'card', tag: { en: 'Fermi: GPU computing goes mainstream', ja: 'Fermi — GPU 演算の本格化' } },
  { date: '2010-11-09', name: 'GeForce GTX 580', model: 'card', tag: { en: 'The GPU that trained AlexNet', ja: 'AlexNet を学習させた GPU' } },
  { date: '2012-03-22', name: 'GeForce GTX 680', model: 'card', tag: { en: 'Kepler: perf-per-watt leap', ja: 'Kepler — 電力効率の飛躍' } },
  { date: '2012-11-12', name: 'Tesla K20X', model: 'module', tag: { en: 'Powers the Titan supercomputer', ja: 'スパコン Titan の心臓' } },
  { date: '2014-09-18', name: 'GeForce GTX 980', model: 'card', tag: { en: 'Maxwell efficiency', ja: 'Maxwell の高効率' } },
  { date: '2016-04-05', name: 'Tesla P100', model: 'module', tag: { en: 'Pascal + HBM2 + NVLink', ja: 'Pascal、HBM2、NVLink' } },
  { date: '2016-05-27', name: 'GeForce GTX 1080', model: 'card', tag: { en: '16nm Pascal for gamers', ja: '16nm Pascal をゲーマーへ' } },
  { date: '2017-03-03', name: 'Tegra X1 · Switch', model: 'module', tag: { en: 'Inside the Nintendo Switch', ja: 'Nintendo Switch に搭載' } },
  { date: '2017-06-21', name: 'Tesla V100', model: 'module', tag: { en: 'First Tensor Cores', ja: '初の Tensor コア' } },
  { date: '2018-09-20', name: 'GeForce RTX 2080 Ti', model: 'card', tag: { en: 'RT cores + DLSS', ja: 'RT コアと DLSS' } },
  { date: '2020-05-14', name: 'A100', model: 'module', tag: { en: 'Ampere: the AI-boom workhorse', ja: 'Ampere — AI ブームの主力' } },
  { date: '2020-09-17', name: 'GeForce RTX 3080', model: 'card', tag: { en: '2nd-gen RTX', ja: '第2世代 RTX' } },
  { date: '2022-03-22', name: 'H100', model: 'module', tag: { en: 'Hopper + Transformer Engine', ja: 'Hopper と Transformer Engine' } },
  { date: '2022-10-12', name: 'GeForce RTX 4090', model: 'card', tag: { en: 'Ada Lovelace flagship', ja: 'Ada Lovelace のフラッグシップ' } },
  { date: '2023-05-29', name: 'GH200 Grace Hopper', model: 'module', tag: { en: 'CPU + GPU superchip', ja: 'CPU+GPU スーパーチップ' } },
  { date: '2024-03-18', name: 'B200', model: 'module', tag: { en: 'Blackwell: 208B transistors', ja: 'Blackwell — 2,080億トランジスタ' } },
  { date: '2025-01-30', name: 'GeForce RTX 5090', model: 'card', tag: { en: 'Blackwell for gamers, DLSS 4', ja: 'ゲーマー向け Blackwell、DLSS 4' } },
  { date: '2025-03-18', name: 'GB300', model: 'module', tag: { en: 'Blackwell Ultra', ja: 'Blackwell Ultra' } },
  { date: '2025-10-15', name: 'DGX Spark', model: 'module', tag: { en: 'A petaflop AI computer on your desk', ja: '机上の1ペタフロップス AI コンピュータ' } },
  { date: '2026-01-05', name: 'Vera Rubin', model: 'module', tag: { en: 'Rubin GPU + Vera CPU', ja: 'Rubin GPU と Vera CPU' } },
];
