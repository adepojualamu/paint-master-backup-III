// ============================
// Ghana mobile phone normalisation.
// Accepts 0244…, +233244…, 233244… → returns canonical +233244…
// ============================

const GH_LOCAL = /^0\d{9}$/;            // 0244123456
const GH_INTL  = /^\+?233\d{9}$/;       // 233244123456 or +233244123456

function normaliseGH(phone) {
  if (!phone) return null;
  const trimmed = String(phone).replace(/\s|-/g, '');
  if (GH_LOCAL.test(trimmed)) return '+233' + trimmed.slice(1);
  if (GH_INTL.test(trimmed))  return trimmed.startsWith('+') ? trimmed : '+' + trimmed;
  return null;
}
function isValidGH(phone) {
  return normaliseGH(phone) !== null;
}
function displayGH(phone) {
  // +233244123456 → 0244 123 456 for UI
  const n = normaliseGH(phone);
  if (!n) return phone;
  const local = '0' + n.slice(4);
  return local.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
}

module.exports = { normaliseGH, isValidGH, displayGH };
