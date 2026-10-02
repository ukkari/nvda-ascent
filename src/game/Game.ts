import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Sound } from '../audio/Sound';
import { COLORS, COURSE, GAME, IPO_PRICE_ADJ } from '../config';
import type { Lang } from '../data/history';
import type { Market } from '../data/market';
import { Particles } from '../fx/Particles';
import { Post } from '../fx/Post';
import { HUD, fmtPct, fmtPrice, fmtTime } from '../ui/HUD';
import { i18n } from '../ui/i18n';
import { FONT_MONO, textTexture } from '../ui/labels';
import { Minimap } from '../ui/Minimap';
import type { Models } from '../world/assets';
import { cloneWithMaterials, tintEmissive } from '../world/assets';
import { buildBackdrop } from '../world/Backdrop';
import { buildCandles } from '../world/Candles';
import { Course } from '../world/Course';
import { Gates } from '../world/Gates';
import { Pickups } from '../world/Pickups';
import { Sky } from '../world/Sky';
import { shared } from '../world/uniforms';
import { CameraRig } from './CameraRig';
import { Input } from './Input';
import { Player, type PlayerEvents } from './Player';

type State = 'title' | 'countdown' | 'playing' | 'paused' | 'finished';

const STEP = 1 / 120;

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly course: Course;
  readonly rig: CameraRig;
  readonly post: Post;
  readonly player: Player;
  readonly gates: Gates;
  readonly pickups: Pickups;
  readonly particles = new Particles(5000);
  readonly sound = new Sound();
  readonly hud = new HUD();
  readonly input = new Input();
  readonly minimap: Minimap;
  private sky = new Sky();
  private timer = new THREE.Timer();
  private acc = 0;
  private frame = 0;
  state: State = 'title';
  private finishX: number;
  private finishBanner!: THREE.Mesh;
  private spire: THREE.Object3D;
  private flash = 0;
  private flashColor = new THREE.Color();
  private stats = this.freshStats();
  private inBear = false;
  private lastAthWeek = 0;
  private lastX = 0;
  private finishTimer = 0;
  onFinish: () => void = () => {};
  onPauseChange: (paused: boolean) => void = () => {};

  constructor(
    canvas: HTMLCanvasElement,
    readonly market: Market,
    private models: Models,
  ) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    r.setSize(innerWidth, innerHeight);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = r;

    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    this.scene.fog = new THREE.FogExp2(shared.uFogColor.value.getHex(), shared.uFogDensity.value);

    this.scene.add(new THREE.HemisphereLight(0xbfe9ff, 0x0b1206, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(-0.35, 0.85, 0.4);
    this.scene.add(sun);

    // ── world ──
    this.course = new Course(market);
    this.scene.add(this.sky.group, this.course.group, buildCandles(market));
    this.scene.add(buildBackdrop(market, this.course, models));
    this.gates = new Gates(market, this.course, models, i18n.lang);
    this.pickups = new Pickups(market, this.course, models, this.gates, i18n.lang);
    this.scene.add(this.gates.group, this.pickups.group, this.particles.points);

    this.finishX = this.course.xLastBar + 40;
    this.buildFinish();
    this.spire = models.summit_spire.clone(true);
    this.spire.scale.setScalar(1.7);
    const sx = this.course.xLastBar + 200;
    this.spire.position.set(sx, this.course.height(sx), 0);
    this.scene.add(this.spire);

    this.player = new Player(this.course, models.player_core);
    this.scene.add(this.player.object);
    this.player.reset(this.course.xStart + 20);

    this.rig = new CameraRig(this.course);
    this.post = new Post(r, this.scene, this.rig.camera);
    this.minimap = new Minimap(document.getElementById('minimap') as HTMLCanvasElement, market, this.course, this.gates);

    this.input.onAction = (a) => this.action(a);
    this.input.bindTouch(document.getElementById('touch')!);
    addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.setPaused(true);
    });
    this.renderer.setAnimationLoop(() => this.tick());
  }

  // ── setup helpers ─────────────────────────────────────────────────────────

  private buildFinish() {
    const gate = cloneWithMaterials(this.models.gate);
    tintEmissive(gate, new THREE.Color(COLORS.gold), 5);
    gate.scale.setScalar(1.35);
    gate.position.set(this.finishX, this.course.height(this.finishX) - 0.2, 0);
    this.finishBanner = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.finishBanner.rotation.y = -Math.PI / 2;
    gate.add(this.finishBanner);
    this.scene.add(gate);
    this.refreshFinishBanner();
  }

  private refreshFinishBanner() {
    const m = this.market;
    const last = m.n - 1;
    const { texture, aspect } = textTexture(
      [
        { text: i18n.lang === 'ja' ? '史上最高値' : 'ALL-TIME HIGH', size: 64, color: '#ffc94a', font: FONT_MONO, weight: 700, letterSpacing: 10 },
        { text: fmtPrice(m.h[last]), size: 140, color: '#ffffff', weight: 700 },
      ],
      { width: 1400, pad: 30, bg: 'rgba(10,8,2,0.6)', border: 'rgba(255,201,74,0.9)', glow: 'rgba(255,201,74,0.6)' },
    );
    const mat = this.finishBanner.material as THREE.MeshBasicMaterial;
    mat.map?.dispose();
    mat.map = texture;
    mat.needsUpdate = true;
    this.finishBanner.scale.set(15, 15 / aspect, 1);
    this.finishBanner.position.y = 9;
  }

  setLang(lang: Lang) {
    i18n.set(lang);
    this.gates.setLang(lang);
    this.pickups.setLang(lang);
    this.refreshFinishBanner();
    this.hud.legend();
  }

  private freshStats() {
    return { cores: 0, products: 0, gates: 0, time: 0, maxSpeed: 0, longestAir: 0, marginCalls: 0, airScore: 0 };
  }

  // ── state transitions ───────────────────────────────────────────────────

  async start() {
    this.sound.start();
    this.reset();
    this.state = 'countdown';
    this.rig.mode = 'chase';
    this.rig.snap(this.player);
    this.hud.show(true);
    this.minimap.resize();
    await this.hud.countdown();
    if (this.state === 'countdown') this.state = 'playing';
  }

  reset() {
    this.stats = this.freshStats();
    this.gates.reset();
    this.pickups.reset();
    this.hud.resetStats();
    this.player.reset(this.course.xStart + 20);
    this.player.energy = 60;
    this.inBear = false;
    this.lastAthWeek = 0;
    this.lastX = this.player.x;
    this.finishTimer = 0;
    this.sound.resetCoreRun();
  }

  toTitle() {
    this.state = 'title';
    this.rig.mode = 'attract';
    this.hud.show(false);
    this.reset();
  }

  setPaused(p: boolean) {
    if (p && this.state === 'playing') this.state = 'paused';
    else if (!p && this.state === 'paused') {
      this.state = 'playing';
      this.timer.update();
    } else return;
    this.onPauseChange(p);
  }

  private action(a: 'pause' | 'camera' | 'mute' | 'respawn') {
    if (a === 'pause') this.setPaused(this.state === 'playing');
    if (a === 'camera') this.toggleCamera();
    if (a === 'mute') this.toggleMute();
    if (a === 'respawn' && this.state === 'playing') this.marginCall(false);
  }

  toggleCamera() {
    if (this.rig.mode === 'chase') this.rig.mode = 'side';
    else if (this.rig.mode === 'side') this.rig.mode = 'chase';
    document.getElementById('btnCam')?.classList.toggle('active', this.rig.mode === 'side');
  }

  toggleMute() {
    this.sound.setMuted(!this.sound.muted);
    document.getElementById('btnMute')?.classList.toggle('off', this.sound.muted);
  }

  private resize() {
    const w = innerWidth;
    const h = innerHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.post.setSize(w, h);
    this.rig.resize(w, h);
    this.particles.resize(h);
    this.minimap.resize();
  }

  // ── main loop ───────────────────────────────────────────────────────────

  /**
   * Debug/testing hook: advance the simulation by `seconds` at a fixed 60 Hz
   * (works even when the tab is hidden and requestAnimationFrame is paused).
   */
  simulate(seconds: number) {
    const frames = Math.round(seconds * 60);
    for (let i = 0; i < frames; i++) this.tick(1 / 60, i === frames - 1);
  }

  private tick(fixedDt?: number, render = true) {
    this.timer.update();
    const dt = fixedDt ?? Math.min(this.timer.getDelta(), 1 / 20);
    this.frame++;
    shared.uTime.value += dt;

    if (this.state === 'playing' || this.state === 'finished') {
      this.acc += dt;
      while (this.acc >= STEP) {
        this.acc -= STEP;
        this.step(STEP);
      }
      if (this.state === 'playing') this.stats.time += dt;
    }

    const live = this.state !== 'title';
    const p = this.player;
    const px = live ? p.pos.x : this.rig.camera.position.x + 120;
    // animate pickups around whatever we're looking at
    const res = this.pickups.update(shared.uTime.value, dt, live ? p.pos : new THREE.Vector3(px, -1e5, 0));
    if (this.state === 'playing') this.collect(res);
    this.gates.update(px);

    this.atmosphere(dt, px);
    this.rig.update(dt, live ? p : null);
    this.sky.follow(this.rig.camera);
    this.trail(dt);
    this.particles.update(dt);
    this.spire.rotation.y += dt * 0.15;

    // post FX
    const sp = live ? p.speed : 0;
    const lens = this.post.lens.uniforms;
    lens.uTime.value = shared.uTime.value;
    lens.uSpeed.value = THREE.MathUtils.smoothstep(sp, 45, 120) * (this.rig.mode === 'chase' ? 1 : 0) + (p.boosting ? 0.25 : 0);
    lens.uDanger.value = live && p.mode === 'falling' ? 1 : 0;
    this.flash = Math.max(0, this.flash - dt * 2.5);
    lens.uFlash.value = this.flash * 0.35;
    lens.uFlashColor.value.copy(this.flashColor);
    shared.uSpeed.value = Math.min(1, sp / 100);
    shared.uPlayer.value.copy(live ? p.pos : new THREE.Vector3(0, -1e4, 0));

    if (live) {
      this.sound.update(sp, p.mode === 'ground', p.mode !== 'ground', p.boosting, shared.uBear.value);
      const week = this.market.xToWeek(Math.max(0, p.x));
      const i = this.market.idx(week);
      const price = p.x < 0 ? this.market.c[0] : this.market.priceAt(week);
      this.hud.telemetry({
        date: p.x < 0 ? new Date(Date.UTC(1993 + Math.floor(((p.x - this.course.xStart) / COURSE.prologue) * 6), 0, 1)) : this.market.dateOf(week),
        price,
        vsIpo: price / IPO_PRICE_ADJ - 1,
        drawdown: this.market.drawdown[i],
        speed: sp,
        energy: p.energy,
        boosting: p.boosting,
        preIpo: p.x < 0,
      });
      this.hud.stats(this.stats.cores, this.stats.products, this.pickups.products.length, this.stats.gates, this.gates.list.length, this.stats.time);
      if (this.frame % 3 === 0) this.minimap.draw(p.mode === 'ground' ? p.x : p.pos.x);
    }

    if (render && this.renderer.domElement.width > 0) this.post.render(dt);
  }

  private step(dt: number) {
    const p = this.player;
    const finished = this.state === 'finished';
    const ctl = finished || this.state !== 'playing' ? { throttle: 0, brake: 0, steer: 0, boost: false, jump: false } : this.input.read();
    const wasAir = p.mode !== 'ground';
    const ev = p.update(dt, ctl, finished);
    this.events(ev, wasAir);

    const x = p.mode === 'ground' ? p.x : p.pos.x;
    if (this.state === 'playing') {
      const crossed = this.gates.crossings(this.lastX, x);
      if (crossed.length) {
        this.stats.gates += crossed.length - 1;
        const g = crossed[crossed.length - 1];
        this.passGate(g.milestone, g.x);
      }
      this.stats.maxSpeed = Math.max(this.stats.maxSpeed, p.speed);
      if (x >= this.finishX && p.mode !== 'falling') this.finish();
    }
    if (finished) {
      this.finishTimer += dt;
      if (this.finishTimer > 0.25 && Math.random() < 0.08) this.firework();
    }
    this.lastX = Math.max(this.lastX, x);
  }

  private events(ev: PlayerEvents, wasAir: boolean) {
    const p = this.player;
    if (ev.jumped) this.sound.jump();
    if (ev.landed !== undefined && wasAir) {
      const air = p.airTime;
      if (ev.landed > 6) {
        this.sound.land(ev.landed);
        this.rig.addShake(Math.min(1.2, ev.landed / 30));
        const c = new THREE.Color(0.6, 1.4, 0.3);
        for (let i = 0; i < Math.min(60, ev.landed * 2); i++)
          this.particles.emit(
            p.pos.clone().setY(p.pos.y - 1),
            new THREE.Vector3((Math.random() - 0.5) * 14, Math.random() * 6, (Math.random() - 0.5) * 14),
            c,
            { life: 0.6, size: 0.8, drag: 3, gravity: 10 },
          );
      }
      if (!ev.bounced && air > 0.25) {
        this.stats.longestAir = Math.max(this.stats.longestAir, air);
        this.stats.airScore += air * GAME.airScorePerSec;
        if (air > 1.4 && this.state === 'playing') this.hud.banner(`${i18n.t('bigAir')} ${air.toFixed(1)}s`, `+${Math.round(air * GAME.airScorePerSec)}`, 'air');
      }
    }
    if (ev.fellOff && this.state === 'playing') this.marginCall(true);
  }

  private passGate(m: import('../data/history').Milestone, x: number) {
    this.stats.gates++;
    const price = x < 0 ? null : this.market.priceAt(this.market.xToWeek(x));
    this.hud.story(m, price);
    this.sound.gate(m.kind);
    this.flash = 1;
    this.flashColor.set(m.kind === 'crash' ? COLORS.red : m.kind === 'record' ? COLORS.gold : COLORS.green);
    const c = new THREE.Color(this.flashColor).multiplyScalar(1.6);
    const at = this.player.pos.clone();
    this.particles.burst(at.setY(at.y + 6), c, 80, 30, { life: 1.2, size: 1.4, gravity: 3 });
  }

  private collect(res: ReturnType<Pickups['update']>) {
    if (res.cores) {
      this.stats.cores += res.cores;
      this.player.energy = Math.min(100, this.player.energy + res.cores * GAME.coreEnergy);
      const c = new THREE.Color(0.7, 2.2, 0.2);
      for (const pos of res.corePositions) {
        this.particles.burst(pos, c, 14, 10, { life: 0.5, size: 0.7, gravity: 0 });
        this.sound.core();
      }
    }
    for (const pr of res.products) {
      this.stats.products++;
      this.player.energy = Math.min(100, this.player.energy + GAME.productEnergy);
      this.hud.toast(pr.product);
      this.sound.product();
      this.flash = 0.9;
      this.flashColor.set(COLORS.greenHot);
      this.particles.burst(pr.pos, new THREE.Color(0.8, 2.4, 0.3), 140, 34, { life: 1.3, size: 1.5, gravity: 4 });
      this.particles.burst(pr.pos, new THREE.Color(2, 2, 2), 40, 18, { life: 0.8, size: 1.0, gravity: 0 });
    }
  }

  private marginCall(fell: boolean) {
    const p = this.player;
    if (fell) {
      this.stats.marginCalls++;
      this.hud.banner(i18n.t('marginCall'), i18n.lang === 'ja' ? '直近のチェックポイントへ' : 'Back to last checkpoint', 'crash');
      this.sound.marginCall();
      this.flash = 1;
      this.flashColor.set(COLORS.red);
    }
    const x = this.gates.checkpointBefore(p.mode === 'ground' ? p.x : p.pos.x);
    p.reset(x, 12);
    this.lastX = Math.max(this.lastX, x);
    this.rig.snap(p);
    this.sound.resetCoreRun();
  }

  private finish() {
    this.state = 'finished';
    this.rig.mode = 'finish';
    this.sound.finish();
    this.flash = 1;
    this.flashColor.set(COLORS.gold);
    this.hud.banner(i18n.t('ath'), fmtPrice(this.market.h[this.market.n - 1]), 'record');
    setTimeout(() => this.onFinish(), 2600);
  }

  /** Final results for the finish screen. */
  results() {
    const s = this.stats;
    const ratio =
      (s.products / this.pickups.products.length) * 0.45 + (s.cores / this.pickups.coreCount) * 0.35 + (s.gates / this.gates.list.length) * 0.2;
    const score = Math.round(
      s.cores * GAME.coreScore + s.products * GAME.productScore + s.gates * GAME.gateScore + s.airScore - s.marginCalls * 250 + Math.max(0, 600 - s.time) * 5,
    );
    const grade = ratio > 0.85 && s.marginCalls === 0 ? 'S' : ratio > 0.7 ? 'A' : ratio > 0.5 ? 'B' : ratio > 0.3 ? 'C' : 'D';
    const last = this.market.c[this.market.n - 1];
    return {
      score,
      grade,
      invest: (1000 / IPO_PRICE_ADJ) * last,
      date: this.market.dateOf(this.market.n - 1),
      rows: [
        [i18n.t('time'), fmtTime(s.time)],
        [i18n.t('cores'), `${s.cores}/${this.pickups.coreCount}`],
        [i18n.t('products'), `${s.products}/${this.pickups.products.length}`],
        [i18n.t('milestones'), `${s.gates}/${this.gates.list.length}`],
        [i18n.t('maxSpeed'), `${Math.round(s.maxSpeed * 3.6)} km/h`],
        [i18n.t('airTime'), `${s.longestAir.toFixed(1)}s`],
        [i18n.t('marginCalls'), String(s.marginCalls)],
        [i18n.t('score'), score.toLocaleString('en-US')],
        ['vs IPO', fmtPct(last / IPO_PRICE_ADJ - 1)],
      ],
    };
  }

  // ── atmosphere & effects ────────────────────────────────────────────────

  private atmosphere(dt: number, x: number) {
    const week = this.market.xToWeek(Math.max(0, x));
    const i = this.market.idx(week);
    const dd = x < 0 ? 0 : this.market.drawdown[i];
    const bear = THREE.MathUtils.smoothstep(-dd, 0.2, 0.6);
    shared.uBear.value += (bear - shared.uBear.value) * (1 - Math.exp(-dt * 1.5));
    const fog = shared.uFogColor.value;
    fog.setRGB(0.012, 0.022, 0.018).lerp(new THREE.Color(0.035, 0.008, 0.011), shared.uBear.value);
    const sf = this.scene.fog as THREE.FogExp2;
    sf.color.copy(fog);
    sf.density = shared.uFogDensity.value;
    this.scene.background = fog;

    if (this.state !== 'playing') return;
    // regime banners
    if (!this.inBear && dd < -0.35) {
      this.inBear = true;
      this.hud.banner(i18n.t('bear'), `${fmtPct(dd)} ${i18n.lang === 'ja' ? '高値から' : 'from the high'}`, 'crash');
    } else if (this.inBear && dd > -0.12) {
      this.inBear = false;
    }
    if (x > 0 && this.market.isATH[i]) {
      if (i - this.lastAthWeek > 30) {
        this.hud.banner(i18n.t('ath'), fmtPrice(this.market.c[i]), 'record');
        this.sound.ath();
        this.flash = 0.7;
        this.flashColor.set(COLORS.gold);
      }
      this.lastAthWeek = i;
    }
  }

  private trail(dt: number) {
    if (this.state === 'title') return;
    const p = this.player;
    const sp = p.speed;
    const n = Math.floor((sp / 18 + (p.boosting ? 6 : 0)) * dt * 60);
    const back = p.vel.clone().normalize().multiplyScalar(-1);
    for (let i = 0; i < n; i++) {
      const pos = p.pos.clone().addScaledVector(back, 1.1).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8));
      const col = p.boosting ? new THREE.Color(1.2, 2.2, 0.8) : new THREE.Color(0.35, 1.0, 0.1);
      this.particles.emit(pos, back.clone().multiplyScalar(4 + Math.random() * 6), col, {
        life: p.boosting ? 0.7 : 0.45,
        size: p.boosting ? 1.3 : 0.6,
        drag: 2,
      });
    }
  }

  private firework() {
    const base = this.spire.position;
    const pos = new THREE.Vector3(base.x + (Math.random() - 0.5) * 120, base.y + 50 + Math.random() * 50, (Math.random() - 0.5) * 120);
    const palette = [COLORS.green, COLORS.gold, COLORS.cyan, COLORS.greenHot];
    const c = new THREE.Color(palette[Math.floor(Math.random() * palette.length)]).multiplyScalar(2);
    this.particles.burst(pos, c, 120, 40, { life: 1.6, size: 2.6, gravity: 8 });
  }
}
