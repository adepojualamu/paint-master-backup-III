// ============================
// Records admin write actions to the audit_log table. Mount on any admin route
// that mutates state. Reads action + entity from the route metadata.
//
//   router.post('/painters/:id/verify', audit('painter.verify', 'painter'), handler)
// ============================

const audit = require('../services/audit');

module.exports = function makeAudit(action, entityType) {
  return function auditMiddleware(req, _res, next) {
    // Defer the actual write until after the response so we don't slow the user.
    res_on_finish(req, () => {
      audit.record({
        action,
        entityType,
        entityId:  req.params.id || req.body?.id || null,
        actorId:   req.user?.id  || null,
        actorRole: req.user?.role || null,
        ip:        req.ip,
        requestId: req.id,
        payload:   safeBody(req.body),
      });
    });
    next();
  };
};

function res_on_finish(req, fn) {
  req.res.once('finish', fn);
}
function safeBody(body) {
  if (!body || typeof body !== 'object') return null;
  const clone = { ...body };
  // Never store passwords or tokens, even in audit.
  ['password', 'currentPassword', 'newPassword', 'token'].forEach(k => { if (clone[k]) clone[k] = '[redacted]'; });
  return JSON.stringify(clone).slice(0, 4000);
}
