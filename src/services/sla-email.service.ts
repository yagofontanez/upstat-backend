import { getUserMonitorsWithSLA } from "./sla.service";
import { Resend } from "resend";
import { db } from "../config/database";

const resend = new Resend(process.env.RESEND_API_KEY);

function formatDuration(ms: number) {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}min`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function getMonthName(month: number) {
  return [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ][month - 1];
}

export async function sendMonthlySLAReport(
  userId: string,
  userEmail: string,
  userName: string,
  year: number,
  month: number,
) {
  const monitors = await getUserMonitorsWithSLA(userId, year, month);

  if (monitors.length === 0) return;

  const allMet = monitors.every((m) => m.sla_met !== false);
  const metCount = monitors.filter((m) => m.sla_met === true).length;

  const monitorsHtml = monitors
    .map((m) => {
      if (!m.sla) return "";
      const color = m.sla_met ? "#22C55E" : "#EF4444";
      const badge = m.sla_met ? "✓ SLA atingido" : "✗ SLA não atingido";
      return `
            <tr>
                <td style="padding:12px 16px;border-bottom:1px solid #1C2128;">
                <div style="font-weight:600;color:#F0F6FC;font-size:13px;">${m.name}</div>
                <div style="color:#555;font-size:11px;margin-top:2px;">${m.url}</div>
                </td>
                <td style="padding:12px 16px;border-bottom:1px solid #1C2128;text-align:center;">
                <span style="color:${color};font-weight:700;font-size:14px;">${m.sla.uptime_percent}%</span>
                </td>
                <td style="padding:12px 16px;border-bottom:1px solid #1C2128;text-align:center;color:#8B949E;font-size:12px;">
                ${m.sla_target}%
                </td>
                <td style="padding:12px 16px;border-bottom:1px solid #1C2128;text-align:center;color:#8B949E;font-size:12px;">
                ${m.sla.total_incidents}
                </td>
                <td style="padding:12px 16px;border-bottom:1px solid #1C2128;text-align:center;color:#8B949E;font-size:12px;">
                ${m.sla.total_downtime_ms > 0 ? formatDuration(m.sla.total_downtime_ms) : "—"}
                </td>
                <td style="padding:12px 16px;border-bottom:1px solid #1C2128;text-align:center;">
                <span style="color:${color};font-size:11px;font-weight:600;">${badge}</span>
                </td>
            </tr>
            `;
    })
    .join("");

  await resend.emails.send({
    from: "UpStat <noreply@upstat.online>",
    to: userEmail,
    subject: `Relatório SLA — ${getMonthName(month)} ${year}`,
    html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"/></head>
        <body style="margin:0;padding:0;background:#060810;font-family:'Courier New',monospace;">
        <div style="max-width:640px;margin:0 auto;padding:40px 24px;">

            <div style="margin-bottom:32px;">
            <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:24px;">
                <div style="width:24px;height:24px;border-radius:6px;background:rgba(0,212,170,0.1);border:1px solid rgba(0,212,170,0.2);display:flex;align-items:center;justify-content:center;">
                <div style="width:7px;height:7px;border-radius:50%;background:#00D4AA;"></div>
                </div>
                <span style="color:#F0F6FC;font-weight:700;font-size:15px;">UpStat</span>
            </div>
            <h1 style="color:#F0F6FC;font-size:22px;font-weight:700;margin:0 0 6px;letter-spacing:-0.5px;">
                Relatório de SLA — ${getMonthName(month)} ${year}
            </h1>
            <p style="color:#555;font-size:13px;margin:0;">Olá, ${userName.split(" ")[0]}. Aqui está o resumo do mês.</p>
            </div>

            <div style="background:${allMet ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)"};border:1px solid ${allMet ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"};border-radius:12px;padding:16px 20px;margin-bottom:24px;display:flex;align-items:center;gap:12px;">
            <span style="font-size:20px;">${allMet ? "✅" : "⚠️"}</span>
            <div>
                <div style="color:${allMet ? "#22C55E" : "#EF4444"};font-weight:700;font-size:14px;">
                ${allMet ? "Todos os SLAs atingidos" : `${metCount} de ${monitors.length} SLAs atingidos`}
                </div>
                <div style="color:#555;font-size:11px;margin-top:2px;">${getMonthName(month)} ${year}</div>
            </div>
            </div>

            <div style="background:#0D1117;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;margin-bottom:24px;">
            <table style="width:100%;border-collapse:collapse;">
                <thead>
                <tr style="background:rgba(255,255,255,0.02);">
                    <th style="padding:10px 16px;text-align:left;font-size:10px;color:#555;letter-spacing:1.5px;font-weight:600;">MONITOR</th>
                    <th style="padding:10px 16px;text-align:center;font-size:10px;color:#555;letter-spacing:1.5px;font-weight:600;">UPTIME</th>
                    <th style="padding:10px 16px;text-align:center;font-size:10px;color:#555;letter-spacing:1.5px;font-weight:600;">META</th>
                    <th style="padding:10px 16px;text-align:center;font-size:10px;color:#555;letter-spacing:1.5px;font-weight:600;">INCIDENTES</th>
                    <th style="padding:10px 16px;text-align:center;font-size:10px;color:#555;letter-spacing:1.5px;font-weight:600;">DOWNTIME</th>
                    <th style="padding:10px 16px;text-align:center;font-size:10px;color:#555;letter-spacing:1.5px;font-weight:600;">STATUS</th>
                </tr>
                </thead>
                <tbody>${monitorsHtml}</tbody>
            </table>
            </div>

            <div style="text-align:center;margin-top:32px;">
            <a href="${process.env.FRONTEND_URL}/monitors" style="display:inline-block;background:#00D4AA;color:#000;font-weight:700;font-size:13px;padding:12px 28px;border-radius:8px;text-decoration:none;">
                Ver detalhes no UpStat →
            </a>
            </div>

            <div style="text-align:center;margin-top:32px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.04);">
            <p style="color:#333;font-size:11px;margin:0;">● UpStat · upstat.online</p>
            </div>
        </div>
        </body>
        </html>
    `,
  });
}
