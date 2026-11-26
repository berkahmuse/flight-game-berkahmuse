// Island Hopper — keyboard and mouse. Arrow keys / WASD fly the plane, F flaps,
// G gear, Space brakes, P pause, M mute, Enter confirms. The mouse clicks the
// title buttons and drags the throttle lever. No DOM reads outside this file.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;

const KEYMAP = {
  ArrowUp: 'pitchUp', KeyW: 'pitchUp',
  ArrowDown: 'pitchDown', KeyS: 'pitchDown',
  ArrowRight: 'throttleUp', KeyD: 'throttleUp',
  ArrowLeft: 'throttleDown', KeyA: 'throttleDown',
  Space: 'brakes',
};

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let throttle = 0;
  let throttleDrag = false;
  let mouse = { x: 0, y: 0, clicked: false };

  function onKeyDown(event) {
    if (event.code === 'Enter' || event.code === 'NumpadEnter') actions |= ACTION_CONFIRM;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyR') actions |= ACTION_RESTART;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
    else if (event.code === 'KeyF') actions |= 16; // flaps toggle, consumed below
    else if (event.code === 'KeyG') actions |= 32; // gear toggle, consumed below
    if (KEYMAP[event.code]) {
      keys.add(event.code);
      event.preventDefault();
    }
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onPointerDown(event) {
    const rect = canvas.getBoundingClientRect();
    mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top, clicked: true };
    // The throttle lever lives at the bottom-right of the HUD; grabbing it drags.
    const sx = (mouse.x / rect.width) * canvas.width;
    const sy = (mouse.y / rect.height) * canvas.height;
    if (sx > canvas.width - 150 && sy > canvas.height - 190) throttleDrag = true;
  }
  function onPointerMove(event) {
    if (!throttleDrag) return;
    const rect = canvas.getBoundingClientRect();
    const sy = ((event.clientY - rect.top) / rect.height) * canvas.height;
    throttle = Math.max(0, Math.min(1, 1 - (sy - (canvas.height - 170)) / 130));
  }
  function onPointerUp() {
    throttleDrag = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  return {
    /** Pitch -1..1 and throttle 0..1 from the keys, or the dragged lever. */
    control(dt) {
      let pitch = 0;
      if (keys.has('ArrowUp') || keys.has('KeyW')) pitch += 1;
      if (keys.has('ArrowDown') || keys.has('KeyS')) pitch -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD')) throttle = Math.min(1, throttle + dt * 0.9);
      if (keys.has('ArrowLeft') || keys.has('KeyA')) throttle = Math.max(0, throttle - dt * 0.9);
      return {
        pitch,
        throttle,
        brakes: keys.has('Space'),
        flaps: this.flaps,
        gear: this.gear,
      };
    },
    flaps: false,
    gear: true,
    takeActions() {
      const taken = actions;
      if (taken & 16) this.flaps = !this.flaps;
      if (taken & 32) this.gear = !this.gear;
      actions = 0;
      return taken & (ACTION_CONFIRM | ACTION_PAUSE | ACTION_RESTART | ACTION_MUTE);
    },
    takeClick() {
      const click = mouse.clicked;
      mouse.clicked = false;
      return click ? { x: mouse.x, y: mouse.y } : null;
    },
    setThrottle(value) {
      throttle = Math.max(0, Math.min(1, value));
    },
    get throttle() {
      return throttle;
    },
  };
}
