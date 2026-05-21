// Storage layer for Bella's Kitchen.
//
// Two modes:
//   - cloud: when js/config.js exists with Supabase credentials, talk to Postgres
//     and use Realtime for cross-device sync.
//   - local: pure localStorage + BroadcastChannel. Cross-tab realtime works
//     (kitchen tab updates instantly when order tab submits) but no cross-device.
//
// Public surface is the same in both modes:
//   db.familyBootstrap()    -> {family, member}
//   db.createFamily(name, displayName, role)
//   db.joinFamily(joinCode, displayName, role)
//   db.setMember(member)
//   db.listMembers(familyId)
//   db.createOrder(order)   -> hydrated order
//   db.listOrders(familyId) -> orders[]
//   db.updateOrder(id, patch)
//   db.subscribe(familyId, handler) -> unsubscribe fn
//   db.mode  -> 'cloud' | 'local'

let _config = null;
try {
  const mod = await import('./config.js');
  _config = mod.config;
} catch (e) {
  _config = null;
}

const hasCloud = !!(_config?.supabase?.url && _config?.supabase?.anonKey);

// ============================================================================
// Local mode (default for first-launch / before Supabase is wired)
// ============================================================================

const LS = {
  family:   'bk.family',
  member:   'bk.member',
  members:  'bk.members',
  orders:   'bk.orders',
  counter:  'bk.orderCounter',
};

const channel = ('BroadcastChannel' in window) ? new BroadcastChannel('bk') : null;

const readJSON = (k, fallback) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
};
const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

const broadcast = (type, payload) => {
  if (channel) channel.postMessage({ type, payload });
};

function randomCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const localDb = {
  mode: 'local',

  async familyBootstrap() {
    const family = readJSON(LS.family, null);
    const member = readJSON(LS.member, null);
    return { family, member };
  },

  async createFamily(name, displayName, role = 'customer') {
    const family = { id: uuid(), name, joinCode: randomCode(), createdAt: new Date().toISOString() };
    const member = { id: uuid(), familyId: family.id, displayName, role, xp: 0, streakDays: 0, lastActive: null };
    writeJSON(LS.family, family);
    writeJSON(LS.member, member);
    writeJSON(LS.members, [member]);
    writeJSON(LS.orders, []);
    writeJSON(LS.counter, 0);
    return { family, member };
  },

  async joinFamily(joinCode, displayName, role = 'customer') {
    // In local mode there's only one family per browser. Accept any code that
    // matches what we already have; otherwise create a fresh local family with
    // that code (treats join as "first to set it" since we can't reach a server).
    let family = readJSON(LS.family, null);
    if (!family) {
      family = { id: uuid(), name: 'My Family', joinCode, createdAt: new Date().toISOString() };
      writeJSON(LS.family, family);
      writeJSON(LS.members, []);
      writeJSON(LS.orders, []);
      writeJSON(LS.counter, 0);
    } else if (family.joinCode !== joinCode) {
      throw new Error('Code does not match this device. Create cloud account to share across devices.');
    }
    const member = { id: uuid(), familyId: family.id, displayName, role, xp: 0, streakDays: 0, lastActive: null };
    const members = readJSON(LS.members, []);
    members.push(member);
    writeJSON(LS.members, members);
    writeJSON(LS.member, member);
    return { family, member };
  },

  async setMember(member) {
    writeJSON(LS.member, member);
    const members = readJSON(LS.members, []);
    const idx = members.findIndex(m => m.id === member.id);
    if (idx >= 0) members[idx] = member; else members.push(member);
    writeJSON(LS.members, members);
    broadcast('member.update', member);
  },

  async listMembers() {
    return readJSON(LS.members, []);
  },

  async createOrder(input) {
    const counter = (readJSON(LS.counter, 0) || 0) + 1;
    writeJSON(LS.counter, counter);
    const order = {
      id: uuid(),
      familyId: input.familyId,
      customerName: input.customerName,
      mealSlug: input.mealSlug,
      selections: input.selections,
      notes: input.notes || '',
      status: 'pending',
      orderNumber: counter,
      takenBy: input.takenBy || null,
      cookedBy: null,
      createdAt: new Date().toISOString(),
      cookedAt: null,
      deliveredAt: null,
    };
    const orders = readJSON(LS.orders, []);
    orders.push(order);
    writeJSON(LS.orders, orders);
    broadcast('order.insert', order);
    return order;
  },

  async listOrders() {
    return readJSON(LS.orders, []);
  },

  async updateOrder(id, patch) {
    const orders = readJSON(LS.orders, []);
    const idx = orders.findIndex(o => o.id === id);
    if (idx < 0) return null;
    const next = { ...orders[idx], ...patch };
    orders[idx] = next;
    writeJSON(LS.orders, orders);
    broadcast('order.update', next);
    return next;
  },

  subscribe(_familyId, handler) {
    if (!channel) return () => {};
    const onMsg = (ev) => handler(ev.data);
    channel.addEventListener('message', onMsg);
    return () => channel.removeEventListener('message', onMsg);
  },
};

// ============================================================================
// Cloud mode (Supabase) — lazy-loaded so no JS shipped to local-only users
// ============================================================================

async function buildCloudDb() {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const sb = createClient(_config.supabase.url, _config.supabase.anonKey, {
    realtime: { params: { eventsPerSecond: 5 } },
  });

  const camel = (row) => {
    if (!row) return row;
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      const ck = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      out[ck] = v;
    }
    return out;
  };
  const snake = (obj) => {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const sk = k.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
      out[sk] = v;
    }
    return out;
  };

  return {
    mode: 'cloud',

    async familyBootstrap() {
      const family = readJSON(LS.family, null);
      const member = readJSON(LS.member, null);
      return { family, member };
    },

    async createFamily(name, displayName, role = 'customer') {
      const code = randomCode();
      const { data: famRow, error: famErr } = await sb
        .from('families').insert({ name, join_code: code }).select().single();
      if (famErr) throw famErr;
      const family = camel(famRow);

      const { data: memRow, error: memErr } = await sb
        .from('members').insert({
          family_id: family.id, display_name: displayName, role,
        }).select().single();
      if (memErr) throw memErr;
      const member = camel(memRow);

      writeJSON(LS.family, family);
      writeJSON(LS.member, member);
      return { family, member };
    },

    async joinFamily(joinCode, displayName, role = 'customer') {
      const { data: famRow, error: famErr } = await sb
        .from('families').select().eq('join_code', joinCode).single();
      if (famErr || !famRow) throw new Error('No family with that code.');
      const family = camel(famRow);

      const { data: memRow, error: memErr } = await sb
        .from('members').insert({
          family_id: family.id, display_name: displayName, role,
        }).select().single();
      if (memErr) throw memErr;
      const member = camel(memRow);

      writeJSON(LS.family, family);
      writeJSON(LS.member, member);
      return { family, member };
    },

    async setMember(member) {
      writeJSON(LS.member, member);
      const { error } = await sb.from('members').update(snake({
        displayName: member.displayName, role: member.role,
        xp: member.xp, streakDays: member.streakDays, lastActive: member.lastActive,
      })).eq('id', member.id);
      if (error) console.warn('setMember', error);
    },

    async listMembers(familyId) {
      const { data, error } = await sb.from('members').select().eq('family_id', familyId);
      if (error) { console.warn(error); return []; }
      return data.map(camel);
    },

    async createOrder(input) {
      // server should compute order_number via trigger; for now we approximate by
      // counting existing orders for this family.
      const { count } = await sb.from('orders').select('*', { count: 'exact', head: true })
        .eq('family_id', input.familyId);
      const payload = snake({
        familyId: input.familyId,
        customerName: input.customerName,
        mealSlug: input.mealSlug,
        selections: input.selections,
        notes: input.notes || '',
        status: 'pending',
        orderNumber: (count || 0) + 1,
        takenBy: input.takenBy || null,
      });
      const { data, error } = await sb.from('orders').insert(payload).select().single();
      if (error) throw error;
      return camel(data);
    },

    async listOrders(familyId) {
      const { data, error } = await sb.from('orders')
        .select().eq('family_id', familyId).order('created_at', { ascending: false });
      if (error) { console.warn(error); return []; }
      return data.map(camel);
    },

    async updateOrder(id, patch) {
      const { data, error } = await sb.from('orders')
        .update(snake(patch)).eq('id', id).select().single();
      if (error) { console.warn(error); return null; }
      return camel(data);
    },

    subscribe(familyId, handler) {
      const ch = sb.channel('orders:' + familyId)
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'orders', filter: `family_id=eq.${familyId}` },
            (payload) => {
              const type = payload.eventType === 'INSERT' ? 'order.insert'
                         : payload.eventType === 'UPDATE' ? 'order.update'
                         : 'order.delete';
              handler({ type, payload: camel(payload.new || payload.old) });
            })
        .subscribe();
      return () => sb.removeChannel(ch);
    },
  };
}

// ============================================================================

export const db = hasCloud ? await buildCloudDb() : localDb;
export const mode = db.mode;
