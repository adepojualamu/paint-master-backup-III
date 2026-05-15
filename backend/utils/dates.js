// ============================
// Date helpers. We work in Africa/Accra (UTC+0, no DST) so most things just work,
// but having a single module means swapping the timezone later is one change.
// ============================

const TZ = 'Africa/Accra';

function nowISO() { return new Date().toISOString(); }

function todayYMD() {
  const d = new Date();
  return d.toISOString().slice(0, 10);  // YYYY-MM-DD (UTC ≈ Accra)
}

function isFutureDate(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  return ymd > todayYMD();
}

function hoursBetween(fromIso, toIso) {
  return (new Date(toIso) - new Date(fromIso)) / 36e5;
}

// Inclusive list of YYYY-MM-DD between start (inclusive) and start+days-1.
function daySpan(startYmd, days) {
  const out = [];
  const d = new Date(startYmd + 'T00:00:00Z');
  for (let i = 0; i < days; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

module.exports = { TZ, nowISO, todayYMD, isFutureDate, hoursBetween, daySpan };
