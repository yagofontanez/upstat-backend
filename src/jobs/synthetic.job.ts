import cron from "node-cron";
import { db } from "../config/database";
import { runSyntheticMonitor } from "../services/synthetic.service";

export function startSyntheticJob() {
  cron.schedule("* * * * *", async () => {
    try {
      const { rows: monitors } = await db.query(
        `SELECT sm.id, sm.interval_minutes,
          (SELECT checked_at FROM synthetic_results
           WHERE monitor_id = sm.id
           ORDER BY checked_at DESC LIMIT 1) as last_checked_at
         FROM synthetic_monitors sm
         WHERE sm.is_active = true`,
      );

      for (const monitor of monitors) {
        const lastChecked = monitor.last_checked_at
          ? new Date(monitor.last_checked_at).getTime()
          : 0;
        const intervalMs = monitor.interval_minutes * 60 * 1000;
        const shouldRun = Date.now() - lastChecked >= intervalMs;

        if (shouldRun) {
          console.log(`[synthetic.job] rodando monitor ${monitor.id}`);
          runSyntheticMonitor(monitor.id).catch((err) =>
            console.error(
              `[synthetic.job] erro no monitor ${monitor.id}:`,
              err,
            ),
          );
        }
      }
    } catch (err) {
      console.error("[synthetic.job] erro:", err);
    }
  });
}
