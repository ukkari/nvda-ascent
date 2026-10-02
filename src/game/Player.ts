import * as THREE from 'three';
import { COURSE, PHYS } from '../config';
import type { Course } from '../world/Course';
import type { Controls } from './Input';

export type PlayerMode = 'ground' | 'air' | 'falling';

export interface PlayerEvents {
  launched?: boolean;
  jumped?: boolean;
  landed?: number; // impact speed
  bounced?: boolean;
  fellOff?: boolean;
}

/**
 * The rolling "tensor core" orb.
 *
 * Grounded motion is integrated along the course profile (1-D arc + lateral
 * offset), so it can never tunnel through the surface. When the centripetal
 * acceleration a crest demands exceeds gravity's normal component the ball
 * launches into full 3-D ballistic flight, then re-attaches on landing with
 * its velocity projected onto the slope (hard landings bounce).
 */
export class Player {
  readonly object = new THREE.Group();
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  mode: PlayerMode = 'ground';
  /** contact x along the course while grounded */
  x = 0;
  /** signed tangential speed while grounded */
  v = 0;
  z = 0;
  vz = 0;
  energy = 60;
  boosting = false;
  airTime = 0;
  fallTime = 0;
  /** world-space angular velocity used for the rolling visual */
  private omega = new THREE.Vector3();
  private light: THREE.PointLight;
  private visual: THREE.Object3D;
  private tmpN = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();

  constructor(
    private course: Course,
    model: THREE.Object3D,
  ) {
    this.visual = model.clone(true);
    this.visual.scale.setScalar(PHYS.radius);
    this.object.add(this.visual);
    this.light = new THREE.PointLight(0x8dff2a, 40, 40, 1.6);
    this.object.add(this.light);
  }

  get speed(): number {
    return this.mode === 'ground' ? Math.abs(this.v) : this.vel.length();
  }

  reset(x: number, speed = 0) {
    this.mode = 'ground';
    this.x = x;
    this.v = speed;
    this.z = 0;
    this.vz = 0;
    this.airTime = 0;
    this.fallTime = 0;
    this.omega.set(0, 0, 0);
    this.syncGround();
  }

  private syncGround() {
    const s = this.course.slope(this.x);
    const c = 1 / Math.sqrt(1 + s * s);
    const sn = s * c;
    const R = PHYS.radius;
    this.pos.set(this.x - sn * R, this.course.height(this.x) + c * R, this.z);
    this.vel.set(this.v * c, this.v * sn, this.vz);
  }

  update(dt: number, ctl: Controls, autopilot = false): PlayerEvents {
    const ev: PlayerEvents = {};
    const g = PHYS.gravity;
    const hw = COURSE.halfWidth;

    // boost energy
    this.boosting = ctl.boost && this.energy > 0 && this.mode !== 'falling';
    if (this.boosting) this.energy = Math.max(0, this.energy - PHYS.boostDrain * dt);

    if (this.mode === 'ground') {
      const s = this.course.slope(this.x);
      const c = 1 / Math.sqrt(1 + s * s);
      const sn = s * c;
      let a = -g * sn;
      if (ctl.throttle > 0) a += PHYS.engine * ctl.throttle * Math.max(0, 1 - this.v / PHYS.engineTopSpeed);
      if (this.boosting) a += PHYS.boost * Math.max(0, 1 - this.v / PHYS.boostTopSpeed);
      if (ctl.brake > 0) a -= Math.sign(this.v || 1) * PHYS.brake * ctl.brake * (Math.abs(this.v) < 2 ? 0.4 : 1);
      if (autopilot) a -= Math.sign(this.v) * Math.min(Math.abs(this.v) * 1.5, 30);
      a -= PHYS.drag * this.v * Math.abs(this.v);
      a -= PHYS.rolling * Math.sign(this.v);
      this.v = THREE.MathUtils.clamp(this.v + a * dt, -PHYS.maxSpeed, PHYS.maxSpeed);
      if (Math.abs(this.v) < 0.05 && ctl.throttle === 0 && Math.abs(s) < 0.02) this.v = 0;

      // advance along the profile (sub-step so steep bits stay accurate)
      const steps = Math.max(1, Math.ceil(Math.abs(this.v * dt) / 1.5));
      for (let i = 0; i < steps; i++) {
        const si = this.course.slope(this.x);
        this.x += (this.v * dt) / steps / Math.sqrt(1 + si * si);
      }
      this.x = THREE.MathUtils.clamp(this.x, this.course.xStart + 2, this.course.xEnd - 4);

      // steering
      const steerGain = PHYS.steer * (0.55 + 0.45 * Math.min(1, Math.abs(this.v) / 40));
      this.vz += (ctl.steer * steerGain - this.vz) * Math.min(1, dt * 7);
      this.z += this.vz * dt;

      this.syncGround();

      // crest launch: needed centripetal accel v²κ vs gravity's normal component
      const k = this.course.curvature(this.x);
      const s2 = this.course.slope(this.x);
      const c2 = 1 / Math.sqrt(1 + s2 * s2);
      const launch = k < 0 && this.v * this.v * -k > g * c2 * PHYS.launchMargin && Math.abs(this.v) > 12;
      if (ctl.jump) {
        this.course.normal(this.x, this.tmpN);
        this.vel.addScaledVector(this.tmpN, PHYS.jump);
        this.mode = 'air';
        this.airTime = 0;
        ev.jumped = true;
      } else if (launch) {
        this.mode = 'air';
        this.airTime = 0;
        ev.launched = true;
      }
      if (Math.abs(this.z) > hw + 0.3) {
        // rolled off the edge
        this.mode = 'air';
        this.airTime = 0;
      }
    } else {
      // ── airborne / falling ──
      this.airTime += dt;
      this.vel.y -= g * dt;
      this.vel.x += ctl.throttle * PHYS.airThrust * dt + (this.boosting ? PHYS.boost * 0.5 * dt : 0);
      if (ctl.brake) this.vel.x -= PHYS.airThrust * dt;
      if (Math.abs(this.z) <= hw) this.vel.z += (ctl.steer * PHYS.airSteer * 2 - this.vel.z * 0.6) * dt;
      this.vel.multiplyScalar(1 - 0.0006 * this.vel.length() * dt);
      this.pos.addScaledVector(this.vel, dt);
      this.z = this.pos.z;
      this.pos.x = THREE.MathUtils.clamp(this.pos.x, this.course.xStart + 2, this.course.xEnd - 4);

      const R = PHYS.radius;
      if (Math.abs(this.pos.z) <= hw + 0.2 && this.mode === 'air') {
        const s = this.course.slope(this.pos.x);
        const c = 1 / Math.sqrt(1 + s * s);
        const sn = s * c;
        const ground = this.course.height(this.pos.x);
        const gap = (this.pos.y - ground) * c; // distance to surface along normal
        if (gap <= R) {
          // contact
          const nx = -sn;
          const ny = c;
          const vn = this.vel.x * nx + this.vel.y * ny;
          const vt = this.vel.x * c + this.vel.y * sn;
          if (vn >= 0 && this.airTime < 0.12) {
            // just left a crest and still skimming the surface — keep flying
            this.pos.y = ground + R / c;
          } else if (-vn > PHYS.bounceImpact) {
            this.x = this.pos.x + sn * R;
            // bounce: reflect normal component with restitution
            this.vel.x = vt * c + nx * -vn * PHYS.restitution;
            this.vel.y = vt * sn + ny * -vn * PHYS.restitution;
            this.pos.y = ground + R / c + 0.05;
            ev.bounced = true;
            ev.landed = -vn;
          } else {
            this.x = this.pos.x + sn * R;
            this.mode = 'ground';
            this.v = vt;
            this.vz = this.vel.z;
            ev.landed = Math.max(0, -vn);
            this.syncGround();
          }
        }
      } else if (this.mode === 'air' && this.pos.y < this.course.height(this.pos.x) - 2) {
        this.mode = 'falling';
        this.fallTime = 0;
      }
      if (this.mode === 'falling') {
        this.fallTime += dt;
        if (this.fallTime > 1.6) ev.fellOff = true;
      }
    }

    // energy trickles back while grounded and cruising
    if (!this.boosting && this.mode === 'ground') this.energy = Math.min(100, this.energy + dt * 2.5);

    this.updateVisual(dt);
    return ev;
  }

  private updateVisual(dt: number) {
    this.object.position.copy(this.pos);
    if (this.mode === 'ground') {
      // ω = n × v / R  (rolling without slipping)
      this.course.normal(this.x, this.tmpN);
      this.omega.crossVectors(this.tmpN, this.vel).multiplyScalar(1 / PHYS.radius);
    } else {
      this.omega.multiplyScalar(1 - dt * 0.15);
    }
    const w = this.omega.length();
    if (w > 1e-4) {
      this.tmpQ.setFromAxisAngle(this.tmpN.copy(this.omega).divideScalar(w), w * dt);
      this.visual.quaternion.premultiply(this.tmpQ);
    }
    const sp = Math.min(1, this.speed / 90);
    this.light.intensity = 25 + sp * 90 + (this.boosting ? 120 : 0);
    this.light.distance = 30 + sp * 25;
  }
}
