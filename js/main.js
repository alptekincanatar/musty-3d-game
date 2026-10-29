import { audio } from './audio.js';
import { initGame } from './game.js';
import { initStudio } from './studio.js';
import { initGallery } from './gallery.js';

function initNavigation() {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('primary-nav');
  const desktop = window.matchMedia('(min-width: 56.26rem)');

  const close = () => {
    toggle.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
  };

  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  });

  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      close();
      toggle.focus();
    }
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.header-inner')) close();
  });

  desktop.addEventListener('change', (event) => {
    if (event.matches) close();
  });

  if ('IntersectionObserver' in window) {
    const links = new Map(
      [...nav.querySelectorAll('a')].map((link) => [link.hash.slice(1), link]),
    );
    const sectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const link of links.values()) link.removeAttribute('aria-current');
        links.get(entry.target.id)?.setAttribute('aria-current', 'location');
      }
    }, { rootMargin: '-18% 0px -68% 0px', threshold: 0 });

    for (const id of links.keys()) {
      const section = document.getElementById(id);
      if (section) sectionObserver.observe(section);
    }
  }
}

function initReveals() {
  const elements = document.querySelectorAll('[data-reveal]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion || !('IntersectionObserver' in window)) {
    elements.forEach((element) => element.classList.add('is-visible'));
    return;
  }

  document.documentElement.classList.add('reveal-ready');
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  elements.forEach((element) => observer.observe(element));
}

function initSoundToggle() {
  const button = document.getElementById('sound-toggle');
  const label = document.getElementById('sound-toggle-label');

  const render = (muted) => {
    button.setAttribute('aria-pressed', String(muted));
    button.setAttribute('aria-label', muted ? 'Sesi aç' : 'Sesi kapat');
    label.textContent = muted ? 'SES KAPALI' : 'SES AÇIK';
  };

  render(audio.muted);
  audio.onMuteChange(render);
  button.addEventListener('click', () => {
    audio.unlock();
    audio.toggleMute();
  });

  // Any first gesture may unlock Web Audio; the game also unlocks on BAŞLA.
  const unlock = () => {
    audio.unlock();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

initNavigation();
initReveals();
initSoundToggle();
initGame(document.getElementById('game-root'));
initStudio(document.getElementById('studio-app'));
initGallery();
document.getElementById('current-year').textContent = String(new Date().getFullYear());
