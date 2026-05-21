import { db } from './supabase-client.js';
import { meals, mealList, getMeal, summarize } from './meals.js';
import { awardTakeOrder } from './gamify.js';
import { registerSW, flash, modePill } from './pwa.js';

const DAD_NUMBER = '+14434149778';

let family = null;
let member = null;
let currentMealSlug = localStorage.getItem('bk.lastMeal') || 'sandwich';
let selections = {}; // { sectionKey: 'string' or string[] }

const $ = (sel) => document.querySelector(sel);

// ---- Boot ----

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
  renderMealPicker();
  renderSections();
  bindHandlers();
})();

// ---- Render ----

function renderFamilyBar() {
  $('#familyBar').innerHTML = `
    <span>👨‍👩‍👧 ${family.name}</span>
    <span class="code">#${family.joinCode}</span>
    <span class="me">${member?.displayName || 'You'}${member?.xp != null ? ` · ${member.xp} XP` : ''}</span>
  `;
}

function renderMealPicker() {
  const tiles = mealList().map(m => `
    <div class="meal-tile ${m.slug === currentMealSlug ? 'selected' : ''}" data-slug="${m.slug}">
      <span class="e">${m.emoji}</span>${m.name.split(' ')[0].toUpperCase()}
    </div>
  `).join('');
  $('#mealPicker').innerHTML = tiles;
}

function renderSections() {
  const meal = getMeal(currentMealSlug) || meals.sandwich;
  selections = {}; // reset on meal change
  const html = meal.sections.map(sec => `
    <div class="section" data-section="${sec.key}">
      <div class="section-title"><span class="icon">${sec.icon}</span>${sec.title.toUpperCase()}</div>
      <div class="chip-grid" data-group="${sec.key}" data-single="${!!sec.single}">
        ${sec.options.map(opt => `
          <div class="chip" data-cat="${sec.key}" data-value="${opt}">${opt.toUpperCase()}</div>
        `).join('')}
      </div>
    </div>
  `).join('');
  $('#mealSections').innerHTML = html;
}

// ---- Interactions ----

function bindHandlers() {
  $('#mealPicker').addEventListener('click', (e) => {
    const tile = e.target.closest('.meal-tile');
    if (!tile) return;
    currentMealSlug = tile.dataset.slug;
    localStorage.setItem('bk.lastMeal', currentMealSlug);
    renderMealPicker();
    renderSections();
  });

  $('#mealSections').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const grid = chip.closest('.chip-grid');
    const key = grid.dataset.group;
    const single = grid.dataset.single === 'true';
    if (single) {
      grid.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      selections[key] = chip.dataset.value;
    } else {
      chip.classList.toggle('selected');
      selections[key] = [...grid.querySelectorAll('.chip.selected')].map(c => c.dataset.value);
    }
  });

  $('#submitBtn').addEventListener('click', submit);
  $('#copyBtn').addEventListener('click', () => copyOrder().then(ok => flash(ok ? 'COPIED ✓' : 'COPY FAILED')));
  $('#textBtn').addEventListener('click', textOrder);
  $('#newBtn').addEventListener('click', resetForm);
}

// ---- Submit ----

function readSelections() {
  // Make sure we capture the latest from DOM (handles the case where the user
  // skipped clicks → object is empty for those sections).
  const meal = getMeal(currentMealSlug);
  const out = {};
  for (const sec of meal.sections) {
    const grid = $(`.chip-grid[data-group="${sec.key}"]`);
    if (!grid) continue;
    const picks = [...grid.querySelectorAll('.chip.selected')].map(c => c.dataset.value);
    if (sec.single) out[sec.key] = picks[0] || '';
    else            out[sec.key] = picks;
  }
  return out;
}

async function submit() {
  const customerName = $('#customer').value.trim();
  if (!customerName) {
    $('#customer').focus();
    $('#customer').style.background = '#ffd6d6';
    setTimeout(() => $('#customer').style.background = '', 1500);
    return;
  }

  const sels = readSelections();
  const order = await db.createOrder({
    familyId: family.id,
    customerName,
    mealSlug: currentMealSlug,
    selections: sels,
    notes: $('#notes').value.trim(),
    takenBy: member?.id || null,
  });

  if (member) {
    const result = await awardTakeOrder(member, order);
    member = result.member;
    renderFamilyBar();
    if (result.streakBonus) flash(`+${result.streakBonus} STREAK BONUS!`);
    for (const b of result.earned) {
      setTimeout(() => flash(`${b.emoji} ${b.name.toUpperCase()}`), 300);
    }
  }

  $('#orderForm').dataset.order = String(order.orderNumber).padStart(3, '0');
  paintReceipt(order);
  flash(`+10 XP · ORDER #${String(order.orderNumber).padStart(3,'0')} SENT`);
}

function paintReceipt(order) {
  const meal = getMeal(order.mealSlug);
  const fmt = (v) => Array.isArray(v) ? (v.length ? v.join(', ') : '—') : (v || '—');
  const rows = [
    ['Customer', order.customerName],
    ['Meal', `${meal.emoji} ${meal.name}`],
    ...meal.sections.map(s => [s.title, fmt(order.selections[s.key])]),
  ];
  if (order.notes) rows.push(['Notes', order.notes]);

  $('#receiptBody').innerHTML = rows.map(([k, v]) =>
    `<div class="receipt-line"><span class="label-r">${k}</span><span class="value-r">${v}</span></div>`
  ).join('');

  const rec = $('#receipt');
  rec.classList.add('show');
  rec.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ---- Text Dad / Copy ----

function buildOrderText() {
  const meal = getMeal(currentMealSlug);
  const sels = readSelections();
  const summary = summarize(currentMealSlug, sels);
  const ts = new Date().toLocaleString();
  const lines = [
    `BELLA'S KITCHEN — ${meal.emoji} ${meal.name}`,
    ts,
    '',
    `CUSTOMER: ${$('#customer').value.trim() || 'Mystery Customer'}`,
    `ORDER:    ${summary || '(empty)'}`,
  ];
  const notes = $('#notes').value.trim();
  if (notes) lines.push(`NOTES:    ${notes}`);
  return lines.join('\n');
}

async function copyOrder() {
  const text = buildOrderText();
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

async function textOrder() {
  const text = buildOrderText();
  const copied = await copyOrder();
  flash(copied ? 'ORDER COPIED · OPENING MESSAGES' : 'OPENING MESSAGES');
  setTimeout(() => {
    const enc = encodeURIComponent(text);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const url = isIOS ? `sms:${DAD_NUMBER}&body=${enc}` : `sms:${DAD_NUMBER}?body=${enc}`;
    window.location.href = url;
  }, 600);
}

function resetForm() {
  document.querySelectorAll('.chip.selected').forEach(c => c.classList.remove('selected'));
  $('#customer').value = '';
  $('#notes').value = '';
  $('#receipt').classList.remove('show');
  $('#customer').scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('#customer').focus();
}
