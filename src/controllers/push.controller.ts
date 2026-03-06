import { Request, Response } from "express";
import { saveSubscription, deleteSubscription } from "../services/push.service";

export async function subscribe(req: Request, res: Response) {
  try {
    const subscription = req.body;
    await saveSubscription(req.user!.id, subscription);
    return res.json({ success: true });
  } catch (err) {
    console.error("Subscribe error:", err);
    return res.status(500).json({ error: "Erro ao salvar subscription" });
  }
}

export async function unsubscribe(req: Request, res: Response) {
  try {
    const { endpoint } = req.body;
    await deleteSubscription(req.user!.id, endpoint);
    return res.json({ success: true });
  } catch (err) {
    console.error("Unsubscribe error:", err);
    return res.status(500).json({ error: "Erro ao remover subscription" });
  }
}

export async function getVapidKey(_req: Request, res: Response) {
  return res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
}
