import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { db } from "../config/database";
import {
  sendDownAlert,
  sendRecoveryAlert,
} from "../services/notification.service";
import { checkMonitor } from "../jobs/ping.job";

const createMonitorSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(100),
  url: z.string().url("URL inválida"),
  keyword: z.string().max(100).optional(),
  monitor_type: z.enum(["http", "tcp"]).optional(),
  tcp_port: z.number().int().min(1).max(65535).optional(),
  sla_target: z.number().min(0).max(100).optional(),
  http_method: z
    .enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"])
    .optional(),
  request_body: z.string().optional(),
  request_headers: z.record(z.string(), z.string()).optional(),
});

const PLAN_LIMITS = {
  free: { monitors: 3, interval: 5, history_days: 7 },
  pro: { monitors: 999, interval: 1, history_days: 90 },
};

export async function listMonitors(req: Request, res: Response) {
  try {
    const { rows } = await db.query(
      `SELECT 
        m.*,
        (
          SELECT json_build_object('status', p.status, 'latency_ms', p.latency_ms, 'checked_at', p.checked_at)
          FROM pings p WHERE p.monitor_id = m.id
          ORDER BY p.checked_at DESC LIMIT 1
        ) AS last_ping,
        (
          SELECT ROUND(
            COUNT(*) FILTER (WHERE p2.status = 'up') * 100.0 / NULLIF(COUNT(*), 0), 2
          )
          FROM pings p2 WHERE p2.monitor_id = m.id
          AND p2.checked_at > NOW() - INTERVAL '7 days'
        ) AS uptime_7d
      FROM monitors m
      WHERE m.user_id = $1
      ORDER BY m.created_at ASC`,
      [req.user!.id],
    );

    return res.json({ monitors: rows });
  } catch (err) {
    console.error("List monitors error:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function createMonitor(req: Request, res: Response) {
  const result = createMonitorSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues[0].message });
  }

  const {
    name,
    url,
    keyword,
    monitor_type,
    tcp_port,
    sla_target,
    http_method,
    request_body,
    request_headers,
  } = result.data;
  const plan = (req.user!.plan ?? "free") as keyof typeof PLAN_LIMITS;
  const limit = PLAN_LIMITS[plan].monitors;

  try {
    const { rows: existing } = await db.query(
      "SELECT COUNT(*) FROM monitors WHERE user_id = $1 AND is_active = true",
      [req.user!.id],
    );

    if (parseInt(existing[0].count) >= limit) {
      return res.status(403).json({
        error: `Limite de monitores atingido para o plano ${plan}. Faça upgrade para adicionar mais.`,
      });
    }

    const interval = PLAN_LIMITS[plan].interval;

    const { rows: monitorRows } = await db.query(
      `INSERT INTO monitors (id, user_id, name, url, interval_minutes, keyword, monitor_type, tcp_port, sla_target, http_method, request_body, request_headers)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
      [
        uuidv4(),
        req.user!.id,
        name,
        url,
        interval,
        keyword || null,
        monitor_type || "http",
        tcp_port || null,
        sla_target || 99.9,
        http_method || "GET",
        request_body || null,
        request_headers ? JSON.stringify(request_headers) : null,
      ],
    );

    const newMonitor = monitorRows[0];

    const { rows: pageRows } = await db.query(
      `SELECT p.id FROM pages p
       JOIN monitors m ON m.user_id = p.user_id
       WHERE m.id = $1`,
      [newMonitor.id],
    );

    if (pageRows.length) {
      const { rows: existingMonitors } = await db.query(
        `SELECT COUNT(*) FROM page_monitors WHERE page_id = $1`,
        [pageRows[0].id],
      );

      if (parseInt(existingMonitors[0].count) === 0) {
        await db.query(
          `INSERT INTO page_monitors (page_id, monitor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [pageRows[0].id, newMonitor.id],
        );
      }
    }

    checkMonitor(newMonitor).catch(() => {});

    return res.status(201).json({ monitor: newMonitor });
  } catch (err) {
    console.error("Create monitor error:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function getMonitor(req: Request, res: Response) {
  try {
    const { rows } = await db.query(
      "SELECT * FROM monitors WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user!.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Monitor não encontrado" });
    }

    return res.json({ monitor: rows[0] });
  } catch (err) {
    console.error("Get monitor error:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function deleteMonitor(req: Request, res: Response) {
  try {
    const { rowCount } = await db.query(
      "DELETE FROM monitors WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user!.id],
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: "Monitor não encontrado" });
    }

    return res.status(204).send();
  } catch (err) {
    console.error("Delete monitor error:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function getMonitorPings(req: Request, res: Response) {
  const plan = (req.user!.plan ?? "free") as keyof typeof PLAN_LIMITS;
  const days = PLAN_LIMITS[plan].history_days;

  try {
    const { rows: monitorRows } = await db.query(
      "SELECT id FROM monitors WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user!.id],
    );
    if (monitorRows.length === 0) {
      return res.status(404).json({ error: "Monitor não encontrado" });
    }

    const { rows } = await db.query(
      `SELECT * FROM pings
       WHERE monitor_id = $1
       AND checked_at > NOW() - INTERVAL '${days} days'
       ORDER BY checked_at DESC
       LIMIT 500`,
      [req.params.id],
    );

    const total = rows.length;
    const up = rows.filter((p) => p.status === "up").length;
    const uptime = total > 0 ? ((up / total) * 100).toFixed(2) : null;

    const withLatency = rows.filter((p) => p.latency_ms !== null);
    const avgLatency =
      withLatency.length > 0
        ? Math.round(
            withLatency.reduce((sum, p) => sum + p.latency_ms, 0) /
              withLatency.length,
          )
        : null;

    return res.json({
      pings: rows,
      uptime_percent: uptime,
      avg_latency_ms: avgLatency,
    });
  } catch (err) {
    console.error("Get pings error:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function getMonitorIncidents(req: Request, res: Response) {
  try {
    const { rows: monitorRows } = await db.query(
      "SELECT id FROM monitors WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user!.id],
    );
    if (monitorRows.length === 0) {
      return res.status(404).json({ error: "Monitor não encontrado" });
    }

    const limit = req.user!.plan === "free" ? 3 : 100;

    const { rows } = await db.query(
      `SELECT * FROM incidents
       WHERE monitor_id = $1
       ORDER BY started_at DESC
       LIMIT $2`,
      [req.params.id, limit],
    );

    return res.json({ incidents: rows });
  } catch (err) {
    console.error("Get incidents error:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function getMonitorUptimeHistory(req: Request, res: Response) {
  try {
    const { rows: monitorRows } = await db.query(
      "SELECT id FROM monitors WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user!.id],
    );
    if (monitorRows.length === 0) {
      return res.status(404).json({ error: "Monitor não encontrado" });
    }

    const { rows } = await db.query(
      `
      SELECT
        DATE(checked_at) as day,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'up') as up
      FROM pings
      WHERE monitor_id = $1
      AND checked_at > NOW() - INTERVAL '90 days'
      GROUP BY DATE(checked_at)
      ORDER BY day ASC
    `,
      [req.params.id],
    );

    return res.json({ history: rows });
  } catch (err) {
    console.error("Uptime history error:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function toggleMonitor(req: Request, res: Response) {
  try {
    const { rows } = await db.query(
      "SELECT id, is_active FROM monitors WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user!.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Monitor não encontrado" });
    }

    const newState = !rows[0].is_active;

    await db.query(
      "UPDATE monitors SET is_active = $1, updated_at = NOW() WHERE id = $2",
      [newState, req.params.id],
    );

    return res.json({ is_active: newState });
  } catch (err) {
    console.error("Toggle monitor error:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function pingMonitorNow(req: Request, res: Response) {
  try {
    const { rows } = await db.query(
      "SELECT * FROM monitors WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user!.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Monitor não encontrado" });
    }

    const monitor = rows[0];
    const start = Date.now();
    let pingStatus: "up" | "down" | "timeout" = "down";
    let statusCode: number | null = null;
    let latency: number | null = null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const headers =
        typeof monitor.request_headers === "string"
          ? JSON.parse(monitor.request_headers)
          : monitor.request_headers || {};

      const response = await fetch(decodeURIComponent(monitor.url), {
        method: monitor.http_method || "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": "UpStat-Monitor/1.0",
          ...(headers || {}),
        },
        body: ["POST", "PUT", "PATCH"].includes(monitor.http_method)
          ? monitor.request_body
          : undefined,
      });

      clearTimeout(timeout);
      latency = Date.now() - start;
      statusCode = response.status;
      pingStatus = response.ok ? "up" : "down";
    } catch (err: any) {
      pingStatus = err.name === "AbortError" ? "timeout" : "down";
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
          `INSERT INTO incidents (id, monitor_id) VALUES (uuid_generate_v4(), $1)`,
          [monitor.id],
        );
        await sendDownAlert(monitor.user_id, monitor.id, monitor.url);
      } else {
        await db.query(
          `UPDATE incidents SET resolved_at = NOW(),
           duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
           WHERE monitor_id = $1 AND resolved_at IS NULL`,
          [monitor.id],
        );
        await sendRecoveryAlert(monitor.user_id, monitor.id, monitor.url);
      }
    }

    await db.query(
      "UPDATE monitors SET status = $1, updated_at = NOW() WHERE id = $2",
      [newStatus, monitor.id],
    );

    return res.json({
      status: pingStatus,
      status_code: statusCode,
      latency_ms: latency,
    });
  } catch (err) {
    console.error("Ping now error:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function exportMonitorPings(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const { rows: monitors } = await db.query(
      "SELECT * FROM monitors WHERE id = $1 AND user_id = $2",
      [id, req.user!.id],
    );

    if (monitors.length === 0) {
      return res.status(404).json({ error: "Monitor não encontrado" });
    }

    if (req.user!.plan !== "pro") {
      return res
        .status(403)
        .json({ error: "Recurso disponível apenas no plano Pro" });
    }

    const { rows: pings } = await db.query(
      `SELECT status, status_code, latency_ms, checked_at
       FROM pings
       WHERE monitor_id = $1
       ORDER BY checked_at DESC`,
      [id],
    );

    const csv = [
      "Data,Status,Código HTTP,Latência (ms)",
      ...pings.map(
        (p) =>
          `${new Date(p.checked_at).toISOString()},${p.status},${p.status_code ?? ""},${p.latency_ms ?? ""}`,
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="upstat-${monitors[0].name}-${Date.now()}.csv"`,
    );
    return res.send(csv);
  } catch (err) {
    console.error("Export error:", err);
    return res.status(500).json({ error: "Erro ao exportar" });
  }
}

export async function updateMonitor(req: Request, res: Response) {
  const result = createMonitorSchema.partial().safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues[0].message });
  }

  const {
    name,
    url,
    keyword,
    monitor_type,
    tcp_port,
    sla_target,
    http_method,
    request_body,
    request_headers,
  } = result.data;

  try {
    const { rows } = await db.query(
      "SELECT id FROM monitors WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user!.id],
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "Monitor não encontrado" });

    const { rows: updated } = await db.query(
      `UPDATE monitors SET
        name = COALESCE($1, name),
        url = COALESCE($2, url),
        keyword = COALESCE($3, keyword),
        monitor_type = COALESCE($4, monitor_type),
        tcp_port = COALESCE($5, tcp_port),
        sla_target = COALESCE($6, sla_target),
        http_method = COALESCE($7, http_method),
        request_body = COALESCE($8, request_body),
        request_headers = COALESCE($9, request_headers),
        updated_at = NOW()
      WHERE id = $10 RETURNING *`,
      [
        name ?? null,
        url ?? null,
        keyword ?? null,
        monitor_type ?? null,
        tcp_port ?? null,
        sla_target ?? null,
        http_method ?? null,
        request_body ?? null,
        request_headers ? JSON.stringify(request_headers) : null,
        req.params.id,
      ],
    );

    return res.json({ monitor: updated[0] });
  } catch (err) {
    console.error("Update monitor error:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}
