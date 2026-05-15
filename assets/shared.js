// =============================================
// Paint Masters — shared nav/footer + utilities
// =============================================

// ─────────────────────────────────────────────
// PM_MODE — 'demo' (default) or 'production'.
//
// Controlled by a `<meta name="pm-mode" content="production">` tag in the
// HTML head. When production:
//   • PM_DEMO_USERS is empty so the local-fallback login can't sign anyone in
//     — only real backend auth is allowed.
//   • Admin store seeds (jobs / customers / artisans / inventory / activity)
//     start empty so a fresh deployment shows zero data, ready for the
//     dispatcher's real entries.
//   • Painter dashboard skips its own demo-job seed.
// To toggle: edit the meta tag in each HTML head, or use Settings → Data →
// "Reset to clean production state" once it ships.
// ─────────────────────────────────────────────
function pmReadMode() {
  try {
    const meta = document.querySelector('meta[name="pm-mode"]');
    const v = ((meta && meta.content) || '').trim().toLowerCase();
    return v === 'production' ? 'production' : 'demo';
  } catch (e) { return 'demo'; }
}
const PM_MODE = pmReadMode();
const PM_IS_PRODUCTION = PM_MODE === 'production';

// ─────────────────────────────────────────────
// BRAND CONFIG — single source of truth.
// Four asset variants live in assets/img/:
//   mark        — the simplified PM monogram, dark-navy ink (for light bgs)
//   markLight   — same monogram in white (for dark bgs: footer, sidebar, hero)
//   lockup      — full horizontal "PAINT MASTERS" lockup, dark text (for light bgs)
//   lockupLight — same lockup recoloured for dark bgs
// To swap the official logo, just replace the files. To use different filenames,
// edit this block. If a file is missing the brand falls back to the text mark "PM".
// ─────────────────────────────────────────────
const PM_BRAND = {
  // Paths are resolved relative to whichever page is loading.
  // Customer pages live at the project root; admin pages live under /admin/
  // so admin-shared.js prepends "../" when needed.
  mark:        'assets/img/paint-masters-logo.png',
  markLight:   'assets/img/paint-masters-logo-light.png',
  lockup:      'assets/img/paint-masters-logo-full.png',
  lockupLight: 'assets/img/paint-masters-logo-full-light.png',
  text:        'PM',
  alt:         'Paint Masters'
};

// Returns HTML for the brand mark.
//   variant: 'dark' (default) for the dark navy mark — looks right on light bgs
//   variant: 'light' for the white mark — looks right on dark bgs (footer, sidebar)
//   kind: 'mark' (default) for the small square monogram
//   kind: 'lockup' for the full horizontal lockup with wordmark
//   pathPrefix: '../' if the page is one folder deep (e.g. admin/*.html)
function pmBrandMark({ variant = 'dark', kind = 'mark', pathPrefix = '' } = {}) {
  const key = kind === 'lockup'
    ? (variant === 'light' ? 'lockupLight' : 'lockup')
    : (variant === 'light' ? 'markLight' : 'mark');
  const src = pathPrefix + PM_BRAND[key];
  const cls = kind === 'lockup' ? 'brand-lockup' : 'brand-mark';
  return `<span class="${cls}">
    <img src="${src}" alt="${PM_BRAND.alt}"
         onerror="this.replaceWith(document.createTextNode('${PM_BRAND.text}'))" />
  </span>`;
}

const PM_NAV = `
<div class="kente-stripe"></div>
<nav class="nav">
  <div class="nav-inner">
    <a href="index.html" class="brand" aria-label="Paint Masters home">
      ${pmBrandMark({ variant: 'dark' })}
      <span class="brand-name">PAINT <span>MASTERS</span></span>
    </a>
    <div class="nav-links">
      <a href="index.html" data-page="home">Home</a>
      <a href="services.html" data-page="services">Services</a>
      <a href="quote.html" data-page="quote">Get a Quote</a>
      <a href="artisans.html" data-page="artisans">Our Masters</a>
      <a href="track.html" data-page="track">Track Project</a>
      <a href="about.html" data-page="about">About</a>
    </div>
    <div class="nav-cta">
      <button class="lang-toggle" onclick="pmToggleLang()" title="Language">🇬🇭 EN</button>
      <!-- Auth widget — pmMountLayout fills this with either a "Sign in" link
           (anonymous) or an account dropdown (signed in). -->
      <span id="pm-auth-widget"></span>
      <a href="quote.html" class="btn btn-gold">Get Quote →</a>
    </div>
  </div>
</nav>
`;

// Cashless-platform notice. Single source of truth so every surface reads
// identical copy. Surfaced in the footer (site-wide), the booking payment
// step, the project tracker sidebar, and printed on PDF receipts. The
// canonical wording — change it here, every consumer updates.
const PM_CASHLESS_NOTICE = {
  short: 'Paint Masters is a cashless platform. Pay only through our checkout — never hand cash to your Master.',
  long:  'Paint Masters is a cashless platform. All payments are held in escrow until QA passes — that\'s how the 12-month warranty stays enforceable. Please do not pay your Paint Master in cash at any point. If you\'re ever asked to, report it through your project tracker or call +233 54 000 0000 — the Master will be removed from the roster.'
};

const PM_FOOTER = `
<footer class="footer">
  <div class="container">
    <div class="footer-grid">
      <div>
        <div class="brand" style="color:#fff;">
          ${pmBrandMark({ variant: 'light' })}
          <span class="brand-name" style="color:#fff;">PAINT <span>MASTERS</span></span>
        </div>
        <p style="margin-top:14px; max-width:360px;">
          Ghana's first professional painting agency. Certified Paint Masters, fixed quotes,
          and a 12-month finish warranty on every job.
        </p>
        <div style="display:flex; gap:10px; margin-top:14px;">
          <a href="#" aria-label="Instagram" style="width:36px;height:36px;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,0.08);">📷</a>
          <a href="#" aria-label="Facebook" style="width:36px;height:36px;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,0.08);">📘</a>
          <a href="#" aria-label="WhatsApp" style="width:36px;height:36px;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,0.08);">💬</a>
          <a href="#" aria-label="TikTok" style="width:36px;height:36px;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,0.08);">🎵</a>
        </div>
      </div>
      <div>
        <h4>Services</h4>
        <a href="services.html#residential">Residential</a><br/>
        <a href="services.html#decorative">Decorative</a><br/>
        <a href="services.html#commercial">Commercial</a><br/>
        <a href="services.html#specialty">Specialty</a>
      </div>
      <div>
        <h4>Company</h4>
        <a href="about.html">About us</a><br/>
        <a href="artisans.html">Our Masters</a><br/>
        <a href="my.html">Member area</a><br/>
        <a href="login.html">Sign in</a><br/>
        <a href="#">Careers</a>
      </div>
      <div>
        <h4>Contact</h4>
        <p style="color:rgba(255,255,255,0.78);">
          +233 54 000 0000<br/>
          hello@paintmasters.gh<br/>
          East Legon, Accra
        </p>
      </div>
    </div>
    <div class="footer-cashless-notice"
         style="margin-top:24px;padding:14px 16px;border-radius:12px;
                background:rgba(245,184,0,0.08);border:1px solid rgba(245,184,0,0.25);
                color:rgba(255,255,255,0.85);font-size:0.85rem;line-height:1.5;
                display:flex;gap:12px;align-items:flex-start;">
      <span aria-hidden="true" style="font-size:1.1rem;line-height:1.3;">🔒</span>
      <span><strong style="color:var(--gold-500);">Cashless platform.</strong> ${PM_CASHLESS_NOTICE.short} If asked, report via your <a href="track.html" style="color:var(--gold-500);font-weight:600;text-decoration:underline;">project tracker</a>.</span>
    </div>
    <div class="footer-bottom">
      <div>© 2026 Paint Masters Ghana Ltd. All rights reserved.</div>
      <div style="display:flex; gap:16px;">
        <a href="#">Privacy</a>
        <a href="#">Terms</a>
        <a href="#">Warranty policy</a>
      </div>
    </div>
  </div>
</footer>
`;

function pmMountLayout(activePage) {
  const navHost = document.getElementById('pm-nav');
  const footerHost = document.getElementById('pm-footer');
  if (navHost) navHost.innerHTML = PM_NAV;
  if (footerHost) footerHost.innerHTML = PM_FOOTER;
  if (activePage) {
    const link = document.querySelector(`.nav-links a[data-page="${activePage}"]`);
    if (link) link.classList.add('active');
  }
  pmRenderAuthWidget();
  pmApplyBrandPrefs();
  pmMountLoader();
}

// ─────────────────────────────────────────────────────────────
// pmMountLoader — paintbrush-themed page loader.
//
// Strategy: the loader is shown immediately on first paint (the script tag
// runs at the end of <body> on most pages, but adding the DOM as the very
// first child of <body> makes it visible before the rest renders). It hides
// itself once pmMountLayout finishes, with a 200ms minimum so fast nav
// doesn't flash. Internal-link clicks re-show it before navigating away.
// ─────────────────────────────────────────────────────────────
const PM_LOADER_HTML = `
  <div id="pmLoader" class="pm-loader" role="status" aria-live="polite" aria-label="Loading">
    <div class="pm-loader-card">
      <svg class="pm-loader-brush" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <!-- Handle -->
        <rect x="36" y="6"  width="8"  height="34" rx="3" fill="#0B1F3A"/>
        <!-- Ferrule (metal band) -->
        <rect x="32" y="40" width="16" height="6"  fill="#9CA3AF"/>
        <!-- Bristles fan -->
        <path d="M30 46 L50 46 L52 64 L28 64 Z" fill="#F5B800"/>
        <!-- Gold drip / paint puddle (animated stroke) -->
        <path id="pmLoaderStroke" d="M14 70 Q40 64 66 70" stroke="#F5B800" stroke-width="6" fill="none" stroke-linecap="round" />
      </svg>
      <div class="pm-loader-bar"><span></span></div>
      <div class="pm-loader-label">Loading…</div>
    </div>
  </div>
`;
const PM_LOADER_CSS = `
  .pm-loader {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(255,255,255,0.96);
    display: flex; align-items: center; justify-content: center;
    transition: opacity 220ms ease;
    backdrop-filter: blur(2px);
  }
  .pm-loader.pm-loader-hide { opacity: 0; pointer-events: none; }
  .pm-loader-card {
    display: flex; flex-direction: column; align-items: center; gap: 14px;
    padding: 26px 36px; min-width: 200px;
  }
  .pm-loader-brush {
    width: 80px; height: 80px;
    animation: pm-brush-bob 1.1s ease-in-out infinite;
    transform-origin: 40px 80px;
  }
  @keyframes pm-brush-bob {
    0%,100% { transform: rotate(-8deg) translateY(0); }
    50%     { transform: rotate(8deg)  translateY(-4px); }
  }
  /* Animated paint stroke under the brush */
  #pmLoaderStroke {
    stroke-dasharray: 70;
    stroke-dashoffset: 70;
    animation: pm-brush-paint 1.1s ease-in-out infinite;
  }
  @keyframes pm-brush-paint {
    0%   { stroke-dashoffset: 70; opacity: 0.2; }
    50%  { stroke-dashoffset: 0;  opacity: 1;   }
    100% { stroke-dashoffset: -70; opacity: 0.2; }
  }
  /* Kente-coloured progress shimmer */
  .pm-loader-bar {
    width: 180px; height: 4px; border-radius: 999px;
    background:
      linear-gradient(90deg,
        #D7263D 0 25%,
        #F5B800 25% 50%,
        #1E7F4F 50% 75%,
        #0B1F3A 75% 100%);
    background-size: 400% 100%;
    overflow: hidden; position: relative;
    animation: pm-bar-shift 1.4s linear infinite;
  }
  @keyframes pm-bar-shift {
    0%   { background-position:   0% 0; }
    100% { background-position: 400% 0; }
  }
  .pm-loader-label {
    font-family: "Bricolage Grotesque", "Inter", sans-serif;
    font-weight: 700; color: #0B1F3A; font-size: 0.92rem;
    letter-spacing: 0.06em; text-transform: uppercase;
  }
`;

let _pmLoaderShownAt = 0;
function pmMountLoader() {
  if (document.getElementById('pmLoader')) {
    pmHideLoader();
    return;
  }
  // Inject CSS once.
  if (!document.getElementById('pmLoaderCss')) {
    const style = document.createElement('style');
    style.id = 'pmLoaderCss';
    style.textContent = PM_LOADER_CSS;
    document.head.appendChild(style);
  }
  // Inject the loader DOM (so navigations that come back also have it ready).
  const wrap = document.createElement('div');
  wrap.innerHTML = PM_LOADER_HTML;
  document.body.appendChild(wrap.firstElementChild);
  pmHideLoader();
}
function pmShowLoader(label) {
  let el = document.getElementById('pmLoader');
  if (!el) {
    pmMountLoader();
    el = document.getElementById('pmLoader');
  }
  if (!el) return;
  if (label) {
    const labelEl = el.querySelector('.pm-loader-label');
    if (labelEl) labelEl.textContent = label;
  }
  el.classList.remove('pm-loader-hide');
  _pmLoaderShownAt = Date.now();
}
function pmHideLoader() {
  const el = document.getElementById('pmLoader'); if (!el) return;
  // Min visible time so fast navigations don't flash.
  const elapsed = Date.now() - _pmLoaderShownAt;
  const wait = Math.max(0, 200 - elapsed);
  setTimeout(() => el.classList.add('pm-loader-hide'), wait);
}
// Re-show the loader on internal-link clicks. Excludes hash anchors,
// mailto/tel/sms/wa.me, target=_blank, and download links.
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
  const href = a.getAttribute('href') || '';
  if (!href || href.startsWith('#')) return;
  if (/^(mailto:|tel:|sms:|javascript:)/i.test(href)) return;
  if (/^https?:\/\//i.test(href) && !href.includes(location.host)) return;
  if (a.target === '_blank' || a.hasAttribute('download')) return;
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  pmShowLoader();
}, true);
// Also re-show on form submits (booking, login, ticket sends).
document.addEventListener('submit', (e) => {
  const f = e.target;
  if (f && f.tagName === 'FORM' && !e.defaultPrevented) {
    // Brief flash so the user sees feedback even when the submit is async.
    pmShowLoader();
    setTimeout(pmHideLoader, 600);
  }
}, true);
// And on bfcache page-show (back/forward navigation), make sure we hide.
window.addEventListener('pageshow', () => pmHideLoader());

// Reads admin-side branding preferences (saved by admin/settings.html) and
// applies them to the current page — so toggling "Show kente stripe" in
// Settings actually affects what visitors see on the customer site.
//
// Today this only handles the kente toggle, but the same hook is the right
// home for future preview-able brand options (custom colors, hide wordmark,
// etc.). Listens for storage events too, so flipping the toggle in another
// tab updates open customer pages live.
function pmApplyBrandPrefs() {
  const SETTINGS_KEY = 'pm_admin_settings_v1';
  const apply = () => {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); } catch (e) {}
    // Default: stripe ON. Only hide if the toggle was explicitly set to false.
    const showKente = !s || !s.branding || s.branding.kente !== false;
    document.body.classList.toggle('no-kente', !showKente);
  };
  apply();
  // Cross-tab live-update: when admin saves settings, customer tabs follow.
  window.addEventListener('storage', (e) => {
    if (e.key === SETTINGS_KEY) apply();
  });
}

// Renders the auth widget in the nav. Called by pmMountLayout, and also after
// sign-in/sign-out so the nav updates immediately without a page reload.
function pmRenderAuthWidget() {
  const host = document.getElementById('pm-auth-widget');
  if (!host) return;
  const u = pmAuth.user();
  if (!u) {
    // Anonymous — simple "Sign in" link with a hint of where to go.
    host.innerHTML = `<a href="login.html" class="lang-toggle" title="Sign in or create an account">👤 Sign in</a>`;
    return;
  }
  // Signed in — render a dropdown. Initials avatar trigger + role-aware menu.
  // Painters land on painter.html (their own dashboard with calendar);
  // admins get the extra "Open admin console" entry; customers see the
  // existing my.html / track.html / warranty links.
  const initials = (u.name || 'U').split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();
  const firstName = (u.name || 'Account').split(' ')[0];
  const isPainter = u.role === 'painter';
  const isAdmin   = u.role === 'admin';
  const roleNote  = isAdmin ? ' · admin' : (isPainter ? ' · Paint Master' : '');

  // Menu items vary by role so each user sees the most relevant first.
  const menuLinks = isPainter ? `
        <a href="painter.html"><span>📅</span> My calendar &amp; jobs</a>
        <a href="painter.html#upcoming"><span>📋</span> Upcoming jobs</a>
        <a href="painter-settings.html"><span>⚙️</span> Settings &amp; password</a>
        <a href="track.html"><span>💬</span> Open dispatcher chat</a>
      ` : isAdmin ? `
        <a href="admin/index.html"><span>📊</span> Admin console</a>
        <a href="my.html"><span>🏠</span> My account</a>
        <a href="track.html"><span>📍</span> Track a project</a>
      ` : `
        <a href="my.html"><span>🏠</span> My account</a>
        <a href="track.html"><span>📍</span> Track a project</a>
        <a href="my.html#bookings"><span>📃</span> My bookings</a>
        <a href="my.html#warranty"><span>🛡️</span> Warranties</a>
      `;

  host.innerHTML = `
    <div class="pm-auth-menu" id="pmAuthMenu">
      <button type="button" class="lang-toggle" id="pmAuthTrigger" aria-haspopup="true" aria-expanded="false" title="My account">
        <span class="pm-auth-avatar">${initials}</span>
        <span class="pm-auth-name">${firstName}</span>
        <span class="pm-auth-caret">▾</span>
      </button>
      <div class="pm-auth-dropdown" role="menu">
        <div class="pm-auth-head">
          <strong>${u.name || 'Member'}</strong>
          <small>${u.phone || ''}${roleNote}</small>
        </div>
        ${menuLinks}
        <hr/>
        <a href="#" id="pmSignOut"><span>🚪</span> Sign out</a>
      </div>
    </div>`;

  // Toggle behaviour.
  const trigger = document.getElementById('pmAuthTrigger');
  const menu    = document.getElementById('pmAuthMenu');
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('open');
    trigger.setAttribute('aria-expanded', menu.classList.contains('open'));
  });
  document.addEventListener('click', () => menu.classList.remove('open'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.classList.remove('open'); });

  document.getElementById('pmSignOut').addEventListener('click', (e) => {
    e.preventDefault();
    pmAuth.logout();
    location.href = 'index.html';
  });
}

// Page-level auth gate. Drop this at the top of any page that should be
// member-only. It checks for a valid session and, if missing, redirects to
// the login page with ?next=<currentPath> so the user lands back here after
// signing in. Optional `roles` array restricts to specific roles.
//
// Usage:
//   <script>pmRequireAuth();</script>            // any signed-in user
//   <script>pmRequireAuth({roles:['painter']});</script>
//
// The function is defensive: if pmAuth isn't loaded yet, it just returns.
function pmRequireAuth({ roles = null, redirectTo = 'login.html' } = {}) {
  if (typeof pmAuth === 'undefined') return false;
  const u = pmAuth.user();
  if (!u) {
    const next = encodeURIComponent(location.pathname.split('/').pop() + location.search + location.hash);
    location.replace(`${redirectTo}?next=${next}`);
    return false;
  }
  if (roles && Array.isArray(roles) && !roles.includes(u.role)) {
    // Wrong role — bounce to home with a message via query string.
    location.replace('index.html?notice=insufficient-role');
    return false;
  }
  // First-sign-in password change. When admin invites a painter or team
  // member with a temporary password, the user record is flagged with
  // mustChangePassword=true. The user must change their password before
  // they're allowed past any member-only page. The change-password page
  // itself is exempt to avoid an infinite redirect loop.
  const onChangePage = /change-password\.html$/.test(location.pathname);
  if (u.mustChangePassword && !onChangePage) {
    const next = encodeURIComponent(location.pathname.split('/').pop() + location.search + location.hash);
    location.replace(`change-password.html?next=${next}`);
    return false;
  }
  return u;
}

// ─────────────────────────────────────────────
// Auth helpers — shared between customer + admin pages.
// JWT lives in localStorage; backend (POST /api/auth/login) returns
// { token, user: { id, name, role, ... } }. If the backend isn't running yet
// (sandbox/preview), `pmAuth.login` falls back to demo credentials so the
// flow stays testable end-to-end.
// ─────────────────────────────────────────────
const PM_AUTH_KEY = 'pm_auth_v1';
const PM_API_BASE = (location.protocol === 'file:' ? '' : '') + '/api';

// Demo credentials mirror backend/db/seed.js so the same logins work
// whether or not the API is reachable. Each demo user carries the same
// title/region/email fields a real account would have, so the admin
// sidebar greets the right person by name + title.
//
// In production mode the array is empty — the local-fallback path in
// pmAuth.login() then can't match anyone, so only the real backend auth
// can sign a user in. Pre-launch flip the meta tag to "production" and
// the demo logins are gone everywhere at once.
// Each Paint Master in admin/assets/admin-shared.js's SEED_ARTISANS gets a
// matching demo login here so any of the twelve can sign in. Phone numbers
// follow the same Ghana mobile pattern the artisan seed uses (+233 24 300
// 000N). All twelve start on `password123` for the demo; in production they
// rotate to a real password on first sign-in (see change-password.html).
const PM_DEMO_USERS = PM_IS_PRODUCTION ? [] : [
  // Admin + customer
  { phone: '0244000000', password: 'password123', user: { id: 1,   name: 'Akosua Boateng',  role: 'admin',    phone: '0244000000', email: 'akosua@paintmasters.gh', region: 'Accra',      title: 'Lead Dispatcher' } },
  { phone: '0244200001', password: 'password123', user: { id: 2,   name: 'Ama Owusu',       role: 'customer', phone: '0244200001', email: 'ama@example.com',         region: 'Accra' } },

  // Twelve Paint Masters — phones match SEED_ARTISANS in admin-shared.js.
  { phone: '0243000001', password: 'password123', user: { id: 101, name: 'Kofi Asante',     role: 'painter',  phone: '0243000001', email: 'kofi@paintmasters.gh',     region: 'Accra',      title: 'Paint Master' } },
  { phone: '0243000002', password: 'password123', user: { id: 102, name: 'Ama Mensah',      role: 'painter',  phone: '0243000002', email: 'ama.m@paintmasters.gh',    region: 'Accra',      title: 'Paint Master' } },
  { phone: '0243000003', password: 'password123', user: { id: 103, name: 'Yaw Owusu',       role: 'painter',  phone: '0243000003', email: 'yaw.o@paintmasters.gh',    region: 'Tema',       title: 'Paint Master' } },
  { phone: '0243000004', password: 'password123', user: { id: 104, name: 'Abena Boateng',   role: 'painter',  phone: '0243000004', email: 'abena.b@paintmasters.gh',  region: 'Accra',      title: 'Paint Master' } },
  { phone: '0243000005', password: 'password123', user: { id: 105, name: 'Kwame Dankwa',    role: 'painter',  phone: '0243000005', email: 'kwame.d@paintmasters.gh',  region: 'Kumasi',     title: 'Paint Master' } },
  { phone: '0243000006', password: 'password123', user: { id: 106, name: 'Efua Adjei',      role: 'painter',  phone: '0243000006', email: 'efua.a@paintmasters.gh',   region: 'Accra',      title: 'Paint Master' } },
  { phone: '0243000007', password: 'password123', user: { id: 107, name: 'Kojo Ntim',       role: 'painter',  phone: '0243000007', email: 'kojo.n@paintmasters.gh',   region: 'Accra',      title: 'Paint Master' } },
  { phone: '0243000008', password: 'password123', user: { id: 108, name: 'Akosua Sarpong',  role: 'painter',  phone: '0243000008', email: 'akosua.s@paintmasters.gh', region: 'Cape Coast', title: 'Paint Master' } },
  { phone: '0243000009', password: 'password123', user: { id: 109, name: 'Kwabena Botwe',   role: 'painter',  phone: '0243000009', email: 'kwabena.b@paintmasters.gh',region: 'Tema',       title: 'Paint Master' } },
  { phone: '0243000010', password: 'password123', user: { id: 110, name: 'Adwoa Darko',     role: 'painter',  phone: '0243000010', email: 'adwoa.d@paintmasters.gh',  region: 'Accra',      title: 'Paint Master' } },
  { phone: '0243000011', password: 'password123', user: { id: 111, name: 'Yaa Boadu',       role: 'painter',  phone: '0243000011', email: 'yaa.b@paintmasters.gh',    region: 'Accra',      title: 'Paint Master' } },
  { phone: '0243000012', password: 'password123', user: { id: 112, name: 'Kwesi Ofori',     role: 'painter',  phone: '0243000012', email: 'kwesi.o@paintmasters.gh',  region: 'Takoradi',   title: 'Paint Master' } }
];

const pmAuth = {
  user() {
    try { return JSON.parse(localStorage.getItem(PM_AUTH_KEY) || 'null')?.user || null; }
    catch (e) { return null; }
  },
  token() {
    try { return JSON.parse(localStorage.getItem(PM_AUTH_KEY) || 'null')?.token || null; }
    catch (e) { return null; }
  },
  isSignedIn() { return !!this.token(); },
  set(payload) { localStorage.setItem(PM_AUTH_KEY, JSON.stringify(payload)); },
  logout() { localStorage.removeItem(PM_AUTH_KEY); },

  async login({ phone, password }) {
    // Try the real backend first.
    try {
      const r = await fetch(PM_API_BASE + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });
      if (r.ok) {
        const data = await r.json();
        if (data.token && data.user) {
          this.set({ token: data.token, user: data.user });
          return { ok: true, user: data.user, source: 'api' };
        }
      } else if ((r.status === 401 || r.status === 400) && PM_IS_PRODUCTION) {
        // Production mode — the backend is the source of truth. A 401 means
        // the credentials are bad; don't silently fall through to demo.
        const data = await r.json().catch(() => ({}));
        return { ok: false, error: data.message || 'Incorrect phone or password.' };
      }
      // Demo mode + backend 401/400: fall through to the local stores. The
      // local pmUsers + PM_DEMO_USERS are the demo source of truth — the
      // backend may simply not have been seeded with the demo accounts.
    } catch (e) {
      // Network error — backend probably not running. Fall through to demo.
    }

    // Local user store fallback — checks accounts created by registration
    // (artisans applying via register.html) and team invitations
    // (admins added via admin/team.html). Same credentials work in production
    // once the backend is deployed; pmUsers persists user records by phone.
    const cleanPhone = phone.replace(/\s+/g, '');
    const localUser = pmUsers.findByPhone(cleanPhone);
    if (localUser && localUser.password === password) {
      if (localUser.status === 'pending') {
        return { ok: false, error: 'Your application is still under review. We\'ll notify you once approved.' };
      }
      if (localUser.status === 'suspended') {
        return { ok: false, error: 'This account is currently suspended. Contact support.' };
      }
      // Carry the mustChangePassword flag through so pmRequireAuth can enforce
      // first-sign-in password rotation for admin-invited accounts.
      const safe = { id: localUser.id, name: localUser.name, role: localUser.role, phone: localUser.phone, email: localUser.email, region: localUser.region, mustChangePassword: !!localUser.mustChangePassword };
      this.set({ token: 'local.' + Date.now(), user: safe });
      return { ok: true, user: safe, source: 'local' };
    }

    // Demo fallback (the seeded demo accounts that work without any backend).
    const match = PM_DEMO_USERS.find(d => d.phone === cleanPhone && d.password === password);
    if (match) {
      this.set({ token: 'demo.' + Date.now(), user: match.user });
      return { ok: true, user: match.user, source: 'demo' };
    }
    return { ok: false, error: 'Incorrect phone number or password.' };
  },

  // Email-based sign in. Uses the same /api/auth/login endpoint when the backend
  // is reachable (the API accepts either phone or email as the identifier).
  // Falls back to the local pmUsers store for demo mode.
  async loginWithEmail({ email, password }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password) return { ok: false, error: 'Enter your email and password.' };

    try {
      const r = await fetch(PM_API_BASE + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password })
      });
      if (r.ok) {
        const data = await r.json();
        if (data.token && data.user) {
          this.set({ token: data.token, user: data.user });
          return { ok: true, user: data.user, source: 'api' };
        }
      } else if ((r.status === 401 || r.status === 400) && PM_IS_PRODUCTION) {
        const data = await r.json().catch(() => ({}));
        return { ok: false, error: data.message || 'Incorrect email or password.' };
      }
      // Demo mode: ignore 401, fall through to local stores + demo seed.
    } catch (e) { /* backend unavailable — fall through to local */ }

    const list = pmUsers.load().filter(u => (u.email || '').toLowerCase() === cleanEmail);
    const localUser = list.find(u => u.password === password);
    if (localUser) {
      if (localUser.status === 'pending')   return { ok: false, error: 'Your account is still pending review.' };
      if (localUser.status === 'suspended') return { ok: false, error: 'This account is currently suspended.' };
      const safe = { id: localUser.id, name: localUser.name, role: localUser.role, phone: localUser.phone, email: localUser.email, region: localUser.region, mustChangePassword: !!localUser.mustChangePassword };
      this.set({ token: 'local.' + Date.now(), user: safe });
      return { ok: true, user: safe, source: 'local' };
    }
    return { ok: false, error: 'No account matches that email and password.' };
  },

  // Change the password of the currently signed-in user. Used by the
  // change-password.html flow that admin-invited users land on at first
  // sign-in. Updates pmUsers (so the new password works on next login)
  // AND clears the mustChangePassword flag on the cached session.
  // Best-effort PUT /api/auth/password if the backend is reachable.
  async changePassword({ newPassword, currentPassword = null }) {
    if (!newPassword || newPassword.length < 6) {
      return { ok: false, error: 'New password must be at least 6 characters.' };
    }
    const cur = this.user();
    if (!cur) return { ok: false, error: 'Not signed in.' };

    // Update pmUsers if the account lives there (admin-invited users do).
    const local = pmUsers.findByPhone(cur.phone);
    if (local) {
      pmUsers.update(local.id, { password: newPassword, mustChangePassword: false });
    }

    // Try the real backend (so painters whose accounts were also synced to
    // /api/auth/register get their password rotated server-side too).
    try {
      const r = await fetch(PM_API_BASE + '/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (this.token() || '') },
        body: JSON.stringify({ currentPassword: currentPassword || '', newPassword })
      });
      // 401/400 from the backend is non-fatal here — the local store is
      // the source of truth for admin-invited users in demo mode.
      void r;
    } catch (e) { /* offline — local update was enough */ }

    // Refresh the cached session: clear the must-change flag.
    const updatedUser = { ...cur, mustChangePassword: false };
    this.set({ token: this.token(), user: updatedUser });
    return { ok: true, user: updatedUser };
  },

  // Customer self-signup. Creates an active 'customer' record in pmUsers and
  // signs the new user in immediately. Painters still apply via register.html
  // (status:'pending' until approved); customers don't need approval.
  async signupCustomer({ name, phone = '', email = '', password, source = 'form' }) {
    const cleanName  = (name || '').trim();
    const cleanPhone = (phone || '').replace(/\s+/g, '');
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanName) return { ok: false, error: 'Please enter your name.' };
    if (!cleanPhone && !cleanEmail) return { ok: false, error: 'Enter a phone number or email address.' };
    if (!password || password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };

    // Reject duplicates against pmUsers + the demo seed phones.
    if (cleanPhone) {
      if (pmUsers.findByPhone(cleanPhone)) return { ok: false, error: 'An account with that phone already exists. Try signing in.' };
      if (PM_DEMO_USERS.some(d => d.phone === cleanPhone)) return { ok: false, error: 'That phone is already in use.' };
    }
    if (cleanEmail) {
      const dupe = pmUsers.load().some(u => (u.email || '').toLowerCase() === cleanEmail);
      if (dupe) return { ok: false, error: 'An account with that email already exists. Try signing in.' };
    }

    const created = pmUsers.add({
      name:   cleanName,
      phone:  cleanPhone,
      email:  cleanEmail,
      role:   'customer',
      status: 'active',
      password,
      meta:   { signupSource: source }
    });
    if (!created) return { ok: false, error: 'Could not create your account. Please try again.' };

    // Bridge into the admin's Customers store so the team can see this person
    // as a potential lead — they've registered but haven't booked yet.
    try {
      pmCreateAdminCustomer({
        name:  created.name,
        phone: created.phone || '',
        email: created.email || '',
        city:  created.region || '',
        source
      });
    } catch (_) { /* non-fatal; signup still succeeds */ }

    const safe = { id: created.id, name: created.name, role: created.role, phone: created.phone, email: created.email, region: created.region };
    this.set({ token: 'local.' + Date.now(), user: safe });
    return { ok: true, user: safe, source: 'local' };
  },

  // Google-style sign-in for the demo. Real OAuth lands later: the front-end
  // hands a Google ID token to POST /api/auth/google and the backend verifies
  // the token + creates/links the account. For now we accept the (name, email)
  // the user supplies and either sign them in (existing match) or create a
  // new active customer record.
  async signInWithGoogle({ name, email }) {
    const cleanName  = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) return { ok: false, error: 'A Google account email is required.' };

    // Existing user by email? Sign them straight in.
    const existing = pmUsers.load().find(u => (u.email || '').toLowerCase() === cleanEmail);
    if (existing) {
      if (existing.status === 'suspended') return { ok: false, error: 'This account is currently suspended.' };
      const safe = { id: existing.id, name: existing.name, role: existing.role, phone: existing.phone, email: existing.email, region: existing.region };
      this.set({ token: 'google.' + Date.now(), user: safe });
      return { ok: true, user: safe, source: 'google', signupCreated: false };
    }

    // New user — create an active customer with a random throwaway password
    // (Google sign-in won't ever use it; included for the local-fallback shape).
    const created = pmUsers.add({
      name:   cleanName || cleanEmail.split('@')[0],
      email:  cleanEmail,
      phone:  '',
      role:   'customer',
      status: 'active',
      password: pmUsers.generatePassword(),
      meta:   { signupSource: 'google' }
    });
    if (!created) return { ok: false, error: 'Could not create your account. Please try again.' };

    // Same bridge as the form-signup path — a Google signup is still a
    // potential customer the admin should see.
    try {
      pmCreateAdminCustomer({
        name:  created.name,
        phone: created.phone || '',
        email: created.email || '',
        city:  created.region || '',
        source: 'google'
      });
    } catch (_) { /* non-fatal */ }

    const safe = { id: created.id, name: created.name, role: created.role, phone: created.phone, email: created.email, region: created.region };
    this.set({ token: 'google.' + Date.now(), user: safe });
    return { ok: true, user: safe, source: 'google', signupCreated: true };
  }
};

// ─────────────────────────────────────────────────────────────
// pmUsers — shared user store (local persistence layer for the demo).
// One source of truth for everyone who can sign in:
//   • Artisans who register via register.html (start as 'pending')
//   • Admins / managers invited via admin/team.html (start as 'active')
//   • Approvals on admin/approvals.html flip pending → active
// When the backend is wired, every method here becomes a fetch() call
// against /api/admin/users + /api/auth/register.
// ─────────────────────────────────────────────────────────────
const PM_USERS_KEY = 'pm_users_v1';

const pmUsers = {
  load() {
    try { return JSON.parse(localStorage.getItem(PM_USERS_KEY) || '[]'); }
    catch (e) { return []; }
  },
  save(list) {
    try { localStorage.setItem(PM_USERS_KEY, JSON.stringify(list)); return true; }
    catch (e) { return false; }
  },
  add(record) {
    const list = this.load();
    // Phone is the unique key.
    const cleanPhone = (record.phone || '').replace(/\s+/g, '');
    if (list.some(u => u.phone === cleanPhone)) return null;
    const id = 'u_' + Date.now().toString(36);
    const user = {
      id,
      name:    record.name || '',
      phone:   cleanPhone,
      email:   record.email || '',
      role:    record.role || 'customer',
      region:  record.region || 'Accra',
      status:  record.status || 'pending',
      password: record.password || pmUsers.generatePassword(),
      // mustChangePassword: true forces the user through change-password.html
      // on first sign-in. Set when an admin invites someone with a temp
      // password (admin/team.html, admin/artisans.html "Add Paint Master").
      // Self-signups (customer registration, painter applications) leave it
      // unset because they chose their own password.
      mustChangePassword: !!record.mustChangePassword,
      meta:    record.meta || {},
      created_at: new Date().toISOString()
    };
    list.push(user);
    this.save(list);
    return user;
  },
  findByPhone(phone) {
    const clean = (phone || '').replace(/\s+/g, '');
    return this.load().find(u => u.phone === clean) || null;
  },
  findById(id) {
    return this.load().find(u => u.id === id) || null;
  },
  update(id, patch) {
    const list = this.load();
    const idx = list.findIndex(u => u.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch, updated_at: new Date().toISOString() };
    this.save(list);
    return list[idx];
  },
  remove(id) {
    const list = this.load().filter(u => u.id !== id);
    this.save(list);
  },
  list({ status, role } = {}) {
    let list = this.load();
    if (status) list = list.filter(u => u.status === status);
    if (role)   list = list.filter(u => u.role === role);
    return list;
  },
  // Generate a memorable temporary password (3 letters + 4 digits, e.g. "PM-AKO-2847").
  generatePassword() {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits  = '23456789';
    let pwd = 'PM-';
    for (let i = 0; i < 3; i++) pwd += letters[Math.floor(Math.random() * letters.length)];
    pwd += '-';
    for (let i = 0; i < 4; i++) pwd += digits[Math.floor(Math.random() * digits.length)];
    return pwd;
  }
};

// ─────────────────────────────────────────────────────────────
// pmRegions — central catchment-area registry.
// One source of truth for every region picker on the customer site
// AND the admin console (register form, booking address, team invite,
// admin job-board filter, admin profile region). Admins edit the list
// in Settings → Business → Service regions; saves to localStorage,
// then every page calling pmRegions.populate() picks up the change
// the next time it renders.
//
// Schema: { name: string, surcharge: number  // GHS, optional travel fee }
// When the backend ships a /api/admin/regions endpoint, this becomes a
// thin client over that endpoint and the shape stays the same.
// ─────────────────────────────────────────────────────────────
const PM_REGIONS_KEY = 'pm_regions_v1';
const pmRegions = {
  DEFAULTS: [
    { name: 'Accra',      surcharge: 0   },
    { name: 'Tema',       surcharge: 50  },
    { name: 'Kasoa',      surcharge: 50  },
    { name: 'Kumasi',     surcharge: 200 },
    { name: 'Cape Coast', surcharge: 180 },
    { name: 'Takoradi',   surcharge: 220 },
    { name: 'Ho',         surcharge: 240 },
    { name: 'Sunyani',    surcharge: 280 },
    { name: 'Tamale',     surcharge: 350 }
  ],
  list() {
    try {
      const raw = JSON.parse(localStorage.getItem(PM_REGIONS_KEY) || 'null');
      if (Array.isArray(raw) && raw.length) return raw;
    } catch (e) {}
    return this.DEFAULTS;
  },
  save(arr) {
    try { localStorage.setItem(PM_REGIONS_KEY, JSON.stringify(arr)); return true; }
    catch (e) { return false; }
  },
  reset() { localStorage.removeItem(PM_REGIONS_KEY); },
  // Travel surcharge for a region by name. Used by the quote engine to
  // add a delivery line item when the customer's city isn't Accra Metro.
  surcharge(name) {
    const r = this.list().find(x => (x.name || '').toLowerCase() === (name || '').toLowerCase());
    return r ? Number(r.surcharge || 0) : 0;
  },
  // Fill a <select> with the current regions while preserving the
  // currently selected value (or the value passed in `currentValue`).
  // opts.placeholder — first disabled option (e.g. "Select…"); pass null to skip.
  // opts.includeOther — append an "Other" option at the end (default false).
  // opts.allLabel — first option label that means "no filter" (e.g. "All cities");
  //                 mutually exclusive with placeholder.
  populate(selectEl, currentValue, opts = {}) {
    if (!selectEl) return;
    const { placeholder = null, includeOther = false, allLabel = null } = opts;
    const list = this.list();
    const want = currentValue != null ? String(currentValue) : (selectEl.value || '');
    const opt  = (val, label, dis = false) =>
      `<option value="${(val || '').replace(/"/g,'&quot;')}"${dis ? ' disabled' : ''}>${label}</option>`;
    let html = '';
    if (allLabel)         html += opt('', allLabel);
    else if (placeholder) html += opt('', placeholder, true);
    html += list.map(r => opt(r.name, r.name)).join('');
    if (includeOther) html += opt('Other', 'Other');
    selectEl.innerHTML = html;
    // Restore selection if the value still exists (or fall back to "").
    const has = Array.from(selectEl.options).some(o => o.value === want);
    selectEl.value = has ? want : (allLabel ? '' : (placeholder ? '' : selectEl.options[0]?.value || ''));
  }
};

// Refill any region selects on the page when the regions list changes
// in another tab (admin saves a new region → customer-side dropdowns
// update without a hard refresh).
window.addEventListener('storage', (e) => {
  if (e.key !== PM_REGIONS_KEY) return;
  document.querySelectorAll('select[data-pm-regions]').forEach(sel => {
    pmRegions.populate(sel, sel.value, JSON.parse(sel.dataset.pmRegions || '{}'));
  });
});

// ─────────────────────────────────────────────────────────────
// pmBrands — central paint-brand registry.
//
// One source of truth for the homepage hero slider, the "brands we paint
// with" partner grid, and the per-brand landing pages at brand.html?brand=<slug>.
// Every entry produces a brand.html page automatically — add a brand here and
// it gets a hero, a paints catalog filter, and a curated colour palette.
//
// Schema:
//   slug:       URL slug, e.g. 'azar' for brand.html?brand=azar
//   name:       display name
//   tagline:    short single-line under the logo on the hero
//   story:      one-paragraph brand intro on the landing page
//   logo:       relative path to logo image
//   hero:       relative path to hero background image (falls back to logo if missing)
//   surfaces:   short tag, e.g. 'Exterior · Walls' (matches PM_BRAND_PARTNERS shape)
//   blurb:      one-line description used on the homepage partner card
//   accent:     CSS colour string used for the brand's accent (hero gradient, link hover)
//   palette:    array of curated colours for the colour-picker grid:
//                 { name: 'Warm Ivory', hex: '#F2E4C9', surface: 'Interior' }
//   paintFilter: optional override — string (brand name to match in PM_PAINTS) or
//                 function(paint) → bool. Defaults to matching by name.
// ─────────────────────────────────────────────────────────────
const pmBrands = {
  ALL: [
    {
      slug: 'dulux',
      name: 'Dulux',
      tagline: 'The Accra façade standard.',
      story:   'Dulux Weathershield is the most-specified exterior emulsion across Greater Accra. Its UV and rain-shed performance is the reason we default to it on any street-facing wall — five years on, the colour holds and the surface stays chalk-free.',
      logo:    'assets/img/brands/dulux.png',
      hero:    'assets/img/brands/dulux.png',
      surfaces:'Exterior · Walls',
      blurb:   'Exterior weatherproof finishes. The Accra façade standard.',
      accent:  '#0A4DA2',
      palette: [
        { name: 'Pure White',         hex: '#F8F8F4', surface: 'Exterior' },
        { name: 'Weathershield Ivory',hex: '#F2E4C9', surface: 'Exterior' },
        { name: 'Limestone',          hex: '#E7DFCB', surface: 'Exterior' },
        { name: 'Almond Stone',       hex: '#D9CCB4', surface: 'Exterior' },
        { name: 'Soft Cream',         hex: '#F4ECDA', surface: 'Interior' },
        { name: 'Magnolia',           hex: '#F2EAD6', surface: 'Interior' },
        { name: 'Linen White',        hex: '#EFE9DA', surface: 'Interior' },
        { name: 'Buttermilk',         hex: '#F1E2B6', surface: 'Interior' },
        { name: 'Coastal Blue',       hex: '#7FA6BF', surface: 'Exterior' },
        { name: 'Atlantic',           hex: '#34607D', surface: 'Exterior' },
        { name: 'Sage Mist',          hex: '#B6C2A1', surface: 'Interior' },
        { name: 'Olive Branch',       hex: '#8C955F', surface: 'Interior' },
        { name: 'Chalk Grey',         hex: '#C9C7BE', surface: 'Exterior' },
        { name: 'Storm Grey',         hex: '#7F7F77', surface: 'Exterior' },
        { name: 'Charcoal',           hex: '#3A3A38', surface: 'Trim' },
        { name: 'Brick Red',          hex: '#8E3A2A', surface: 'Exterior' }
      ]
    },
    {
      slug: 'caparol',
      name: 'Caparol',
      featured: true,                // Caparol is our anchor partner — gets first-position
                                     //  treatment in lists, a Featured Partner pill on the
                                     //  partner card, and an extra "Why we recommend" section
                                     //  on its brand page. See pmBrands.list() for the sort.
      featuredCopy: {
        whyHeading: 'Why Caparol is our anchor partner',
        whyBody:    'After five years of side-by-side trials across every emulsion brand on the Accra market, Caparol consistently delivers the lowest batch-to-batch colour drift, the densest single-coat coverage, and the cleanest cut against trim. We use it as our default on every premium interior — and on every job where the customer cares about a finish that still looks fresh five years on.',
        perks: [
          { icon: '🎨', title: 'Custom colour matching',  body: 'Bring us any swatch — fabric, paint chip, brand colour — and our Caparol team mixes the exact tone in-store within 20 minutes.' },
          { icon: '🛡️', title: 'Extended warranty cover', body: 'Caparol-only jobs come with an 18-month finish warranty (six months longer than our standard 12-month cover).' },
          { icon: '🚚', title: 'Stocked locally',         body: 'Held in our East Legon depot, so a Saturday-morning job never waits for a Monday-morning delivery.' }
        ],
      },
      tagline: 'European-grade durability for premium interiors.',
      story:   'Caparol is our pick when the spec calls for German engineering on a premium interior — the silky matte holds up to wiping, the coverage is dense enough to let us cut a coat, and the colour drift between batches is the lowest of anything we use.',
      logo:    'assets/img/brands/caparol.png',
      hero:    'assets/img/brands/caparol.png',
      surfaces:'Premium interior emulsion',
      blurb:   'European-grade durability we trust on premium interiors.',
      accent:  '#C8102E',
      palette: [
        { name: 'CapaSilk White',     hex: '#F6F3EC', surface: 'Interior' },
        { name: 'Soft Alabaster',     hex: '#EFEAD9', surface: 'Interior' },
        { name: 'Warm Pearl',         hex: '#E9DFC9', surface: 'Interior' },
        { name: 'Greige',             hex: '#C7BCA8', surface: 'Interior' },
        { name: 'Sand Beige',         hex: '#D7C4A1', surface: 'Interior' },
        { name: 'Walnut Brown',       hex: '#6B4A2B', surface: 'Trim' },
        { name: 'Slate Blue',         hex: '#536B7A', surface: 'Interior' },
        { name: 'Deep Bordeaux',      hex: '#5B1A2A', surface: 'Accent' },
        { name: 'Rosé Mist',          hex: '#E8C8C0', surface: 'Interior' },
        { name: 'Eucalyptus',         hex: '#8FA493', surface: 'Interior' },
        { name: 'Forest Floor',       hex: '#4F5B3A', surface: 'Accent' },
        { name: 'Anthracite',         hex: '#2D2F33', surface: 'Trim' }
      ]
    },
    {
      slug: 'leyland',
      name: 'Leyland',
      tagline: 'Soft matte that resists yellowing in tropical heat.',
      story:   'Leyland trade matte is what we reach for on bedrooms and quiet living spaces — the chalky finish hides minor wall faults, the warm whites stay warm under Ghanaian sun, and the touch-up colour matches even months later.',
      logo:    'assets/img/brands/leyland.png',
      hero:    'assets/img/brands/leyland.png',
      surfaces:'Interior matte',
      blurb:   'Soft matte interiors that resist yellowing in tropical heat.',
      accent:  '#1F2C44',
      palette: [
        { name: 'Matte Off-White',    hex: '#EFEAE0', surface: 'Interior' },
        { name: 'Cotton',             hex: '#F4F0E5', surface: 'Interior' },
        { name: 'Antique Lace',       hex: '#EFE6CF', surface: 'Interior' },
        { name: 'Putty',              hex: '#CFC2A8', surface: 'Interior' },
        { name: 'Mushroom',           hex: '#A89A82', surface: 'Interior' },
        { name: 'Soft Sheen Navy',    hex: '#1F2C44', surface: 'Accent' },
        { name: 'Nordic Blue',        hex: '#3B5876', surface: 'Accent' },
        { name: 'Powder Sky',         hex: '#C2D6E1', surface: 'Interior' },
        { name: 'Sage',               hex: '#9CAE94', surface: 'Interior' },
        { name: 'Eucalyptus',         hex: '#7E988A', surface: 'Interior' },
        { name: 'Soft Coral',         hex: '#E5A893', surface: 'Accent' },
        { name: 'Deep Plum',          hex: '#3C2438', surface: 'Accent' }
      ]
    },
    {
      slug: 'azar',
      name: 'Azar',
      tagline: 'Bold local-tested emulsion for accent walls.',
      story:   'Azar is a Ghanaian-made emulsion that earned its place on our shelves by passing the same QA cycle we put the imports through. Saturated colour, fair price, and locally-stocked tints — exactly the right brand when the brief is "feature wall, fast."',
      logo:    'assets/img/brands/azar.png',
      hero:    'assets/img/brands/azar.png',
      surfaces:'Emulsion · Accent',
      blurb:   'A local champion — fully tested in our QA program.',
      accent:  '#2E5D3A',
      palette: [
        { name: 'Forest Green',       hex: '#2E5D3A', surface: 'Accent' },
        { name: 'Olive Grove',        hex: '#5F6B3A', surface: 'Accent' },
        { name: 'Terracotta',         hex: '#A85A3F', surface: 'Accent' },
        { name: 'Burnt Sienna',       hex: '#8C422A', surface: 'Accent' },
        { name: 'Mustard',            hex: '#C99A2E', surface: 'Accent' },
        { name: 'Saffron',            hex: '#E2A93B', surface: 'Accent' },
        { name: 'Ochre',              hex: '#B97A1F', surface: 'Accent' },
        { name: 'Coral',              hex: '#E27A5C', surface: 'Accent' },
        { name: 'Indigo',             hex: '#2A3470', surface: 'Accent' },
        { name: 'Royal Blue',         hex: '#1F5BA4', surface: 'Accent' },
        { name: 'Plum',               hex: '#5C2A4C', surface: 'Accent' },
        { name: 'Rosewood',           hex: '#7A2E3D', surface: 'Accent' },
        { name: 'Mango',              hex: '#EE9B3A', surface: 'Accent' },
        { name: 'Cocoa',              hex: '#4A2E1E', surface: 'Trim' },
        { name: 'Stone',              hex: '#B8AE9E', surface: 'Interior' },
        { name: 'Cream',              hex: '#F2EAD0', surface: 'Interior' }
      ]
    },
    {
      slug: 'coral',
      name: 'Coral',
      tagline: 'Hot-climate engineered for Ghanaian humidity.',
      story:   'Coral high-sheen gloss is what goes on every door, frame and railing we paint — the cure is hard, the wipe-clean is easy, and the colour fade after two harmattan seasons is essentially zero. Trim is where bad paint shows first; Coral is why ours doesn\'t.',
      logo:    'assets/img/brands/coral.png',
      hero:    'assets/img/brands/coral.png',
      surfaces:'Gloss · Trim',
      blurb:   'High-sheen gloss for trim, doors, and metal frames.',
      accent:  '#E94E2B',
      palette: [
        { name: 'Gloss White',        hex: '#F8F8F8', surface: 'Trim' },
        { name: 'Soft Ivory',         hex: '#F1ECDF', surface: 'Trim' },
        { name: 'Warm Beige',         hex: '#D9C9AE', surface: 'Trim' },
        { name: 'Stone Grey',         hex: '#B0AEA6', surface: 'Trim' },
        { name: 'Slate',              hex: '#5E6770', surface: 'Trim' },
        { name: 'Charcoal',           hex: '#2D2D2D', surface: 'Trim' },
        { name: 'Gloss Black',        hex: '#1A1A1A', surface: 'Trim' },
        { name: 'Brick Red',          hex: '#9F2F2F', surface: 'Trim' },
        { name: 'Forest Green',       hex: '#1F4F36', surface: 'Trim' },
        { name: 'Royal Blue',         hex: '#1A3F86', surface: 'Trim' },
        { name: 'Burnt Orange',       hex: '#C9521C', surface: 'Trim' },
        { name: 'Mustard',            hex: '#C28A1F', surface: 'Trim' }
      ]
    },
    {
      slug: 'shield',
      name: 'Shield',
      tagline: 'Premium long-life coatings for façades and roofs.',
      story:   'Shield is our specialty rail — heat-reflective roof coatings, marine-grade waterproofers, and façade primers that hold a curtain wall together for a decade. Not for every job, but on coastal and industrial work it earns the line item every time.',
      logo:    'assets/img/brands/shield.png',
      hero:    'assets/img/brands/shield.png',
      surfaces:'Specialty · Roof & Façade',
      blurb:   'Premium long-life coatings for façades and roofs.',
      accent:  '#1B4D89',
      palette: [
        { name: 'Reflective White',   hex: '#F0F1EE', surface: 'Roof' },
        { name: 'Aluminium',          hex: '#C5C8CC', surface: 'Roof' },
        { name: 'Solar Silver',       hex: '#A8AFB5', surface: 'Roof' },
        { name: 'Slate Grey',         hex: '#6E7780', surface: 'Roof' },
        { name: 'Charcoal',           hex: '#3B3F44', surface: 'Roof' },
        { name: 'Terracotta Tile',    hex: '#A8513A', surface: 'Roof' },
        { name: 'Façade Sand',        hex: '#D7C9AE', surface: 'Exterior' },
        { name: 'Sandstone',          hex: '#C7B189', surface: 'Exterior' },
        { name: 'Atlantic Blue',      hex: '#2C5A82', surface: 'Specialty' },
        { name: 'Industrial Green',   hex: '#3F5C42', surface: 'Specialty' },
        { name: 'Marine Black',       hex: '#1B1F24', surface: 'Specialty' },
        { name: 'Anti-Rust Red',      hex: '#7E2A1F', surface: 'Specialty' }
      ]
    },
    {
      slug: 'berger',
      name: 'Berger',
      tagline: 'Sealer primers and emulsions for interior surfaces.',
      story:   'Berger Sealer Primer is the unsung hero of every interior job we do — it kills bleed-through, locks the topcoat, and means the colour you sign off looks the same in coat one and coat ten. Their interior emulsion sits one notch below Caparol on price and one notch up on availability.',
      logo:    'assets/img/brands/berger.png',
      hero:    'assets/img/brands/berger.png',
      surfaces:'Primer · Interior',
      blurb:   'Sealer primers and emulsions for interior surfaces.',
      accent:  '#0072CE',
      palette: [
        { name: 'Pure White Primer',  hex: '#FAFAFA', surface: 'Primer' },
        { name: 'Off-White Emulsion', hex: '#F1EDE2', surface: 'Interior' },
        { name: 'Soft Cream',         hex: '#F4ECDA', surface: 'Interior' },
        { name: 'Pearl Beige',        hex: '#E2D4B7', surface: 'Interior' },
        { name: 'Apricot',            hex: '#F0C7A1', surface: 'Interior' },
        { name: 'Powder Pink',        hex: '#F2D4D0', surface: 'Interior' },
        { name: 'Sky',                hex: '#BFD7E8', surface: 'Interior' },
        { name: 'Mint',               hex: '#C5DDC9', surface: 'Interior' },
        { name: 'Lavender',           hex: '#C8C0DA', surface: 'Interior' },
        { name: 'Sand',               hex: '#D9C8A6', surface: 'Interior' },
        { name: 'Slate',              hex: '#5C6873', surface: 'Trim' },
        { name: 'Espresso',           hex: '#3A2A20', surface: 'Trim' }
      ]
    },
    {
      slug: 'crown',
      name: 'Crown',
      tagline: 'Specialty roof coatings and waterproofing systems.',
      story:   'Crown\'s aluminium roof coating is the single product most likely to extend the life of a Ghanaian flat-roof: reflects heat, seals pinhole leaks, and recoats over itself without prep. Their epoxy floor system is what we use in clinics and warehouses where the floor has to take a beating.',
      logo:    'assets/img/brands/crown.png',
      hero:    'assets/img/brands/crown.png',
      surfaces:'Roof · Specialty',
      blurb:   'Specialty roof coatings and waterproofing systems.',
      accent:  '#7A1C2C',
      palette: [
        { name: 'Aluminium Roof',     hex: '#C5C8CC', surface: 'Roof' },
        { name: 'Solar White',        hex: '#EAECEA', surface: 'Roof' },
        { name: 'Brick Red Roof',     hex: '#933A2A', surface: 'Roof' },
        { name: 'Slate Roof',         hex: '#3F4751', surface: 'Roof' },
        { name: 'Charcoal Roof',      hex: '#262A2F', surface: 'Roof' },
        { name: 'Epoxy Light Grey',   hex: '#B8B8B8', surface: 'Specialty' },
        { name: 'Epoxy Mid Grey',     hex: '#7E7E7E', surface: 'Specialty' },
        { name: 'Epoxy Charcoal',     hex: '#404040', surface: 'Specialty' },
        { name: 'Safety Yellow',      hex: '#F2C400', surface: 'Specialty' },
        { name: 'Safety Red',         hex: '#C8102E', surface: 'Specialty' },
        { name: 'Marine Blue',        hex: '#1F4E79', surface: 'Specialty' },
        { name: 'Industrial Green',   hex: '#3D6E47', surface: 'Specialty' }
      ]
    }
  ],
  // list() returns brands with featured ones first. Caparol carries a
  // featured: true flag so it always appears at position 0 — drives the
  // homepage partner grid order, the hero slider order, and the brand
  // detail's "Featured Partner" badge.
  list() {
    return [...this.ALL].sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
  },
  bySlug(slug) {
    const k = String(slug || '').toLowerCase();
    return this.ALL.find(b => b.slug === k) || null;
  },
  byName(name) {
    const k = String(name || '').toLowerCase();
    return this.ALL.find(b => b.name.toLowerCase() === k) || null;
  },
  // Returns the paints from PM_PAINTS that belong to this brand. Requires
  // PM_PAINTS to be loaded (paint-catalog.js). Safe to call when not loaded —
  // returns []. Uses the brand's name field unless paintFilter is provided.
  paintsFor(slug) {
    if (typeof PM_PAINTS === 'undefined') return [];
    const b = this.bySlug(slug);
    if (!b) return [];
    if (typeof b.paintFilter === 'function') return PM_PAINTS.filter(b.paintFilter);
    const want = (b.paintFilter || b.name).toLowerCase();
    return PM_PAINTS.filter(p => (p.brand || '').toLowerCase() === want);
  }
};

// ─────────────────────────────────────────────────────────────
// pmReviews — per-booking review storage (localStorage-backed today,
// thin client over POST /api/reviews when the backend ships).
//
// Schema:
//   { bookingRef, painterId, painterName, rating: 1..5, comment,
//     beforePhotos: [dataURL], afterPhotos: [dataURL], createdAt }
//
// Used by track.html's "Leave a review" modal and by my.html for the
// "Avg satisfaction" stat (count of reviews left).
// ─────────────────────────────────────────────────────────────
const PM_REVIEWS_KEY = 'pm_reviews_v1';
const pmReviews = {
  list() {
    try {
      const raw = JSON.parse(localStorage.getItem(PM_REVIEWS_KEY) || 'null');
      if (Array.isArray(raw)) return raw;
    } catch (e) {}
    return [];
  },
  byBooking(ref) {
    return this.list().find(r => r.bookingRef === ref) || null;
  },
  save(review) {
    if (!review || !review.bookingRef) return false;
    const list = this.list();
    const i = list.findIndex(r => r.bookingRef === review.bookingRef);
    const row = Object.assign({ createdAt: new Date().toISOString() }, review);
    if (i >= 0) list[i] = row; else list.push(row);
    try { localStorage.setItem(PM_REVIEWS_KEY, JSON.stringify(list)); return true; }
    catch (e) {
      // Likely a quota error — strip photo data URLs and try again so the rating still saves.
      const slim = Object.assign({}, row, { beforePhotos: [], afterPhotos: [] });
      if (i >= 0) list[i] = slim; else list[list.length - 1] = slim;
      try { localStorage.setItem(PM_REVIEWS_KEY, JSON.stringify(list)); return 'rating-only'; }
      catch (e2) { return false; }
    }
  },
  avg() {
    const all = this.list();
    if (!all.length) return null;
    return Math.round(all.reduce((s, r) => s + (Number(r.rating) || 0), 0) / all.length * 10) / 10;
  }
};

// ─────────────────────────────────────────────────────────────
// PM_DISPATCH_CONTACT — central dispatch reachables for the customer-side
// chat composer. SMS / WhatsApp deep links target these unless overridden
// per-booking. When the backend ships /api/admin/contacts the customer-side
// chat fetches the booking's actual dispatcher; until then this is the
// constant and admin Settings → Contacts can edit it.
// ─────────────────────────────────────────────────────────────
const PM_DISPATCH_CONTACT = Object.freeze({
  name:     'Akosua Boateng',
  role:     'Lead Dispatcher · Accra',
  phone:    '+233 24 000 0000',
  whatsapp: '+233 24 000 0000',
  email:    'dispatch@paintmasters.gh'
});

// ─────────────────────────────────────────────────────────────
// pmComms — channel-aware send. Single helper used by:
//   * the admin painter modal's "Message <name>" composer
//   * the customer-side chat composer on track.html
//   * any future broadcast that needs to render the same channel pills
//
// The "in-platform" channel does the best-effort POST and returns a receipt
// the caller can render in its chat. SMS and WhatsApp build deep links to
// the device's native apps so the actual send happens off-device — this is
// the right behaviour until the backend's notifications-outbox + Hubtel
// gateway can send on the user's behalf.
//
// Phone numbers can come in any format ("+233 24 300 0001", "024 300 0001",
// "0244 300 0001"); pmComms.normalizePhone returns the digits-only E.164
// form sms:/wa.me/ both want. Default country is Ghana (233).
// ─────────────────────────────────────────────────────────────
const pmComms = {
  CHANNELS: ['platform', 'sms', 'whatsapp', 'email'],

  /**
   * Strip phone formatting and return digits-only E.164 (no + prefix).
   * Local Ghanaian formats (0XXX...) are converted to 233XXX...
   */
  normalizePhone(raw, defaultCountry = '233') {
    let s = String(raw || '').replace(/[^0-9+]/g, '');
    if (!s) return '';
    if (s.startsWith('+')) s = s.slice(1);
    if (s.startsWith('00'))  s = s.slice(2);
    // Local Ghana number starting with 0 → swap to 233.
    if (s.startsWith('0'))   s = defaultCountry + s.slice(1);
    return s;
  },

  /**
   * Build the URL for a given channel + recipient + body. Returns null for
   * the platform channel (which has no URL — caller posts via fetch).
   */
  buildUrl({ channel, to, body, subject }) {
    const enc = encodeURIComponent;
    if (channel === 'sms') {
      const num = this.normalizePhone(to);
      // iOS uses `&body=`, Android uses `?body=`. The `?body=` form works on both.
      return `sms:+${num}?body=${enc(body || '')}`;
    }
    if (channel === 'whatsapp') {
      const num = this.normalizePhone(to);
      return `https://wa.me/${num}${body ? `?text=${enc(body)}` : ''}`;
    }
    if (channel === 'email') {
      const params = [];
      if (subject) params.push('subject=' + enc(subject));
      if (body)    params.push('body='    + enc(body));
      return `mailto:${to}${params.length ? '?' + params.join('&') : ''}`;
    }
    return null;
  },

  /**
   * Send. Returns { channel, ok, url, receipt } where receipt is a short
   * string the caller can drop into their chat history.
   *
   * For SMS / WhatsApp / email: opens the deep link in a new tab (the device
   * picks up the handler and opens the right app). The `ok` flag reflects
   * "we handed off to the OS" — actual delivery is out of our hands.
   *
   * For platform: POSTs to opts.platformPath (default /api/messages) with
   * { to, body, subject, threadKey } and returns ok = true on 2xx.
   */
  async send(opts) {
    const { channel = 'platform', to = '', body = '', subject = '' } = opts;
    if (!body || !channel) return { channel, ok: false, error: 'channel and body required' };

    if (channel === 'platform') {
      const path = opts.platformPath || '/api/messages';
      const headers = { 'Content-Type': 'application/json' };
      try {
        const tok = (typeof pmAuth !== 'undefined' && pmAuth.token) ? pmAuth.token() : null;
        if (tok) headers.Authorization = 'Bearer ' + tok;
        const res = await fetch(path, {
          method: 'POST', headers,
          body: JSON.stringify({ to, body, subject, threadKey: opts.threadKey })
        });
        return { channel, ok: !!res.ok, status: res.status, receipt: 'sent in-platform' };
      } catch (e) {
        // Backend not running or endpoint not yet shipped — treat as queued.
        return { channel, ok: true, queued: true, receipt: 'queued in-platform (backend offline)' };
      }
    }

    if (!to) return { channel, ok: false, error: `${channel} requires a recipient` };
    const url = this.buildUrl({ channel, to, body, subject });
    if (!url) return { channel, ok: false, error: `unsupported channel: ${channel}` };

    try {
      // Open the deep link. window.open is preferred over location.href so the
      // tracker page stays put and the device's native app gets focus.
      const w = window.open(url, '_blank', 'noopener');
      if (!w) {
        // Pop-up blocker — fall back to location-assign on the current window.
        // The user comes back via the back button.
        location.href = url;
      }
      const label = channel === 'sms' ? 'SMS' : (channel === 'whatsapp' ? 'WhatsApp' : 'email');
      return { channel, ok: true, url, receipt: `opened ${label} to ${to}` };
    } catch (e) {
      return { channel, ok: false, error: e.message };
    }
  },

  /**
   * Channel labels and emoji for UI rendering. Single source so admin modals
   * and the customer chat picker show the same things.
   */
  LABELS: {
    platform: { emoji: '💬', label: 'In-platform' },
    sms:      { emoji: '📱', label: 'SMS' },
    whatsapp: { emoji: '🟢', label: 'WhatsApp' },
    email:    { emoji: '✉️', label: 'Email' }
  }
};

// ─────────────────────────────────────────────────────────────
// pmActivity — cross-tab activity bus.
//
// Every meaningful interaction in the app (a customer requests a photo, a
// painter checks in, dispatch receives a concern report, a payment lands)
// emits an event here. The admin shell reads from it to drive:
//   • the bell badge in the topbar (count of unread)
//   • the bell dropdown (recent activities)
//   • the live activity panel on admin/index.html
//
// Backed by localStorage keyed PM_ACTIVITY_KEY. The storage event lets
// open admin tabs update in real time when an event fires in another tab
// (or another role's session — e.g. customer hits Report Concern in their
// browser, admin sees the bell badge tick up in theirs).
//
// Schema:
//   { id, ts, kind, title, sub?, source: { role, name }, severity, read }
//
// Where:
//   kind     ∈ booking | photo_request | scope_change | concern | cash_request
//             | review | payment | painter_checkin | painter_complete | message | system
//   severity ∈ 'info' | 'warn' | 'error'
//   source   describes who fired the event (role + display name)
//
// The list is capped at MAX_EVENTS to prevent unbounded growth in the demo.
// ─────────────────────────────────────────────────────────────
const PM_ACTIVITY_KEY = 'pm_activity_v1';
const PM_ACTIVITY_MAX = 200;
const pmActivity = {
  KINDS: ['booking','photo_request','scope_change','concern','cash_request','review','payment','painter_checkin','painter_complete','message','system'],
  list() {
    try {
      const raw = JSON.parse(localStorage.getItem(PM_ACTIVITY_KEY) || 'null');
      if (Array.isArray(raw)) return raw;
    } catch (e) {}
    return [];
  },
  unreadCount() { return this.list().filter(e => !e.read).length; },
  /**
   * Emit a new activity. Returns the stored event (with id + ts).
   * Examples:
   *   pmActivity.emit({ kind:'photo_request', title:'New photo request',
   *                     sub:'Above the front door', source:{role:'customer', name:'Ekow Quansah'}})
   */
  emit({ kind = 'system', title, sub = '', source = null, severity = 'info', target = null } = {}) {
    if (!title) return null;
    const ev = {
      id:   'ev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      ts:   Date.now(),
      kind, title, sub,
      source: source || { role: 'system', name: 'Paint Masters' },
      severity, target,
      read: false,
    };
    const list = this.list();
    list.unshift(ev);
    if (list.length > PM_ACTIVITY_MAX) list.length = PM_ACTIVITY_MAX;
    try { localStorage.setItem(PM_ACTIVITY_KEY, JSON.stringify(list)); } catch (e) { /* quota */ }
    return ev;
  },
  markAllRead() {
    const list = this.list().map(e => Object.assign({}, e, { read: true }));
    try { localStorage.setItem(PM_ACTIVITY_KEY, JSON.stringify(list)); } catch (e) {}
  },
  clear() { try { localStorage.removeItem(PM_ACTIVITY_KEY); } catch (e) {} },
  /**
   * Subscribe to changes. Fires on any local emit AND on cross-tab updates.
   * Returns an unsubscribe function. Listener gets the full list.
   */
  listen(fn) {
    if (typeof fn !== 'function') return () => {};
    const wrap = (e) => { if (!e || e.key === PM_ACTIVITY_KEY) fn(this.list()); };
    window.addEventListener('storage', wrap);
    // Also poll on a short interval to catch same-tab emits (storage event
    // doesn't fire for the tab that wrote). Cheap enough — 800ms.
    let last = JSON.stringify(this.list());
    const t = setInterval(() => {
      const cur = JSON.stringify(this.list());
      if (cur !== last) { last = cur; fn(this.list()); }
    }, 800);
    return () => { window.removeEventListener('storage', wrap); clearInterval(t); };
  },
  /**
   * Convenience renderers used by the admin bell + feed.
   */
  iconFor(kind) {
    return ({
      booking: '📅', photo_request: '📸', scope_change: '📝', concern: '⚠️',
      cash_request: '⚠️', review: '⭐', payment: '💰',
      painter_checkin: '📍', painter_complete: '✓',
      message: '💬', system: 'ℹ️'
    })[kind] || 'ℹ️';
  },
  relTime(ts) {
    const d = (Date.now() - ts) / 1000;
    if (d < 60)    return 'just now';
    if (d < 3600)  return Math.round(d / 60)   + ' min ago';
    if (d < 86400) return Math.round(d / 3600) + ' h ago';
    return Math.round(d / 86400) + ' d ago';
  }
};

function pmToggleLang() {
  alert("Twi translations are being prepared for the next release. 🙂\nFor now we're English-only.");
}

// ----- State helpers (localStorage for cross-page state) -----
const PM_STATE_KEY = 'pm_quote_v1';
function pmSaveQuote(q) { try { localStorage.setItem(PM_STATE_KEY, JSON.stringify(q)); } catch(e){} }
function pmLoadQuote() {
  try { return JSON.parse(localStorage.getItem(PM_STATE_KEY) || 'null'); } catch(e){ return null; }
}

function pmFormatGHS(n) {
  if (isNaN(n)) return 'GHS 0';
  return 'GHS ' + Math.round(n).toLocaleString('en-GH');
}

// Lightweight toast
function pmToast(msg, kind = 'ok') {
  let host = document.getElementById('pm-toast');
  if (!host) {
    host = document.createElement('div');
    host.id = 'pm-toast';
    host.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2000;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = `padding:12px 16px;border-radius:10px;background:${kind==='ok'?'#1E7F4F':'#0B1F3A'};color:#fff;box-shadow:0 8px 24px rgba(0,0,0,0.2);font-size:0.9rem;max-width:320px;`;
  host.appendChild(el);
  setTimeout(() => { el.style.transition='opacity 0.3s'; el.style.opacity='0'; setTimeout(()=>el.remove(), 300); }, 2600);
}

// ─────────────────────────────────────────────────────────────
// Admin-store bridge — when a customer completes a booking on the
// customer site, queue the new job for the admin Job Board.
//
// We use a two-track approach:
//   1. INBOX (pm_admin_inbox_v1) — every booking always lands here.
//      admin-shared.js drains this on every load.
//   2. STORE merge — if the admin store already exists, we ALSO
//      merge directly so the job is visible immediately if the admin
//      tab is open.
//
// Why not write directly to the store always? Because the admin store
// might not exist yet (admin hasn't visited the dashboard, so its
// SEED_ARTISANS/CUSTOMERS aren't loaded). If we wrote a partial store,
// admin-shared.js's first-load seeder would skip seeding and the
// dashboard would render with empty masters/customers.
//
// In production this is replaced by a `POST /api/bookings` call.
// ─────────────────────────────────────────────────────────────
const PM_ADMIN_STORE_KEY = 'pm_admin_state_v2';
const PM_ADMIN_INBOX_KEY = 'pm_admin_inbox_v1';

function pmCreateAdminJob({
  ref, customer, service, area, amount,
  date, window: jobWindow = 'morning', address,
  tags = [], payment_method
} = {}) {
  // Generate a unique-ish job id. Admin's seed jobs use j1xxx; we use
  // j2xxx for live-bridged ones so they're easy to tell apart in dev.
  const id = 'j2' + Date.now().toString(36).slice(-5).toUpperCase();
  const job = {
    id,
    ref:        ref || 'PM-' + Math.floor(100000 + Math.random() * 900000),
    customer:   customer || 'Customer',
    service:    service || 'Painting',
    area:       Number(area) || 0,
    amount:     Number(amount) || 0,
    stage:      'new',                 // lands in the "New Request" column
    assignedTo: null,
    date:       date || new Date().toISOString().slice(0, 10),
    window:     jobWindow,
    address:    address || '',
    tags:       Array.isArray(tags) ? tags : [],
    paymentMethod: payment_method || null,
    sourcedFrom: 'customer-booking'
  };
  const activity = {
    kind:   'booking',
    who:    customer || 'Customer',
    what:   `booked ${service || 'a job'}`,
    amount: Number(amount) || null,
    t:      Date.now()
  };

  // Track 1: Always append to the inbox.
  let inbox;
  try { inbox = JSON.parse(localStorage.getItem(PM_ADMIN_INBOX_KEY) || 'null'); }
  catch (e) { inbox = null; }
  if (!inbox || !Array.isArray(inbox.jobs)) inbox = { jobs: [], activity: [] };
  inbox.jobs.push(job);
  inbox.activity.push(activity);
  try { localStorage.setItem(PM_ADMIN_INBOX_KEY, JSON.stringify(inbox)); }
  catch (e) { return false; }

  // Track 2: If the admin store exists already, merge in immediately.
  try {
    const raw = localStorage.getItem(PM_ADMIN_STORE_KEY);
    if (raw) {
      const store = JSON.parse(raw);
      if (store && Array.isArray(store.jobs)) {
        store.jobs.unshift(job);
        store.activity = store.activity || [];
        store.activity.unshift(activity);
        localStorage.setItem(PM_ADMIN_STORE_KEY, JSON.stringify(store));
      }
    }
  } catch (e) { /* fine — inbox will catch it on next admin load */ }

  return id;
}

// ─────────────────────────────────────────────────────────────
// pmCreateAdminCustomer — bridge a fresh customer signup into the admin's
// Customers page so the team can reach out to them as a potential lead.
//
// Mirrors the inbox/store-merge pattern of pmCreateAdminJob. Without this,
// customer self-signups (login.html → pmAuth.signupCustomer) only land in
// the pm_users_v1 store and the admin's customers.html — which reads from
// the admin's own store — never sees them.
//
// In production this is replaced by GET /api/admin/customers reading the
// users table directly. The inbox bridge keeps the demo flow working
// without a live backend.
// ─────────────────────────────────────────────────────────────
function pmCreateAdminCustomer({
  name, phone = '', email = '', city = '', type = 'Homeowner', source = 'signup'
} = {}) {
  const id = 'c2' + Date.now().toString(36).slice(-5).toUpperCase();
  const customer = {
    id,
    name:    (name || 'New customer').trim(),
    type:    type || 'Homeowner',
    phone:   phone || '',
    email:   email || '',
    city:    city || 'Accra',
    jobs:    0,          // no bookings yet
    ltv:     0,          // lifetime value starts at zero
    lastJob: null,
    rating:  null,
    isLead:  true,       // surfaces a "Potential" badge on the admin row
    signedUpAt: new Date().toISOString(),
    signupSource: source
  };
  const activity = {
    kind:   'signup',
    who:    customer.name,
    what:   `created a customer account (${source})`,
    amount: null,
    t:      Date.now()
  };

  // Track 1: always queue into the inbox so the admin picks it up on next load.
  let inbox;
  try { inbox = JSON.parse(localStorage.getItem(PM_ADMIN_INBOX_KEY) || 'null'); }
  catch (e) { inbox = null; }
  if (!inbox) inbox = { jobs: [], activity: [], customers: [] };
  if (!Array.isArray(inbox.customers)) inbox.customers = [];
  inbox.customers.push(customer);
  inbox.activity = Array.isArray(inbox.activity) ? inbox.activity : [];
  inbox.activity.push(activity);
  try { localStorage.setItem(PM_ADMIN_INBOX_KEY, JSON.stringify(inbox)); }
  catch (e) { return false; }

  // Track 2: if the admin store is already seeded, merge in right away so
  // an admin who happens to be looking at customers.html sees the new lead
  // without a refresh of the page.
  try {
    const raw = localStorage.getItem(PM_ADMIN_STORE_KEY);
    if (raw) {
      const store = JSON.parse(raw);
      if (store && Array.isArray(store.customers)) {
        const exists = store.customers.some(c =>
          (c.phone && customer.phone && c.phone === customer.phone) ||
          (c.email && customer.email && c.email.toLowerCase() === customer.email.toLowerCase())
        );
        if (!exists) {
          store.customers.unshift(customer);
          store.activity = store.activity || [];
          store.activity.unshift(activity);
          localStorage.setItem(PM_ADMIN_STORE_KEY, JSON.stringify(store));
        }
      }
    }
  } catch (e) { /* admin inbox-drain will catch it next time */ }

  return id;
}
