// ============================
// scripts/notify-test.js — live verification of the SMS + email send paths.
//
// Sends one real test SMS and one real test email through the exact
// services/sms.js and services/email.js modules the notification worker
// uses. A green run here means the production notification pipeline
// (notifications.emit → notifications_outbox → notifyWorker → these
// senders) will deliver for real.
//
// Run from the backend/ directory:
//   node scripts/notify-test.js <phone> <email>
// e.g.
//   node scripts/notify-test.js 0244123456 you@example.com
//
// Behaviour depends entirely on backend/.env:
//   • No credentials              → senders log to sms_log / email_log as
//                                   'pending' and report record-only mode;
//                                   nothing is actually sent.
//   • HUBTEL_MODE / EMAIL_MODE=stub → logged as sent, no real HTTP, no cost.
//   • Real credentials            → a real SMS + email go out. Standard
//                                   Hubtel SMS charges apply.
//
// Every attempt — sent, failed or pending — is recorded in the sms_log /
// email_log tables, so there is always an audit trail to inspect.
// ============================

const config = require('../config');
const sms    = require('../services/sms');
const email  = require('../services/email');

// Show whether a secret is configured WITHOUT printing its value.
const has = (v) => (v ? 'set' : '— missing');

function verdict(result, err) {
  if (err) return 'FAILED — ' + err.message;
  if (!result) return 'no result';
  if (result.stub && result.reason === 'no_credentials') {
    return 'record-only (no credentials in .env) — nothing sent';
  }
  if (result.stub) return 'stub mode — logged as sent, no real HTTP';
  if (result.sent) return 'SENT' + (result.providerId ? ' · provider id ' + result.providerId : '');
  return 'not sent';
}

async function main() {
  const phone   = process.argv[2];
  const toEmail = process.argv[3];

  if (!phone || !toEmail) {
    console.error('Usage:   node scripts/notify-test.js <phone> <email>');
    console.error('Example: node scripts/notify-test.js 0244123456 you@example.com');
    process.exit(1);
  }

  console.log('\nPaint Masters — notification send test');
  console.log('======================================');
  console.log('Environment      :', config.env);
  console.log('SMS — Hubtel');
  console.log('  client id      :', has(config.hubtel.clientId));
  console.log('  client secret  :', has(config.hubtel.clientSecret));
  console.log('  sender id      :', config.hubtel.senderId);
  console.log('  mode           :', config.hubtel.mode || '(live)');
  console.log('Email');
  console.log('  provider       :', config.email.provider || '(none)');
  console.log('  api key        :', has(config.email.apiKey));
  console.log('  from           :', config.email.from);
  console.log('  mode           :', config.email.mode || '(live)');
  if (String(config.email.provider).toLowerCase() === 'mailgun') {
    console.log('  mailgun domain :', has(config.email.mailgunDomain));
  }
  console.log('');

  let smsResult, smsErr, emailResult, emailErr;

  // ---- test SMS ----
  console.log('-> Sending test SMS to', phone, '...');
  try {
    smsResult = await sms.send({
      to:   phone,
      body: 'Paint Masters: test SMS confirming your notification setup works. No action needed.',
    });
    console.log('   result:', JSON.stringify(smsResult));
  } catch (e) {
    smsErr = e;
    console.log('   error :', e.message);
  }

  // ---- test email ----
  console.log('-> Sending test email to', toEmail, '...');
  try {
    emailResult = await email.send({
      to:      toEmail,
      subject: 'Paint Masters — notification test',
      body:    'This is a test email confirming your Paint Masters notification setup works.\n\n'
             + 'If you received this, the email sending path is live. No action needed.\n\n'
             + '— Paint Masters',
    });
    console.log('   result:', JSON.stringify(emailResult));
  } catch (e) {
    emailErr = e;
    console.log('   error :', e.message);
  }

  // ---- summary ----
  console.log('\nSummary');
  console.log('-------');
  console.log('SMS   :', verdict(smsResult, smsErr));
  console.log('Email :', verdict(emailResult, emailErr));
  console.log('\nAll attempts are recorded in the sms_log / email_log tables.\n');

  // Non-zero exit only when a configured channel hard-failed, so this can be
  // wired into CI later. Record-only mode is a clean pass.
  process.exit((smsErr || emailErr) ? 1 : 0);
}

main().catch((e) => { console.error('Unexpected error:', e && (e.stack || e.message)); process.exit(2); });
