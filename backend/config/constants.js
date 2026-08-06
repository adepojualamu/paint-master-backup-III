// ============================
// Business constants. Anything that's a "magic number" should live here so we have
// one place to change it. All currency is in GHS (Ghana Cedi) unless noted.
// ============================

module.exports = {
  // Platform economics
  PLATFORM_FEE_PCT:        0.10,   // 10% added to subtotal
  PAINTER_PAYOUT_PCT:      0.90,   // painter receives 90% of total

  // Refund policy
  REFUND_FULL_HOURS:       48,     // ≥48 hrs before job_date → full refund
  REFUND_LATE_FEE_PCT:     0.20,   // <48 hrs → 20% cancellation fee

  // Pricing — used by services/pricing.js
  // Per-sqm rates by service type (GHS). Conservative defaults.
  RATE_PER_SQM: {
    Interior:      14,
    Exterior:      18,
    Commercial:    22,
    Decorative:    35,
    Waterproofing: 28,
    Repaint:       12,
  },
  // Materials uplift if customer wants the painter to supply paint
  MATERIALS_PER_SQM:       45,     // GHS per sqm of paint + primer

  // Validation bounds
  MIN_RATE_PER_DAY:        50,     // GHS
  MAX_RATE_PER_DAY:        2000,
  // Server-side default day-rate used when an anonymous customer creates a
  // quote without an assigned painter. Critical: the customer-supplied
  // rate_per_day is NEVER trusted by the quote create path; if no painter
  // is assigned yet, we use this default instead. See routes/quotes.js.
  DEFAULT_QUOTE_RATE_PER_DAY: 500,
  MIN_AREA_SQM:            5,
  MAX_AREA_SQM:            10000,
  MIN_DURATION_DAYS:       1,
  MAX_DURATION_DAYS:       60,

  // Pagination
  DEFAULT_PAGE_SIZE:       20,
  MAX_PAGE_SIZE:           100,

  // Booking ID
  BOOKING_ID_PREFIX:       'BK-',
  QUOTE_ID_PREFIX:         'QT-',
  CONTRACT_ID_PREFIX:      'CT-',
  PAYMENT_REF_PREFIX:      'PAY-',

  // Roles / statuses (centralised so we never typo a string)
  ROLES:           ['customer', 'painter', 'admin'],
  ADMIN_SUB_ROLES: ['super_admin', 'dispatcher', 'qa', 'finance', 'inventory_manager'],
  // Booking lifecycle (in order):
  //   pending_assignment  customer booked, no painter yet
  //   pending             painter assigned, awaiting their confirmation
  //   confirmed           painter said yes, locked in
  //   in_progress         painter on site
  //   qa_pending          painter says done, QA still needs to sign off
  //   completed           QA signed off, warranty starts, payouts release,
  //                       reservations get consumed
  //   cancelled           customer/admin pulled the plug; reservations released
  BOOKING_STATUS:  ['pending_assignment', 'pending', 'confirmed', 'in_progress', 'qa_pending', 'completed', 'cancelled'],
  PAYMENT_STATUS:  ['pending', 'paid', 'refunded', 'partial_refund', 'failed'],
  PAYMENT_METHODS: ['momo', 'card', 'onsite'],

  // Quote volume gate — a quote cannot become a contract until a dispatcher
  // (or super_admin) has confirmed the volume estimate.
  QUOTE_VOLUME_STATUS: ['not_required', 'pending_review', 'confirmed', 'rejected'],
};
