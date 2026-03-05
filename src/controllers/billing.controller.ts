import { Request, Response } from "express";
import { db } from "../config/database";
import {
  createOrFindCustomer,
  createSubscription,
  getSubscriptionPaymentLink,
} from "../services/asaas.service";

export async function upgrade(req: Request, res: Response) {
  const { cpf_cnpj } = req.body;

  if (!cpf_cnpj) {
    return res.status(400).json({ error: "CPF ou CNPJ obrigatório" });
  }

  try {
    const { rows } = await db.query(
      "SELECT id, name, email, plan, asaas_customer_id, asaas_subscription_id FROM users WHERE id = $1",
      [req.user!.id],
    );

    const user = rows[0];

    if (user.plan === "pro") {
      return res.status(400).json({ error: "Você já é Pro!" });
    }

    await db.query("UPDATE users SET cpf_cnpj = $1 WHERE id = $2", [
      cpf_cnpj,
      user.id,
    ]);

    const customer = await createOrFindCustomer({
      id: user.id,
      name: user.name,
      email: user.email,
      cpf_cnpj,
    });

    await db.query("UPDATE users SET asaas_customer_id = $1 WHERE id = $2", [
      customer.id,
      user.id,
    ]);

    const subscription = await createSubscription(customer.id);

    if (!subscription.id) {
      throw new Error("Erro ao criar assinatura");
    }

    await db.query(
      "UPDATE users SET asaas_subscription_id = $1 WHERE id = $2",
      [subscription.id, user.id],
    );

    let paymentUrl = subscription.paymentLink;
    if (!paymentUrl) {
      paymentUrl = await getSubscriptionPaymentLink(subscription.id);
    }

    return res.json({
      payment_url: paymentUrl,
      subscription_id: subscription.id,
    });
  } catch (err: any) {
    console.error("Upgrade error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Erro ao processar upgrade" });
  }
}

export async function webhook(req: Request, res: Response) {
  try {
    const event = req.body;

    console.log("[webhook] Asaas event:", event.event);

    if (
      event.event === "PAYMENT_CONFIRMED" ||
      event.event === "PAYMENT_RECEIVED"
    ) {
      const customerId = event.payment?.customer;

      if (customerId) {
        await db.query(
          "UPDATE users SET plan = $1 WHERE asaas_customer_id = $2",
          ["pro", customerId],
        );
        console.log(`[webhook] User upgraded to pro — customer: ${customerId}`);
      }
    }

    if (
      event.event === "SUBSCRIPTION_CANCELLED" ||
      event.event === "PAYMENT_OVERDUE"
    ) {
      const customerId = event.payment?.customer;

      if (customerId) {
        await db.query(
          "UPDATE users SET plan = $1 WHERE asaas_customer_id = $2",
          ["free", customerId],
        );
        console.log(
          `[webhook] User downgraded to free — customer: ${customerId}`,
        );
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("[webhook] Error:", err);
    return res.status(500).json({ error: "Webhook error" });
  }
}
