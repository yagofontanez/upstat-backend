import { Resend } from "resend";
import { db } from "../config/database";

const resend = new Resend(process.env.RESEND_API_KEY);

async function getUserNotificationSettings(userId: string) {
  const { rows } = await db.query(
    `SELECT u.name, u.email, n.email_enabled, n.whatsapp_enabled, n.whatsapp_number
     FROM users u
     LEFT JOIN notifications n ON n.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  );
  return rows[0] || null;
}

export async function sendDownAlert(
  userId: string,
  monitorId: string,
  url: string,
) {
  try {
    const settings = await getUserNotificationSettings(userId);
    if (!settings || !settings.email_enabled) return;

    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: settings.email,
      subject: `🔴 [UpStat] ${url} está fora do ar`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0A0E1A; padding: 32px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #00D4AA; margin: 0; font-size: 24px;">● UpStat</h1>
          </div>
          <div style="background: #111827; padding: 32px; border-radius: 0 0 8px 8px;">
            <div style="background: #EF4444; padding: 12px 16px; border-radius: 6px; margin-bottom: 24px;">
              <strong style="color: white; font-size: 16px;">🔴 Sistema fora do ar</strong>
            </div>
            <p style="color: #D1D5DB; font-size: 16px; margin: 0 0 16px;">
              Olá <strong style="color: white;">${settings.name}</strong>,
            </p>
            <p style="color: #9CA3AF; font-size: 14px; line-height: 1.6;">
              Detectamos que o seu sistema está inacessível:
            </p>
            <div style="background: #1F2937; padding: 16px; border-radius: 6px; margin: 16px 0; border-left: 3px solid #EF4444;">
              <code style="color: #F9FAFB; font-size: 14px;">${url}</code>
            </div>
            <p style="color: #6B7280; font-size: 13px;">
              Você será notificado novamente quando o sistema se recuperar.
            </p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error("[notification] Failed to send down alert:", err);
  }
}

export async function sendRecoveryAlert(
  userId: string,
  monitorId: string,
  url: string,
) {
  try {
    const settings = await getUserNotificationSettings(userId);
    if (!settings || !settings.email_enabled) return;

    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: settings.email,
      subject: `✅ [UpStat] ${url} voltou ao ar`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0A0E1A; padding: 32px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #00D4AA; margin: 0; font-size: 24px;">● UpStat</h1>
          </div>
          <div style="background: #111827; padding: 32px; border-radius: 0 0 8px 8px;">
            <div style="background: #16A34A; padding: 12px 16px; border-radius: 6px; margin-bottom: 24px;">
              <strong style="color: white; font-size: 16px;">✅ Sistema recuperado</strong>
            </div>
            <p style="color: #D1D5DB; font-size: 16px; margin: 0 0 16px;">
              Olá <strong style="color: white;">${settings.name}</strong>,
            </p>
            <p style="color: #9CA3AF; font-size: 14px; line-height: 1.6;">
              Boa notícia! Seu sistema voltou a responder normalmente:
            </p>
            <div style="background: #1F2937; padding: 16px; border-radius: 6px; margin: 16px 0; border-left: 3px solid #16A34A;">
              <code style="color: #F9FAFB; font-size: 14px;">${url}</code>
            </div>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error("[notification] Failed to send recovery alert:", err);
  }
}
