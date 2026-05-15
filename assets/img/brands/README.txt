Paint partner logos
====================

Drop logo files here named after the brand, lowercase, .png:

  dulux.png
  berger.png
  leyland.png
  azar.png
  coral.png
  crown.png

The homepage's "Trusted paint partners" strip will pick them up
automatically — no code changes needed.

Recommended specs
-----------------
  • Wider than tall (the strip cells are 200×56)
  • Transparent background
  • At least 200×60px
  • SVG works equally well; just save as <brand>.svg and update the
    `logoSrc` in assets/paint-catalog.js → PM_BRAND_PARTNERS

Until each file lands
---------------------
The strip falls back to a styled nameplate showing the brand name in
the Paint Masters display font. Layout never shifts.

Adding or removing partners
---------------------------
Open assets/paint-catalog.js → edit the PM_BRAND_PARTNERS array.
The strip auto-resizes; up to ~8 logos read cleanly on desktop.
