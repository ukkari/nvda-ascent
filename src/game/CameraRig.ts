import * as THREE from 'three';
import type { Course } from '../world/Course';
import type { Player } from './Player';

export type CamMode = 'chase' | 'side' | 'attract' | 'finish';

/**
 * Critically-damped follow camera with look-ahead pitch so steep climbs and
 * cliff-like crashes are framed before you reach them.
 *  - chase  : behind & slightly right of the ball
 *  - side   : classic chart view — reveals that the road *is* the price chart
 *  - attract: title-screen flyover of the whole history
 *  - finish : slow orbit around the summit
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  mode: CamMode = 'attract';
  private look = new THREE.Vector3();
  private desired = new THREE.Vector3();
  private desiredLook = new THREE.Vector3();
  private shake = 0;
  private attractX = 0;
  private t = 0;
  private fov = 62;

  constructor(private course: Course) {
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 12000);
    this.attractX = course.xStart;
  }

  addShake(amount: number) {
    this.shake = Math.min(1.5, this.shake + amount);
  }

  snap(player: Player) {
    this.compute(player, 0);
    this.camera.position.copy(this.desired);
    this.look.copy(this.desiredLook);
    this.camera.lookAt(this.look);
  }

  private compute(player: Player | null, dt: number) {
    const c = this.course;
    if (this.mode === 'attract' || !player) {
      // cruise along the course at a high three-quarter angle
      this.attractX += dt * 140;
      if (this.attractX > c.xEnd) this.attractX = c.xStart;
      const x = this.attractX;
      const ahead = x + 140;
      const h = Math.max(c.height(x), c.height(ahead) - 40);
      this.desired.set(x - 40, h + 70 + Math.sin(this.t * 0.2) * 15, 120 + Math.sin(this.t * 0.13) * 40);
      this.desiredLook.set(ahead, c.height(ahead) + 5, -10);
      return;
    }
    const p = player.pos;
    if (this.mode === 'finish') {
      const a = this.t * 0.25;
      this.desired.set(p.x + Math.cos(a) * 60, p.y + 28, Math.sin(a) * 60);
      this.desiredLook.set(p.x + 40, p.y + 14, 0);
      return;
    }
    if (this.mode === 'side') {
      this.desired.set(p.x + 60, p.y + 25, 230);
      this.desiredLook.set(p.x + 60, p.y, 0);
      return;
    }
    // chase
    const sp = player.speed;
    const lookAheadX = p.x + 25 + sp * 0.35;
    const pitch = Math.atan2(c.height(lookAheadX) - c.height(p.x - 4), lookAheadX - p.x + 4);
    const pitchC = THREE.MathUtils.clamp(pitch, -0.9, 0.9);
    const dist = 15 + sp * 0.06;
    const fx = Math.cos(pitchC);
    const fy = Math.sin(pitchC);
    const falling = player.mode === 'falling';
    this.desired.set(p.x - fx * dist, p.y - fy * dist + 5.5 + (falling ? 8 : 0), p.z * 0.55 + 4.5);
    // keep the camera above the road surface
    const ground = c.height(this.desired.x) + 2.5;
    if (this.desired.y < ground) this.desired.y = ground;
    this.desiredLook.set(p.x + fx * 14, p.y + fy * 14 + 1.5, p.z * 0.75);
    if (falling) this.desiredLook.copy(p);
  }

  update(dt: number, player: Player | null) {
    this.t += dt;
    this.compute(player, dt);
    const stiff = this.mode === 'chase' ? 5.5 : this.mode === 'attract' ? 1.6 : 2.4;
    const k = 1 - Math.exp(-dt * stiff);
    this.camera.position.lerp(this.desired, k);
    this.look.lerp(this.desiredLook, 1 - Math.exp(-dt * stiff * 1.6));
    this.camera.lookAt(this.look);

    if (this.shake > 0) {
      const s = this.shake * this.shake * 0.6;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 2.2);
    }

    // speed-reactive field of view
    const sp = player && this.mode === 'chase' ? player.speed : 0;
    const boost = player?.boosting ? 6 : 0;
    const target = this.mode === 'side' ? 50 : 60 + Math.min(20, sp * 0.16) + boost;
    this.fov += (target - this.fov) * (1 - Math.exp(-dt * 3));
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
