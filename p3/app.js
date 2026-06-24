/* ─────────────────────────────────────────────────
   PIXLR — app.js (CORRIGIDO)
   UI Controller, API Integration, Dashboard Logic
   API: Unsplash Source (no key required)
   ───────────────────────────────────────────────── */

(function() {
  'use strict';

  /* ── DOM REFS ── */
  const fetchBtn       = document.getElementById('fetchBtn');
  const searchInput    = document.getElementById('searchInput');
  const exportBtn      = document.getElementById('exportBtn');
  const statusBar      = document.getElementById('statusBar');
  const effectLabel    = document.getElementById('effectLabel');
  const coordLabel     = document.getElementById('coordLabel');
  const fpsVal         = document.getElementById('fpsVal');
  const frameVal       = document.getElementById('frameVal');
  const pixelCount     = document.getElementById('pixelCount');
  const metaContent    = document.getElementById('metaContent');
  const effectDesc     = document.getElementById('effectDesc');
  const canvasDims     = document.getElementById('canvasDims');
  const placeholder    = document.getElementById('placeholder');
  const histCanvas     = document.getElementById('histCanvas');
  const probeR         = document.getElementById('probeR').querySelector('.probe-val');
  const probeG         = document.getElementById('probeG').querySelector('.probe-val');
  const probeB         = document.getElementById('probeB').querySelector('.probe-val');
  const probeA         = document.getElementById('probeA').querySelector('.probe-val');
  const probeColor     = document.getElementById('probeColor');
  const intensitySlider= document.getElementById('intensitySlider');
  const thresholdSlider= document.getElementById('thresholdSlider');
  const scaleSlider    = document.getElementById('scaleSlider');
  const intensityVal   = document.getElementById('intensityVal');
  const thresholdVal   = document.getElementById('thresholdVal');
  const scaleVal       = document.getElementById('scaleVal');
  const mouseToggle    = document.getElementById('mouseToggle');
  const histCtx        = histCanvas.getContext('2d');

  /* ── EFFECT DESCRIPTIONS ── */
  const EFFECT_DESCS = {
    none:     'Original image with no post-processing applied. Mouse interaction shows a proximity cursor ring.',
    glitch:   'Randomly shifts horizontal slices of pixels across channels. Mouse Y position adds a distortion band with channel-swap corruption.',
    pixelate: 'Groups pixels into average-color blocks. Block size increases near the mouse cursor for a dynamic zoom-lens effect.',
    sort:     'Sorts pixel runs by brightness in each row, creating the iconic databending aesthetic. Threshold controls which pixel runs get sorted.',
    rgb:      'Separates the red and blue channels and shifts them in opposite directions over time, creating chromatic aberration.',
    noise:    'Adds random luminosity noise to each pixel plus CRT-style scanlines. Intensity controls the noise amplitude.',
    invert:   'Blends the image with its photographic negative. Intensity controls the blend ratio from original to fully inverted.',
    duotone:  'Remaps luminosity to a two-colour gradient from cyan (#00F5C4) to magenta (#FF3366). Intensity controls the blend.',
  };

  /* ── UNSPLASH API SETUP ── */
  const UNSPLASH_ACCESS_KEY = 'lKJLX65jVjM2Oo4cxQW8cLRt7A_Zs3aDSmNV29v74Uo';

  let currentQuery = '';
  let isLoading = false;

  /* ── STATUS HELPER ── */
  function setStatus(msg, cls = '') {
    statusBar.textContent = msg;
    statusBar.style.color = cls === 'err' ? 'var(--accent2)' : 'var(--accent)';
  }

  /* ── NOTIFICATION ── */
  function notify(msg, isError = false) {
    let n = document.querySelector('.notif');
    if (!n) {
      n = document.createElement('div');
      n.className = 'notif';
      document.body.appendChild(n);
    }
    n.textContent = msg;
    n.className = 'notif' + (isError ? ' error' : '');
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => n.classList.remove('show'), 2800);
  }

  /* ── LOADING OVERLAY ── */
  function showLoader(show) {
    let ov = document.querySelector('.loading-overlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.className = 'loading-overlay hidden';
      ov.innerHTML = '<div class="loader-ring"></div><div class="loader-text">FETCHING IMAGE…</div>';
      document.getElementById('canvasContainer').appendChild(ov);
    }
    ov.classList.toggle('hidden', !show);
  }

  /* ── FETCH IMAGE ── */
  async function fetchImage(query) {
    if (isLoading) return;
    if (!query.trim()) { notify('Enter a search query first.', true); return; }

    isLoading = true;
    currentQuery = query.trim();
    fetchBtn.disabled = true;
    setStatus(`FETCHING — "${currentQuery.toUpperCase()}"`);
    showLoader(true);

    try {
      let imageUrl;
      let metaHtml = '';

      const slug = encodeURIComponent(currentQuery);
      
      // Tentar API oficial da Unsplash primeiro
      try {
        const apiRes = await fetch(
          `https://api.unsplash.com/photos/random?query=${slug}&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`
        );
        
        if (apiRes.ok) {
          const photo = await apiRes.json();
          // URL com parâmetros de largura e altura para CORS
          imageUrl = `${photo.urls.regular}?w=800&h=600&fit=crop`;
          metaHtml = `
            <strong>${photo.alt_description || 'Untitled'}</strong><br/>
            By <a href="${photo.user.links.html}?utm_source=pixlr&utm_medium=referral" target="_blank">${photo.user.name}</a><br/>
            ${photo.width} × ${photo.height}px<br/>
            ❤ ${photo.likes.toLocaleString()} likes<br/>
            <a href="${photo.links.html}?utm_source=pixlr&utm_medium=referral" target="_blank">View on Unsplash ↗</a>
          `;
        } else {
          throw new Error('API issue');
        }
      } catch(apiErr) {
        // Fallback para Unsplash Source (funciona melhor para CORS)
        imageUrl = `https://source.unsplash.com/800x600/?${slug}`;
        metaHtml = `Query: <strong>${currentQuery}</strong><br/>Source: Unsplash (random)<br/><a href="https://unsplash.com/s/photos/${slug}?utm_source=pixlr" target="_blank">Browse on Unsplash ↗</a>`;
      }

      setStatus(`LOADING IMAGE…`);
      metaContent.innerHTML = metaHtml || '…';

      // Delegate to p5 sketch
      window.pixlrLoad(imageUrl);

    } catch(err) {
      showLoader(false);
      fetchBtn.disabled = false;
      isLoading = false;
      setStatus('ERROR — SEE CONSOLE', 'err');
      notify('Failed to fetch: ' + err.message, true);
      console.error('[PIXLR] Fetch error:', err);
    }
  }

  /* ── p5 CALLBACKS ── */
  window.pixlrOnLoad = function(w, h) {
    showLoader(false);
    fetchBtn.disabled = false;
    isLoading = false;
    exportBtn.disabled = false;
    setStatus(`LOADED — ${w}×${h}px — EFFECT: ${window.PIXLR.effect.toUpperCase()}`);
    notify('Image loaded successfully!');
    drawHistogram();
    document.getElementById('canvasDims').textContent = `${w} × ${h}`;
    window.PIXLR.pixelCount = w * h;
  };

  window.pixlrOnError = function(msg) {
    showLoader(false);
    fetchBtn.disabled = false;
    isLoading = false;
    setStatus('PIXEL READ ERROR — TRY ANOTHER IMAGE', 'err');
    notify(msg, true);
  };

  /* ── HISTOGRAM ── */
  window.pixlrDrawHistogram = drawHistogram;

  function drawHistogram() {
    const data = window.PIXLR.histData;
    if (!data) return;
    const { r, g, b } = data;
    const W = histCanvas.width, H = histCanvas.height;
    histCtx.clearRect(0, 0, W, H);
    histCtx.fillStyle = '#0a0a0b';
    histCtx.fillRect(0, 0, W, H);

    const maxVal = Math.max(...r, ...g, ...b);
    const channels = [
      { data: r, color: 'rgba(255,80,100,0.6)' },
      { data: g, color: 'rgba(80,255,140,0.6)' },
      { data: b, color: 'rgba(80,140,255,0.6)' },
    ];

    channels.forEach(ch => {
      histCtx.beginPath();
      histCtx.moveTo(0, H);
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * W;
        const y = H - (ch.data[i] / maxVal) * H;
        histCtx.lineTo(x, y);
      }
      histCtx.lineTo(W, H);
      histCtx.closePath();
      histCtx.fillStyle = ch.color;
      histCtx.fill();
    });

    // Grid lines
    histCtx.strokeStyle = 'rgba(255,255,255,0.05)';
    histCtx.lineWidth = 1;
    [64, 128, 192].forEach(x => {
      const px = (x / 255) * W;
      histCtx.beginPath();
      histCtx.moveTo(px, 0);
      histCtx.lineTo(px, H);
      histCtx.stroke();
    });
  }

  /* ── SLIDER SYNC ── */
  window.pixlrSyncSliders = function() {
    intensitySlider.value = Math.round(window.PIXLR.intensity);
    intensityVal.textContent = intensitySlider.value;
  };

  /* ── EFFECT BUTTONS ── */
  document.querySelectorAll('.effect-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('.effect-btn.active')?.classList.remove('active');
      btn.classList.add('active');
      const effect = btn.dataset.effect;
      window.PIXLR.effect = effect;
      effectLabel.textContent = `EFFECT: ${effect.toUpperCase()}`;
      effectDesc.textContent = EFFECT_DESCS[effect] || '';
      setStatus(`EFFECT → ${effect.toUpperCase()}`);
    });
  });

  /* ── QUICK TAGS ── */
  document.querySelectorAll('.tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const q = tag.dataset.q;
      searchInput.value = q;
      fetchImage(q);
    });
  });

  /* ── FETCH BUTTON ── */
  fetchBtn.addEventListener('click', () => fetchImage(searchInput.value));
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') fetchImage(searchInput.value);
  });

  /* ── EXPORT ── */
  exportBtn.addEventListener('click', () => {
    window.pixlrSave();
    notify('Canvas saved as PNG!');
  });
  exportBtn.disabled = true;

  /* ── SLIDERS ── */
  intensitySlider.addEventListener('input', () => {
    window.PIXLR.intensity = parseInt(intensitySlider.value);
    intensityVal.textContent = intensitySlider.value;
  });
  thresholdSlider.addEventListener('input', () => {
    window.PIXLR.threshold = parseInt(thresholdSlider.value);
    thresholdVal.textContent = thresholdSlider.value;
  });
  scaleSlider.addEventListener('input', () => {
    window.PIXLR.scale = parseInt(scaleSlider.value);
    scaleVal.textContent = scaleSlider.value;
  });
  mouseToggle.addEventListener('change', () => {
    window.PIXLR.mouseFx = mouseToggle.checked;
  });

  /* ── PERFORMANCE PANEL ── */
  setInterval(() => {
    const s = window.PIXLR;
    fpsVal.textContent   = s.fps || '—';
    frameVal.textContent = s.frameCount || '—';
    pixelCount.textContent = s.pixelCount ? (s.pixelCount / 1000).toFixed(1) + 'K' : '—';

    // Probe update
    const p = s.probePixel;
    if (p) {
      probeR.textContent = p.r;
      probeG.textContent = p.g;
      probeB.textContent = p.b;
      probeA.textContent = p.a;
      probeColor.style.background = `rgb(${p.r},${p.g},${p.b})`;
    }
  }, 150);

  /* ── MOUSE COORD DISPLAY ── */
  document.getElementById('canvasContainer').addEventListener('mousemove', e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    coordLabel.textContent = `X:${x} Y:${y}`;
  });

  /* ── KEYBOARD ── */
  document.addEventListener('keydown', e => {
    if (e.target === searchInput) return;
    if (e.key === ' ') {
      e.preventDefault();
      const frozen = window.PIXLR.frozen;
      setStatus(frozen ? 'RESUMED' : 'FROZEN — PRESS SPACE TO RESUME');
    }
  });

  /* ── INIT STATUS ── */
  setStatus('IDLE — ENTER A QUERY TO BEGIN');
  effectDesc.textContent = EFFECT_DESCS['none'];

  // Auto-load a welcome image
  setTimeout(() => {
    searchInput.value = 'abstract';
    fetchImage('abstract');
  }, 800);

})();