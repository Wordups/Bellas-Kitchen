import { db } from './supabase-client.js';
import { getMeal, summarize } from './meals.js';
import { awardCookOrder, awardDeliverOrder } from './gamify.js';
import { registerSW, flash, modePill, chime, ageString } from './pwa.js';

const STATUSES = ['pending', 'cooking', 'ready', 'delivered'];
const NEXT = { pending: 'cooking', cooking: 'ready', ready: 'delivered' };
const PREV = { cooking: 'pending', ready: 'cooking', delivered: 'ready' };

let family = null;
let member = null;
let orders = [];

const $ = (s) => document.querySelector(s);

(async function boot() {
  registerSW();
  modePill();

  const b = await db.familyBootstrap();
  family = b.family;
  member = b.member;

  if (!family) {
    location.href = 'index.html';
    return;
  }

  renderFamilyBar();
  await loadOrders();
  subscribe();
  bindLaneTabs();
  bindLaneActions();

  // Refresh "X min ago" labels once a minute, paint late/warn classes.
  setInterval(repaintAges, 30 * 1000);
})();

function renderFamilyBar() {
  $('#familyBar').innerHTML = `
    <span>🔥 ${family.name} LINE</span>
    <span class="code">#${family.joinCode}</span>
    <span class="me">${member?.displayName || 'Chef'}${member?.xp != null ? ` · ${member.xp} XP` : ''}</span>
  `;
}

async function loadOrders() {
  orders = await db.listOrders(family.id);
  renderAllLanes();
}

function subscribe() {
  db.subscribe(family.id, (msg) => {
    if (!msg) return;
    if (msg.type === 'order.insert') {
      const o = msg.payload;
      if (orders.find(x => x.id === o.id)) return;
      orders.unshift(o);
      renderAllLanes();
      chime();
      flash(`NEW ORDER #${String(o.orderNumber).padStart(3,'0')}`);
    } else if (msg.type === 'order.update') {
      const o = msg.payload;
      const i = orders.findIndex(x => x.id === o.id);
      if (i >= 0) orders[i] = o; else orders.unshift(o);
      renderAllLanes();
    }
  });
}

function bindLaneTabs() {
  document.querySelectorAll('.lane-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.lane-tabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.lane').forEach(l => l.classList.remove('mobile-active'));
      document.querySelector(`.lane[data-lane="${btn.dataset.lane}"]`).classList.add('mobile-active');
    });
  });
}

function bindLaneActions() {
  document.querySelectorAll('.lanes').forEach(root => {
    root.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const card = btn.closest('.ticket');
      const id = card.dataset.id;
      const action = btn.dataset.action;
      const order = orders.find(o => o.id === id);
      if (!order) return;

      let target = null;
      let patch = {};
      if (action === 'forward') {
        target = NEXT[order.status];
        if (!target) return;
        patch.status = target;
        if (target === 'cooking') { patch.cookedBy = member?.id || null; }
        if (target === 'ready')   { patch.cookedAt = new Date().toISOString(); }
        if (target === 'delivered') { patch.deliveredAt = new Date().toISOString(); }
      } else if (action === 'back') {
        target = PREV[order.status];
        if (!target) return;
        patch.status = target;
      }

      const updated = await db.updateOrder(id, patch);
      if (updated) {
        const i = orders.findIndex(o => o.id === id);
        orders[i] = updated;
        renderAllLanes();
      }

      // XP
      if (action === 'forward' && member) {
        if (patch.status === 'ready') {
          const r = await awardCookOrder(member);
          member = r.member; renderFamilyBar();
          flash('+15 XP COOKED');
          r.earned.forEach(b => setTimeout(() => flash(`${b.emoji} ${b.name.toUpperCase()}`), 250));
        } else if (patch.status === 'delivered') {
          const r = await awardDeliverOrder(member);
          member = r.member; renderFamilyBar();
          flash('+5 XP DELIVERED');
        }
      }
    });
  });
}

function renderAllLanes() {
  for (const status of ['pending', 'cooking', 'ready']) {
    const list = orders
      .filter(o => o.status === status)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    $(`#cnt-${status}`).textContent = list.length;
    $(`#lane-${status}`).innerHTML = list.length
      ? list.map(renderTicket).join('')
      : '<div class="lane-empty">— EMPTY —</div>';
  }
}

function renderTicket(o) {
  const meal = getMeal(o.mealSlug);
  const e = meal ? meal.emoji : '🍽️';
  const summary = meal ? summarize(o.mealSlug, o.selections) : '';
  const age = (Date.now() - new Date(o.createdAt).getTime()) / 60000;
  const ageClass = age > 15 ? 'late' : age > 10 ? 'warn' : '';
  const fwdLabel =
    o.status === 'pending'  ? 'START' :
    o.status === 'cooking'  ? 'READY' :
                              'DELIVERED';
  const showBack = o.status !== 'pending';

  return `
    <div class="ticket ${ageClass}" data-id="${o.id}">
      <div class="t-head">
        <span>#${String(o.orderNumber).padStart(3, '0')} · ${o.customerName.toUpperCase()}</span>
      </div>
      <div class="t-meal"><span class="e">${e}</span>${meal?.name || o.mealSlug}</div>
      <div class="t-body">${summary || ''}</div>
      ${o.notes ? `<div class="t-notes">📝 ${escape(o.notes)}</div>` : ''}
      <div class="t-foot">
        <span class="t-age">${ageString(o.createdAt)}</span>
        <div class="t-actions">
          ${showBack ? `<button class="back" data-action="back">↶ BACK</button>` : ''}
          <button data-action="forward">${fwdLabel} →</button>
        </div>
      </div>
    </div>
  `;
}

function repaintAges() {
  document.querySelectorAll('.ticket').forEach(card => {
    const id = card.dataset.id;
    const o = orders.find(x => x.id === id);
    if (!o) return;
    const age = (Date.now() - new Date(o.createdAt).getTime()) / 60000;
    card.classList.toggle('warn', age > 10 && age <= 15);
    card.classList.toggle('late', age > 15);
    const a = card.querySelector('.t-age');
    if (a) a.textContent = ageString(o.createdAt);
  });
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
