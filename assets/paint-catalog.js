// =============================================
// Paint Masters — Trusted Paint Partners
// Brand-only showcase shown on the homepage. No paint names, no prices.
// Each entry produces a card with the partner's logo (or text fallback) and
// a one-line description of the surface they're best at. The list IS the
// "Trusted paint partners" section — edit here to add or remove partners.
// =============================================

// PM_BRAND_PARTNERS — derived from pmBrands (defined in shared.js, which loads
// first) so the homepage card grid, the hero slider, and the per-brand
// landing pages stay in sync. Add a brand once to pmBrands.ALL and it
// appears here, in the slider's defaults, and at brand.html?brand=<slug>.
//
// An admin override at localStorage key 'pm_brand_partners_v1' takes priority
// when set — that's how admin/brand-partners.html lets a dispatcher edit
// the homepage line-up without touching code. The shape stored there matches
// the partner-card schema: { slug, name, logoSrc, blurb, surfaces, featured? }.
//
// Falls back to a hardcoded list if pmBrands isn't available (e.g. someone
// loaded paint-catalog.js without shared.js, or in a test harness).
function pmReadBrandPartnersOverride() {
  try {
    const raw = JSON.parse(localStorage.getItem('pm_brand_partners_v1') || 'null');
    if (Array.isArray(raw) && raw.length) return raw;
  } catch (_) { /* corrupted or unavailable — silently fall through */ }
  return null;
}

const PM_BRAND_PARTNERS = pmReadBrandPartnersOverride()
  || ((typeof pmBrands !== 'undefined' && pmBrands.list)
  ? pmBrands.list().map(b => ({
      name:     b.name,
      slug:     b.slug,
      logoSrc:  b.logo,
      blurb:    b.blurb,
      surfaces: b.surfaces,
      featured: b.featured,
    }))
  : [
      // Fallback — keep in sync with pmBrands if you edit either side.
      { slug:'dulux',   name:'Dulux',   logoSrc:'assets/img/brands/dulux.png',   blurb:'Exterior weatherproof finishes. The Accra façade standard.',  surfaces:'Exterior · Walls' },
      { slug:'caparol', name:'Caparol', logoSrc:'assets/img/brands/caparol.png', blurb:'European-grade durability we trust on premium interiors.',     surfaces:'Premium interior emulsion' },
      { slug:'leyland', name:'Leyland', logoSrc:'assets/img/brands/leyland.png', blurb:'Soft matte interiors that resist yellowing in tropical heat.', surfaces:'Interior matte' },
      { slug:'azar',    name:'Azar',    logoSrc:'assets/img/brands/azar.png',    blurb:'A local champion — fully tested in our QA program.',           surfaces:'Emulsion · Accent' },
      { slug:'coral',   name:'Coral',   logoSrc:'assets/img/brands/coral.png',   blurb:'High-sheen gloss for trim, doors, and metal frames.',          surfaces:'Gloss · Trim' },
      { slug:'shield',  name:'Shield',  logoSrc:'assets/img/brands/shield.png',  blurb:'Premium long-life coatings for façades and roofs.',           surfaces:'Specialty · Roof & Façade' },
      { slug:'berger',  name:'Berger',  logoSrc:'assets/img/brands/berger.png',  blurb:'Sealer primers and emulsions for interior surfaces.',          surfaces:'Primer · Interior' },
      { slug:'crown',   name:'Crown',   logoSrc:'assets/img/brands/crown.png',   blurb:'Specialty roof coatings and waterproofing systems.',           surfaces:'Roof · Specialty' }
    ]);

// Renders a brand-partner showcase card. Logo image is the hero; if the file
// isn't there yet, we swap to a styled wordmark using the Paint Masters
// display font so the card never looks broken while assets trickle in.
//
// Each card is wrapped in an anchor to the per-brand landing page
// (brand.html?brand=<slug>). Slug comes from b.slug when present, otherwise
// derived from b.name so legacy entries without a slug still link correctly.
function pmRenderBrandPartner(b) {
  const slug = (b.slug || String(b.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  const href = `brand.html?brand=${encodeURIComponent(slug)}`;
  // Featured partners (Caparol) get a gold ribbon in the top-right corner
  // and a slightly enriched body line. Non-featured brands render as before.
  const featuredRibbon = b.featured ? `
      <span class="brand-card-featured" aria-label="Featured Partner"
            style="position:absolute;top:10px;right:10px;background:linear-gradient(135deg,var(--gold-500),var(--gold-400));color:var(--navy-900);font-size:0.62rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;padding:4px 10px;border-radius:999px;box-shadow:0 2px 6px rgba(11,31,58,0.18);z-index:2;">★ Featured</span>` : '';
  return `
    <a class="brand-card${b.featured ? ' brand-card-featured-card' : ''}" href="${href}" aria-label="View ${b.name} brand page" style="position:relative;">
      ${featuredRibbon}
      <div class="brand-card-logo">
        <img src="${b.logoSrc}" alt="${b.name}"
             onerror="this.replaceWith(Object.assign(document.createElement('span'), {className:'brand-card-wordmark', textContent:'${b.name}'}))" />
      </div>
      <div class="brand-card-body">
        <span class="brand-card-tag">${b.surfaces}</span>
        <p>${b.blurb}</p>
        <span class="brand-card-link">View brand page →</span>
      </div>
    </a>`;
}

// ─────────────────────────────────────────────────────────────
// Paint catalog (browse-only). Per-paint records used by paints.html
// for the customer browse-by-brand page. No prices — pricing happens
// inside the quote engine where labour + materials are bundled.
// ─────────────────────────────────────────────────────────────
const PM_PAINTS = [
  // ─── Dulux — exterior weatherproof, the Accra façade default ──────────────
  { sku: 'DLX-WS-IVR',  brand: 'Dulux',   name: 'Weathershield Ivory',     finish: 'Exterior matte',     size: '4L tin',  swatch: '#F2E4C9', surface: 'Exterior',  note: 'Best-seller for Accra façades.' },
  { sku: 'DLX-WS-WHT',  brand: 'Dulux',   name: 'Weathershield Pure White',finish: 'Exterior matte',     size: '4L tin',  swatch: '#F8F8F4', surface: 'Exterior',  note: 'Crisp, sun-stable white.' },
  { sku: 'DLX-WS-LIM',  brand: 'Dulux',   name: 'Weathershield Limestone', finish: 'Exterior matte',     size: '4L tin',  swatch: '#E7DFCB', surface: 'Exterior',  note: 'Warm neutral that hides dust between cleans.' },
  { sku: 'DLX-WS-ATL',  brand: 'Dulux',   name: 'Weathershield Atlantic',  finish: 'Exterior matte',     size: '4L tin',  swatch: '#34607D', surface: 'Exterior',  note: 'Coastal blue that stays true through harmattan.' },
  { sku: 'DLX-WS-BRK',  brand: 'Dulux',   name: 'Weathershield Brick Red', finish: 'Exterior matte',     size: '4L tin',  swatch: '#8E3A2A', surface: 'Exterior',  note: 'Deep terracotta for traditional façades.' },
  { sku: 'DLX-IN-CRM',  brand: 'Dulux',   name: 'Interior Cream',          finish: 'Interior matte',     size: '4L tin',  swatch: '#F4ECDA', surface: 'Interior',  note: 'Warm, low-glare living-room finish.' },
  { sku: 'DLX-IN-MAG',  brand: 'Dulux',   name: 'Interior Magnolia',       finish: 'Interior matte',     size: '4L tin',  swatch: '#F2EAD6', surface: 'Interior',  note: 'Soft cream — the safest neutral on the shelf.' },
  { sku: 'DLX-IN-SAG',  brand: 'Dulux',   name: 'Interior Sage Mist',      finish: 'Interior matte',     size: '4L tin',  swatch: '#B6C2A1', surface: 'Interior',  note: 'Calming bedroom and bathroom green.' },

  // ─── Caparol — premium European emulsion, our anchor partner ──────────────
  { sku: 'CPL-CS-WHT',  brand: 'Caparol', name: 'CapaSilk White',          finish: 'Premium silk matte', size: '5L tin',  swatch: '#F6F3EC', surface: 'Interior',  note: 'Wipeable silky matte — premium-spec interiors.' },
  { sku: 'CPL-CS-ALA',  brand: 'Caparol', name: 'CapaSilk Soft Alabaster', finish: 'Premium silk matte', size: '5L tin',  swatch: '#EFEAD9', surface: 'Interior',  note: 'Warm alabaster, lowest batch drift on the market.' },
  { sku: 'CPL-CS-PRL',  brand: 'Caparol', name: 'CapaSilk Warm Pearl',     finish: 'Premium silk matte', size: '5L tin',  swatch: '#E9DFC9', surface: 'Interior',  note: 'Soft beige — flattering kitchen and dining tone.' },
  { sku: 'CPL-CS-GRG',  brand: 'Caparol', name: 'CapaSilk Greige',         finish: 'Premium silk matte', size: '5L tin',  swatch: '#C7BCA8', surface: 'Interior',  note: 'The grown-up neutral. Pairs with everything.' },
  { sku: 'CPL-AC-BRD',  brand: 'Caparol', name: 'Accent Deep Bordeaux',    finish: 'Interior accent',    size: '2.5L tin', swatch: '#5B1A2A', surface: 'Accent',    note: 'Statement accent for dining and feature walls.' },
  { sku: 'CPL-AC-EUC',  brand: 'Caparol', name: 'Accent Eucalyptus',       finish: 'Interior accent',    size: '2.5L tin', swatch: '#8FA493', surface: 'Accent',    note: 'Calming accent for bedrooms and studies.' },
  { sku: 'CPL-TR-WAL',  brand: 'Caparol', name: 'Trim Walnut Brown',       finish: 'Trim & doors',       size: '1L tin',  swatch: '#6B4A2B', surface: 'Trim',      note: 'Rich walnut on doors and skirting.' },
  { sku: 'CPL-TR-ANT',  brand: 'Caparol', name: 'Trim Anthracite',         finish: 'Trim & doors',       size: '1L tin',  swatch: '#2D2F33', surface: 'Trim',      note: 'Modern anthracite for window frames and trim.' },

  // ─── Leyland — soft matte interiors, holds up in tropical heat ────────────
  { sku: 'LEY-MT-OFW',  brand: 'Leyland', name: 'Matte Off-White',         finish: 'Interior matte',     size: '4L tin',  swatch: '#EFEAE0', surface: 'Interior',  note: 'Soft warmth without yellowing.' },
  { sku: 'LEY-MT-COT',  brand: 'Leyland', name: 'Matte Cotton',            finish: 'Interior matte',     size: '4L tin',  swatch: '#F4F0E5', surface: 'Interior',  note: 'Crisp neutral — the everyday workhorse.' },
  { sku: 'LEY-MT-PUT',  brand: 'Leyland', name: 'Matte Putty',             finish: 'Interior matte',     size: '4L tin',  swatch: '#CFC2A8', surface: 'Interior',  note: 'Warm grey-beige with a hint of pink.' },
  { sku: 'LEY-MT-MUS',  brand: 'Leyland', name: 'Matte Mushroom',          finish: 'Interior matte',     size: '4L tin',  swatch: '#A89A82', surface: 'Interior',  note: 'Soft taupe for hallways and stairwells.' },
  { sku: 'LEY-SF-NVY',  brand: 'Leyland', name: 'Soft Sheen Navy',         finish: 'Interior eggshell',  size: '4L tin',  swatch: '#1F2C44', surface: 'Accent',    note: 'Deep navy for accent walls.' },
  { sku: 'LEY-SF-NRD',  brand: 'Leyland', name: 'Soft Sheen Nordic Blue',  finish: 'Interior eggshell',  size: '4L tin',  swatch: '#3B5876', surface: 'Accent',    note: 'Smoky blue — flattering on north-facing walls.' },
  { sku: 'LEY-AC-PLM',  brand: 'Leyland', name: 'Accent Deep Plum',        finish: 'Interior accent',    size: '2.5L tin', swatch: '#3C2438', surface: 'Accent',    note: 'Moody plum — a single feature wall changes a room.' },

  // ─── Azar — local emulsion, bold and saturated ───────────────────────────
  { sku: 'AZR-EML-GRN', brand: 'Azar',    name: 'Emulsion Forest Green',   finish: 'Interior emulsion',  size: '4L tin',  swatch: '#2E5D3A', surface: 'Accent',    note: 'A statement accent wall, sealed in 2 coats.' },
  { sku: 'AZR-EML-TRC', brand: 'Azar',    name: 'Emulsion Terracotta',     finish: 'Interior emulsion',  size: '4L tin',  swatch: '#A85A3F', surface: 'Accent',    note: 'Warm earth tone, popular in living spaces.' },
  { sku: 'AZR-EML-MUS', brand: 'Azar',    name: 'Emulsion Mustard',        finish: 'Interior emulsion',  size: '4L tin',  swatch: '#C99A2E', surface: 'Accent',    note: 'Spice-yellow accent — pairs well with cocoa trim.' },
  { sku: 'AZR-EML-IND', brand: 'Azar',    name: 'Emulsion Indigo',         finish: 'Interior emulsion',  size: '4L tin',  swatch: '#2A3470', surface: 'Accent',    note: 'Saturated indigo for nurseries and reading nooks.' },
  { sku: 'AZR-EML-RSE', brand: 'Azar',    name: 'Emulsion Rosewood',       finish: 'Interior emulsion',  size: '4L tin',  swatch: '#7A2E3D', surface: 'Accent',    note: 'Earthy red — tropical-house staple.' },
  { sku: 'AZR-EML-OCH', brand: 'Azar',    name: 'Emulsion Ochre',          finish: 'Interior emulsion',  size: '4L tin',  swatch: '#B97A1F', surface: 'Accent',    note: 'Sun-baked ochre — feature walls, hallways, niches.' },
  { sku: 'AZR-EML-CRM', brand: 'Azar',    name: 'Emulsion Cream',          finish: 'Interior emulsion',  size: '4L tin',  swatch: '#F2EAD0', surface: 'Interior',  note: 'Soft neutral when you want one wall less bold.' },

  // ─── Coral — high-sheen gloss for trim ──────────────────────────────────
  { sku: 'CRL-GL-BLK',  brand: 'Coral',   name: 'Gloss Black',             finish: 'Trim & doors',       size: '4L tin',  swatch: '#1A1A1A', surface: 'Trim',      note: 'High-sheen for window frames and doors.' },
  { sku: 'CRL-GL-WHT',  brand: 'Coral',   name: 'Gloss White',             finish: 'Trim & doors',       size: '4L tin',  swatch: '#F8F8F8', surface: 'Trim',      note: 'Standard trim white, easy clean.' },
  { sku: 'CRL-GL-IVY',  brand: 'Coral',   name: 'Gloss Soft Ivory',        finish: 'Trim & doors',       size: '4L tin',  swatch: '#F1ECDF', surface: 'Trim',      note: 'Warm trim — sits well with cream walls.' },
  { sku: 'CRL-GL-SLT',  brand: 'Coral',   name: 'Gloss Slate',             finish: 'Trim & doors',       size: '4L tin',  swatch: '#5E6770', surface: 'Trim',      note: 'Mid-grey trim — pairs with off-whites and pales.' },
  { sku: 'CRL-GL-BRK',  brand: 'Coral',   name: 'Gloss Brick Red',         finish: 'Trim & doors',       size: '4L tin',  swatch: '#9F2F2F', surface: 'Trim',      note: 'Heritage trim red for doors and railings.' },
  { sku: 'CRL-GL-FOR',  brand: 'Coral',   name: 'Gloss Forest Green',      finish: 'Trim & doors',       size: '4L tin',  swatch: '#1F4F36', surface: 'Trim',      note: 'Deep green trim for entry doors.' },
  { sku: 'CRL-GL-RYL',  brand: 'Coral',   name: 'Gloss Royal Blue',        finish: 'Trim & doors',       size: '4L tin',  swatch: '#1A3F86', surface: 'Trim',      note: 'Bold blue for window frames and shutters.' },

  // ─── Shield — specialty long-life roof + façade ──────────────────────────
  { sku: 'SHD-RF-ALU',  brand: 'Shield',  name: 'Reflective Aluminium',    finish: 'Specialty roof',     size: '20L drum', swatch: '#C5C8CC', surface: 'Roof',      note: 'Solar-reflective coating. Drops attic temperature by 6–8°C.' },
  { sku: 'SHD-RF-WHT',  brand: 'Shield',  name: 'Solar Reflective White',  finish: 'Specialty roof',     size: '20L drum', swatch: '#F0F1EE', surface: 'Roof',      note: 'Premium SRI — the highest-performance roof we sell.' },
  { sku: 'SHD-RF-TER',  brand: 'Shield',  name: 'Terracotta Roof Tile',    finish: 'Specialty roof',     size: '20L drum', swatch: '#A8513A', surface: 'Roof',      note: 'For tile roofs that have lost their colour.' },
  { sku: 'SHD-RF-SLG',  brand: 'Shield',  name: 'Slate Roof Grey',         finish: 'Specialty roof',     size: '20L drum', swatch: '#3F4751', surface: 'Roof',      note: 'Recoats faded metal and asbestos roofing.' },
  { sku: 'SHD-FA-SND',  brand: 'Shield',  name: 'Façade Sandstone',        finish: 'Specialty exterior', size: '10L drum', swatch: '#C7B189', surface: 'Exterior',  note: 'Long-life façade in a warm sandstone tone.' },
  { sku: 'SHD-FA-ATL',  brand: 'Shield',  name: 'Façade Atlantic Blue',    finish: 'Specialty exterior', size: '10L drum', swatch: '#2C5A82', surface: 'Exterior',  note: 'Marine-grade exterior — coastal homes and docks.' },
  { sku: 'SHD-SP-RST',  brand: 'Shield',  name: 'Anti-Rust Red Primer',    finish: 'Specialty primer',   size: '4L tin',  swatch: '#7E2A1F', surface: 'Specialty', note: 'Goes under metal — gates, balconies, railings.' },

  // ─── Suvinil — primers and interior emulsion ─────────────────────────────
  { sku: 'BGR-PRM-WHT', brand: 'Berger',  name: 'Sealer Primer',           finish: 'Universal primer',   size: '4L tin',  swatch: '#FAFAFA', surface: 'Primer',    note: 'Goes under everything. Stops bleed-through.' },
  { sku: 'BGR-PRM-CON', brand: 'Berger',  name: 'Concrete Primer',         finish: 'Specialty primer',   size: '4L tin',  swatch: '#E2E2E2', surface: 'Primer',    note: 'Locks down chalky concrete and plaster.' },
  { sku: 'BGR-EML-OFW', brand: 'Berger',  name: 'Emulsion Off-White',      finish: 'Interior emulsion',  size: '4L tin',  swatch: '#F1EDE2', surface: 'Interior',  note: 'Workhorse interior emulsion.' },
  { sku: 'BGR-EML-PCH', brand: 'Berger',  name: 'Emulsion Apricot',        finish: 'Interior emulsion',  size: '4L tin',  swatch: '#F0C7A1', surface: 'Interior',  note: 'Warm wash — kids\'s rooms and sunny corners.' },
  { sku: 'BGR-EML-PNK', brand: 'Berger',  name: 'Emulsion Powder Pink',    finish: 'Interior emulsion',  size: '4L tin',  swatch: '#F2D4D0', surface: 'Interior',  note: 'Soft pink — bedrooms and bathrooms.' },
  { sku: 'BGR-EML-MNT', brand: 'Berger',  name: 'Emulsion Mint',           finish: 'Interior emulsion',  size: '4L tin',  swatch: '#C5DDC9', surface: 'Interior',  note: 'Pale mint — kitchens and laundry rooms.' },
  { sku: 'BGR-EML-LAV', brand: 'Berger',  name: 'Emulsion Lavender',       finish: 'Interior emulsion',  size: '4L tin',  swatch: '#C8C0DA', surface: 'Interior',  note: 'Quiet purple — guest bedrooms and studies.' },

  // ─── Crown — specialty roof and floor coatings ──────────────────────────
  { sku: 'CRN-RF-ALU',  brand: 'Crown',   name: 'Aluminium Roof Coating',  finish: 'Specialty roof',     size: '20L drum', swatch: '#C5C8CC', surface: 'Roof',      note: 'Reflects heat, seals leaks. Standard on Accra roofs.' },
  { sku: 'CRN-RF-WHT',  brand: 'Crown',   name: 'Solar White Roof',        finish: 'Specialty roof',     size: '20L drum', swatch: '#EAECEA', surface: 'Roof',      note: 'High-albedo white — keeps single-storey homes cool.' },
  { sku: 'CRN-RF-CHA',  brand: 'Crown',   name: 'Charcoal Roof',           finish: 'Specialty roof',     size: '20L drum', swatch: '#262A2F', surface: 'Roof',      note: 'For dark-tile roofs and metal awnings.' },
  { sku: 'CRN-EPX-CLR', brand: 'Crown',   name: '2-Part Epoxy Floor Coat', finish: 'Specialty floor',    size: '10L set', swatch: '#B8B8B8', surface: 'Specialty', note: 'For warehouses, clinics, kitchens.' },
  { sku: 'CRN-EPX-MID', brand: 'Crown',   name: 'Epoxy Mid-Grey Floor',    finish: 'Specialty floor',    size: '10L set', swatch: '#7E7E7E', surface: 'Specialty', note: 'Light-industrial mid-grey — workshops and garages.' },
  { sku: 'CRN-SF-YEL',  brand: 'Crown',   name: 'Safety Yellow',           finish: 'Specialty industrial',size: '4L tin',  swatch: '#F2C400', surface: 'Specialty', note: 'Walkway and machine-guard yellow.' },
  { sku: 'CRN-SF-RED',  brand: 'Crown',   name: 'Safety Red',              finish: 'Specialty industrial',size: '4L tin',  swatch: '#C8102E', surface: 'Specialty', note: 'Fire-equipment and stop-bar red.' }
];

// Helper: render a single paint card for the browse page.
function pmRenderPaintCard(p) {
  return `
    <div class="paint-card" data-brand="${p.brand}" data-surface="${p.surface}" data-sku="${p.sku}">
      <div class="paint-swatch" style="background:${p.swatch};"></div>
      <div class="paint-body">
        <div class="paint-meta">
          <span class="paint-brand">${p.brand}</span>
          <span class="paint-finish">${p.finish}</span>
        </div>
        <strong>${p.name}</strong>
        <p>${p.note}</p>
        <div class="paint-foot">
          <span class="paint-size">${p.size}</span>
          <a href="quote.html?paint=${encodeURIComponent(p.sku)}" class="paint-cta">Use in quote →</a>
        </div>
      </div>
    </div>`;
}

// =============================================
// Caparol product gallery — the ready-made marketing spec cards Caparol
// publishes for each product (CapaPrime, CapaSuper, etc.). Each entry maps
// one of the IMG_*.JPG files in assets/img/brands/caparol_paints/ to the
// product name + category. The brand.html template renders this only when
// the page is loaded as ?brand=caparol; the homepage uses the first few
// entries for the featured Caparol hero section.
//
// Order is intentional: hero/marquee products first (the most photogenic
// and the broadest-appeal interior/exterior emulsions), then specialty
// finishes, then primers/putties/fillers. Re-ordering here re-orders both
// the brand page grid and the homepage feature.
// =============================================
const PM_CAPAROL_GALLERY = [
  // Marquee interior emulsions — what most homeowners actually buy.
  { file: 'IMG_4668.JPG', name: 'CapaSuper',         category: 'Interior Emulsion',        sizes: '18L · 3.75L', tagline: 'Matt emulsion, 40 vibrant colours, exceptional coverage.' },
  { file: 'IMG_4669.JPG', name: 'CapaPlus Silk',     category: 'Interior Silk Emulsion',   sizes: '18L · 3.75L', tagline: 'High-grade washable silk for walls and ceilings.' },
  { file: 'IMG_4670.JPG', name: 'CapaLux',           category: 'Interior Zero-VOC',        sizes: '18L · 3.75L', tagline: 'Eco-friendly, zero-VOC — safe for nurseries and clinics.' },
  { file: 'IMG_4671.JPG', name: 'CapaPlus Hygiene',  category: 'Interior Anti-bacterial',  sizes: '18L · 3.75L', tagline: 'Anti-bacterial, anti-fungal emulsion for kitchens & bathrooms.' },
  { file: 'IMG_4673.JPG', name: 'CleanStar',         category: 'Interior Stain-release',   sizes: '18L · 3.75L', tagline: 'Stain-release technology — wipes clean, completely odourless.' },

  // Exterior emulsions — Accra weather is the real test.
  { file: 'IMG_4672.JPG', name: 'CapaForte',         category: 'Exterior Emulsion',        sizes: '27KG · 5KG',  tagline: '2× coverage, anti-fungal premium acrylic matt.' },
  { file: 'IMG_4675.JPG', name: 'CapaUltra Matt',    category: 'Exterior Matt Emulsion',   sizes: '18L · 3.75L', tagline: 'Superior washability, unlimited colours that stay true.' },
  { file: 'IMG_4676.JPG', name: 'Optima Exterior',   category: 'Exterior Emulsion',        sizes: '18L · 3.75L', tagline: 'Zero-sheen matt with anti-carbonation properties.' },
  { file: 'IMG_4674.JPG', name: 'FlexoTop',          category: 'Exterior Anti-carbonation',sizes: '18L · 3.75L', tagline: 'Smooth crack-bridging finish with UV resistance.' },
  { file: 'IMG_4677.JPG', name: 'Amphibolin',        category: 'Premium Elastomeric',      sizes: '18L · 3.75L', tagline: 'Elastomeric top coat — the heavy-duty façade choice.' },

  // Specialty textures and stone effects — the architect-spec lines.
  { file: 'IMG_4680.JPG', name: 'StructurePutz',     category: 'Exterior Texture',         sizes: '18L · 3L',    tagline: 'High-build grooved texture — covers undulations.' },
  { file: 'IMG_4678.JPG', name: 'CapaTex',           category: 'Exterior Texture',         sizes: '25KG · 5KG',  tagline: 'Heavy textured finish, easy roller application.' },
  { file: 'IMG_4679.JPG', name: 'CapaGrain',         category: 'Exterior Texture',         sizes: '25KG · 5KG',  tagline: 'Acrylic co-polymer texture — interior & exterior.' },
  { file: 'IMG_4682.JPG', name: 'CapaSprayTex',      category: 'Exterior Texture',         sizes: '30KG · 5KG',  tagline: 'Heavy-duty splattered texture, fast spray application.' },
  { file: 'IMG_4683.JPG', name: 'Rashaat',           category: 'Exterior Texture',         sizes: '16L · 3.75L', tagline: 'Nano-technology elegant textured finish.' },
  { file: 'IMG_4684.JPG', name: 'CapaStone: Ceratile', category: 'Stone Effect',           sizes: '23KG · 5KG',  tagline: 'Natural-stone spatter using real aggregates.' },
  { file: 'IMG_4681.JPG', name: 'CapaStone: Granito', category: 'Stone Effect',           sizes: '23KG · 5KG',  tagline: 'Granite-like finish — high UV, anti-carbonation.' },

  // Primers, putties, fillers — the foundation layer.
  { file: 'IMG_4663.JPG', name: 'CapaPrime',         category: 'Interior Primer',          sizes: '18L · 3.75L', tagline: 'Low-VOC, low-odour interior primer with high adhesion.' },
  { file: 'IMG_4664.JPG', name: 'CapaAcryl Primer',  category: 'Exterior Primer',          sizes: '18L · 3.75L', tagline: 'Water-based exterior primer for concrete, plaster, gypsum.' },
  { file: 'IMG_4665.JPG', name: 'CapaStucco',        category: 'Interior Stucco',          sizes: '30KG · 5KG',  tagline: 'Smooth interior wall stucco — perfect base for topcoats.' },
  { file: 'IMG_4666.JPG', name: 'CapaFilex',         category: 'Filler & Repair',          sizes: '30KG · 5KG',  tagline: 'Repairs minor defects in renders, plasters, concrete.' },
  { file: 'IMG_4667.JPG', name: 'CapaMajun',         category: 'White Cement Putty',       sizes: '20KG',        tagline: 'White cement putty — covers hairline cracks, water-resistant.' },
];

// Render a single Caparol product card. The image IS the marketing card
// (Caparol-published infographic) so we just frame it cleanly with a label
// strip underneath and a CTA. Clicking the image opens a lightbox view.
function pmRenderCaparolProductCard(p) {
  const src = `assets/img/brands/caparol_paints/${p.file}`;
  return `
    <article class="caparol-product-card" data-caparol-card="${encodeURIComponent(p.name)}">
      <button class="caparol-product-image-btn" type="button"
              data-caparol-lightbox-src="${src}"
              data-caparol-lightbox-name="${p.name}"
              aria-label="Enlarge ${p.name} spec sheet">
        <img src="${src}" alt="${p.name} — ${p.category}" loading="lazy" />
      </button>
      <div class="caparol-product-body">
        <span class="caparol-product-category">${p.category}</span>
        <h3>${p.name}</h3>
        <p>${p.tagline}</p>
        <div class="caparol-product-foot">
          <span class="caparol-product-sizes">${p.sizes}</span>
          <a class="caparol-product-cta"
             href="quote.html?brand=Caparol&amp;product=${encodeURIComponent(p.name)}">Get a quote →</a>
        </div>
      </div>
    </article>`;
}

// Wire up a simple click-to-enlarge lightbox for the Caparol gallery.
// Call once after the cards are in the DOM.
function pmInitCaparolLightbox() {
  if (document.getElementById('caparol-lightbox')) return; // already wired
  const overlay = document.createElement('div');
  overlay.id = 'caparol-lightbox';
  overlay.setAttribute('hidden', '');
  overlay.innerHTML = `
    <button class="caparol-lightbox-close" aria-label="Close">×</button>
    <figure>
      <img alt="" />
      <figcaption></figcaption>
    </figure>`;
  document.body.appendChild(overlay);

  const img = overlay.querySelector('img');
  const cap = overlay.querySelector('figcaption');

  function open(src, name) {
    img.src = src; img.alt = name + ' spec sheet';
    cap.textContent = name;
    overlay.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    overlay.setAttribute('hidden', '');
    img.src = ''; cap.textContent = '';
    document.body.style.overflow = '';
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-caparol-lightbox-src]');
    if (btn) {
      open(btn.dataset.caparolLightboxSrc, btn.dataset.caparolLightboxName);
    } else if (e.target.matches('.caparol-lightbox-close') || e.target === overlay) {
      close();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hasAttribute('hidden')) close();
  });
}
