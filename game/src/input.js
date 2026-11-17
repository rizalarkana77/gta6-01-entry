// SOLMAR HEAT — keyboard and mouse. One job: turn browser events into a
// plain input object the world can step with, in the browser or in a test.
export function createInput() {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    run: false,
    act: false, // E pressed this frame (edge)
    punch: false, // Space pressed this frame (edge)
    shoot: false, // mouse click this frame (edge)
    pause: false, // P pressed this frame (edge)
    save: false, // S pressed this frame (edge)
    mute: false, // M pressed this frame (edge)
    anyKey: false, // any key pressed this frame (edge)
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
  };
}

// Wire DOM events into the input object. Returns a detach function.
export function attachInput(input, canvas) {
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
  };
  const EDGE = { KeyE: 'act', Space: 'punch', KeyP: 'pause', KeyS: 'save', KeyM: 'mute' };

  function onKeyDown(e) {
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') e.preventDefault();
    const held = KEYMAP[e.code];
    if (held) input[held] = true;
    const edge = EDGE[e.code];
    if (edge && !e.repeat) input[edge] = true;
    input.anyKey = true;
  }
  function onKeyUp(e) {
    const held = KEYMAP[e.code];
    if (held) input[held] = false;
  }
  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  }
  function onMouseDown(e) {
    onMouseMove(e);
    input.mouseDown = true;
    if (e.button === 0) input.shoot = true;
  }
  function onMouseUp() {
    input.mouseDown = false;
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
  };
}

// Clear every edge flag after a frame has consumed the input.
export function clearEdges(input) {
  input.act = false;
  input.punch = false;
  input.shoot = false;
  input.pause = false;
  input.save = false;
  input.mute = false;
  input.anyKey = false;
}
