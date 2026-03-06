import cron from "node-cron";
import { db } from "../config/database";
import { checkDNS } from "../services/dns.service";
import { sendPushNotification } from "../services/push.service";

export function startDNSCheckJob() {
  cron.schedule("*/10 * * * *", async () => {
    console.log("[dns-check] Iniciando verificação de DNS...");

    try {
      const { rows: monitors } = await db.query(
        `SELECT m.id, m.name, m.url, m.dns_valid, m.user_id
         FROM monitors m
         WHERE m.is_active = true`,
      );

      for (const monitor of monitors) {
        const dns = await checkDNS(monitor.url);

        const wasValid = monitor.dns_valid;
        const isValid = dns.valid;

        await db.query(
          `UPDATE monitors SET 
            dns_valid = $1,
            dns_checked_at = NOW(),
            updated_at = NOW()
           WHERE id = $2`,
          [isValid, monitor.id],
        );

        if (wasValid === true && !isValid) {
          console.log(
            `[dns-check] DNS falhou para ${monitor.url}: ${dns.error}`,
          );

          await sendPushNotification(
            monitor.user_id,
            "⚠️ Falha de DNS detectada",
            `${monitor.name} — DNS não está respondendo`,
            `${process.env.FRONTEND_URL}/monitors/${monitor.id}`,
          );
        }

        if (wasValid === false && isValid) {
          console.log(`[dns-check] DNS recuperado para ${monitor.url}`);

          await sendPushNotification(
            monitor.user_id,
            "✅ DNS recuperado",
            `${monitor.name} — DNS voltou a responder`,
            `${process.env.FRONTEND_URL}/monitors/${monitor.id}`,
          );
        }
      }

      console.log(`[dns-check] ${monitors.length} registros DNS verificados`);
    } catch (err) {
      console.error("[dns-check] Erro:", err);
    }
  });

  console.log("[dns-check] Job agendado — a cada 10 minutos");
}
