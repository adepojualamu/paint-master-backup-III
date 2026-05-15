Paint Masters — Logo assets
============================

The official logo lives here in four variants. Each one is auto-rendered in
the right place by the brand system; you don't need to edit HTML or CSS to
swap any of them — just replace the file at the listed path.

  paint-masters-logo.png            — Square monogram, dark navy ink
                                      Used on light backgrounds:
                                        • Customer-site nav (top-left)
                                        • Settings → Branding preview

  paint-masters-logo-light.png      — Square monogram, white ink
                                      Used on dark backgrounds:
                                        • Customer-site footer
                                        • Admin sidebar

  paint-masters-logo-full.png       — Full horizontal "PAINT MASTERS" lockup,
                                      dark text, colour accents
                                      Used on light backgrounds (none yet,
                                      ready for: print materials, PDF receipts,
                                      email letterhead).

  paint-masters-logo-full-light.png — Full horizontal lockup, light text
                                      Used on dark backgrounds:
                                        • Login page hero panel

  favicon.png                       — 64×64 browser tab icon, derived
                                      from the monogram. Linked from every
                                      .html page automatically.

  paint-masters-logo-source.PNG     — Original 1024×1024 file you uploaded.
                                      Kept here for reference — never used
                                      directly in the UI.


How the styling stays dynamic
-----------------------------
The brand mark sits in a CSS-controlled box called .brand-mark, and the
horizontal lockup sits in .brand-lockup. Both are sized via CSS variables
defined in assets/styles.css:

    --brand-mark-size     (default 34px)   — width & height of the square
    --brand-mark-radius   (default 8px)    — rounded corners
    --brand-mark-bg       (default navy)   — background colour (hidden when
                                              a real image loads, kept as
                                              the fallback for the "PM" text)
    --brand-lockup-height (default 36px)   — height of the horizontal lockup

To make the brand mark larger anywhere, add the .lg / .xl / .xxl modifier
class to the wrapping element:

    <span class="brand-mark xl">…</span>     (72px)
    <span class="brand-mark xxl">…</span>    (120px)

When the image loads successfully, the navy box and kente accent stripe are
suppressed automatically (CSS :has(img) rule) — the mark sits clean on
whatever surface is behind it. If the image is missing, the navy box +
"PM" text fallback appears so nothing looks broken.


Replacing the assets
--------------------
You can drop in updated files at any time. The recommended specs are:

  paint-masters-logo.png       Square (e.g. 256×256 or 512×512), transparent bg
                               Dark/navy ink — colour values come from your
                               brand standard
  paint-masters-logo-light.png Same dimensions, white/light ink
  paint-masters-logo-full.png  Wide aspect (e.g. 836×314 like the source crop)
                               Dark text + colour accents
  ...-full-light.png           Same wide aspect, light text + colour accents
  favicon.png                  64×64

SVG works equally well — just save with a .svg extension and update the
PM_BRAND block at the top of assets/shared.js so the paths point at .svg
instead of .png.


Where the brand is referenced in code
-------------------------------------
  • assets/shared.js          PM_BRAND config + pmBrandMark() helper
  • assets/styles.css         .brand-mark and .brand-lockup styling
  • admin/assets/admin-shared.js  adminBrandMark() (light variant)
  • login.html                hero panel uses .brand-lockup directly
  • admin/settings.html       Branding tab shows live preview of the mark
