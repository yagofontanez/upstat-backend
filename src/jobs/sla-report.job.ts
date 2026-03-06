import cron from "node-cron";
import { db } from "../config/database";
import { sendMonthlySLAReport } from "../services/sla-email.service";

export function startSLAReportJob() {
  cron.schedule("0 8 1 * *", async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const reportMonth = month === 0 ? 12 : month;
    const reportYear = month === 0 ? year - 1 : year;

    console.log(
      `[sla-report] Sending reports for ${reportMonth}/${reportYear}`,
    );

    try {
      const { rows: users } = await db.query(
        `SELECT DISTINCT u.id, u.email, u.name
         FROM users u
         JOIN monitors m ON m.user_id = u.id
         WHERE m.is_active = true
         AND u.plan = 'pro'`,
      );

      console.log(`[sla-report] ${users.length} user(s) to notify`);

      await Promise.allSettled(
        users.map((user) =>
          sendMonthlySLAReport(
            user.id,
            user.email,
            user.name,
            reportYear,
            reportMonth,
          ),
        ),
      );

      console.log(`[sla-report] Done`);
    } catch (err) {
      console.error("[sla-report] Error:", err);
    }
  });

  console.log("📊 SLA report job started");
}
