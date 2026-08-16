const db = require('../db');
const { sendMail } = require('./mailer');

// Fire-and-forget: inserts an in-app notification and, if requested, emails it.
// Never throws into the caller's request flow - mirrors the pattern already used
// for password-reset emails (log failures, don't block the response).
async function createNotification({ userId, type, title, body, link, sendEmail = false }) {
  if (!userId) return;
  try {
    await db.query(
      `INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1,$2,$3,$4,$5)`,
      [userId, type || null, title, body || null, link || null]
    );
  } catch (err) {
    console.error('createNotification insert failed:', err.message);
    return;
  }

  if (sendEmail) {
    try {
      const userResult = await db.query(`SELECT email, name FROM users WHERE id = $1`, [userId]);
      const user = userResult.rows[0];
      if (user?.email) {
        sendMail({
          to: user.email,
          subject: title,
          html: `<p>Hi ${user.name},</p><p>${body || title}</p>${link ? `<p><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}${link}">View in GrowInch</a></p>` : ''}`,
        }).catch((err) => console.error('createNotification sendMail failed:', err.message));
      }
    } catch (err) {
      console.error('createNotification email lookup failed:', err.message);
    }
  }
}

module.exports = { createNotification };
