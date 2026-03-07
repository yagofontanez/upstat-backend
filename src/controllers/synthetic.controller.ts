import { Request, Response } from "express";
import { db } from "../config/database";
import { runSyntheticMonitor } from "../services/synthetic.service";

export async function getSyntheticMonitors(req: Request, res: Response) {
  try {
    const { rows } = await db.query(
      `SELECT sm.*,
        (SELECT status FROM synthetic_results
         WHERE monitor_id = sm.id
         ORDER BY checked_at DESC LIMIT 1) as last_status,
        (SELECT checked_at FROM synthetic_results
         WHERE monitor_id = sm.id
         ORDER BY checked_at DESC LIMIT 1) as last_checked_at
       FROM synthetic_monitors sm
       WHERE sm.user_id = $1
       ORDER BY sm.created_at DESC`,
      [req.user!.id],
    );
    return res.json(rows);
  } catch (err) {
    console.error("getSyntheticMonitors error:", err);
    return res.status(500).json({ error: "Erro ao buscar monitors" });
  }
}

export async function getSyntheticMonitor(req: Request, res: Response) {
  try {
    const { rows } = await db.query(
      `SELECT sm.* FROM synthetic_monitors sm
       WHERE sm.id = $1 AND sm.user_id = $2`,
      [req.params.id, req.user!.id],
    );
    if (!rows.length)
      return res.status(404).json({ error: "Monitor não encontrado" });

    const { rows: steps } = await db.query(
      `SELECT * FROM synthetic_steps WHERE monitor_id = $1 ORDER BY order_index ASC`,
      [req.params.id],
    );

    const { rows: results } = await db.query(
      `SELECT * FROM synthetic_results WHERE monitor_id = $1 ORDER BY checked_at DESC LIMIT 20`,
      [req.params.id],
    );

    return res.json({ ...rows[0], steps, results });
  } catch (err) {
    console.error("getSyntheticMonitor error:", err);
    return res.status(500).json({ error: "Erro ao buscar monitor" });
  }
}

export async function createSyntheticMonitor(req: Request, res: Response) {
  try {
    const { name, interval_minutes, steps } = req.body;

    const { rows } = await db.query(
      `INSERT INTO synthetic_monitors (user_id, name, interval_minutes)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.user!.id, name, interval_minutes ?? 10],
    );
    const monitor = rows[0];

    for (const step of steps) {
      await db.query(
        `INSERT INTO synthetic_steps (monitor_id, order_index, action, selector, value)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          monitor.id,
          step.order_index,
          step.action,
          step.selector ?? null,
          step.value ?? null,
        ],
      );
    }

    return res.status(201).json(monitor);
  } catch (err) {
    console.error("createSyntheticMonitor error:", err);
    return res.status(500).json({ error: "Erro ao criar monitor" });
  }
}

export async function deleteSyntheticMonitor(req: Request, res: Response) {
  try {
    await db.query(
      `DELETE FROM synthetic_monitors WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user!.id],
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("deleteSyntheticMonitor error:", err);
    return res.status(500).json({ error: "Erro ao deletar monitor" });
  }
}

export async function runSyntheticNow(req: Request, res: Response) {
  try {
    const { rows } = await db.query(
      `SELECT id FROM synthetic_monitors WHERE id = $1 AND user_id = $2`,
      [req.params["id"] as string, req.user!.id],
    );
    if (!rows.length)
      return res.status(404).json({ error: "Monitor não encontrado" });

    const result = await runSyntheticMonitor(req.params["id"] as string);
    return res.json(result);
  } catch (err) {
    console.error("runSyntheticNow error:", err);
    return res.status(500).json({ error: "Erro ao executar monitor" });
  }
}
