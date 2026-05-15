// ============================
// services/audit.js — write helper used by middleware/audit.js.
// Fire-and-forget; never throws into the request flow.
// ============================

const db  = require('../db');
const log = require('../utils/logger');

function record({ action, entityType, entityId, actorId, actorRole, ip, requestId, payload }) {
  try {
    db.prepare(`
      INSERT INTO audit_log (action, entity_type, entity_id, actor_id, actor_role, ip, request_id, payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      action,
      entityType || null,
      entityId   || null,
      actorId    || null,
      actorRole  || null,
      ip         || null,
      requestId  || null,
      payload    || null,
    );
  } catch (e) {
    log.warn({ err: e.message }, 'audit log write failed');
  }
}

function list({ limit = 100, action, entityId } = {}) {
  let sql = 'SELECT * FROM audit_log';
  const where = []; const params = [];
  if (action)   { where.push('action = ?');    params.push(action); }
  if (entityId) { where.push('entity_id = ?'); params.push(entityId); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(Math.min(500, limit));
  return db.prepare(sql).all(...params);
}

module.exports = { record, list };
