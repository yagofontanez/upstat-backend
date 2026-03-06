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

export async function sendWeeklyReport(
  userEmail: string,
  userName: string,
  monitors: {
    name: string;
    url: string;
    uptime: string;
    avgLatency: number | null;
    incidents: number;
  }[],
) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const totalMonitors = monitors.length;
    const avgUptime =
      monitors.length > 0
        ? (
            monitors.reduce((acc, m) => acc + parseFloat(m.uptime || "0"), 0) /
            monitors.length
          ).toFixed(2)
        : "0";

    const monitorsHtml = monitors
      .map(
        (m) => `
      <tr>
        <td style="padding:16px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
          <p style="margin:0 0 4px;font-size:14px;color:#F0F6FC;font-weight:700;">${m.name}</p>
          <p style="margin:0;font-size:12px;color:#555;">${m.url}</p>
        </td>
        <td style="padding:16px 0;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;">
          <span style="font-size:16px;font-weight:700;color:${parseFloat(m.uptime) >= 99 ? "#00D4AA" : parseFloat(m.uptime) >= 95 ? "#F59E0B" : "#EF4444"};">
            ${m.uptime}%
          </span>
        </td>
        <td style="padding:16px 0;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;">
          <span style="font-size:14px;color:#8B949E;">${m.avgLatency ? `${m.avgLatency}ms` : "—"}</span>
        </td>
        <td style="padding:16px 0;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;">
          <span style="font-size:14px;color:${m.incidents > 0 ? "#EF4444" : "#00D4AA"};">${m.incidents}</span>
        </td>
      </tr>
    `,
      )
      .join("");

    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: userEmail,
      subject: `● UpStat — Relatório semanal (${new Date().toLocaleDateString("pt-BR")})`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#060810;font-family:'Courier New',monospace;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:40px 20px;">
                <table width="600" cellpadding="0" cellspacing="0" style="background:#0D1117;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
                  
                  <!-- Header -->
                  <tr>
                    <td style="padding:40px 48px 32px;border-bottom:1px solid rgba(255,255,255,0.06);">
                      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#00D4AA;">● UpStat</p>
                      <p style="margin:0;font-size:13px;color:#555;letter-spacing:2px;text-transform:uppercase;">relatório semanal</p>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding:48px;">
                      <p style="margin:0 0 32px;font-size:16px;color:#8B949E;line-height:1.7;">
                        Olá, ${userName}! Aqui está o resumo da última semana dos seus monitores.
                      </p>

                      <!-- Summary cards -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:40px;">
                        <tr>
                          <td width="50%" style="padding-right:8px;">
                            <div style="background:#161B22;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px;text-align:center;">
                              <p style="margin:0 0 4px;font-size:32px;font-weight:700;color:#00D4AA;">${avgUptime}%</p>
                              <p style="margin:0;font-size:12px;color:#555;text-transform:uppercase;letter-spacing:2px;">uptime médio</p>
                            </div>
                          </td>
                          <td width="50%" style="padding-left:8px;">
                            <div style="background:#161B22;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px;text-align:center;">
                              <p style="margin:0 0 4px;font-size:32px;font-weight:700;color:#F0F6FC;">${totalMonitors}</p>
                              <p style="margin:0;font-size:12px;color:#555;text-transform:uppercase;letter-spacing:2px;">monitores</p>
                            </div>
                          </td>
                        </tr>
                      </table>

                      <!-- Monitors table -->
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding-bottom:12px;font-size:11px;color:#555;letter-spacing:2px;text-transform:uppercase;">Monitor</td>
                          <td style="padding-bottom:12px;font-size:11px;color:#555;letter-spacing:2px;text-transform:uppercase;text-align:center;">Uptime</td>
                          <td style="padding-bottom:12px;font-size:11px;color:#555;letter-spacing:2px;text-transform:uppercase;text-align:center;">Latência</td>
                          <td style="padding-bottom:12px;font-size:11px;color:#555;letter-spacing:2px;text-transform:uppercase;text-align:center;">Incidentes</td>
                        </tr>
                        ${monitorsHtml}
                      </table>

                      <!-- CTA -->
                      <div style="margin-top:40px;text-align:center;">
                        <a href="${process.env.FRONTEND_URL}/dashboard" style="display:inline-block;background:#00D4AA;color:#000;font-family:'Courier New',monospace;font-size:14px;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;">
                          Ver dashboard completo →
                        </a>
                      </div>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding:24px 48px;border-top:1px solid rgba(255,255,255,0.06);">
                      <p style="margin:0;font-size:12px;color:#555;">
                        ● UpStat — você recebe este email toda segunda-feira<br/>
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

    console.log(`[weekly-report] Email enviado para ${userEmail}`);
  } catch (err) {
    console.error("[weekly-report] Erro ao enviar relatório:", err);
  }
}

export async function sendSSLAlert(
  userEmail: string,
  userName: string,
  monitorName: string,
  monitorUrl: string,
  daysRemaining: number,
) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: userEmail,
      subject: `⚠️ Certificado SSL expirando em ${daysRemaining} dias — ${monitorName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#060810;font-family:'Courier New',monospace;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:40px 20px;">
                <table width="600" cellpadding="0" cellspacing="0" style="background:#0D1117;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
                  
                  <tr>
                    <td style="padding:40px 48px 32px;border-bottom:1px solid rgba(255,255,255,0.06);">
                      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#00D4AA;">● UpStat</p>
                      <p style="margin:0;font-size:13px;color:#555;letter-spacing:2px;text-transform:uppercase;">alerta de ssl</p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:48px;">
                      <div style="background:#F59E0B11;border:1px solid #F59E0B33;border-radius:12px;padding:20px 24px;margin-bottom:32px;">
                        <p style="margin:0;font-size:16px;color:#F59E0B;font-weight:700;">⚠️ Certificado SSL expirando em ${daysRemaining} dias</p>
                      </div>

                      <p style="margin:0 0 24px;font-size:16px;color:#8B949E;line-height:1.7;">
                        Olá, ${userName}! O certificado SSL do monitor <strong style="color:#F0F6FC;">${monitorName}</strong> vai expirar em <strong style="color:#F59E0B;">${daysRemaining} dias</strong>.
                      </p>

                      <div style="background:#161B22;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:24px;margin-bottom:32px;">
                        <p style="margin:0 0 8px;font-size:12px;color:#555;letter-spacing:2px;text-transform:uppercase;">monitor</p>
                        <p style="margin:0 0 4px;font-size:16px;color:#F0F6FC;font-weight:700;">${monitorName}</p>
                        <p style="margin:0;font-size:14px;color:#555;">${monitorUrl}</p>
                      </div>

                      <p style="margin:0 0 32px;font-size:14px;color:#8B949E;line-height:1.7;">
                        Renove o certificado SSL antes que ele expire para evitar que seus usuários vejam avisos de segurança no browser.
                      </p>

                      <a href="${process.env.FRONTEND_URL}/monitors" style="display:inline-block;background:#F59E0B;color:#000;font-family:'Courier New',monospace;font-size:14px;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;">
                        Ver monitor →
                      </a>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:24px 48px;border-top:1px solid rgba(255,255,255,0.06);">
                      <p style="margin:0;font-size:12px;color:#555;">● UpStat — <a href="${process.env.FRONTEND_URL}" style="color:#00D4AA;text-decoration:none;">${process.env.FRONTEND_URL}</a></p>
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

    console.log(
      `[ssl-alert] Email enviado para ${userEmail} — ${monitorName} expira em ${daysRemaining} dias`,
    );
  } catch (err) {
    console.error("[ssl-alert] Erro ao enviar email:", err);
  }
}
