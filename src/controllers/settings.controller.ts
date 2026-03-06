import { Request, Response } from "express";
import { z } from "zod";
import { db } from "../config/database";

const updateNotificationsSchema = z.object({
  email_enabled: z.boolean().optional(),
  whatsapp_enabled: z.boolean().optional(),
  whatsapp_number: z.string().nullable().optional(),
});

export async function getNotifications(req: Request, res: Response) {
  try {
    const { rows } = await db.query(
      "SELECT * FROM notifications WHERE user_id = $1",
      [req.user!.id],
    );

    return res.json({ notifications: rows[0] || null });
  } catch (e) {
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function updateNotifications(req: Request, res: Response) {
  const result = updateNotificationsSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: result.error.issues[0].message });
  }

  const { email_enabled, whatsapp_enabled, whatsapp_number } = result.data;

  if (whatsapp_enabled && req.user!.plan !== "pro") {
    return res.status(403).json({
      error: "Notificação via WhatsApp disponível apenas no plano Pro",
    });
  }

  try {
    const { rows } = await db.query(
      `UPDATE notifications SET
        email_enabled = COALESCE($1, email_enabled),
        whatsapp_enabled = COALESCE($2, whatsapp_enabled),
        whatsapp_number = COALESCE($3, whatsapp_number),
        updated_at = NOW()
       WHERE user_id = $4
       RETURNING *`,
      [email_enabled, whatsapp_enabled, whatsapp_number, req.user!.id],
    );

    return res.json({ notifications: rows[0] });
  } catch (e) {
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function updateSlackSettings(req: Request, res: Response) {
  try {
    const { slack_webhook_url, slack_enabled } = req.body;

    await db.query(
      `UPDATE notifications 
       SET slack_webhook_url = $1, slack_enabled = $2 
       WHERE user_id = $3`,
      [slack_webhook_url || null, slack_enabled, req.user!.id],
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Slack settings error:", err);
    return res
      .status(500)
      .json({ error: "Erro ao salvar configurações do Slack" });
  }
}
