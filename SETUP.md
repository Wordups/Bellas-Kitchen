# Bella's Kitchen — Setup Checklist

Everything Claude Code built ships as a working PWA in **local mode** the
moment you push. The items below upgrade it to **cloud mode** (cross-device
realtime), get it onto `bellaskitchen.app`, and produce an iOS build for the
App Store.

---

## 1. Supabase (cross-device realtime)

Without this, two phones can each use the app independently but can't see
each other's orders. With it, the kitchen iPad watches every phone in the
family in realtime.

1. Create a free Supabase project at https://supabase.com
2. **SQL Editor → New query**, paste the schema below, run it:

   ```sql
   create extension if not exists "pgcrypto";

   create table families (
     id uuid primary key default gen_random_uuid(),
     name text not null,
     join_code text unique not null,
     created_at timestamptz default now()
   );

   create table members (
     id uuid primary key default gen_random_uuid(),
     family_id uuid references families(id) on delete cascade,
     display_name text not null,
     role text check (role in ('chef', 'customer', 'kid_chef')) default 'customer',
     xp int default 0,
     streak_days int default 0,
     last_active date,
     created_at timestamptz default now()
   );

   create table orders (
     id uuid primary key default gen_random_uuid(),
     family_id uuid references families(id) on delete cascade,
     customer_name text not null,
     meal_slug text not null,
     selections jsonb not null,
     notes text,
     status text check (status in ('pending', 'cooking', 'ready', 'delivered')) default 'pending',
     order_number int not null,
     taken_by uuid references members(id),
     cooked_by uuid references members(id),
     created_at timestamptz default now(),
     cooked_at timestamptz,
     delivered_at timestamptz
   );

   -- Realtime
   alter publication supabase_realtime add table orders;

   -- For v1, accept anon reads/writes scoped to a family_id passed by the client.
   -- (Tighten with Auth later when you're ready.)
   alter table families enable row level security;
   alter table members  enable row level security;
   alter table orders   enable row level security;

   create policy "anon read families"  on families for select using (true);
   create policy "anon write families" on families for insert with check (true);

   create policy "anon read members"   on members  for select using (true);
   create policy "anon write members"  on members  for insert with check (true);
   create policy "anon update members" on members  for update using (true);

   create policy "anon read orders"    on orders   for select using (true);
   create policy "anon write orders"   on orders   for insert with check (true);
   create policy "anon update orders"  on orders   for update using (true);
   ```

3. **Project Settings → API** — copy `Project URL` and `anon public` key.
4. In the repo: `cp js/config.example.js js/config.js`, paste the URL + key.
   `js/config.js` is gitignored, so your keys stay local.
5. Reload the app — the pill in the bottom-right will switch from `LOCAL MODE`
   to `CLOUD SYNC`. Orders now sync across devices in real time.

> Tighten later: replace the open policies above with `auth.uid()`-based ones
> once you turn on Supabase Auth (magic links work great for parents; kids can
> stay anon under the family's join code).

---

## 2. Custom domain — `bellaskitchen.app`

1. Buy `bellaskitchen.app` at [Cloudflare Registrar](https://dash.cloudflare.com/) (~$15/yr, no markup).
2. In Cloudflare DNS, add these records (proxy ON, orange cloud):
   - `A`     `@`   `185.199.108.153`
   - `A`     `@`   `185.199.109.153`
   - `A`     `@`   `185.199.110.153`
   - `A`     `@`   `185.199.111.153`
   - `CNAME` `www` `wordups.github.io`
3. In the repo: create a file called `CNAME` (no extension) containing the line
   `bellaskitchen.app`, commit and push.
4. GitHub repo → **Settings → Pages → Custom domain** → enter `bellaskitchen.app`,
   wait for the green check, then enable **Enforce HTTPS**.

> You can do step 3 with: `echo bellaskitchen.app > CNAME; git add CNAME; git commit -m "Add CNAME"; git push`. Until that file exists, the live URL stays
> `https://wordups.github.io/Bellas-Kitchen/`.

---

## 3. Capacitor iOS wrapper (requires a Mac with Xcode)

The scaffolding is in the repo (`package.json`, `capacitor.config.json`).
On a Mac:

```bash
git clone https://github.com/Wordups/Bellas-Kitchen.git
cd Bellas-Kitchen
npm install
npx cap add ios
npx cap sync
npx cap open ios
```

In Xcode:

1. Set your Apple Developer Team in **Signing & Capabilities**.
2. Build to a connected iPhone (Cmd-R). Confirm haptics + status bar + splash.
3. **Product → Archive** → **Distribute App → App Store Connect** → upload.

In App Store Connect:

1. Create a new app, bundle ID `com.takeoff.bellaskitchen`.
2. Fill in metadata (description draft is below).
3. Upload screenshots (6.7" + 6.1" iPhone + 12.9" iPad).
4. Privacy URL: `https://bellaskitchen.app/privacy`
5. Support URL: `https://bellaskitchen.app/support`
6. Age rating: **4+**.
7. Submit for review.

### App Store description (paste verbatim)

> **Bella's Kitchen — Family Dinner, Made Fun**
>
> Turn dinner into the best part of your family's day. Bella's Kitchen is the order-taking game where your kids run the restaurant — and you finally know what everyone actually wants.
>
> • Take orders for the whole family with tappable, kid-friendly menus
> • Live kitchen view shows you exactly what to make
> • Earn XP, build streaks, unlock chef badges
> • Five meal modes: Sandwich, Taco, Breakfast, Pizza, Build-a-Bowl
> • Works for couples, families, and roommates
>
> Built by a dad and his daughter. No ads, no subscriptions, no nonsense.

---

## 4. Verification checklist

Run through this on real devices before calling it shipped:

- [ ] PWA installs cleanly on iOS Safari (Share → Add to Home Screen)
- [ ] PWA installs cleanly on Android Chrome (browser prompts to install)
- [ ] Orders sync between two devices in <2 seconds (cloud mode only)
- [ ] Kitchen panel updates in realtime when order placed
- [ ] XP increments correctly on take/cook/deliver
- [ ] Streaks roll over at midnight local time
- [ ] Offline order entry works and syncs when back online
- [ ] Sound notification plays on kitchen panel for new orders
- [ ] Add-to-home-screen flow works on iOS Safari + Android Chrome
- [ ] Capacitor build runs on physical iPhone via Xcode
- [ ] All 5 meal templates render and submit correctly
- [ ] Family join code flow works end-to-end
- [ ] Landing page loads at `bellaskitchen.app`
