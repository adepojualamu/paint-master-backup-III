// ============================
// Currency helpers. Internally we store GHS as integer pesewas (1 GHS = 100 pesewas)
// to avoid float drift in totals. API still emits decimals for human consumption.
// ============================

function toPesewas(ghs) {
  return Math.round(Number(ghs) * 100);
}
function toCedis(pesewas) {
  return Math.round(Number(pesewas)) / 100;
}
function formatGHS(ghs, { withSymbol = true } = {}) {
  const n = Number(ghs).toFixed(2);
  const withCommas = n.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return withSymbol ? `GH₵${withCommas}` : withCommas;
}

module.exports = { toPesewas, toCedis, formatGHS };
