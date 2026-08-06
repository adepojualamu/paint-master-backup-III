// =============================================
// Paint Masters — Admin shared layout + seed data
// =============================================

// Brand mark for the admin sidebar — same dynamic logo as the customer site,
// but rendered with the LIGHT variant because the sidebar background is dark navy.
// "../" prefix is needed because admin pages live one folder deeper.
// Falls back to the "PM" text mark if the logo file is missing.
function adminBrandMark() {
  if (typeof pmBrandMark === 'function') {
    return pmBrandMark({ variant: 'light', pathPrefix: '../' });
  }
  return `<span class="brand-mark">
    <img src="../assets/img/paint-masters-logo-light.png" alt="Paint Masters"
         onerror="this.replaceWith(document.createTextNode('PM'))" />
  </span>`;
}

const ADMIN_NAV = `
<aside class="side">
  <div class="brand">
    ${adminBrandMark()}
    <span class="brand-name">PAINT <span>MASTERS</span></span>
  </div>
  <a class="side-role" href="settings.html?tab=account" id="admin-role-link"
     title="View your account">
    <div class="avatar" style="background:linear-gradient(135deg,var(--blue),var(--navy-900));" id="admin-avatar">AB</div>
    <div>
      <strong id="admin-user-name">Akosua Boateng</strong>
      <small id="admin-user-role">Lead Dispatcher · Accra</small>
    </div>
  </a>
  <nav class="side-nav">
    <div class="group-label">Operations</div>
    <a href="index.html"    data-page="dash"><span class="ico">📊</span> Dashboard</a>
    <a href="jobs.html"     data-page="jobs"><span class="ico">🗂️</span> Job Board <span class="badge st-new" id="nav-new-jobs">3</span></a>
    <a href="volume-reviews.html" data-page="volume-reviews"><span class="ico">🪣</span> Volume Reviews <span class="badge st-warn" id="nav-pending-volume" style="display:none;">0</span></a>
    <a href="assign-bookings.html" data-page="assign-bookings"><span class="ico">📌</span> Assign Bookings <span class="badge st-warn" id="nav-pending-assign" style="display:none;">0</span></a>
    <a href="qa-reviews.html" data-page="qa-reviews"><span class="ico">✔️</span> QA Reviews <span class="badge st-warn" id="nav-pending-qa" style="display:none;">0</span></a>
    <a href="artisans.html" data-page="artisans"><span class="ico">🎨</span> Paint Masters</a>
    <a href="customers.html"data-page="customers"><span class="ico">👥</span> Customers</a>
    <div class="group-label">Resources</div>
    <a href="inventory.html"data-page="inventory"><span class="ico">📦</span> Inventory <span class="badge st-warn" id="nav-low-stock">2 low</span></a>
    <a href="paint-products.html" data-page="paint-products"><span class="ico">🎨</span> Paint Catalog</a>
    <a href="brand-partners.html" data-page="brand-partners"><span class="ico">🤝</span> Brand Partners</a>
    <a href="payouts.html"  data-page="payouts"><span class="ico">💰</span> Painter Payouts</a>
    <a href="finance.html"  data-page="finance"><span class="ico">💼</span> Finance</a>
    <a href="pricing.html"  data-page="pricing"><span class="ico">🏷️</span> Pricing</a>
    <a href="analytics.html"data-page="analytics"><span class="ico">📈</span> Analytics</a>
    <div class="group-label">Account</div>
    <a href="approvals.html" data-page="approvals"><span class="ico">✅</span> Approvals <span class="badge st-warn" id="nav-pending-approvals" style="display:none;">0</span></a>
    <a href="team.html"     data-page="team"><span class="ico">👤</span> Team</a>
    <a href="settings.html" data-page="settings"><span class="ico">⚙️</span> Settings</a>
    <a href="support.html"  data-page="support"><span class="ico">🛟</span> Help & Support</a>
  </nav>
  <div class="side-foot">
    <a href="../index.html">↩  Customer Site</a>
    <a href="#" onclick="adminSignOut();return false;">🚪 Sign out</a>
  </div>
</aside>
`;

const ADMIN_TOPBAR = (title, sub) => `
<div class="topbar">
  <div class="search" style="position:relative;">
    <input id="adminSearchInput" type="search" placeholder="Search jobs, customers, artisans..." autocomplete="off" />
    <div id="adminSearchPop" style="display:none;position:absolute;top:100%;left:0;right:0;margin-top:6px;background:#fff;border:1px solid var(--ink-100);border-radius:12px;box-shadow:0 12px 32px rgba(11,31,58,0.18);max-height:420px;overflow:hidden;z-index:200;"></div>
  </div>
  <div class="top-actions">
    <div class="bell-wrap" id="adminBellWrap" style="position:relative;">
      <button class="icon-btn" title="Notifications" id="adminBellBtn" onclick="toggleAdminBell(event)">
        🔔<span class="dot" id="adminBellDot" style="display:none;"></span>
        <span class="bell-count" id="adminBellCount" style="display:none;position:absolute;top:-4px;right:-4px;background:var(--red);color:#fff;font-size:0.62rem;font-weight:700;padding:1px 5px;border-radius:999px;min-width:16px;text-align:center;line-height:1.4;">0</span>
      </button>
      <div class="bell-pop" id="adminBellPop" style="display:none;position:absolute;top:100%;right:0;margin-top:8px;background:#fff;border:1px solid var(--ink-100);border-radius:12px;box-shadow:0 12px 32px rgba(11,31,58,0.18);width:380px;max-height:480px;overflow:hidden;z-index:200;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid var(--ink-100);">
          <strong style="font-size:0.92rem;color:var(--navy-900);">Notifications</strong>
          <button class="small" style="background:transparent;border:0;color:var(--navy-900);font-weight:600;cursor:pointer;font-size:0.78rem;" onclick="markAdminBellRead()">Mark all read</button>
        </div>
        <div id="adminBellList" style="max-height:400px;overflow-y:auto;"></div>
      </div>
    </div>
    <button class="icon-btn" title="Messages" onclick="location.href='customers.html'">💬</button>
    <button class="btn btn-gold" onclick="location.href='jobs.html'">＋ New Job</button>
  </div>
</div>
`;

// ──────────────────────────────────────────────────────────────
// Role-based access. The backend already enforces admin sub-roles on the
// API (routes/finance.js requires 'finance', assign/QA require 'dispatcher'
// / 'qa', etc.); this mirrors that in the UI so admins only see — and can
// only open — the sections their sub-role owns.
//
// ADMIN_PAGE_ROLES maps a page (data-page) to the sub-role(s) allowed to use
// it. super_admin sees everything. An admin with NO sub_role is treated as
// full-access — this mirrors the backend's requireSubRole bootstrap (any
// admin passes until a super_admin is designated) and avoids locking people
// out mid-migration. Pages absent from the map are open to all admins
// (Dashboard, Analytics, Help).
// ──────────────────────────────────────────────────────────────
const ADMIN_PAGE_ROLES = {
  // Operations — dispatcher
  'jobs':            ['dispatcher'],
  'volume-reviews':  ['dispatcher'],
  'assign-bookings': ['dispatcher'],
  'artisans':        ['dispatcher'],
  'customers':       ['dispatcher'],
  'inventory':       ['dispatcher'],
  'paint-products':  ['dispatcher'],
  'brand-partners':  ['dispatcher'],
  // Quality — qa
  'qa-reviews':      ['qa'],
  // Money / accounting — finance
  'payouts':         ['finance'],
  'finance':         ['finance'],
  'pricing':         ['finance'],
  // Account administration — super_admin only ([] = no ordinary sub-role qualifies)
  'approvals':       [],
  'team':            [],
  'settings':        [],
};

const ADMIN_ROLE_LABELS = {
  dispatcher:  'Dispatcher',
  qa:          'Quality Assurance',
  finance:     'Finance',
  super_admin: 'Super Admin',
};

// The signed-in admin's sub_role (from the login response / GET /auth/me,
// both of which include it), or null if none is set.
function pmAdminSubRole() {
  try { const u = pmAuth.user(); return (u && u.sub_role) ? u.sub_role : null; }
  catch (e) { return null; }
}

// Can the signed-in admin access `page`?
function pmAdminCanAccess(page) {
  const sr = pmAdminSubRole();
  if (!sr || sr === 'super_admin') return true;   // full access / bootstrap
  if (!(page in ADMIN_PAGE_ROLES)) return true;     // unlisted => open to all admins
  return ADMIN_PAGE_ROLES[page].includes(sr);
}

// Remove sidebar links this admin can't use, then drop any now-empty group
// labels so the nav doesn't show a header with nothing under it.
function pmFilterAdminNav() {
  document.querySelectorAll('.side-nav a[data-page]').forEach(a => {
    if (!pmAdminCanAccess(a.dataset.page)) a.remove();
  });
  document.querySelectorAll('.side-nav .group-label').forEach(label => {
    let el = label.nextElementSibling, hasLink = false;
    while (el && !el.classList.contains('group-label')) {
      if (el.tagName === 'A') { hasLink = true; break; }
      el = el.nextElementSibling;
    }
    if (!hasLink) label.remove();
  });
}

// Full-screen overlay shown when an admin opens a page their sub-role can't
// use (e.g. by typing the URL). Fixed + high z-index so it covers whatever
// the page's own script renders underneath.
function pmRenderAccessDenied(page) {
  const sr    = pmAdminSubRole();
  const label = (sr && ADMIN_ROLE_LABELS[sr]) || 'your role';
  const old = document.getElementById('pmAccessDenied'); if (old) old.remove();
  const el = document.createElement('div');
  el.id = 'pmAccessDenied';
  el.setAttribute('role', 'alertdialog');
  el.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(247,250,252,0.98);display:flex;align-items:center;justify-content:center;padding:24px;';
  el.innerHTML =
    '<div style="max-width:440px;text-align:center;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:34px 28px;box-shadow:0 12px 34px rgba(11,31,58,0.10);">' +
      '<div style="font-size:34px;margin-bottom:10px;">🔒</div>' +
      '<h2 style="margin:0 0 8px;font-size:1.15rem;color:#0B1F3A;">Restricted section</h2>' +
      '<p style="margin:0 0 20px;color:#5b6472;font-size:0.94rem;line-height:1.55;">The <strong>' + page + '</strong> section is limited to specific roles. Your role (<strong>' + label + '</strong>) doesn\'t have access. Ask a super-admin if you need it.</p>' +
      '<a href="index.html" style="display:inline-block;background:#0B1F3A;color:#fff;text-decoration:none;padding:10px 20px;border-radius:9px;font-weight:600;">← Back to Dashboard</a>' +
    '</div>';
  document.body.appendChild(el);
}

function adminMount(activePage) {
  // Auth gate — anyone hitting an admin page without being signed in
  // (or signed in as a non-admin) gets bounced to the unified login page.
  // pmAuth lives in ../assets/shared.js; admin pages now load both scripts.
  if (typeof pmAuth !== 'undefined') {
    const u = pmAuth.user();
    if (!u) { location.replace('../login.html?next=admin'); return; }
    if (u.role !== 'admin') { location.replace('../index.html'); return; }
    // First-sign-in password change. Admin-invited team members hit this
    // path on their first visit; the change-password page sits at the
    // project root and accepts ?next=admin to bring them back here after.
    if (u.mustChangePassword) {
      location.replace('../change-password.html?next=admin');
      return;
    }
  }

  const sideHost = document.getElementById('admin-sidebar');
  const topHost  = document.getElementById('admin-topbar');
  if (sideHost) sideHost.innerHTML = ADMIN_NAV;
  if (topHost)  topHost.innerHTML  = ADMIN_TOPBAR();
  if (activePage) {
    document.querySelectorAll('.side-nav a').forEach(a => {
      if (a.dataset.page === activePage) a.classList.add('active');
    });
  }

  // Role-based nav: hide sections this admin's sub-role can't use.
  pmFilterAdminNav();

  // Role guard: if they reached a restricted page directly (typed URL),
  // show the access-denied overlay and stop wiring the rest of the page.
  if (activePage && !pmAdminCanAccess(activePage)) {
    renderAdminRoleCard();
    pmRenderAccessDenied(activePage);
    return;
  }

  // Render the sidebar role card from the signed-in user. Extracted so
  // pages that mutate the user's profile (Settings → Account → Save) can
  // call renderAdminRoleCard() and have the sidebar update immediately.
  renderAdminRoleCard();

  // Wire the notification bell. The first paint reflects whatever's in
  // pmActivity right now; the listener catches future events both from
  // this tab and from other tabs (storage event).
  refreshAdminBell();
  if (typeof pmActivity !== 'undefined' && pmActivity.listen) {
    pmActivity.listen(() => refreshAdminBell());
  }
  // Mount the paintbrush page loader (defined in shared.js) so admin
  // pages also get the cross-page transition spinner.
  if (typeof pmMountLoader === 'function') pmMountLoader();
  // Wire the topbar search.
  wireAdminSearch();
  // Click-outside / Escape closes the bell dropdown + the search pop.
  document.addEventListener('click', (e) => {
    const wrap = document.getElementById('adminBellWrap');
    if (wrap && !wrap.contains(e.target)) closeAdminBell();
    const sp = document.getElementById('adminSearchPop');
    const si = document.getElementById('adminSearchInput');
    if (sp && si && !sp.contains(e.target) && e.target !== si) sp.style.display = 'none';
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeAdminBell(); const sp = document.getElementById('adminSearchPop'); if (sp) sp.style.display = 'none'; } });

  // Keep nav counts current after mount
  setTimeout(updateNavCounts, 0);

  // Live dispatcher badge on the Assign Bookings link — refresh on mount and
  // then poll. One interval per page load (each admin page is a full load).
  setTimeout(updateAssignBadge, 0);
  if (!window.__pmAssignPoll) {
    window.__pmAssignPoll = setInterval(updateAssignBadge, 60 * 1000);
  }

  // In production, pull real data into the store so the list pages aren't
  // blank. Pages that opt in (listen for 'pmStoreReady') re-render when it
  // lands. No-op in demo mode (SEED_* fixtures are used instead).
  pmHydrateAdminStoreFromApi();
}

// ──────────────────────────────────────────────────────────────
// Notification bell (topbar). Reads from pmActivity, paints the unread
// badge, opens a dropdown of recent events. Each row is rendered with
// kind icon, title, source line and relative timestamp.
// ──────────────────────────────────────────────────────────────
function refreshAdminBell() {
  if (typeof pmActivity === 'undefined') return;
  const count = pmActivity.unreadCount();
  const badge = document.getElementById('adminBellCount');
  const dot   = document.getElementById('adminBellDot');
  if (badge) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }
  if (dot) dot.style.display = count > 0 ? 'inline-block' : 'none';

  // Re-render the dropdown list if it's currently open.
  const pop = document.getElementById('adminBellPop');
  if (pop && pop.style.display !== 'none') renderAdminBellList();
}
function renderAdminBellList() {
  const host = document.getElementById('adminBellList'); if (!host) return;
  const list = pmActivity.list().slice(0, 30);
  if (!list.length) {
    host.innerHTML = `<div style="padding:24px;text-align:center;color:var(--ink-500);font-size:0.86rem;">No activity yet. Customer + painter actions will land here.</div>`;
    return;
  }
  host.innerHTML = list.map(ev => {
    const sourceLine = ev.source && ev.source.name ? `${ev.source.name} (${ev.source.role})` : 'System';
    const sevColor = ev.severity === 'error' ? 'var(--red)' : (ev.severity === 'warn' ? '#D97706' : 'var(--ink-500)');
    const unreadBg = ev.read ? 'transparent' : 'rgba(245,184,0,0.08)';
    return `
      <div style="display:grid;grid-template-columns:28px 1fr auto;gap:10px;padding:10px 14px;border-bottom:1px solid var(--ink-100);background:${unreadBg};">
        <div style="font-size:1.1rem;line-height:1.2;">${pmActivity.iconFor(ev.kind)}</div>
        <div>
          <strong style="display:block;font-size:0.88rem;color:var(--navy-900);">${escAdmin(ev.title)}</strong>
          ${ev.sub ? `<div style="font-size:0.78rem;color:var(--ink-500);margin-top:2px;line-height:1.4;">${escAdmin(ev.sub)}</div>` : ''}
          <div style="font-size:0.72rem;color:${sevColor};margin-top:4px;">${escAdmin(sourceLine)}</div>
        </div>
        <div style="font-size:0.72rem;color:var(--ink-500);align-self:start;">${pmActivity.relTime(ev.ts)}</div>
      </div>`;
  }).join('');
}
function toggleAdminBell(e) {
  if (e) e.stopPropagation();
  const pop = document.getElementById('adminBellPop'); if (!pop) return;
  const isOpen = pop.style.display !== 'none';
  if (isOpen) closeAdminBell(); else openAdminBell();
}
function openAdminBell() {
  const pop = document.getElementById('adminBellPop'); if (!pop) return;
  pop.style.display = 'block';
  renderAdminBellList();
}
function closeAdminBell() {
  const pop = document.getElementById('adminBellPop');
  if (pop) pop.style.display = 'none';
}
function markAdminBellRead() {
  if (typeof pmActivity === 'undefined') return;
  pmActivity.markAllRead();
  refreshAdminBell();
  renderAdminBellList();
}
function escAdmin(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ──────────────────────────────────────────────────────────────
// Topbar search. Live search across jobs / customers / artisans in the
// admin store. Debounced 120ms. Keyboard nav: ↓↑ moves selection, Enter
// jumps to the result's detail page. Click-outside closes the popover.
// ──────────────────────────────────────────────────────────────
let _searchTimer = null;
let _searchSelected = -1;
let _searchHits = [];
function wireAdminSearch() {
  const input = document.getElementById('adminSearchInput'); if (!input) return;
  input.addEventListener('input', () => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => runAdminSearch(input.value), 120);
  });
  input.addEventListener('focus', () => {
    if (input.value.trim()) runAdminSearch(input.value);
  });
  input.addEventListener('keydown', (e) => {
    const pop = document.getElementById('adminSearchPop');
    if (pop && pop.style.display !== 'none') {
      if (e.key === 'ArrowDown') { e.preventDefault(); _searchSelected = Math.min(_searchSelected + 1, _searchHits.length - 1); renderSearchSelection(); }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); _searchSelected = Math.max(_searchSelected - 1, 0); renderSearchSelection(); }
      else if (e.key === 'Enter')     {
        e.preventDefault();
        const hit = _searchHits[_searchSelected] || _searchHits[0];
        if (hit) location.href = hit.href;
      }
    }
  });
}
function runAdminSearch(raw) {
  const pop = document.getElementById('adminSearchPop'); if (!pop) return;
  const q = String(raw || '').trim().toLowerCase();
  if (!q) { pop.style.display = 'none'; _searchHits = []; _searchSelected = -1; return; }

  // Resolve the relative path prefix — admin pages live in /admin/, but
  // wireAdminSearch can be called from any of them. The result hrefs are
  // siblings, so we just use the bare filename.
  let s; try { s = (typeof getStore === 'function') ? getStore() : null; } catch (e) { s = null; }
  if (!s) { pop.style.display = 'none'; return; }

  const hits = [];
  // Jobs — match by ref / customer / service / address.
  (s.jobs || []).filter(j => !j.deleted_at).forEach(j => {
    const hay = `${j.ref} ${j.customer} ${j.service} ${j.address || ''}`.toLowerCase();
    if (hay.includes(q)) {
      hits.push({
        kind: 'job', icon: '📋',
        title: `${j.ref} · ${j.service}`,
        sub:   `${j.customer} · ${j.window || ''} · ${j.address || ''}`.trim().replace(/^[· ]+|[· ]+$/g,''),
        href:  `jobs.html#${j.id}`,
      });
    }
  });
  // Customers — match by name / phone / email / city.
  (s.customers || []).forEach(c => {
    const hay = `${c.name} ${c.phone} ${c.email} ${c.city}`.toLowerCase();
    if (hay.includes(q)) {
      hits.push({
        kind: 'customer', icon: '👤',
        title: c.name,
        sub:   `${c.type || 'Customer'} · ${c.city || ''} · ${c.phone || ''}`.trim().replace(/^[· ]+|[· ]+$/g,''),
        href:  `customers.html?id=${encodeURIComponent(c.id)}`,
      });
    }
  });
  // Artisans — match by name / specs / region.
  (s.artisans || []).forEach(a => {
    const hay = `${a.name} ${(a.specs || []).join(' ')} ${a.region}`.toLowerCase();
    if (hay.includes(q)) {
      hits.push({
        kind: 'artisan', icon: '🎨',
        title: a.name,
        sub:   `Paint Master · ${a.region} · ${(a.specs || []).join(', ')}`,
        href:  `artisans.html?id=${encodeURIComponent(a.id)}`,
      });
    }
  });

  _searchHits = hits.slice(0, 30);
  _searchSelected = _searchHits.length ? 0 : -1;
  renderSearchResults(q);
}
function renderSearchResults(q) {
  const pop = document.getElementById('adminSearchPop'); if (!pop) return;
  if (!_searchHits.length) {
    pop.innerHTML = `<div style="padding:18px;text-align:center;color:var(--ink-500);font-size:0.86rem;">No matches for "<strong>${escAdmin(q)}</strong>"</div>`;
    pop.style.display = 'block';
    return;
  }
  // Group by kind for visual scanning. Within a group results stay in match order.
  const groups = { job: [], customer: [], artisan: [] };
  _searchHits.forEach((h, i) => groups[h.kind].push({ ...h, _i: i }));
  const groupTitle = { job: 'Jobs', customer: 'Customers', artisan: 'Paint Masters' };

  const blocks = ['job','customer','artisan'].filter(k => groups[k].length).map(k => {
    return `
      <div style="font-size:0.7rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--ink-500);padding:10px 14px 4px;border-top:1px solid var(--ink-100);">${groupTitle[k]} <span style="color:var(--ink-300);font-weight:500;">${groups[k].length}</span></div>
      ${groups[k].map(h => `
        <a class="admin-search-row" data-i="${h._i}" href="${h.href}"
           style="display:grid;grid-template-columns:24px 1fr;gap:10px;padding:10px 14px;text-decoration:none;color:inherit;border-bottom:1px solid var(--ink-100);">
          <div style="font-size:1rem;line-height:1.2;">${h.icon}</div>
          <div>
            <strong style="display:block;font-size:0.86rem;color:var(--navy-900);">${escAdmin(h.title)}</strong>
            <div style="font-size:0.74rem;color:var(--ink-500);margin-top:2px;line-height:1.4;">${escAdmin(h.sub)}</div>
          </div>
        </a>`).join('')}`;
  }).join('');
  pop.innerHTML = blocks + `<div style="padding:8px 14px;font-size:0.72rem;color:var(--ink-500);background:var(--ink-50);">${_searchHits.length} result${_searchHits.length === 1 ? '' : 's'} · ↓↑ to navigate · Enter to open</div>`;
  pop.style.display = 'block';
  renderSearchSelection();
}
function renderSearchSelection() {
  const pop = document.getElementById('adminSearchPop'); if (!pop) return;
  pop.querySelectorAll('.admin-search-row').forEach(el => {
    const isActive = Number(el.dataset.i) === _searchSelected;
    el.style.background = isActive ? 'rgba(245,184,0,0.10)' : '';
  });
  // Scroll the active row into view.
  const active = pop.querySelector(`.admin-search-row[data-i="${_searchSelected}"]`);
  if (active) active.scrollIntoView({ block: 'nearest' });
}

/**
 * Repaint the sidebar avatar / name / role line from pmAuth.user(). Idempotent.
 *
 * Self-heal: if the cached pmAuth user came from PM_DEMO_USERS but the seed
 * has since been updated, refresh the cached user from the current demo seed
 * so old sessions pick up the new copy without a forced sign-out. Skipped
 * after a manual edit (when the cached user differs from the seed and isn't
 * one of the seed defaults) so admin profile edits aren't reverted.
 */
function renderAdminRoleCard() {
  if (typeof pmAuth === 'undefined') return;
  let u = pmAuth.user();
  if (!u) return;

  if (typeof PM_DEMO_USERS !== 'undefined') {
    const fresh = PM_DEMO_USERS.find(d => d.phone === u.phone);
    // Only auto-heal if the cached user STILL looks like the seed (no manual
    // edits) — we detect that by checking whether the cached name matches
    // the seed name OR a previous seed value. If the user has edited their
    // profile, leave their copy alone.
    if (fresh) {
      const cachedLooksLikeSeed = (u.name === fresh.user.name) || u._fromSeed;
      if (cachedLooksLikeSeed && JSON.stringify(fresh.user) !== JSON.stringify(u)) {
        const merged = Object.assign({}, fresh.user, { _fromSeed: true });
        pmAuth.set({ token: pmAuth.token() || ('demo.' + Date.now()), user: merged });
        u = merged;
      }
    }
  }

  const nameEl = document.getElementById('admin-user-name');
  const roleEl = document.getElementById('admin-user-role');
  const av     = document.getElementById('admin-avatar');
  if (nameEl) nameEl.textContent = u.name || 'Admin';
  if (roleEl) {
    const cap   = s => (s || '').replace(/^./, c => c.toUpperCase());
    // Prefer the actual admin sub-role label (Finance, Dispatcher, …) so the
    // sidebar reflects what the person can actually do; fall back to their
    // saved title or role.
    const title = (u.sub_role && ADMIN_ROLE_LABELS[u.sub_role]) || u.title || cap(u.role || 'admin');
    const where = u.region || 'Paint Masters';
    roleEl.textContent = `${title} · ${where}`;
  }
  if (av) {
    const initials = (u.name || 'AD').split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();
    av.textContent = initials;
  }
}

// Sign out — clears the JWT and returns to the unified login page.
function adminSignOut() {
  if (typeof pmAuth !== 'undefined') pmAuth.logout();
  location.href = '../login.html';
}

// ---------- Shared utilities ----------
function fmtGHS(n) { if (isNaN(n)) return 'GHS 0'; return 'GHS ' + Math.round(n).toLocaleString('en-GH'); }
function fmtDate(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  return dt.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}
function fmtShort(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  return dt.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' });
}
function fmtRel(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  const diff = (Date.now() - dt.getTime()) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return Math.round(diff/60) + ' min ago';
  if (diff < 86400) return Math.round(diff/3600) + ' h ago';
  return Math.round(diff/86400) + ' d ago';
}

function toast(msg, kind='ok') {
  let host = document.getElementById('pm-toast');
  if (!host) {
    host = document.createElement('div');
    host.id = 'pm-toast';
    host.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2000;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = `padding:12px 16px;border-radius:10px;background:${kind==='ok'?'#1E7F4F':kind==='warn'?'#D97706':'#0B1F3A'};color:#fff;box-shadow:0 8px 24px rgba(0,0,0,0.2);font-size:0.9rem;max-width:320px;`;
  host.appendChild(el);
  setTimeout(() => { el.style.transition='opacity 0.3s'; el.style.opacity='0'; setTimeout(()=>el.remove(), 300); }, 2600);
}

// ========== SEED DATA ==========
// Single source of truth used by all admin pages. Mutations persisted to localStorage.

// Phone is the master record for SMS deep links. WhatsApp falls back to phone
// unless a separate `whatsapp` field is set (some painters keep a personal
// number off WhatsApp). Both numbers are stored in international E.164 format
// so pmComms can hand them straight to sms: and wa.me/ links.
//
// commissionRate: per-painter commission percentage on each completed job.
// Default platform rate is 90 (set in admin Settings → Pricing); values here
// override per painter. Senior masters with strong ratings earn 92%; new
// joiners during their probation period earn 85%.
const SEED_ARTISANS = [
  { id:'a1',  initials:'KA', name:'Kofi Asante',      specs:['Interior','Decorative'],   years:7,  rating:4.9, jobs:180, region:'Accra',      status:'on_job',   color:'#D7263D', phone:'+233 24 300 0001', commissionRate:90 },
  { id:'a2',  initials:'AM', name:'Ama Mensah',       specs:['Decorative','Interior'],   years:5,  rating:4.9, jobs:122, region:'Accra',      status:'available',color:'#F5B800', phone:'+233 24 300 0002', commissionRate:90 },
  { id:'a3',  initials:'YO', name:'Yaw Owusu',        specs:['Commercial','Epoxy'],      years:10, rating:4.8, jobs:240, region:'Tema',       status:'available',color:'#1E7F4F', phone:'+233 24 300 0003', commissionRate:92 },
  { id:'a4',  initials:'AB', name:'Abena Boateng',    specs:['Interior'],                years:4,  rating:4.9, jobs:95,  region:'Accra',      status:'available',color:'#2E70C9', phone:'+233 24 300 0004', commissionRate:90 },
  { id:'a5',  initials:'KD', name:'Kwame Dankwa',     specs:['Roof','Commercial'],       years:12, rating:4.8, jobs:310, region:'Kumasi',     status:'leave',    color:'#EA7317', phone:'+233 24 300 0005', commissionRate:92 },
  { id:'a6',  initials:'EA', name:'Efua Adjei',       specs:['Decorative'],              years:6,  rating:5.0, jobs:140, region:'Accra',      status:'on_job',   color:'#D7263D', phone:'+233 24 300 0006', commissionRate:92 },
  { id:'a7',  initials:'KN', name:'Kojo Ntim',        specs:['Epoxy','Commercial'],      years:8,  rating:4.8, jobs:205, region:'Accra',      status:'available',color:'#1E7F4F', phone:'+233 24 300 0007', commissionRate:90 },
  { id:'a8',  initials:'AS', name:'Akosua Sarpong',   specs:['Interior','Roof'],         years:3,  rating:4.7, jobs:72,  region:'Cape Coast', status:'available',color:'#2E70C9', phone:'+233 24 300 0008', commissionRate:85 },
  { id:'a9',  initials:'KB', name:'Kwabena Botwe',    specs:['Roof'],                    years:9,  rating:4.9, jobs:188, region:'Tema',       status:'on_job',   color:'#F5B800', phone:'+233 24 300 0009', commissionRate:90 },
  { id:'a10', initials:'AD', name:'Adwoa Darko',      specs:['Interior','Decorative'],   years:5,  rating:4.9, jobs:118, region:'Accra',      status:'available',color:'#EA7317', phone:'+233 24 300 0010', commissionRate:90 },
  { id:'a11', initials:'YB', name:'Yaa Boadu',        specs:['Commercial'],              years:11, rating:4.8, jobs:265, region:'Accra',      status:'on_job',   color:'#2E70C9', phone:'+233 24 300 0011', commissionRate:92 },
  { id:'a12', initials:'KO', name:'Kwesi Ofori',      specs:['Epoxy','Roof'],            years:6,  rating:4.8, jobs:160, region:'Takoradi',   status:'available',color:'#1E7F4F', phone:'+233 24 300 0012', commissionRate:90 }
];

// Jobs span the full pipeline. `inspection` sits BEFORE `scheduled` and represents
// a request the admin has flagged as needing on-site inspection by a Paint Master
// (acting as agent) before the quote is produced. Senior masters double as
// inspectors — no separate role for now.
const STAGES = ['new','inspection','scheduled','dispatched','on_site','qa','completed'];
const STAGE_LABEL = {
  new:        'New Request',
  inspection: 'Inspection',
  scheduled:  'Scheduled',
  dispatched: 'Dispatched',
  on_site:    'On Site',
  qa:         'QA Check',
  completed:  'Completed'
};
const STAGE_BADGE = {
  new:        'st-new',
  inspection: 'st-insp',
  scheduled:  'st-sched',
  dispatched: 'st-disp',
  on_site:    'st-site',
  qa:         'st-qa',
  completed:  'st-done'
};

const SEED_JOBS = [
  // NEW (unassigned quotes pending booking)
  { id:'j1001', ref:'PM-482015', customer:'Nana Adwoa',      service:'Interior Wall Repaint', area:54,  amount:4465,  stage:'new',        assignedTo:null, date:'2026-05-02', window:'morning',   address:'12 Josif Broz Tito Ave, East Legon',      tags:['Interior','Residential'] },
  { id:'j1002', ref:'PM-482044', customer:'Ama Mensah (SMB)', service:'Retail Storefront',     area:180, amount:24500, stage:'new',        assignedTo:null, date:'2026-05-04', window:'afternoon', address:'Oxford St, Osu',                           tags:['Commercial'] },
  { id:'j1003', ref:'PM-482061', customer:'Mr. Kwame Osei',   service:'Whole-House Package',   area:420, amount:38352, stage:'new',        assignedTo:null, date:'2026-05-06', window:'morning',   address:'Ring Rd Central, Cantonments',             tags:['Residential','Interior'] },
  // INSPECTION (admin flagged for on-site inspection before quote is finalised)
  { id:'j1100', ref:'PM-482078', customer:'Reverence Hotel',  service:'Whole-Property Repaint', area:0,   amount:0,     stage:'inspection', assignedTo:'a3', date:'2026-05-03', window:'morning',   address:'Spintex Road, Tema',                        tags:['Commercial','Specialty'], inspectionNotes:'Customer requested in-person quote for 4-storey façade.' },
  { id:'j1101', ref:'PM-482079', customer:'Adwoa Mensah',     service:'Heritage Restoration',   area:0,   amount:0,     stage:'inspection', assignedTo:null, date:'2026-05-04', window:'afternoon', address:'Jamestown, Accra',                          tags:['Decorative','Specialty'], inspectionNotes:'Pre-1900 building; needs surface assessment before quote.' },
  // SCHEDULED (paid, not yet dispatched)
  { id:'j1004', ref:'PM-481982', customer:'Comfort Asare',   service:'Accent Walls',           area:28,  amount:5200,  stage:'scheduled',  assignedTo:null, date:'2026-04-27', window:'morning',   address:'Spintex Road, Baatsona',                   tags:['Decorative'] },
  { id:'j1005', ref:'PM-481970', customer:'Stanbic Office',  service:'Office Fit-Out',         area:320, amount:14250, stage:'scheduled',  assignedTo:null, date:'2026-04-28', window:'afternoon', address:'Airport City, Accra',                      tags:['Commercial'] },
  // DISPATCHED (assigned, traveling)
  { id:'j1006', ref:'PM-481955', customer:'Prince Dogbe',    service:'Kitchen Repaint',        area:36,  amount:3100,  stage:'dispatched', assignedTo:'a2', date:'2026-04-26', window:'morning',   address:'Labone Crescent, Labone',                  tags:['Residential'] },
  // ON SITE
  { id:'j1007', ref:'PM-481930', customer:'Golden Tulip',    service:'Hotel Floor Repaint',    area:540, amount:32600, stage:'on_site',    assignedTo:'a3', date:'2026-04-25', window:'morning',   address:'Liberation Rd, Accra',                     tags:['Commercial'] },
  { id:'j1008', ref:'PM-481905', customer:'Ekow Quansah',    service:'Interior Wall Repaint',  area:62,  amount:4900,  stage:'on_site',    assignedTo:'a1', date:'2026-04-25', window:'morning',   address:'North Ridge, Accra',                       tags:['Residential','Interior'] },
  // QA
  { id:'j1009', ref:'PM-481878', customer:'Vida Akuffo',     service:'Faux Finish Feature',    area:18,  amount:3850,  stage:'qa',         assignedTo:'a6', date:'2026-04-24', window:'midday',    address:'Airport West, Accra',                      tags:['Decorative'] },
  { id:'j1010', ref:'PM-481862', customer:'Ato Essien',      service:'Roof Coating',           area:210, amount:22100, stage:'qa',         assignedTo:'a9', date:'2026-04-23', window:'morning',   address:'Community 18, Tema',                       tags:['Specialty','Roof'] },
  // COMPLETED
  { id:'j1011', ref:'PM-481801', customer:'Akwesi Dwomoh',   service:'Exterior Façade',        area:300, amount:18900, stage:'completed', assignedTo:'a11',date:'2026-04-22', window:'morning',   address:'Adabraka, Accra',                          tags:['Residential'] },
  { id:'j1012', ref:'PM-481772', customer:'Farida Yakubu',   service:'Doors & Trim',           area:22,  amount:2400,  stage:'completed', assignedTo:'a4', date:'2026-04-21', window:'afternoon', address:'Dzorwulu, Accra',                          tags:['Residential'] }
];

const SEED_CUSTOMERS = [
  { id:'c1', name:'Nana Adwoa',     type:'Homeowner',        phone:'+233 24 111 2233', email:'n.adwoa@gmail.com',  city:'Accra',      jobs:3, ltv:12400, lastJob:'2026-04-24', rating:5.0 },
  { id:'c2', name:'Mr. Kwame Osei', type:'Property Manager', phone:'+233 20 554 9912', email:'kwame@estatesgh.com',city:'Accra',      jobs:14,ltv:98500, lastJob:'2026-04-24', rating:4.9 },
  { id:'c3', name:'Ama Mensah',     type:'SMB Owner',        phone:'+233 55 212 7788', email:'ama@mensafabrics.com',city:'Accra',     jobs:5, ltv:41200, lastJob:'2026-04-18', rating:4.9 },
  { id:'c4', name:'Comfort Asare',  type:'Homeowner',        phone:'+233 24 633 8120', email:'comfort.a@mail.com', city:'Accra',      jobs:1, ltv:5200,  lastJob:'2026-04-27', rating:null },
  { id:'c5', name:'Stanbic Office', type:'SMB Owner',        phone:'+233 30 269 1000', email:'facilities@stanbic.gh.com',city:'Accra',jobs:2, ltv:28500, lastJob:'2026-04-28', rating:4.7 },
  { id:'c6', name:'Prince Dogbe',   type:'Homeowner',        phone:'+233 54 228 4410', email:'prince.dogbe@mail.com',city:'Accra',   jobs:2, ltv:6900,  lastJob:'2026-04-26', rating:5.0 },
  { id:'c7', name:'Golden Tulip',   type:'SMB Owner',        phone:'+233 30 221 3333', email:'ops@goldentulip.gh',  city:'Accra',     jobs:4, ltv:115200,lastJob:'2026-04-25', rating:4.8 },
  { id:'c8', name:'Ekow Quansah',   type:'Homeowner',        phone:'+233 26 117 5501', email:'ekow.q@mail.com',     city:'Accra',     jobs:1, ltv:4900,  lastJob:'2026-04-25', rating:null },
  { id:'c9', name:'Vida Akuffo',    type:'Homeowner',        phone:'+233 24 900 1101', email:'vida.a@mail.com',     city:'Accra',     jobs:3, ltv:11600, lastJob:'2026-04-24', rating:4.9 },
  { id:'c10',name:'Ato Essien',     type:'Homeowner',        phone:'+233 27 335 2244', email:'ato.e@mail.com',      city:'Tema',      jobs:2, ltv:25600, lastJob:'2026-04-23', rating:4.8 },
  { id:'c11',name:'Akwesi Dwomoh',  type:'Homeowner',        phone:'+233 26 118 9021', email:'akwesi.d@mail.com',   city:'Accra',     jobs:1, ltv:18900, lastJob:'2026-04-22', rating:4.9 },
  { id:'c12',name:'Farida Yakubu',  type:'Homeowner',        phone:'+233 54 881 2260', email:'farida.y@mail.com',   city:'Accra',     jobs:1, ltv:2400,  lastJob:'2026-04-21', rating:5.0 }
];

const SEED_INVENTORY = [
  { sku:'DLX-WS-IVR', name:'Dulux Weathershield 4L — Ivory',    category:'Paint — Standard', stock:32, reorder:20, unit:'tin', cost:180, supplier:'Dulux Ghana' },
  { sku:'DLX-WS-WHT', name:'Dulux Weathershield 4L — Pure White', category:'Paint — Standard', stock:28, reorder:20, unit:'tin', cost:180, supplier:'Dulux Ghana' },
  { sku:'LEY-MT-OFW', name:'Leyland Matte 4L — Off-White',      category:'Paint — Standard', stock:18, reorder:15, unit:'tin', cost:155, supplier:'Leyland' },
  { sku:'AZR-EML-GRN',name:'Azar Emulsion 4L — Forest Green',   category:'Paint — Brand',    stock:12, reorder:10, unit:'tin', cost:120, supplier:'Azar Paints' },
  { sku:'CRL-GL-BLK', name:'Coral Gloss 4L — Black',            category:'Paint — Brand',    stock:8,  reorder:12, unit:'tin', cost:130, supplier:'Coral Paints' },
  { sku:'BGR-PRM-WHT',name:'Berger Sealer Primer 4L',           category:'Primer',           stock:40, reorder:25, unit:'tin', cost:95,  supplier:'Berger' },
  { sku:'EPX-CLR',    name:'2-part Epoxy Floor Coat 10L',       category:'Specialty',        stock:6,  reorder:8,  unit:'set', cost:780, supplier:'Imported' },
  { sku:'RF-ALUM',    name:'Aluminium Roof Coating 20L',        category:'Specialty',        stock:14, reorder:10, unit:'drum',cost:620, supplier:'Imported' },
  { sku:'TAP-MSK',    name:'Masking Tape 48mm × 50m',           category:'Consumable',       stock:120,reorder:60, unit:'roll',cost:18,  supplier:'General' },
  { sku:'DRP-CTH',    name:'Canvas Drop Cloth 3×4m',            category:'Consumable',       stock:46, reorder:30, unit:'pc',  cost:85,  supplier:'General' },
  { sku:'RLR-9IN',    name:'Microfibre Roller Sleeve 9"',       category:'Consumable',       stock:64, reorder:40, unit:'pc',  cost:22,  supplier:'General' },
  { sku:'BRH-SET',    name:'Brush Set 1"/2"/3" — Pro',          category:'Consumable',       stock:22, reorder:25, unit:'set', cost:95,  supplier:'General' }
];

// ------ State store with localStorage persistence ------
// v2 — added `inspection` stage + seed jobs. Bumping the key forces a fresh
// seed for demo users who already have state in localStorage.
const STORE_KEY = 'pm_admin_state_v2';
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (s) return s;
  } catch(e){}
  return null;
}
function saveState(s) { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch(e){} }
function resetState() { localStorage.removeItem(STORE_KEY); }

function getStore() {
  let s = loadState();
  if (!s) {
    // Production deployments hydrate empty so the dispatcher's real entries
    // are the only data on the platform. Demo deployments hydrate with the
    // SEED_* fixtures so the platform is browseable straight after install.
    const isProd = (typeof PM_IS_PRODUCTION !== 'undefined') && PM_IS_PRODUCTION;
    s = isProd ? {
      artisans:  [],
      jobs:      [],
      customers: [],
      inventory: [],
      activity:  []
    } : {
      artisans: SEED_ARTISANS,
      jobs: SEED_JOBS,
      customers: SEED_CUSTOMERS,
      inventory: SEED_INVENTORY,
      activity: [
        { kind:'booking', who:'Nana Adwoa',    what:'booked Interior Wall Repaint',         amount:4465,  t: Date.now() - 1000*60*12 },
        { kind:'qa',      who:'Vida Akuffo',   what:'job moved to QA',                     amount:3850,  t: Date.now() - 1000*60*45 },
        { kind:'done',    who:'Akwesi Dwomoh', what:'job completed + warranty issued',     amount:18900, t: Date.now() - 1000*60*120 },
        { kind:'dispatch',who:'Prince Dogbe',  what:'Ama Mensah assigned (Kitchen Repaint)',amount:null,  t: Date.now() - 1000*60*210 },
        { kind:'review',  who:'Farida Yakubu', what:'left a 5★ review',                    amount:null,  t: Date.now() - 1000*60*320 }
      ]
    };
    saveState(s);
  }
  // Drain the customer→admin inbox. Anything queued by pmCreateAdminJob()
  // (booking confirmations) or pmCreateAdminCustomer() (new account signups)
  // gets merged into the live store and the inbox is cleared.
  try {
    const inbox = JSON.parse(localStorage.getItem('pm_admin_inbox_v1') || 'null');
    if (inbox && (Array.isArray(inbox.jobs) || Array.isArray(inbox.activity) || Array.isArray(inbox.customers))) {
      let drained = 0;
      (inbox.jobs || []).forEach(j => {
        if (!s.jobs.some(existing => existing.id === j.id)) {
          s.jobs.unshift(j);
          drained++;
        }
      });
      // New signups land in the Customers list with isLead=true so the admin
      // can see them as a potential before they've booked anything.
      (inbox.customers || []).forEach(c => {
        const dup = s.customers.some(existing =>
          (existing.phone && c.phone && existing.phone === c.phone) ||
          (existing.email && c.email && existing.email.toLowerCase() === c.email.toLowerCase())
        );
        if (!dup) {
          s.customers.unshift(c);
          drained++;
        }
      });
      (inbox.activity || []).forEach(a => s.activity.unshift(a));
      localStorage.removeItem('pm_admin_inbox_v1');
      if (drained > 0) saveState(s);
    }
  } catch (e) { /* inbox malformed, ignore */ }

  // Normalise jobs: every record must carry an explicit start (date) AND end
  // date plus a durationDays count. Older records written before this rule
  // existed only carry `date`; we backfill durationDays (default 1) and
  // compute endDate = date + durationDays - 1. Idempotent — safe to run
  // every getStore() call.
  let _normalised = false;
  s.jobs.forEach(j => {
    if (j.durationDays == null) {
      // Use the service name as a heuristic — multi-day services get more.
      const heavy = /Whole-Property|Whole-House|Hotel|Façade|Roof|Office Fit-Out|Storefront/i;
      j.durationDays = heavy.test(j.service || '') ? 3 : (j.area > 200 ? 2 : 1);
      _normalised = true;
    }
    if (!j.endDate && j.date) {
      const d = new Date(j.date);
      d.setDate(d.getDate() + Math.max(0, (j.durationDays || 1) - 1));
      j.endDate = d.toISOString().slice(0, 10);
      _normalised = true;
    }
  });
  if (_normalised) saveState(s);
  return s;
}

function mutate(fn) {
  const s = getStore();
  fn(s);
  saveState(s);
  return s;
}

// Helper to get an artisan by id
function artisanById(id) { return getStore().artisans.find(a => a.id === id); }

// Update nav counts on every page
function updateNavCounts() {
  const s = getStore();
  const newCount = s.jobs.filter(j => j.stage === 'new').length;
  const lowStock = s.inventory.filter(i => i.stock <= i.reorder).length;
  const nj = document.getElementById('nav-new-jobs'); if (nj) nj.textContent = newCount;
  const ls = document.getElementById('nav-low-stock'); if (ls) ls.textContent = lowStock + ' low';

  // Pending artisan approvals — comes from pmUsers (shared.js, loaded first).
  if (typeof pmUsers !== 'undefined') {
    const pending = pmUsers.list({ status: 'pending', role: 'painter' }).length;
    const pa = document.getElementById('nav-pending-approvals');
    if (pa) {
      pa.textContent = pending;
      pa.style.display = pending > 0 ? 'inline-block' : 'none';
    }
  }
}

// ──────────────────────────────────────────────────────────────
// Dispatcher notification. The auto-assigner proposes a painter for every new
// booking but stays silent until someone opens Assign Bookings. This badges
// the sidebar "Assign Bookings" link (visible on every admin page) with the
// number of bookings that need a dispatcher: proposals awaiting approval plus
// anything still unassigned. Reads live counts from the API (GET /api/bookings
// returns `total`), so it reflects real backend state, not the demo store.
// Best-effort — if the backend is down or the link is hidden for this role,
// it silently no-ops.
// ──────────────────────────────────────────────────────────────
async function updateAssignBadge() {
  const badge = document.getElementById('nav-pending-assign');
  if (!badge) return;   // link hidden for this sub-role, or not on an admin page
  try {
    const t = (typeof pmAuth !== 'undefined' && pmAuth.token) ? pmAuth.token() : null;
    const headers = t ? { Authorization: 'Bearer ' + t } : {};
    const [ap, un] = await Promise.all([
      fetch('/api/bookings?status=pending_approval&limit=1',   { headers }),
      fetch('/api/bookings?status=pending_assignment&limit=1', { headers }),
    ]);
    if (!ap.ok || !un.ok) return;
    const [apj, unj] = await Promise.all([ap.json(), un.json()]);
    const awaiting   = Number(apj.total) || 0;
    const unassigned = Number(unj.total) || 0;
    const count = awaiting + unassigned;
    badge.textContent = String(count);
    badge.title = `${awaiting} awaiting approval · ${unassigned} unassigned`;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  } catch (e) { /* backend unreachable — leave the badge as-is */ }
}

// ──────────────────────────────────────────────────────────────
// Production data hydration. In demo mode the admin store is seeded from the
// SEED_* fixtures. In production it starts empty, so the list pages (Paint
// Masters, Customers, Job Board) would render blank. This fetches the real
// data from the API and maps it into the store shape those pages already
// read, then fires a 'pmStoreReady' event so a page can re-render with live
// data. Best-effort: on any failure the store is left as-is.
//
// Note: /api/painters returns the ACTIVE roster only (suspended painters are
// excluded), and lists are capped at 100 rows per the API's max page size —
// pagination for larger rosters is a follow-up.
// ──────────────────────────────────────────────────────────────
function _pmInitials(name) {
  return String(name || '').trim().split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase() || '—';
}
function _pmStageFromStatus(s) {
  switch (s) {
    case 'pending_assignment':
    case 'pending_approval': return 'new';
    case 'pending':
    case 'confirmed':        return 'scheduled';
    case 'in_progress':      return 'on_site';
    case 'qa_pending':       return 'qa';
    case 'completed':        return 'completed';
    default:                 return null;   // cancelled / unknown -> filtered out
  }
}
function pmMapPainterToArtisan(p) {
  return {
    id: p.id, initials: _pmInitials(p.name), name: p.name,
    specs: Array.isArray(p.services) ? p.services : [],
    years: p.experience_years || 0, rating: p.avg_rating || 0, jobs: p.review_count || 0,
    region: p.city || '', status: 'available',
    color: p.avatar_color || '#2E70C9', phone: p.phone || '', email: p.email || '',
    commissionRate: 90,
  };
}
function pmMapBookingToJob(b) {
  const stage = _pmStageFromStatus(b.status);
  if (!stage) return null;
  return {
    id: b.id, ref: b.id, customer: b.customer_name || '—', service: b.service || '',
    area: b.area_sqm || 0, amount: b.total || 0, stage,
    assignedTo: (b.painter_id != null) ? b.painter_id : null,
    date: String(b.job_date || '').slice(0, 10), window: 'All-day',
    address: b.address || '', durationDays: b.duration_days || 1,
    tags: b.service ? [b.service] : [],
  };
}
function pmMapUserToCustomer(u) {
  return { id: u.id, name: u.name, type: 'Customer', phone: u.phone || '', email: u.email || '',
    city: '', jobs: 0, ltv: 0, lastJob: null, rating: 0 };
}

// Fetch every page of a paginated list endpoint (those returning { pages,
// <key>: [...] }, capped at 100 rows/page). Page 1 is fetched first to learn
// the page count, then the rest in parallel. maxPages bounds a runaway roster.
// Returns the concatenated array, or null if the first request fails.
async function _pmFetchAllPages(baseUrl, key, headers, opts) {
  const pageSize = (opts && opts.pageSize) || 100;
  const maxPages = (opts && opts.maxPages) || 50;
  const first = await fetch(baseUrl + '?limit=' + pageSize + '&page=1', { headers });
  if (!first.ok) return null;
  const j0 = await first.json();
  let rows = Array.isArray(j0[key]) ? j0[key].slice() : [];
  const pages = Math.min(Number(j0.pages) || 1, maxPages);
  if (pages > 1) {
    const reqs = [];
    for (let p = 2; p <= pages; p++) {
      reqs.push(fetch(baseUrl + '?limit=' + pageSize + '&page=' + p, { headers }).then(r => r.ok ? r.json() : null));
    }
    const more = await Promise.all(reqs);
    for (const m of more) { if (m && Array.isArray(m[key])) rows = rows.concat(m[key]); }
  }
  return rows;
}

async function pmHydrateAdminStoreFromApi() {
  if (typeof PM_IS_PRODUCTION === 'undefined' || !PM_IS_PRODUCTION) return false;   // demo uses SEED_*
  try {
    const t = (typeof pmAuth !== 'undefined' && pmAuth.token) ? pmAuth.token() : null;
    const headers = t ? { Authorization: 'Bearer ' + t } : {};
    const [painters, bookings, cr] = await Promise.all([
      _pmFetchAllPages('/api/painters', 'painters', headers),
      _pmFetchAllPages('/api/bookings', 'bookings', headers),
      fetch('/api/admin/users?role=customer', { headers }),
    ]);
    const store = getStore();
    if (painters) store.artisans = painters.map(pmMapPainterToArtisan);
    if (bookings) store.jobs     = bookings.map(pmMapBookingToJob).filter(Boolean);
    if (cr.ok) { const j = await cr.json(); if (Array.isArray(j.users)) store.customers = j.users.map(pmMapUserToCustomer); }
    // Mark artisans who are currently on an active job.
    const activeStages = new Set(['dispatched', 'on_site', 'qa']);
    const busy = new Set((store.jobs || []).filter(j => activeStages.has(j.stage) && j.assignedTo != null).map(j => j.assignedTo));
    (store.artisans || []).forEach(a => { if (busy.has(a.id)) a.status = 'on_job'; });
    saveState(store);
    window.dispatchEvent(new CustomEvent('pmStoreReady'));
    return true;
  } catch (e) { return false; }
}

// Common: schedule nav count update after mount
window.addEventListener('load', () => setTimeout(updateNavCounts, 0));
