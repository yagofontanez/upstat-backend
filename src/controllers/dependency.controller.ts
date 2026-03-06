import { Request, Response } from "express";
import { db } from "../config/database";

export async function getServices(req: Request, res: Response) {
  try {
    const { rows } = await db.query(
      `SELECT es.*,
        CASE WHEN ud.id IS NOT NULL THEN true ELSE false END as is_dependency,
        (SELECT indicator FROM external_service_incidents
         WHERE service_id = es.id AND resolved_at IS NULL
         ORDER BY started_at DESC LIMIT 1) as current_indicator
       FROM external_services es
       LEFT JOIN user_dependencies ud ON ud.service_id = es.id AND ud.user_id = $1
       ORDER BY es.category, es.name`,
      [req.user!.id],
    );

    return res.json(rows);
  } catch (e) {
    console.error("Error fetching services:", e);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function addDependency(req: Request, res: Response) {
  try {
    await db.query(
      `INSERT INTO user_dependencies (user_id, service_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.user!.id, req.params.serviceId],
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("addDependency error:", err);
    return res.status(500).json({ error: "Erro ao adicionar dependência" });
  }
}

export async function removeDependency(req: Request, res: Response) {
  try {
    await db.query(
      `DELETE FROM user_dependencies WHERE user_id = $1 AND service_id = $2`,
      [req.user!.id, req.params.serviceId],
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("removeDependency error:", err);
    return res.status(500).json({ error: "Erro ao remover dependência" });
  }
}

export async function getMyDependencies(req: Request, res: Response) {
  try {
    const { rows } = await db.query(
      `SELECT es.*,
        (SELECT indicator FROM external_service_incidents
         WHERE service_id = es.id AND resolved_at IS NULL
         ORDER BY started_at DESC LIMIT 1) as current_indicator,
        (SELECT description FROM external_service_incidents
         WHERE service_id = es.id AND resolved_at IS NULL
         ORDER BY started_at DESC LIMIT 1) as current_description
       FROM external_services es
       INNER JOIN user_dependencies ud ON ud.service_id = es.id
       WHERE ud.user_id = $1
       ORDER BY es.name`,
      [req.user!.id],
    );
    return res.json(rows);
  } catch (err) {
    console.error("getMyDependencies error:", err);
    return res.status(500).json({ error: "Erro ao buscar dependências" });
  }
}
