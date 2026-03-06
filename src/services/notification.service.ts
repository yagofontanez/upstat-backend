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

export async function sendWelcomeEmail(
  userEmail: string,
  userName: string,
  pageSlug: string,
) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const pageUrl = `${process.env.FRONTEND_URL}/status/${pageSlug}`;

    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: userEmail,
      subject: "● Bem-vindo ao UpStat!",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        </head>
        <body style="margin:0;padding:0;background:#060810;font-family:'Courier New',monospace;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:40px 20px;">
                <table width="600" cellpadding="0" cellspacing="0" style="background:#0D1117;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
                  
                  <!-- Header -->
                  <tr>
                    <td style="padding:40px 48px 32px;border-bottom:1px solid rgba(255,255,255,0.06);">
                      <p style="margin:0;font-size:22px;font-weight:700;color:#00D4AA;letter-spacing:-0.5px;">● UpStat</p>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding:48px;">
                      <p style="margin:0 0 8px;font-size:13px;color:#8B949E;letter-spacing:3px;text-transform:uppercase;">// bem-vindo</p>
                      <h1 style="margin:0 0 24px;font-size:36px;font-weight:700;color:#F0F6FC;line-height:1.1;letter-spacing:-1px;">
                        Olá, ${userName}!
                      </h1>
                      <p style="margin:0 0 32px;font-size:16px;color:#8B949E;line-height:1.7;">
                        Sua conta no UpStat foi criada com sucesso.<br/>
                        Agora você pode monitorar suas APIs e compartilhar<br/>
                        sua status page com seus clientes.
                      </p>

                      <!-- Status page box -->
                      <div style="background:#161B22;border:1px solid rgba(0,212,170,0.2);border-radius:12px;padding:24px;margin-bottom:32px;">
                        <p style="margin:0 0 8px;font-size:12px;color:#8B949E;letter-spacing:2px;text-transform:uppercase;">sua status page pública</p>
                        <p style="margin:0;font-size:16px;color:#00D4AA;font-weight:700;">${pageUrl}</p>
                      </div>

                      <!-- CTA -->
                      <a href="${process.env.FRONTEND_URL}/monitors" style="display:inline-block;background:#00D4AA;color:#000000;font-family:'Courier New',monospace;font-size:15px;font-weight:700;padding:16px 32px;border-radius:8px;text-decoration:none;letter-spacing:-0.3px;">
                        Adicionar meu primeiro monitor →
                      </a>

                      <!-- Steps -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:40px;border-top:1px solid rgba(255,255,255,0.06);padding-top:40px;">
                        <tr>
                          <td style="padding-bottom:20px;">
                            <p style="margin:0 0 4px;font-size:13px;color:#00D4AA;">01 — Adicione um monitor</p>
                            <p style="margin:0;font-size:13px;color:#8B949E;">Cole a URL da sua API ou site</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding-bottom:20px;">
                            <p style="margin:0 0 4px;font-size:13px;color:#00D4AA;">02 — Receba alertas</p>
                            <p style="margin:0;font-size:13px;color:#8B949E;">Seja notificado na hora que seu sistema cair</p>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <p style="margin:0 0 4px;font-size:13px;color:#00D4AA;">03 — Compartilhe sua status page</p>
                            <p style="margin:0;font-size:13px;color:#8B949E;">Mostre pro seu cliente que você leva a sério</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding:24px 48px;border-top:1px solid rgba(255,255,255,0.06);">
                      <p style="margin:0;font-size:12px;color:#555;">
                        ● UpStat — monitoramento de sistemas<br/>
                        <a href="${process.env.FRONTEND_URL}" style="color:#00D4AA;text-decoration:none;">${process.env.FRONTEND_URL}</a>
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log(`[welcome] Email enviado para ${userEmail}`);
  } catch (err) {
    console.error("[welcome] Erro ao enviar email:", err);
  }
}
