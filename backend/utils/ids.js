// ============================
// ID generators. We use crypto.randomBytes to avoid the Math.random collision risk
// from the original booking-ID scheme.
// ============================

const crypto = require('crypto');
const C = require('../config/constants');

// 8 alphanumeric chars (no I/O/0/1 to avoid confusion when read aloud).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(len = 8) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

module.exports = {
  randomCode,
  bookingId:  () => C.BOOKING_ID_PREFIX  + randomCode(8),
  quoteId:    () => C.QUOTE_ID_PREFIX    + randomCode(8),
  contractId: () => C.CONTRACT_ID_PREFIX + randomCode(8),
  paymentRef: () => C.PAYMENT_REF_PREFIX + randomCode(10),
  uuid:       () => crypto.randomUUID(),
};
