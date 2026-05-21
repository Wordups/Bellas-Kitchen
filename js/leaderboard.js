import { db } from './supabase-client.js';
import { BADGES, getStats } from './gamify.js';
import { registerSW, modePill } from './pwa.js';

let family = null;
let me = null;
let members = [];
let orders = [];

const $ = (s) => document.querySelector(s);

(async function boot() {
  registerSW();
  modePill();

  const b = await db.familyBootstrap();
  family = b.family;
  me = b.member;
  if (!family) { location.href = 'index.html'; return; }

  members = await db.listMembers(family.id);
  orders  = await db.listOrders(family.id);

  $('#familyBar').innerHTML = `
    <span>👨‍👩‍👧 ${family.name}</span>
    <span class="code">#${family.joinCode}</span>
    <span class="me">${me?.displayName || ''}</span>`;

  document.querySelectorAll('.lb-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.lb-tabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderLeaderboard(btn.dataset.range);
    });
  });
  renderLeaderboard('week');
  renderBadges();
})();

function weeklyXp(memberId) {
  // Approximate weekly XP from orders touched in the last 7 days.
  const weekAgo = Date.now() - 7 * 86400000;
  let xp = 0;
  for (const o of orders) {
    const t = new Date(o.createdAt).getTime();
    if (t < weekAgo) continue;
    if (o.takenBy === memberId) xp += 10;
    if (o.cookedBy === memberId && o.status === 'ready') xp += 15;
    if (o.cookedBy === memberId && o.status === 'delivered') xp += 20; // cooked+delivered
  }
  return xp;
}

function renderLeaderboard(range) {
  const rows = members
    .map(m => {
      const score = range === 'week' ? weeklyXp(m.id) : (m.xp || 0);
      return { m, score };
    })
    .sort((a, b) => b.score - a.score);

  $('#lbList').innerHTML = rows.length ? rows.map((r, i) => `
    <div class="lb-row">
      <div class="lb-rank">${i + 1}</div>
      <div>
        <div class="lb-name">${escape(r.m.displayName.toUpperCase())}</div>
        <div class="lb-role">${r.m.role.replace('_', ' ')}</div>
      </div>
      <div>
        <div class="lb-xp">${r.score} XP</div>
        <div class="lb-streak">${r.m.streakDays ? `🔥 ${r.m.streakDays}d` : ''}</div>
      </div>
    </div>
  `).join('') : '<div class="lane-empty">— No crew yet —</div>';
}

function renderBadges() {
  // Show "me" first if available, else union across the family.
  const stats = me ? getStats(me.id) : { badges: [] };
  $('#badgesGrid').innerHTML = BADGES.map(b => `
    <div class="badge ${stats.badges.includes(b.id) ? '' : 'locked'}">
      <span class="b-emoji">${b.emoji}</span>${b.name.toUpperCase()}
    </div>
  `).join('');
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
