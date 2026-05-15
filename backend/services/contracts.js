// ============================
// services/contracts.js — generate + manage signed contracts.
// STATUS: DB layer real; PDF generation is a skeleton.
// ============================

const db   = require('../db');
const ids  = require('../utils/ids');
const log  = require('../utils/logger');
const { notFound, badRequest } = require('../utils/errors');

function templateBody({ booking, customer, painter }) {
  return `PAINTGH SERVICE AGREEMENT — ${booking.id}

Customer: ${customer.name} (${customer.phone})
Painter:  ${painter.name} (${painter.phone})

Job:      ${booking.service} at ${booking.address}
Start:    ${booking.job_date}
Duration: ${booking.duration_days} day(s)
Total:    GH₵${booking.total}

Both parties agree to PaintGH's standard terms (cancellation policy, dispute resolution, scope changes).

Customer signature: __________   Date: __________
Painter signature:  __________   Date: __________`;
}

function createForBooking(bookingId) {
  const booking  = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) throw notFound(`Booking ${bookingId} not found`);
  const customer = db.prepare('SELECT name, phone, email FROM users WHERE id = ?').get(booking.customer_id);
  const painter  = db.prepare(`
    SELECT u.name, u.phone, u.email FROM painter_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.id = ?
  `).get(booking.painter_id);

  const id   = ids.contractId();
  const body = templateBody({ booking, customer, painter });

  db.prepare(`
    INSERT INTO contracts (id, booking_id, body, status) VALUES (?, ?, ?, 'pending_signatures')
  `).run(id, bookingId, body);

  return db.prepare('SELECT * FROM contracts WHERE id = ?').get(id);
}

function sign({ contractId, role, signature }) {
  if (!['customer', 'painter'].includes(role)) throw badRequest('role must be customer or painter');
  const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId);
  if (!contract) throw notFound('Contract not found');

  const col = role === 'customer' ? 'customer_signed_at' : 'painter_signed_at';
  const sigCol = role === 'customer' ? 'customer_signature' : 'painter_signature';
  db.prepare(`UPDATE contracts SET ${col} = datetime('now'), ${sigCol} = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(signature || role + '_typed', contractId);

  // If both parties signed, flip status to 'signed' and queue PDF generation.
  const fresh = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId);
  if (fresh.customer_signed_at && fresh.painter_signed_at) {
    db.prepare(`UPDATE contracts SET status = 'signed' WHERE id = ?`).run(contractId);
    // TODO: services/contracts.js → renderPDF(contract) → store via services/uploads.store(...)
    log.info({ contractId }, 'Contract fully signed — PDF generation queued (TODO)');
  }
  return db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId);
}

async function renderPDF(/* contract */) {
  // TODO: pdfkit or puppeteer → buffer → uploads.store({ buffer, ...prefix: 'contracts' })
  throw new Error('Contract PDF generation not implemented yet.');
}

module.exports = { createForBooking, sign, renderPDF, templateBody };
