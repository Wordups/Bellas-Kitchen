// XP / streak / badge logic.
// Persists per-member state through the storage layer.

import { db } from './supabase-client.js';

export const XP = {
  takeOrder:    10, // kid_chef takes an order
  cookOrder:    15, // chef finishes cooking
  deliverOrder:  5,
  streakBonus:  25, // applied once when streak crosses 3 days
};

export const BADGES = [
  { id: 'first_order',     emoji: '🎉', name: 'First Order',     test: m => m.lifetimeOrders >= 1 },
  { id: 'order_x10',       emoji: '🔟', name: 'Order Up x10',    test: m => m.lifetimeOrders >= 10 },
  { id: 'streak_7',        emoji: '🔥', name: '7-Day Streak',    test: m => m.streakDays >= 7 },
  { id: 'chefs_special',   emoji: '👨‍🍳', name: "Chef's Special", test: m => m.cooked >= 25 },
  { id: 'multi_cuisine',   emoji: '🌍', name: 'Multi-Cuisine',   test: m => (m.cuisinesTried || []).length >= 4 },
  { id: 'family_favorite', emoji: '⭐', name: 'Family Favorite', test: m =>
      Object.values(m.byCustomer || {}).some(n => n >= 50) },
];

// Member state extends the DB row with derived counters held in localStorage,
// keyed by member id, because we don't have a dedicated stats table yet.
const STATS_KEY = (id) => `bk.stats.${id}`;

const loadStats = (id) => {
  try { return JSON.parse(localStorage.getItem(STATS_KEY(id))) || emptyStats(); }
  catch { return emptyStats(); }
};
const saveStats = (id, s) => localStorage.setItem(STATS_KEY(id), JSON.stringify(s));

const emptyStats = () => ({
  lifetimeOrders: 0,
  cooked: 0,
  delivered: 0,
  cuisinesTried: [],
  byCustomer: {},
  badges: [],
  xp: 0,
  streakDays: 0,
  lastActive: null,
});

function bumpStreak(stats) {
  const today = new Date().toISOString().slice(0, 10);
  if (stats.lastActive === today) return 0;
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let bonus = 0;
  if (stats.lastActive === yest) {
    stats.streakDays = (stats.streakDays || 0) + 1;
    if (stats.streakDays === 3) bonus = XP.streakBonus;
  } else {
    stats.streakDays = 1;
  }
  stats.lastActive = today;
  return bonus;
}

function evalBadges(stats) {
  const earned = [];
  for (const b of BADGES) {
    if (b.test(stats) && !stats.badges.includes(b.id)) {
      stats.badges.push(b.id);
      earned.push(b);
    }
  }
  return earned;
}

async function applyDelta(member, delta) {
  const stats = loadStats(member.id);
  Object.assign(stats, delta(stats));
  const streakBonus = bumpStreak(stats);
  stats.xp += streakBonus;
  const newBadges = evalBadges(stats);
  saveStats(member.id, stats);

  const updated = { ...member, xp: stats.xp, streakDays: stats.streakDays, lastActive: stats.lastActive };
  await db.setMember(updated);
  return { member: updated, stats, earned: newBadges, streakBonus };
}

export async function awardTakeOrder(member, order) {
  return applyDelta(member, (s) => {
    s.xp = (s.xp || 0) + XP.takeOrder;
    s.lifetimeOrders = (s.lifetimeOrders || 0) + 1;
    s.byCustomer[order.customerName] = (s.byCustomer[order.customerName] || 0) + 1;
    if (!s.cuisinesTried.includes(order.mealSlug)) s.cuisinesTried.push(order.mealSlug);
    return {};
  });
}

export async function awardCookOrder(member) {
  return applyDelta(member, (s) => {
    s.xp = (s.xp || 0) + XP.cookOrder;
    s.cooked = (s.cooked || 0) + 1;
    return {};
  });
}

export async function awardDeliverOrder(member) {
  return applyDelta(member, (s) => {
    s.xp = (s.xp || 0) + XP.deliverOrder;
    s.delivered = (s.delivered || 0) + 1;
    return {};
  });
}

export function getStats(memberId) {
  return loadStats(memberId);
}

export function badgeMeta(id) {
  return BADGES.find(b => b.id === id);
}
