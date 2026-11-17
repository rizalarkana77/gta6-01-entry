// SOLMAR HEAT — keyboard + mouse input.
// The browser side listens to DOM events; the game logic only ever sees the
// plain snapshot object this class hands out, so the same world code can run
// headless in Node with a hand-built snapshot.

export class Input {
  constructor() {
    this.keys = new Set(); // codes currently held down
    this.pressed = new Set(); // codes pressed since the last snapshot
    this.mouseX = 0; // mouse position in canvas pixels
    this.mouseY = 0;
    this.mouseDown = false;
    this.clicked = false; // a fresh mouse press since the last snapshot
    this._element = null;
  }

  attach(element) {
    this._element = element;
    const onKeyDown = (event) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        event.preventDefault();
      }
      if (!event.repeat) this.pressed.add(event.code);
      this.keys.add(event.code);
    };
    const onKeyUp = (event) => this.keys.delete(event.code);
    const onMouseMove = (event) => {
      const rect = element.getBoundingClientRect();
      this.mouseX = ((event.clientX - rect.left) / rect.width) * element.width;
      this.mouseY = ((event.clientY - rect.top) / rect.height) * element.height;
    };
    const onMouseDown = (event) => {
      onMouseMove(event);
      this.mouseDown = true;
      this.clicked = true;
    };
    const onMouseUp = () => {
      this.mouseDown = false;
    };
    const onBlur = () => {
      this.keys.clear();
      this.mouseDown = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    element.addEventListener('mousemove', onMouseMove);
    element.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', onBlur);
  }

  // Headless helpers: drive the same state without a DOM.
  setKey(code, down) {
    if (down) {
      if (!this.keys.has(code)) this.pressed.add(code);
      this.keys.add(code);
    } else {
      this.keys.delete(code);
    }
  }

  setMouse(x, y) {
    this.mouseX = x;
    this.mouseY = y;
  }

  // Build the plain snapshot the world step consumes, then clear the
  // edge-triggered flags so a press only fires once. The snapshot carries
  // its own copy of the pressed set, so the caller can still react to
  // one-shot keys (Enter, P, S, ...) after this call.
  snapshot() {
    const snap = {
      up: this.keys.has('KeyW') || this.keys.has('ArrowUp'),
      down: this.keys.has('KeyS') || this.keys.has('ArrowDown'),
      left: this.keys.has('KeyA') || this.keys.has('ArrowLeft'),
      right: this.keys.has('KeyD') || this.keys.has('ArrowRight'),
      run: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      interact: this.pressed.has('KeyE'),
      punch: this.pressed.has('Space'),
      shoot: this.clicked,
      shootHeld: this.mouseDown,
      aimX: this.mouseX,
      aimY: this.mouseY,
      pressed: new Set(this.pressed),
    };
    this.pressed.clear();
    this.clicked = false;
    return snap;
  }
}
