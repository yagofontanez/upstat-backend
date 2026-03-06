import cron from "node-cron";
import { db } from "../config/database";
import {
  sendDownAlert,
  sendRecoveryAlert,
} from "../services/notification.service";

async function checkMonitor(monitor: {
  id: string;
  url: string;
  status: string;
  user_id: string;
  interval_minutes: number;
  keyword: string;
}) {
  const start = Date.now();
  let pingStatus: "up" | "down" | "timeout" = "down";
  let statusCode: number | null = null;
  let latency: number | null = null;

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

  await db.query(
    `INSERT INTO pings (id, monitor_id, status, status_code, latency_ms)
     VALUES (uuid_generate_v4(), $1, $2, $3, $4)`,
    [monitor.id, pingStatus, statusCode, latency],
  );

  const newStatus = pingStatus === "up" ? "up" : "down";

  if (monitor.status !== "pending" && monitor.status !== newStatus) {
    if (newStatus === "down") {
      await db.query(
        `INSERT INTO incidents (id, monitor_id)
         VALUES (uuid_generate_v4(), $1)`,
        [monitor.id],
      );
      await sendDownAlert(monitor.user_id, monitor.id, monitor.url);
    } else {
      await db.query(
        `UPDATE incidents
         SET resolved_at = NOW(),
             duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
         WHERE monitor_id = $1 AND resolved_at IS NULL`,
        [monitor.id],
      );
      await sendRecoveryAlert(monitor.user_id, monitor.id, monitor.url);
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
        SELECT m.id, m.url, m.status, m.user_id, m.interval_minutes
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
