import { audio } from './audio.js';

const GROUP_LABELS = {
  start: 'BAŞLANGIÇ',
  good: 'SEVİNÇ',
  bad: 'TUZAK',
  speed: 'HIZLANMA',
  over: 'OYUN SONU',
};

export function initGallery() {
  initFaceLightbox();
  initSoundboard();
}

function initFaceLightbox() {
  const dialog = document.getElementById('face-lightbox');
  const image = document.getElementById('lightbox-image');
  const title = document.getElementById('lightbox-title');
  const caption = document.getElementById('lightbox-caption');
  const line = document.getElementById('lightbox-line');
  const triggers = document.querySelectorAll('.expression-trigger');

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const voice = audio.LINES[Math.floor(Math.random() * audio.LINES.length)];
      image.src = trigger.dataset.image;
      image.alt = `${trigger.dataset.title} Musty’nin büyük portresi`;
      title.textContent = trigger.dataset.title;
      caption.textContent = trigger.dataset.caption;
      line.textContent = voice ? `“${voice.text}”` : '';

      audio.unlock();
      if (voice) audio.playLine(voice.id);
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      document.body.classList.add('lightbox-open');
    });
  });

  dialog.addEventListener('click', (event) => {
    // Native dialog clicks land on the dialog itself only on its backdrop.
    if (event.target !== dialog) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  });

  dialog.addEventListener('close', () => {
    document.body.classList.remove('lightbox-open');
  });

  // The fallback used by older browsers has no native close event.
  dialog.querySelector('form').addEventListener('submit', (event) => {
    document.body.classList.remove('lightbox-open');
    if (typeof dialog.close !== 'function') {
      event.preventDefault();
      dialog.removeAttribute('open');
    }
  });
}

function initSoundboard() {
  const grid = document.getElementById('soundboard-grid');
  const status = document.getElementById('soundboard-status');
  const timers = new WeakMap();

  const fragment = document.createDocumentFragment();
  audio.LINES.forEach((voice, index) => {
    const button = document.createElement('button');
    button.className = 'sound-button';
    button.type = 'button';
    button.dataset.line = voice.id;
    button.setAttribute('aria-label', `Sesi çal: ${voice.text}`);

    const number = document.createElement('span');
    number.className = 'sound-button-number';
    number.setAttribute('aria-hidden', 'true');
    number.textContent = String(index + 1).padStart(2, '0');

    const copy = document.createElement('span');
    copy.className = 'sound-button-copy';
    const text = document.createElement('strong');
    text.textContent = voice.text;
    const group = document.createElement('small');
    group.textContent = GROUP_LABELS[voice.group] || 'MUSTY';
    copy.append(text, group);

    const play = document.createElement('span');
    play.className = 'sound-button-play';
    play.setAttribute('aria-hidden', 'true');
    play.textContent = '▶';

    button.append(number, copy, play);
    fragment.append(button);
  });
  grid.replaceChildren(fragment);

  grid.addEventListener('click', (event) => {
    const button = event.target.closest('.sound-button');
    if (!button) return;
    const voice = audio.LINES.find((item) => item.id === button.dataset.line);
    if (!voice) return;

    audio.unlock();
    // An explicit soundboard press is the intentional exception to global mute.
    audio.playLine(voice.id, { force: true });
    status.textContent = `Çalıyor: ${voice.text}`;

    clearTimeout(timers.get(button));
    grid.querySelectorAll('.is-playing').forEach((item) => item.classList.remove('is-playing'));
    button.classList.add('is-playing');
    timers.set(button, window.setTimeout(() => button.classList.remove('is-playing'), 1800));
  });
}
