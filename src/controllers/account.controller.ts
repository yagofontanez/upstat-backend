import { Request, Response } from "express";
import { db } from "../config/database";
import { cancelSubscription } from "../services/asaas.service";

export async function deleteAccount(req: Request, res: Response) {
  const userId = req.user!.id;

  try {
    const { rows } = await db.query(
      "SELECT asaas_subscription_id FROM users WHERE id = $1",
      [userId],
    );

    const subscriptionId = rows[0]?.asaas_subscription_id;
    if (subscriptionId) {
      try {
        await cancelSubscription(subscriptionId);
      } catch (e) {
        console.error("Erro ao cancelar assinatura no Asaas:", e);
      }
    }

    await db.query("DELETE FROM users WHERE id = $1", [userId]);

    return res.json({ ok: true });
  } catch (err) {
    console.error("Delete account error:", err);
    return res.status(500).json({ error: "Erro ao excluir conta" });
  }
}
