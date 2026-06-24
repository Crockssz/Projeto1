/* ─────────────────────────────────────────────────
   PIXLR — sketch.js (CORRIGIDO)
   p5.js instance-mode canvas with interactive effects
   ───────────────────────────────────────────────── */

let pixlrSketch;

// Shared state (written by app.js, read here)
window.PIXLR = {
  loadedImage: null,
  effect: 'none',
  intensity: 50,
  threshold: 128,
  scale: 8,
  mouseFx: true,
  frozen: false,
  resetFlag: false,
  frameCount: 0,
  fps: 0,
  pixelCount: 0,
  probePixel: { r: 0, g: 0, b: 0, a: 255 },
  histData: null,
};

pixlrSketch = new p5(function(p) {

  let img = null;
  let origPixels = null;
  let workPixels = null;
  let w = 0, h = 0;
  let scrollMult = 1.0;
  let isDragging = false;
  let lastFpsTime = 0;
  let frameCounter = 0;

  /* ── SETUP ── */
  p.setup = function() {
    const container = document.getElementById('canvasContainer');
    const cw = Math.floor(container.clientWidth) || 600;
    const ch = Math.floor(container.clientHeight) || 420;
    const cnv = p.createCanvas(cw, ch);
    cnv.parent('canvasContainer');
    p.pixelDensity(1);
    p.noLoop();
    p.background(10, 10, 11);
    document.getElementById('canvasDims').textContent = `${cw} × ${ch}`;
  };

  /* ── MAIN DRAW ── */
  p.draw = function() {
    if (window.PIXLR.frozen) return;

    const state = window.PIXLR;

    // Reset if requested
    if (state.resetFlag && origPixels) {
      workPixels = new Uint8ClampedArray(origPixels);
      state.resetFlag = false;
    }

    if (!img || !workPixels) {
      p.background(10, 10, 11);
      return;
    }

    const mx = p.mouseX;
    const my = p.mouseY;
    const intensity = state.intensity / 100;
    const threshold = state.threshold;
    const scale = Math.max(1, state.scale);
    const mouseFx = state.mouseFx;

    // Copy orig for fresh render each frame
    let pix = new Uint8ClampedArray(origPixels);

    // ── Apply selected effect ──
    switch (state.effect) {
      case 'glitch':    applyGlitch(pix, w, h, intensity, mouseFx ? mx : -1, my); break;
      case 'pixelate':  applyPixelate(pix, w, h, scale, mouseFx ? mx : w/2, my); break;
      case 'sort':      applyPixelSort(pix, w, h, threshold, intensity); break;
      case 'rgb':       applyRGBShift(pix, w, h, intensity * 30, mouseFx ? mx : w/2); break;
      case 'noise':     applyNoise(pix, w, h, intensity, mouseFx ? mx : -1, my); break;
      case 'invert':    applyInvert(pix, w, h, intensity); break;
      case 'duotone':   applyDuotone(pix, w, h, intensity); break;
      default: break;
    }

    workPixels = pix;

    // Put pixels on canvas
    p.loadPixels();
    const cw = p.width, ch = p.height;

    // Scale image to canvas
    for (let cy = 0; cy < ch; cy++) {
      for (let cx = 0; cx < cw; cx++) {
        const ix = Math.floor((cx / cw) * w);
        const iy = Math.floor((cy / ch) * h);
        const si = (iy * w + ix) * 4;
        const di = (cy * cw + cx) * 4;
        p.pixels[di]   = pix[si];
        p.pixels[di+1] = pix[si+1];
        p.pixels[di+2] = pix[si+2];
        p.pixels[di+3] = pix[si+3];
      }
    }
    p.updatePixels();

    // Mouse interaction: draw glow ring if mouse on canvas
    if (mouseFx && p.mouseX >= 0 && p.mouseX < p.width) {
      const radius = 40 + 20 * Math.sin(p.frameCount * 0.06);
      p.noFill();
      p.stroke(0, 245, 196, 60);
      p.strokeWeight(1.5);
      p.ellipse(p.mouseX, p.mouseY, radius * 2, radius * 2);
      p.stroke(0, 245, 196, 25);
      p.ellipse(p.mouseX, p.mouseY, radius * 3, radius * 3);
    }

    // Probe pixel under mouse
    const probIx = Math.min(Math.max(Math.floor((mx / p.width) * w), 0), w-1);
    const probIy = Math.min(Math.max(Math.floor((my / p.height) * h), 0), h-1);
    const probI = (probIy * w + probIx) * 4;
    state.probePixel = {
      r: pix[probI],
      g: pix[probI+1],
      b: pix[probI+2],
      a: pix[probI+3]
    };

    // FPS
    frameCounter++;
    const now = performance.now();
    if (now - lastFpsTime > 500) {
      state.fps = Math.round(frameCounter * 1000 / (now - lastFpsTime));
      frameCounter = 0;
      lastFpsTime = now;
    }
    state.frameCount = p.frameCount;
  };

  /* ── LOAD IMAGE from URL ── */
  window.pixlrLoad = function(url) {
    p.noLoop();
    img = null;
    origPixels = null;
    workPixels = null;

    console.log('[PIXLR] Loading image from:', url);

    // Use blob fetch para melhor controlo de CORS
    fetch(url, {
      mode: 'cors',
      credentials: 'omit'
    })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.blob();
    })
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const tempImg = new Image();
      tempImg.crossOrigin = 'anonymous';
      
      tempImg.onload = function() {
        console.log('[PIXLR] Image loaded, extracting pixels...');
        try {
          // Draw to offscreen canvas to extract pixels
          const oc = document.createElement('canvas');
          oc.width  = tempImg.naturalWidth  || tempImg.width;
          oc.height = tempImg.naturalHeight || tempImg.height;
          
          if (oc.width === 0 || oc.height === 0) {
            throw new Error('Image has invalid dimensions');
          }

          const ctx = oc.getContext('2d');
          if (!ctx) throw new Error('Could not get canvas context');
          
          ctx.drawImage(tempImg, 0, 0);

          const data = ctx.getImageData(0, 0, oc.width, oc.height);
          w = oc.width;
          h = oc.height;
          origPixels = new Uint8ClampedArray(data.data);
          workPixels = new Uint8ClampedArray(origPixels);
          window.PIXLR.pixelCount = w * h;

          console.log('[PIXLR] Pixels extracted:', w, 'x', h);

          // Compute histogram
          computeHistogram(origPixels);

          // p5 image (for reference)
          img = p.createImage(w, h);
          img.loadPixels();
          for (let i = 0; i < origPixels.length; i++) img.pixels[i] = origPixels[i];
          img.updatePixels();

          p.loop();
          document.getElementById('placeholder').classList.add('hidden');
          window.pixlrOnLoad && window.pixlrOnLoad(w, h);
          
          // Cleanup blob URL
          URL.revokeObjectURL(blobUrl);
        } catch(e) {
          console.error('[PIXLR] Pixel extraction error:', e);
          window.pixlrOnError && window.pixlrOnError('Pixel extraction error: ' + e.message);
          URL.revokeObjectURL(blobUrl);
        }
      };

      tempImg.onerror = function() {
        console.error('[PIXLR] Image load error');
        window.pixlrOnError && window.pixlrOnError('Failed to load image from blob.');
        URL.revokeObjectURL(blobUrl);
      };

      tempImg.src = blobUrl;
    })
    .catch(err => {
      console.error('[PIXLR] Fetch error:', err);
      window.pixlrOnError && window.pixlrOnError('Network error: ' + err.message);
    });
  };

  /* ── RESET to original ── */
  window.pixlrReset = function() {
    if (origPixels) {
      workPixels = new Uint8ClampedArray(origPixels);
    }
  };

  /* ── SAVE canvas ── */
  window.pixlrSave = function() {
    p.saveCanvas('pixlr_export', 'png');
  };

  /* ── KEYBOARD ── */
  p.keyPressed = function() {
    if (p.key === ' ') {
      window.PIXLR.frozen = !window.PIXLR.frozen;
      if (!window.PIXLR.frozen) p.loop();
      return false;
    }
    if (p.key === 'r' || p.key === 'R') {
      window.PIXLR.resetFlag = true;
    }
  };

  /* ── MOUSE ── */
  p.mousePressed  = function() { isDragging = true; };
  p.mouseReleased = function() { isDragging = false; };
  p.mouseWheel    = function(event) {
    scrollMult = Math.max(0.1, Math.min(5, scrollMult - event.delta * 0.001));
    window.PIXLR.intensity = Math.min(100, Math.max(0, window.PIXLR.intensity + event.delta * 0.05));
    window.pixlrSyncSliders && window.pixlrSyncSliders();
    return false;
  };


  /* ═══════════════════════════════════════════════
     EFFECT IMPLEMENTATIONS
  ═══════════════════════════════════════════════ */

  /* ── GLITCH ── */
  function applyGlitch(pix, w, h, intensity, mx, my) {
    const numSlices = Math.floor(intensity * 25) + 2;
    const t = Date.now() * 0.001;
    for (let s = 0; s < numSlices; s++) {
      const y = Math.floor(Math.random() * h);
      const sliceH = Math.floor(Math.random() * 6) + 1;
      const shift = Math.floor((Math.random() - 0.5) * intensity * 60);
      const channelShift = Math.floor(Math.random() * 3);

      for (let dy = 0; dy < sliceH; dy++) {
        const row = Math.min(y + dy, h - 1);
        for (let x = 0; x < w; x++) {
          const sx = ((x + shift) + w) % w;
          const si = (row * w + sx) * 4;
          const di = (row * w + x) * 4;
          pix[di + channelShift] = pix[si + channelShift];
        }
      }
    }

    // Mouse proximity: extra glitch band
    if (mx >= 0) {
      const bandY = Math.floor((my / p.height) * h);
      const bandSize = Math.floor(intensity * 20);
      for (let y = Math.max(0, bandY - bandSize); y < Math.min(h, bandY + bandSize); y++) {
        const shift = Math.floor(Math.sin(y * 0.1 + t * 3) * intensity * 40);
        for (let x = 0; x < w; x++) {
          const sx = ((x + shift) + w) % w;
          const si = (y * w + sx) * 4;
          const di = (y * w + x) * 4;
          pix[di]   = pix[si + 2]; // channel swap
          pix[di+2] = pix[si];
        }
      }
    }
  }

  /* ── PIXELATE ── */
  function applyPixelate(pix, w, h, scale, mx, my) {
    const px = p.width > 0 ? Math.floor((mx / p.width) * w) : w/2;
    const py = p.height > 0 ? Math.floor((my / p.height) * h) : h/2;

    for (let y = 0; y < h; y += scale) {
      for (let x = 0; x < w; x += scale) {
        // Vary block size near mouse
        const dist = Math.hypot(x - px, y - py);
        const localScale = Math.max(1, Math.round(scale * (1 + (1 - Math.min(dist / 200, 1)) * 2)));

        let r=0, g=0, b=0, cnt=0;
        for (let dy = 0; dy < localScale && y+dy < h; dy++) {
          for (let dx = 0; dx < localScale && x+dx < w; dx++) {
            const i = ((y+dy)*w + (x+dx)) * 4;
            r += pix[i]; g += pix[i+1]; b += pix[i+2];
            cnt++;
          }
        }
        r = Math.round(r/cnt); g = Math.round(g/cnt); b = Math.round(b/cnt);

        for (let dy = 0; dy < localScale && y+dy < h; dy++) {
          for (let dx = 0; dx < localScale && x+dx < w; dx++) {
            const i = ((y+dy)*w + (x+dx)) * 4;
            pix[i] = r; pix[i+1] = g; pix[i+2] = b;
          }
        }
      }
    }
  }

  /* ── PIXEL SORT ── */
  function applyPixelSort(pix, w, h, threshold, intensity) {
    const angle = p.frameCount * 0.01 * intensity;
    const sortByBrightness = (a, b) => {
      const ba = 0.299*a[0] + 0.587*a[1] + 0.114*a[2];
      const bb = 0.299*b[0] + 0.587*b[1] + 0.114*b[2];
      return ba - bb;
    };

    for (let y = 0; y < h; y++) {
      let start = -1;
      let run = [];
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const brightness = 0.299*pix[i] + 0.587*pix[i+1] + 0.114*pix[i+2];
        if (brightness > threshold) {
          if (start === -1) start = x;
          run.push([pix[i], pix[i+1], pix[i+2], pix[i+3]]);
        } else {
          if (run.length > 1) {
            run.sort(sortByBrightness);
            for (let k = 0; k < run.length; k++) {
              const di = (y * w + (start + k)) * 4;
              pix[di]   = run[k][0];
              pix[di+1] = run[k][1];
              pix[di+2] = run[k][2];
              pix[di+3] = run[k][3];
            }
          }
          start = -1; run = [];
        }
      }
    }
  }

  /* ── RGB SHIFT ── */
  function applyRGBShift(pix, w, h, amount, mx) {
    const t = Date.now() * 0.002;
    const shiftX = Math.floor(amount * Math.sin(t));
    const shiftY = Math.floor(amount * 0.3 * Math.cos(t * 0.7));
    const result = new Uint8ClampedArray(pix);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const di = (y * w + x) * 4;

        // Red channel: shifted right
        const rx = Math.min(Math.max(x + shiftX, 0), w-1);
        const ri = (y * w + rx) * 4;
        result[di] = pix[ri];

        // Blue channel: shifted left
        const bx = Math.min(Math.max(x - shiftX, 0), w-1);
        const by = Math.min(Math.max(y + shiftY, 0), h-1);
        const bi = (by * w + bx) * 4;
        result[di+2] = pix[bi+2];
      }
    }
    for (let i = 0; i < pix.length; i++) pix[i] = result[i];
  }

  /* ── NOISE ── */
  function applyNoise(pix, w, h, intensity, mx, my) {
    const t = Date.now() * 0.001;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const n = (Math.random() - 0.5) * intensity * 180;
        pix[i]   = Math.min(255, Math.max(0, pix[i]   + n));
        pix[i+1] = Math.min(255, Math.max(0, pix[i+1] + n * 0.8));
        pix[i+2] = Math.min(255, Math.max(0, pix[i+2] + n * 1.2));

        // Scanlines
        if (y % 3 === 0) {
          pix[i]   *= 0.85;
          pix[i+1] *= 0.85;
          pix[i+2] *= 0.85;
        }
      }
    }
  }

  /* ── INVERT ── */
  function applyInvert(pix, w, h, intensity) {
    for (let i = 0; i < pix.length; i += 4) {
      pix[i]   = pix[i]   + (255 - pix[i]   * 2) * intensity;
      pix[i+1] = pix[i+1] + (255 - pix[i+1] * 2) * intensity;
      pix[i+2] = pix[i+2] + (255 - pix[i+2] * 2) * intensity;
    }
  }

  /* ── DUOTONE ── */
  function applyDuotone(pix, w, h, intensity) {
    // Cyan (#00f5c4) + Magenta (#ff3366)
    const c1 = [0, 245, 196];
    const c2 = [255, 51, 102];
    for (let i = 0; i < pix.length; i += 4) {
      const lum = (0.299*pix[i] + 0.587*pix[i+1] + 0.114*pix[i+2]) / 255;
      const t = lum;
      const r = c1[0] * (1-t) + c2[0] * t;
      const g = c1[1] * (1-t) + c2[1] * t;
      const b = c1[2] * (1-t) + c2[2] * t;
      pix[i]   = pix[i]   * (1-intensity) + r * intensity;
      pix[i+1] = pix[i+1] * (1-intensity) + g * intensity;
      pix[i+2] = pix[i+2] * (1-intensity) + b * intensity;
    }
  }

  /* ── HISTOGRAM ── */
  function computeHistogram(pix) {
    const r = new Array(256).fill(0);
    const g = new Array(256).fill(0);
    const b = new Array(256).fill(0);
    for (let i = 0; i < pix.length; i += 4) {
      r[pix[i]]++;
      g[pix[i+1]]++;
      b[pix[i+2]]++;
    }
    window.PIXLR.histData = { r, g, b };
    window.pixlrDrawHistogram && window.pixlrDrawHistogram();
  }

}, document.body);