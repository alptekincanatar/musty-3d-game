const ANGLES = ['000', '045', '090', '135', '180', '225', '270', '315'];
const ANGLE_NAMES = ['ÖN', 'ÖN SOL', 'SOL PROFİL', 'ARKA SOL', 'ARKA', 'ARKA SAĞ', 'SAĞ PROFİL', 'ÖN SAĞ'];
const OUTFITS = {
  a: { name: 'Mavi', file: 'mavi' },
  carsi: { name: 'Çarşı', file: 'carsi' },
  kirmizi: { name: 'Kırmızı', file: 'kirmizi' },
  sari: { name: 'Sarı', file: 'sari' },
};

const modulo = (value, divisor) => ((value % divisor) + divisor) % divisor;
const framePath = (outfit, index) => outfit === 'a'
  ? `assets/turn/a${ANGLES[index]}.jpg`
  : `assets/turn/${outfit}_${ANGLES[index]}.jpg`;

export function initStudio(root) {
  const stage = root.querySelector('#studio-stage');
  const image = root.querySelector('#studio-image');
  const angleLabel = root.querySelector('#studio-angle');
  const angleName = root.querySelector('#studio-angle-name');
  const frameNumber = root.querySelector('#studio-frame-number');
  const dots = [...root.querySelectorAll('.studio-angle-dots i')];
  const chips = [...root.querySelectorAll('.outfit-chip')];
  const autoButton = root.querySelector('#studio-auto');
  const autoLabel = root.querySelector('#studio-auto-label');
  const downloadButton = root.querySelector('#studio-download');
  const status = root.querySelector('#studio-status');
  const help = root.querySelector('#studio-help');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let outfit = 'a';
  let position = 0;
  let displayedIndex = -1;
  let dragging = false;
  let pointerId = null;
  let lastX = 0;
  let lastMoveTime = 0;
  let velocity = 0;
  let frameRequest = 0;
  let tween = null;
  let autoRotate = false;
  let autoTimer = 0;
  let downloading = false;
  const preloadCache = new Map();

  const currentIndex = () => modulo(Math.round(position), ANGLES.length);

  function render(force = false) {
    const index = currentIndex();
    if (!force && index === displayedIndex) return;
    displayedIndex = index;
    const angle = Number(ANGLES[index]);
    const name = ANGLE_NAMES[index];

    image.src = framePath(outfit, index);
    image.alt = `${OUTFITS[outfit].name} kıyafetli Musty, ${name.toLocaleLowerCase('tr-TR')} görünüm`;
    angleLabel.textContent = `${angle}°`;
    angleName.textContent = name;
    frameNumber.textContent = String(index + 1).padStart(2, '0');
    stage.setAttribute('aria-valuenow', String(angle));
    stage.setAttribute('aria-valuetext', `${name.toLocaleLowerCase('tr-TR')}, ${angle} derece`);
    dots.forEach((dot, dotIndex) => dot.classList.toggle('is-active', dotIndex === index));
  }

  function preloadOutfit(key) {
    if (preloadCache.has(key)) return preloadCache.get(key);

    const promise = Promise.all(ANGLES.map((angle) => new Promise((resolve) => {
      const frame = new Image();
      frame.decoding = 'async';
      frame.onload = () => resolve(true);
      frame.onerror = () => resolve(false);
      frame.src = key === 'a' ? `assets/turn/a${angle}.jpg` : `assets/turn/${key}_${angle}.jpg`;
    }))).then((results) => {
      // A later outfit click may retry a failed network request.
      if (!results.every(Boolean)) preloadCache.delete(key);
      return results;
    });
    preloadCache.set(key, promise);
    return promise;
  }

  function announce(message, visible = false) {
    status.textContent = message;
    if (visible) help.textContent = message;
  }

  function cancelFrame() {
    if (frameRequest) cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    tween = null;
    velocity = 0;
  }

  function animateTo(target, duration = 260) {
    cancelFrame();
    const distance = target - position;
    if (reducedMotion.matches || duration === 0 || Math.abs(distance) < 0.001) {
      position = target;
      render();
      return;
    }

    tween = { from: position, target, elapsed: 0, duration };
    let previousTime = performance.now();
    const tick = (time) => {
      if (!tween) return;
      tween.elapsed += Math.min(time - previousTime, 50);
      previousTime = time;
      const progress = Math.min(tween.elapsed / tween.duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      position = tween.from + (tween.target - tween.from) * eased;
      render();
      if (progress === 1) {
        position = tween.target;
        tween = null;
        frameRequest = 0;
        render();
      } else {
        frameRequest = requestAnimationFrame(tick);
      }
    };
    frameRequest = requestAnimationFrame(tick);
  }

  function goToIndex(index, duration = 300) {
    // Pick the equivalent frame nearest the current continuous position.
    const target = Math.round((position - index) / ANGLES.length) * ANGLES.length + index;
    animateTo(target, duration);
  }

  function setAutoRotate(enabled) {
    const wasEnabled = autoRotate;
    clearInterval(autoTimer);
    autoTimer = 0;
    autoRotate = enabled;
    autoButton.setAttribute('aria-pressed', String(enabled));
    autoLabel.textContent = enabled ? 'Durdur' : 'Otomatik döndür';
    cancelFrame();

    if (enabled) {
      position = currentIndex();
      render();
      animateTo(position + 1, 700);
      autoTimer = window.setInterval(() => {
        if (autoRotate && !dragging) animateTo(Math.round(position) + 1, 700);
      }, 1050);
      announce('Otomatik dönüş başladı.');
    } else if (wasEnabled) {
      announce('Otomatik dönüş durdu.');
    }
  }

  function snap() {
    animateTo(Math.round(position), 240);
  }

  function coast() {
    if (reducedMotion.matches || Math.abs(velocity) < 0.00035) {
      snap();
      return;
    }

    let previousTime = performance.now();
    const tick = (time) => {
      const delta = Math.min(time - previousTime, 40);
      previousTime = time;
      position += velocity * delta;
      velocity *= Math.exp(-delta / 170);
      render();
      if (Math.abs(velocity) < 0.00035) {
        snap();
      } else {
        frameRequest = requestAnimationFrame(tick);
      }
    };
    frameRequest = requestAnimationFrame(tick);
  }

  stage.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    setAutoRotate(false);
    dragging = true;
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastMoveTime = performance.now();
    velocity = 0;
    stage.classList.add('is-dragging', 'has-moved');
    stage.setPointerCapture(event.pointerId);
    stage.focus({ preventScroll: true });
  });

  stage.addEventListener('pointermove', (event) => {
    if (!dragging || event.pointerId !== pointerId) return;
    const now = performance.now();
    const elapsed = Math.max(now - lastMoveTime, 1);
    const change = -(event.clientX - lastX) / 58;
    position += change;
    velocity = velocity * 0.65 + (change / elapsed) * 0.35;
    lastX = event.clientX;
    lastMoveTime = now;
    render();
  });

  function endDrag(event, withInertia) {
    if (!dragging || event.pointerId !== pointerId) return;
    dragging = false;
    stage.classList.remove('is-dragging');
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    pointerId = null;
    if (performance.now() - lastMoveTime > 100) velocity = 0;
    if (withInertia) coast();
    else snap();
  }

  stage.addEventListener('pointerup', (event) => endDrag(event, true));
  stage.addEventListener('pointercancel', (event) => endDrag(event, false));
  stage.addEventListener('lostpointercapture', (event) => endDrag(event, false));

  stage.addEventListener('keydown', (event) => {
    let target = null;
    if (event.key === 'ArrowLeft') target = Math.round(position) - 1;
    if (event.key === 'ArrowRight') target = Math.round(position) + 1;
    if (event.key === 'Home') target = 0;
    if (event.key === 'End') target = 7;
    if (target === null) return;
    event.preventDefault();
    setAutoRotate(false);
    stage.classList.add('has-moved');
    if (event.key === 'Home' || event.key === 'End') goToIndex(target, 240);
    else animateTo(target, 220);
  });

  root.querySelector('#studio-front').addEventListener('click', () => {
    setAutoRotate(false);
    goToIndex(0);
  });
  root.querySelector('#studio-back').addEventListener('click', () => {
    setAutoRotate(false);
    goToIndex(4);
  });
  autoButton.addEventListener('click', () => setAutoRotate(!autoRotate));

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const nextOutfit = chip.dataset.outfit;
      if (!OUTFITS[nextOutfit]) return;
      setAutoRotate(false);
      outfit = nextOutfit;
      position = currentIndex();
      chips.forEach((item) => {
        const active = item === chip;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      render(true);
      announce(`${OUTFITS[outfit].name} kıyafet seçildi. Kareler yükleniyor.`);
      preloadOutfit(outfit).then((results) => {
        if (outfit === nextOutfit) {
          announce(results.every(Boolean)
            ? `${OUTFITS[outfit].name} kıyafetin 8 karesi hazır.`
            : 'Bazı kareler yüklenemedi. Bağlantını kontrol edip yeniden dene.');
        }
      });
    });
  });

  downloadButton.addEventListener('click', async () => {
    if (downloading) return;
    downloading = true;
    setAutoRotate(false);
    downloadButton.disabled = true;
    downloadButton.firstChild.textContent = 'Hazırlanıyor… ';

    const savedOutfit = outfit;
    const savedIndex = currentIndex();
    try {
      // The assets are JPG; drawing to a same-origin canvas produces a real PNG.
      const source = new Image();
      source.src = framePath(savedOutfit, savedIndex);
      await source.decode();
      const canvas = document.createElement('canvas');
      canvas.width = source.naturalWidth;
      canvas.height = source.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas desteklenmiyor');
      context.drawImage(source, 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('PNG oluşturulamadı');

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `musty-${OUTFITS[savedOutfit].file}-${ANGLES[savedIndex]}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      announce('PNG hazır. İndirme başladı.', true);
    } catch {
      announce('PNG hazırlanamadı. Görsel yüklendikten sonra yeniden dene.', true);
    } finally {
      downloading = false;
      downloadButton.disabled = false;
      downloadButton.firstChild.textContent = 'PNG indir ';
    }
  });

  image.addEventListener('load', () => {
    help.textContent = 'Görseli sürükle veya sol / sağ ok tuşlarını kullan.';
  });
  image.addEventListener('error', () => {
    announce('Bu kare yüklenemedi. Başka bir açı veya kıyafet dene.', true);
  });

  const warmUp = () => {
    preloadOutfit(outfit).then((results) => {
      announce(results.every(Boolean) ? '8 dönüş karesi hazır.' : 'Bazı dönüş kareleri yüklenemedi.');
    });
  };
  if ('IntersectionObserver' in window) {
    const preloadObserver = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      preloadObserver.disconnect();
      warmUp();
    }, { rootMargin: '500px 0px' });
    preloadObserver.observe(root);
  } else {
    warmUp();
  }

  render(true);
}
