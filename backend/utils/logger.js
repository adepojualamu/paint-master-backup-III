// ============================
// Structured logger. Falls back to console if pino isn't installed yet.
// To upgrade: `npm install pino pino-pretty` and the import path will resolve.
// ============================

const config = require('../config');

let logger;
try {
  // eslint-disable-next-line node/no-missing-require
  const pino = require('pino');
  logger = pino({
    level: config.log.level,
    transport: config.isDev ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
    base: { app: 'paintgh-backend' },
  });
} catch (_) {
  // Fallback: thin shim so calling code doesn't care which logger is active.
  const stamp = (level) => (...args) => {
    const ts = new Date().toISOString();
    // eslint-disable-next-line no-console
    console.log(`[${ts}] ${level.toUpperCase()}`, ...args);
  };
  logger = {
    fatal: stamp('fatal'), error: stamp('error'), warn: stamp('warn'),
    info:  stamp('info'),  debug: stamp('debug'), trace: stamp('trace'),
    child: () => logger,
  };
}

module.exports = logger;
