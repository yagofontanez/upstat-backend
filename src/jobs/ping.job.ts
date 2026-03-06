import cron from "node-cron";
import { db } from "../config/database";
import {
  sendDownAlert,
  sendRecoveryAlert,
} from "../services/notification.service";
import { sendPushNotification } from "../services/push.service";
import { checkTCP } from "../services/tcp.service";
import { sendSlackAlert } from "../services/slack.service";

async function checkMonitor(monitor: {
  id: string;
  url: string;
  status: string;
  user_id: string;
  interval_minutes: number;
  keyword: string;
  monitor_type: string;
  tcp_port: number | null;
}) {
  const start = Date.now();
  let pingStatus: "up" | "down" | "timeout" = "down";
  let statusCode: number | null = null;
  let latency: number | null = null;

  if (monitor.monitor_type === "tcp" && monitor.tcp_port) {
    const hostname = new URL(monitor.url).hostname;
    const tcp = await checkTCP(hostname, monitor.tcp_port);
    latency = tcp.latency;
    pingStatus = tcp.alive ? "up" : "down";
  } else {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(monitor.url, {
        method: "GET",
        signal: controller.signal,
        headers: { "User-Agent": "UpStat-Monitor/1.0" },
      });

      clearTimeout(timeout);

      latency = Date.now() - start;
      statusCode = response.status;
      pingStatus = response.ok ? "up" : "down";

      if (pingStatus === "up" && monitor.keyword) {
        const body = await response.text();
        if (!body.includes(monitor.keyword)) {
          pingStatus = "down";
          console.log(
            `[ping-job] Keyword "${monitor.keyword}" não encontrada em ${monitor.url}`,
          );
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        pingStatus = "timeout";
      } else {
        pingStatus = "down";
      }
      latency = Date.now() - start;
    }
  }

  await db.query(
    `INSERT INTO pings (id, monitor_id, status, status_code, latency_ms)
     VALUES (uuid_generate_v4(), $1, $2, $3, $4)`,
    [monitor.id, pingStatus, statusCode, latency],
  );

  const newStatus = pingStatus === "up" ? "up" : "down";

  if (monitor.status !== "pending" && monitor.status !== newStatus) {
    const { rows: notifRows } = await db.query(
      `SELECT slack_enabled, slack_webhook_url FROM notifications WHERE user_id = $1`,
      [monitor.user_id],
    );
    const notif = notifRows[0];

    if (newStatus === "down") {
      await db.query(
        `INSERT INTO incidents (id, monitor_id) VALUES (uuid_generate_v4(), $1)`,
        [monitor.id],
      );
      await sendDownAlert(monitor.user_id, monitor.id, monitor.url);
      await sendPushNotification(
        monitor.user_id,
        "🔴 Sistema fora do ar",
        `${monitor.url} está offline`,
        `${process.env.FRONTEND_URL}/monitors/${monitor.id}`,
      );

      if (notif?.slack_enabled && notif?.slack_webhook_url) {
        await sendSlackAlert(
          notif.slack_webhook_url,
          monitor.url,
          monitor.url,
          "down",
        );
      }
    } else {
      await db.query(
        `UPDATE incidents SET resolved_at = NOW(), duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000 WHERE monitor_id = $1 AND resolved_at IS NULL`,
        [monitor.id],
      );
      await sendRecoveryAlert(monitor.user_id, monitor.id, monitor.url);
      await sendPushNotification(
        monitor.user_id,
        "✅ Sistema recuperado",
        `${monitor.url} voltou ao ar`,
        `${process.env.FRONTEND_URL}/monitors/${monitor.id}`,
      );

      if (notif?.slack_enabled && notif?.slack_webhook_url) {
        await sendSlackAlert(
          notif.slack_webhook_url,
          monitor.url,
          monitor.url,
          "up",
        );
      }
    }
  }

  await db.query(
    `UPDATE monitors SET status = $1, updated_at = NOW() WHERE id = $2`,
    [newStatus, monitor.id],
  );
}

export function startPingJob() {
  cron.schedule("* * * * *", async () => {
    try {
      const { rows: monitors } = await db.query(`
        SELECT m.id, m.url, m.status, m.user_id, m.interval_minutes, m.keyword, m.monitor_type, m.tcp_port
        FROM monitors m
        WHERE m.is_active = true
        AND (
          m.status = 'pending'
          OR NOT EXISTS (
            SELECT 1 FROM pings p
            WHERE p.monitor_id = m.id
            AND p.checked_at > NOW() - (m.interval_minutes || ' minutes')::INTERVAL
          )
        )
      `);

      if (monitors.length > 0) {
        console.log(`[ping-job] Checking ${monitors.length} monitor(s)...`);
        await Promise.allSettled(monitors.map(checkMonitor));
      }
    } catch (err) {
      console.error("[ping-job] Error:", err);
    }
  });

  console.log("⏱  Ping job started");
}
