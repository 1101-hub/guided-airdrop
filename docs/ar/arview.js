/* ===========================================================================
   arview.js — the AR shell. Camera passthrough behind a transparent WebGL
   canvas, with the three.js camera driven by the phone's tilt sensors.

   There is no plane detection here and that is deliberate: iOS Safari has no
   WebXR, so anything that depends on it would work for some judges and not
   others. Instead the floor is assumed to sit EYE_HEIGHT below the phone,
   which is accurate enough for a twenty-second demo and starts instantly on
   every phone.

   Nothing in here is allowed to dead-end. No camera, no sensors, permission
   denied, ancient browser — each degrades to something that still runs, and
   `view.mode` says which path was taken.
   =========================================================================== */
import * as THREE from './vendor/three.module.min.js';

export const MODE = {
  FULL:   'full',    // camera + tilt: real AR
  NOCAM:  'nocam',   // tilt only, drawn on a flat background
  DRAG:   'drag',    // no sensors: finger-drag to look around
};

const RAD = Math.PI / 180;

/* ---------------------------------------------------------------------------
   Device orientation -> camera quaternion.

   This is the conversion from three.js's old DeviceOrientationControls. The
   sensor frame and the WebGL frame differ by a -90 degree rotation about X
   (q1), and the screen may itself be rotated (q0), so both corrections are
   applied after the raw Euler angles.
   --------------------------------------------------------------------------- */
const zee = new THREE.Vector3(0, 0, 1);
const euler = new THREE.Euler();
const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

function quatFromDevice(out, alpha, beta, gamma, screenAngle) {
  euler.set(beta, alpha, -gamma, 'YXZ');
  out.setFromEuler(euler);
  out.multiply(q1);
  out.multiply(q0.setFromAxisAngle(zee, -screenAngle));
}

export class ARView {
  constructor({
    canvas, video,
    fov = 62,            // rough match for a phone's rear camera, vertical
    eyeHeight = 1.5,     // how high the phone is held; floor sits at y = 0
    smoothing = 0.28,    // slerp factor per frame; lower is calmer, laggier
  } = {}) {
    this.canvasEl = canvas;
    this.videoEl = video;
    this.eyeHeight = eyeHeight;
    this.smoothing = smoothing;
    this.mode = null;
    this.running = false;

    this.renderer = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: true, powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(fov, 1, 0.01, 200);
    this.camera.position.set(0, eyeHeight, 0);

    /* The world is parented to a yaw pivot so that "straight ahead when you
       pressed start" becomes the scene's forward direction. Using a relative
       heading avoids the compass entirely, which is the single least reliable
       sensor on a phone. */
    this.world = new THREE.Group();
    this.scene.add(this.world);

    this._q = new THREE.Quaternion();       // smoothed, applied to the camera
    this._qTarget = new THREE.Quaternion(); // raw from the sensors
    this._haveOrientation = false;
    this._alphaOffset = null;
    this._screenAngle = 0;
    this._drag = { on: false, x: 0, y: 0, yaw: 0, pitch: 0 };
    this._frameCbs = [];
    this._clock = new THREE.Clock();

    this._onResize = this._onResize.bind(this);
    this._onOrient = this._onOrient.bind(this);
    this._loop = this._loop.bind(this);
  }

  /* ---- permissions and start ------------------------------------------- */

  /** Must be called from inside a user gesture: both iOS permission prompts
      and camera capture refuse to run otherwise. */
  async start() {
    const cam = await this._startCamera();
    const orient = await this._startOrientation();

    this.mode = cam && orient ? MODE.FULL
              : orient        ? MODE.NOCAM
              :                 MODE.DRAG;
    if (this.mode === MODE.DRAG) this._enableDrag();

    addEventListener('resize', this._onResize);
    addEventListener('orientationchange', this._onResize);
    this._onResize();

    this.running = true;
    this._clock.start();
    this.renderer.setAnimationLoop(this._loop);
    return this.mode;
  }

  async _startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' },
                 width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      this.videoEl.srcObject = stream;
      this.videoEl.setAttribute('playsinline', '');   // iOS: do not go fullscreen
      this.videoEl.muted = true;
      await this.videoEl.play();
      this.stream = stream;
      return true;
    } catch (e) {
      this.cameraError = e?.name || String(e);
      return false;
    }
  }

  async _startOrientation() {
    if (typeof DeviceOrientationEvent === 'undefined') return false;
    // iOS 13+ gates the sensors behind an explicit prompt; Android does not.
    const req = DeviceOrientationEvent.requestPermission;
    if (typeof req === 'function') {
      try {
        if (await req.call(DeviceOrientationEvent) !== 'granted') {
          this.orientError = 'denied';
          return false;
        }
      } catch (e) {
        this.orientError = e?.name || String(e);
        return false;
      }
    }
    addEventListener('deviceorientation', this._onOrient);

    // Some browsers expose the event but never fire it. Wait briefly and see.
    const fired = await new Promise(res => {
      const t = setTimeout(() => res(this._haveOrientation), 700);
      const check = () => { if (this._haveOrientation) { clearTimeout(t); res(true); } };
      const iv = setInterval(check, 60);
      setTimeout(() => clearInterval(iv), 760);
    });
    if (!fired) {
      removeEventListener('deviceorientation', this._onOrient);
      this.orientError = 'no events';
    }
    return fired;
  }

  _onOrient(e) {
    if (e.alpha == null && e.beta == null && e.gamma == null) return;
    this._haveOrientation = true;
    const alpha = (e.alpha || 0) * RAD;
    if (this._alphaOffset == null) this._alphaOffset = alpha;  // face the scene
    this._screenAngle = (screen.orientation?.angle ?? window.orientation ?? 0) * RAD;
    quatFromDevice(this._qTarget, alpha - this._alphaOffset,
                   (e.beta || 0) * RAD, (e.gamma || 0) * RAD, this._screenAngle);
  }

  /** Re-anchor the scene to wherever the phone is pointing right now. The
      sensor path re-zeroes on the next orientation event; the drag fallback
      has no heading to re-zero, so its accumulated angles are cleared. */
  recentre() {
    this._alphaOffset = null;
    this._drag.yaw = 0;
    this._drag.pitch = 0;
  }

  /* ---- finger-drag fallback --------------------------------------------- */

  _enableDrag() {
    const el = this.canvasEl;
    const pos = t => ({ x: t.clientX, y: t.clientY });
    const down = e => {
      const t = e.touches ? e.touches[0] : e;
      const p = pos(t); this._drag.on = true; this._drag.x = p.x; this._drag.y = p.y;
    };
    const move = e => {
      if (!this._drag.on) return;
      const t = e.touches ? e.touches[0] : e;
      const p = pos(t);
      this._drag.yaw -= (p.x - this._drag.x) * 0.005;
      this._drag.pitch -= (p.y - this._drag.y) * 0.005;
      this._drag.pitch = Math.max(-1.3, Math.min(1.3, this._drag.pitch));
      this._drag.x = p.x; this._drag.y = p.y;
      e.preventDefault();
    };
    const up = () => { this._drag.on = false; };
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', up);
    el.addEventListener('mousedown', down);
    addEventListener('mousemove', move);
    addEventListener('mouseup', up);
  }

  /* ---- loop -------------------------------------------------------------- */

  onFrame(cb) { this._frameCbs.push(cb); return this; }

  _onResize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _loop() {
    const dt = Math.min(this._clock.getDelta(), 0.1);

    if (this.mode === MODE.DRAG) {
      this._q.setFromEuler(new THREE.Euler(this._drag.pitch, this._drag.yaw, 0, 'YXZ'));
      this.camera.quaternion.copy(this._q);
    } else {
      // Slerp rather than snap: raw sensor output jitters by a degree or two
      // and a hard copy makes the whole scene shimmer.
      this._q.slerp(this._qTarget, this.smoothing);
      this.camera.quaternion.copy(this._q);
    }
    this.camera.position.set(0, this.eyeHeight, 0);

    /* Bring the camera matrices up to date before the callbacks rather than
       leaving it to render(). Anything that projects a world point to the
       screen during a callback would otherwise be working from last frame's
       pose, which shows up as an on-screen marker lagging the view. */
    this.camera.updateMatrixWorld(true);
    this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();

    for (const cb of this._frameCbs) cb(dt, this);
    this.renderer.render(this.scene, this.camera);
  }

  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
    removeEventListener('resize', this._onResize);
    removeEventListener('orientationchange', this._onResize);
    removeEventListener('deviceorientation', this._onOrient);
    this.stream?.getTracks().forEach(t => t.stop());
  }
}
