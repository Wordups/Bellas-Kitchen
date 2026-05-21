import { db } from './supabase-client.js';
import { registerSW, flash, modePill } from './pwa.js';

const $ = (s) => document.querySelector(s);

(function boot() {
  registerSW();
  modePill();

  let role = 'kid_chef';
  $('#roleGrid').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    $('#roleGrid').querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    role = chip.dataset.value;
  });
  // default-select kid_chef
  $('#roleGrid').querySelector('.chip[data-value="kid_chef"]').classList.add('selected');

  $('#createBtn').addEventListener('click', async () => {
    const familyName = $('#familyName').value.trim();
    const myName     = $('#myName').value.trim();
    if (!familyName || !myName) { flash('FILL IN BOTH NAMES'); return; }
    try {
      const { family } = await db.createFamily(familyName, myName, role);
      flash(`FAMILY CODE: ${family.joinCode}`);
      setTimeout(() => location.href = 'app.html', 900);
    } catch (e) {
      flash('SOMETHING BROKE');
      console.error(e);
    }
  });

  $('#joinBtn').addEventListener('click', async () => {
    const code = $('#joinCode').value.trim();
    const name = $('#joinName').value.trim();
    if (code.length !== 4 || !/^\d{4}$/.test(code)) { flash('CODE MUST BE 4 DIGITS'); return; }
    if (!name) { flash('ENTER YOUR NAME'); return; }
    try {
      await db.joinFamily(code, name, 'customer');
      setTimeout(() => location.href = 'app.html', 400);
    } catch (e) {
      flash(e.message || 'NO MATCH');
    }
  });
})();
