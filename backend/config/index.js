// ============================
// Typed env loader. Fails fast if required vars are missing or malformed.
// ============================

require('dotenv').config();

function required(name) {
  const v = process.env[name];
  if (v === undefined || v === '') throw new Error(`Missing required env var: ${name}`);
  return v;
}
function optional(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}
function int(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

const NODE_ENV = optional('NODE_ENV', 'development');

const config = {
  env:        NODE_ENV,
  isProd:     NODE_ENV === 'production',
  isTest:     NODE_ENV === 'test',
  isDev:      NODE_ENV === 'development',
  port:       int(process.env.PORT, 3000),

  jwt: {
    secret:    required('JWT_SECRET'),
    expiresIn: optional('JWT_EXPIRES_IN', '7d'),
  },

  db: {
    path: optional('DB_PATH', './paintgh.db'),
  },

  rateLimit: {
    windowMs: int(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    authMax:  int(process.env.RATE_LIMIT_AUTH_MAX, 10),
    apiMax:   int(process.env.RATE_LIMIT_API_MAX, 120),
  },

  cors: {
    // Comma-separated allowlist for production. Empty = allow all (dev only).
    origins: optional('CORS_ORIGINS', '').split(',').map(s => s.trim()).filter(Boolean),
  },

  // Third-party — populated when we wire them up.
  paystack: {
    secretKey:    optional('PAYSTACK_SECRET_KEY', ''),
    webhookSecret: optional('PAYSTACK_WEBHOOK_SECRET', ''),
  },
  hubtel: {
    clientId:        optional('HUBTEL_CLIENT_ID', ''),
    clientSecret:    optional('HUBTEL_CLIENT_SECRET', ''),
    senderId:        optional('HUBTEL_SENDER_ID', 'PaintGH'),
    // Receive Money / payments:
    merchantAccount: optional('HUBTEL_MERCHANT_ACCOUNT', ''),
    callbackUrl:     optional('HUBTEL_CALLBACK_URL', 'http://localhost:3000/api/payments/callback'),
    callbackSecret:  optional('HUBTEL_CALLBACK_SECRET', ''),
    // 'stub' forces no real HTTP calls even when credentials are present (CI / demos).
    mode:            optional('HUBTEL_MODE', ''),
  },
  email: {
    provider: optional('EMAIL_PROVIDER', ''),     // resend | sendgrid | mailgun | ''
    apiKey:   optional('EMAIL_API_KEY', ''),
    from:     optional('EMAIL_FROM', 'no-reply@paintgh.com'),
  },
  uploads: {
    driver:    optional('UPLOADS_DRIVER', 'local'),  // local | s3 | r2
    localDir:  optional('UPLOADS_LOCAL_DIR', './uploads'),
    s3Bucket:  optional('S3_BUCKET', ''),
    s3Region:  optional('S3_REGION', ''),
    publicUrl: optional('UPLOADS_PUBLIC_URL', ''),
  },

  log: {
    level: optional('LOG_LEVEL', NODE_ENV === 'production' ? 'info' : 'debug'),
  },
};

module.exports = config;
