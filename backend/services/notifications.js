// ============================
// services/notifications.js — high-level "tell people things" orchestrator.
// Composes sms + email + (later) in-app push, so route handlers never call
// the channel-specific services directly.
// ============================

const sms   = require('./sms');
const email = require('./email');
const log   = require('../utils/logger');

async function bookingConfirmed({ customer, painter, booking }) {
  const tasks = [
    sms.send({
      to: customer.phone,
      body: `PaintGH: Your booking ${booking.id} for ${booking.service} on ${booking.job_date} is confirmed by ${painter.name}.`,
      relatedBookingId: booking.id,
    }),
    sms.send({
      to: painter.phone,
      body: `PaintGH: New job ${booking.id} confirmed for ${booking.job_date}. Customer: ${customer.name}, ${booking.address}.`,
      relatedBookingId: booking.id,
    }),
  ];
  if (customer.email) {
    tasks.push(email.send({
      to: customer.email,
      subject: `Your PaintGH booking ${booking.id} is confirmed`,
      body: `Hi ${customer.name},\n\n${painter.name} has confirmed your booking on ${booking.job_date}.\n\n— PaintGH`,
      relatedBookingId: booking.id,
    }));
  }
  return Promise.allSettled(tasks).then(results => {
    results.filter(r => r.status === 'rejected').forEach(r => log.warn({ err: r.reason }, 'notification rejected'));
    return results;
  });
}

async function jobCompleted({ customer, painter, booking }) {
  return sms.send({
    to: customer.phone,
    body: `PaintGH: ${painter.name} has marked job ${booking.id} complete. Please review and rate.`,
    relatedBookingId: booking.id,
  });
}

module.exports = { bookingConfirmed, jobCompleted };
