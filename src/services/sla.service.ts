import { db } from "../config/database";

export async function calculateMonthlySLA(
  monitorId: string,
  year: number,
  month: number,
) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const { rows } = await db.query(
    `SELECT
      COUNT(*) FILTER (WHERE status = 'up') AS up_count,
      COUNT(*) AS total_count
     FROM pings
     WHERE monitor_id = $1
     AND checked_at >= $2
     AND checked_at < $3`,
    [monitorId, start, end],
  );

  const upCount = parseInt(rows[0].up_count);
  const totalCount = parseInt(rows[0].total_count);

  if (totalCount === 0) return null;

  const uptimePercent = (upCount / totalCount) * 100;

  const { rows: incidentRows } = await db.query(
    `SELECT
      COUNT(*) AS total_incidents,
      COALESCE(SUM(duration_ms), 0) AS total_downtime_ms
     FROM incidents
     WHERE monitor_id = $1
     AND started_at >= $2
     AND started_at < $3`,
    [monitorId, start, end],
  );

  return {
    uptime_percent: parseFloat(uptimePercent.toFixed(3)),
    total_pings: totalCount,
    total_incidents: parseInt(incidentRows[0].total_incidents),
    total_downtime_ms: parseInt(incidentRows[0].total_downtime_ms),
  };
}

export async function getUserMonitorsWithSLA(
  userId: string,
  year: number,
  month: number,
) {
  const { rows: monitors } = await db.query(
    `SELECT id, name, url, sla_target FROM monitors WHERE user_id = $1 AND is_active = true`,
    [userId],
  );

  const results = await Promise.all(
    monitors.map(async (monitor) => {
      const sla = await calculateMonthlySLA(monitor.id, year, month);
      return {
        ...monitor,
        sla,
        sla_met: sla ? sla.uptime_percent >= monitor.sla_target : null,
      };
    }),
  );

  return results;
}
