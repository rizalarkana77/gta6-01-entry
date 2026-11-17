// SOLMAR HEAT — keyboard + mouse input.
// Keeps a live picture of what the player is holding and reports edge
// presses (E to enter/exit a car, Space to punch, clicks to shoot) exactly
// once, so the world step can consume them in a single frame.

const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  KeyE: 'action',
  Space: 'punch',
  KeyP: 'pause',
  KeyM: 'mute',
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set(); // edges, consumed once per frame
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  function onKeyDown(e) {
    const name = KEYMAP[e.code];
    if (!name) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!held.has(name)) pressed.add(name);
    held.add(name);
  }
  function onKeyUp(e) {
    const name = KEYMAP[e.code];
    if (name) held.delete(name);
  }
  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  }
  function onMouseDown(e) {
    if (e.button !== 0) return;
    onMouseMove(e);
    mouse.down = true;
    mouse.clicked = true;
  }
  function onMouseUp(e) {
    if (e.button === 0) mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    held,
    pressed,
    mouse,
    // Snapshot the held keys into the plain object world.step() consumes.
    snapshot() {
      return {
        up: held.has('up'),
        down: held.has('down'),
        left: held.has('left'),
        right: held.has('right'),
        run: held.has('run'),
        action: pressed.has('action'),
        punch: pressed.has('punch'),
        pause: pressed.has('pause'),
        mute: pressed.has('mute'),
        shoot: mouse.down,
        shootPressed: mouse.clicked,
        mouseX: mouse.x,
        mouseY: mouse.y,
      };
    },
    // Clear edge presses after the frame consumed them.
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    },
  };
}

// A blank input snapshot for headless tests and for frames with no input.
export function blankInput() {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    run: false,
    action: false,
    punch: false,
    pause: false,
    mute: false,
    shoot: false,
    shootPressed: false,
    mouseX: 0,
    mouseY: 0,
  };
}
