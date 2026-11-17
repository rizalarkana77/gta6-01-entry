// Keyboard + mouse input. Tracks held keys, pressed edges (one-shot) and the
// mouse position / buttons in canvas coordinates. Nothing here knows about
// the game: it only reports what the player did.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false, worldX: 0, worldY: 0 };

  function code(e) {
    return e.code;
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
  });

  function toCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * canvas.width,
      y: ((e.clientY - r.top) / r.height) * canvas.height,
    };
  }
  canvas.addEventListener('mousemove', (e) => {
    const p = toCanvas(e);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  canvas.addEventListener('mousedown', (e) => {
    const p = toCanvas(e);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.down = true;
    mouse.clicked = true;
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    keys,
    mouse,
    // True while the key is held.
    held(...codes) {
      return codes.some((c) => keys.has(c));
    },
    // True only on the frame the key went down. Consumed by endFrame().
    wasPressed(...codes) {
      return codes.some((c) => pressed.has(c));
    },
    // True only on the frame the mouse was clicked.
    wasClicked() {
      return mouse.clicked;
    },
    // Call once per frame, after the game has read the edges.
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
  };
}
