import { Request, Response } from "express";
import { z } from "zod";
import { db } from "../config/database";

export async function getPublicPage(req: Request, res: Response) {
  const { slug } = req.params;

  try {
    const { rows: pageRows } = await db.query(
      "SELECT * FROM pages WHERE slug = $1",
      [slug],
    );

    if (pageRows.length === 0) {
      return res.status(404).json({ error: "Página não encontrada" });
    }

    const page = pageRows[0];

    const { rows: monitors } = await db.query(
      `SELECT 
        m.id, m.name, m.url, m.status,
        (
          SELECT ROUND(
            COUNT(*) FILTER (WHERE p.status = 'up') * 100.0 / NULLIF(COUNT(*), 0), 2
          )
          FROM pings p WHERE p.monitor_id = m.id
          AND p.checked_at > NOW() - INTERVAL '90 days'
        ) AS uptime_percent,
        (
          SELECT json_build_object('status', p2.status, 'latency_ms', p2.latency_ms, 'checked_at', p2.checked_at)
          FROM pings p2 WHERE p2.monitor_id = m.id
          ORDER BY p2.checked_at DESC LIMIT 1
        ) AS last_ping,
        (
          SELECT json_agg(daily ORDER BY daily->>'day' ASC)
          FROM (
            SELECT json_build_object(
              'day', DATE(p3.checked_at),
              'total', COUNT(*),
              'up', COUNT(*) FILTER (WHERE p3.status = 'up')
            ) as daily
            FROM pings p3
            WHERE p3.monitor_id = m.id
            AND p3.checked_at > NOW() - INTERVAL '90 days'
            GROUP BY DATE(p3.checked_at)
          ) sub
        ) AS uptime_history
      FROM page_monitors pm
      JOIN monitors m ON m.id = pm.monitor_id
      WHERE pm.page_id = $1
      ORDER BY pm.position ASC`,
      [page.id],
    );

    const monitorIds = monitors.map((m: any) => m.id);
    let incidents: any[] = [];
    if (monitorIds.length > 0) {
      const { rows } = await db.query(
        `SELECT i.*, m.name as monitor_name
         FROM incidents i
         JOIN monitors m ON m.id = i.monitor_id
         WHERE i.monitor_id = ANY($1::uuid[])
         ORDER BY i.started_at DESC
         LIMIT 10`,
        [monitorIds],
      );
      incidents = rows;
    }

    const hasDown = monitors.some((m: any) => m.status === "down");
    const hasDegraded = monitors.some((m: any) => m.status === "degraded");
    const overallStatus = hasDown
      ? "down"
      : hasDegraded
        ? "degraded"
        : "operational";

    return res.json({
      page: {
        title: page.title,
        description: page.description,
        logo_url: page.logo_url,
        slug: page.slug,
      },
      overall_status: overallStatus,
      monitors,
      incidents,
    });
  } catch (err) {
    console.error("Get public page error:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

const updatePageSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(300).optional(),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug deve conter apenas letras minúsculas, números e hífens",
    )
    .optional(),
  monitor_ids: z.array(z.string().uuid()).optional(),
});

export async function updatePage(req: Request, res: Response) {
  const result = updatePageSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues[0].message });
  }

  const { title, description, slug, monitor_ids } = result.data;
  const userId = req.user!.id;

  try {
    const { rows: pageRows } = await db.query(
      "SELECT * FROM pages WHERE user_id = $1",
      [userId],
    );

    if (pageRows.length === 0) {
      return res.status(404).json({ error: "Página não encontrada" });
    }

    const page = pageRows[0];

    if (slug && slug !== page.slug) {
      if (req.user!.plan !== "pro") {
        return res.status(403).json({
          error: "Personalização de slug disponível apenas no plano Pro",
        });
      }

      const { rows: slugCheck } = await db.query(
        "SELECT id FROM pages WHERE slug = $1 AND id != $2",
        [slug, page.id],
      );
      if (slugCheck.length > 0) {
        return res.status(409).json({ error: "Esse slug já está em uso" });
      }
    }

    await db.query(
      `UPDATE pages SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        slug = COALESCE($3, slug),
        updated_at = NOW()
       WHERE id = $4`,
      [title, description, slug, page.id],
    );

    if (monitor_ids !== undefined) {
      await db.query("DELETE FROM page_monitors WHERE page_id = $1", [page.id]);

      if (monitor_ids.length > 0) {
        const values = monitor_ids
          .map((id, i) => `($1, $${i + 2}, ${i})`)
          .join(", ");
        await db.query(
          `INSERT INTO page_monitors (page_id, monitor_id, position) VALUES ${values}`,
          [page.id, ...monitor_ids],
        );
      }
    }

    const { rows: updated } = await db.query(
      "SELECT * FROM pages WHERE id = $1",
      [page.id],
    );

    return res.json({ page: updated[0] });
  } catch (err) {
    console.error("Update page error:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function getMyPage(req: Request, res: Response) {
  try {
    const { rows } = await db.query(
      `SELECT p.*, 
        COALESCE(json_agg(pm.monitor_id ORDER BY pm.position) FILTER (WHERE pm.monitor_id IS NOT NULL), '[]') AS monitor_ids
       FROM pages p
       LEFT JOIN page_monitors pm ON pm.page_id = p.id
       WHERE p.user_id = $1
       GROUP BY p.id`,
      [req.user!.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Página não encontrada" });
    }

    return res.json({ page: rows[0] });
  } catch (err) {
    console.error("Get my page error:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}
