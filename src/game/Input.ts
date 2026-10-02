/** Keyboard + touch input, normalised into a small control state. */
export interface Controls {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1 (left) .. +1 (right)
  boost: boolean;
  jump: boolean; // edge-triggered
}

export class Input {
  private keys = new Set<string>();
  private jumpQueued = false;
  private touch = { left: false, right: false, boost: false, brake: false };
  readonly isTouch = matchMedia('(pointer: coarse)').matches;
  /** handlers for one-shot actions */
  onAction: (a: 'pause' | 'camera' | 'mute' | 'respawn') => void = () => {};

  constructor() {
    addEventListener('keydown', (e) => {
      if (e.repeat && (e.code === 'Space' || e.code === 'KeyP' || e.code === 'Escape')) return;
      this.keys.add(e.code);
      if (e.code === 'Space') this.jumpQueued = true;
      if (e.code === 'Escape' || e.code === 'KeyP') this.onAction('pause');
      if (e.code === 'KeyC') this.onAction('camera');
      if (e.code === 'KeyM') this.onAction('mute');
      if (e.code === 'KeyR') this.onAction('respawn');
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  /** Wire the on-screen touch pad (buttons carry data-touch attributes). */
  bindTouch(root: HTMLElement) {
    root.querySelectorAll<HTMLElement>('[data-touch]').forEach((el) => {
      const k = el.dataset.touch as keyof typeof this.touch | 'jump';
      const on = (e: Event) => {
        e.preventDefault();
        el.classList.add('on');
        if (k === 'jump') this.jumpQueued = true;
        else this.touch[k] = true;
      };
      const off = (e: Event) => {
        e.preventDefault();
        el.classList.remove('on');
        if (k !== 'jump') this.touch[k] = false;
      };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    });
  }

  private has(...codes: string[]) {
    return codes.some((c) => this.keys.has(c));
  }

  read(): Controls {
    const left = this.has('KeyA', 'ArrowLeft') || this.touch.left;
    const right = this.has('KeyD', 'ArrowRight') || this.touch.right;
    const brake = this.has('KeyS', 'ArrowDown') || this.touch.brake;
    // touch devices auto-accelerate; keyboard players hold W / ↑
    const throttle = this.has('KeyW', 'ArrowUp') || (this.isTouch && !brake);
    const c: Controls = {
      throttle: throttle ? 1 : 0,
      brake: brake ? 1 : 0,
      steer: (right ? 1 : 0) - (left ? 1 : 0),
      boost: this.has('ShiftLeft', 'ShiftRight') || this.touch.boost,
      jump: this.jumpQueued,
    };
    this.jumpQueued = false;
    return c;
  }
}
