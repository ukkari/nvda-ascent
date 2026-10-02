/** World-scale and gameplay tuning. 1 unit = 1 metre. */

export const COURSE = {
  /** horizontal metres per weekly bar */
  xPerWeek: 8,
  /** vertical metres per 10× change in price (log scale keeps 1999 and 2026 both rideable) */
  yPerDecade: 220,
  /** height of the all-time-low above y = 0 */
  baseY: 40,
  /** Gaussian smoothing (in weeks) applied to log(close) to make the surface rideable */
  smoothSigma: 2.5,
  /** fine samples per week used for the height field and road mesh */
  samplesPerWeek: 4,
  /** half the playable road width */
  halfWidth: 10,
  /** pre-IPO runway (1993-1998 prologue) */
  prologue: 420,
  /** plateau after the last bar, where the summit spire stands */
  epilogue: 300,
  /** bottom of the area-chart "cliffs" under the road */
  floorY: -80,
  /** candlestick wall lateral offset (negative z = player's left) */
  candleZ: -19,
} as const;

export const PHYS = {
  gravity: 26,
  radius: 1.2,
  engine: 20,
  engineTopSpeed: 74,
  boost: 30,
  boostTopSpeed: 125,
  boostDrain: 22,
  brake: 32,
  drag: 0.0042,
  rolling: 0.35,
  maxSpeed: 150,
  steer: 17,
  airSteer: 7,
  airThrust: 5,
  jump: 15,
  /** landings harder than this (m/s into the surface) bounce */
  bounceImpact: 26,
  restitution: 0.28,
  /** extra grip margin before a crest launches the ball (1 = pure physics) */
  launchMargin: 1.05,
} as const;

export const GAME = {
  /** distance (m) in which world props are shown */
  propViewDistance: 900,
  pickupRadius: 4.2,
  coreRadius: 2.4,
  coreScore: 10,
  productScore: 500,
  gateScore: 100,
  airScorePerSec: 60,
  coreEnergy: 3,
  productEnergy: 30,
} as const;

export const COLORS = {
  green: 0x76b900,
  greenHot: 0xa8ff2a,
  red: 0xff3355,
  gold: 0xffc94a,
  cyan: 0x3fe0ff,
  violet: 0x9b7bff,
  ink: 0x05070a,
} as const;

/** IPO price ($12) expressed in today's split-adjusted dollars (6 splits = 480×). */
export const IPO_PRICE_ADJ = 12 / 480;
