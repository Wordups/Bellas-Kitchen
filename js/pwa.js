// Shared helpers: service-worker registration, flash messages, mode pill.

import { mode } from './supabase-client.js';

export function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  // Pages serves us from /Bellas-Kitchen/ — register relative.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}

export function flash(msg) {
  const el = document.createElement('div');
  el.className = 'flash';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

export function modePill() {
  const el = document.createElement('div');
  el.className = 'mode-pill ' + (mode === 'cloud' ? 'cloud' : '');
  el.textContent = mode === 'cloud' ? 'CLOUD SYNC' : 'LOCAL MODE';
  document.body.appendChild(el);
  const setOffline = () => { el.classList.add('offline'); el.textContent = 'OFFLINE'; };
  const setOnline  = () => {
    el.classList.remove('offline');
    el.classList.toggle('cloud', mode === 'cloud');
    el.textContent = mode === 'cloud' ? 'CLOUD SYNC' : 'LOCAL MODE';
  };
  window.addEventListener('offline', setOffline);
  window.addEventListener('online', setOnline);
  if (!navigator.onLine) setOffline();
}

export function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const t0 = ctx.currentTime;
    const make = (freq, when) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0 + when);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + when + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + when + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + when);
      o.stop(t0 + when + 0.4);
    };
    make(880, 0);
    make(1320, 0.12);
  } catch {}
}

export function ageString(iso) {
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 60) return `${Math.floor(sec)}s ago`;
  const min = sec / 60;
  if (min < 60) return `${Math.floor(min)}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}
