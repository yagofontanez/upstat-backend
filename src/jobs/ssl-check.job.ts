import cron from "node-cron";
import { db } from "../config/database";
import { checkSSL } from "../services/ssl.service";
import { sendSSLAlert } from "../services/notification.service";

export function startSSLCheckJob() {
  cron.schedule("0 9 * * *", async () => {
    console.log("[ssl-check] Iniciando verificação de certificados SSL...");

    try {
      const { rows: monitors } = await db.query(
        `SELECT m.id, m.name, m.url, m.ssl_days_remaining,
          u.id as user_id, u.email, u.name as user_name
         FROM monitors m
         JOIN users u ON u.id = m.user_id
         WHERE m.is_active = true
         AND m.url LIKE 'https://%'`,
      );

      for (const monitor of monitors) {
        const ssl = await checkSSL(monitor.url);

        await db.query(
          `UPDATE monitors SET 
            ssl_valid_until = $1,
            ssl_days_remaining = $2,
            updated_at = NOW()
           WHERE id = $3`,
          [ssl.validUntil, ssl.daysRemaining, monitor.id],
        );

        if (
          ssl.daysRemaining !== null &&
          [30, 15, 7].includes(ssl.daysRemaining)
        ) {
          await sendSSLAlert(
            monitor.email,
            monitor.user_name,
            monitor.name,
            monitor.url,
            ssl.daysRemaining,
          );
        }
      }

      console.log(`[ssl-check] ${monitors.length} certificados verificados`);
    } catch (err) {
      console.error("[ssl-check] Erro:", err);
    }
  });

  console.log("[ssl-check] Job agendado — todo dia às 09:00");
}
