import cron from "node-cron";
import { db } from "../config/database";
import { sendWeeklyReport } from "../services/notification.service";

export function startWeeklyReportJob() {
  cron.schedule("0 8 * * 1", async () => {
    console.log("[weekly-report] Iniciando envio de relatórios...");

    try {
      const { rows: users } = await db.query(
        "SELECT id, name, email FROM users WHERE plan = 'pro'",
      );

      for (const user of users) {
        const { rows: monitors } = await db.query(
          `SELECT
            m.name,
            m.url,
            COALESCE(
              ROUND(
                COUNT(*) FILTER (WHERE p.status = 'up') * 100.0 / NULLIF(COUNT(*), 0), 2
              )::text, '0'
            ) as uptime,
            ROUND(AVG(p.latency_ms) FILTER (WHERE p.status = 'up'))::int as avg_latency,
            (
              SELECT COUNT(*) FROM incidents i
              WHERE i.monitor_id = m.id
              AND i.started_at > NOW() - INTERVAL '7 days'
            ) as incidents
          FROM monitors m
          LEFT JOIN pings p ON p.monitor_id = m.id
            AND p.checked_at > NOW() - INTERVAL '7 days'
          WHERE m.user_id = $1
          AND m.is_active = true
          GROUP BY m.id, m.name, m.url`,
          [user.id],
        );

        if (monitors.length === 0) continue;

        await sendWeeklyReport(
          user.email,
          user.name,
          monitors.map((m) => ({
            name: m.name,
            url: m.url,
            uptime: m.uptime,
            avgLatency: m.avg_latency,
            incidents: parseInt(m.incidents),
          })),
        );
      }

      console.log(
        `[weekly-report] Relatórios enviados para ${users.length} usuários`,
      );
    } catch (e) {
      console.error("[weekly-report] Erro:", e);
    }
  });

  console.log("[weekly-report] Job agendado — toda segunda às 08:00");
}
