import webpush from "web-push";
import { db } from "../config/database";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  url?: string,
) {
  try {
    const { rows } = await db.query(
      "SELECT * FROM push_subscriptions WHERE user_id = $1",
      [userId],
    );

    for (const sub of rows) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify({ title, body, url }),
        );
      } catch (err: any) {
        if (err.statusCode === 410) {
          await db.query("DELETE FROM push_subscriptions WHERE id = $1", [
            sub.id,
          ]);
        }
      }
    }
  } catch (err) {
    console.error("[push] Erro ao enviar notificação:", err);
  }
}

export async function saveSubscription(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
) {
  await db.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING`,
    [
      userId,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth,
    ],
  );
}

export async function deleteSubscription(userId: string, endpoint: string) {
  await db.query(
    "DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2",
    [userId, endpoint],
  );
}
