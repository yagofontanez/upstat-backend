import { Resend } from "resend";
import axios from "axios";
import { db } from "../config/database";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function fetchServiceStatus(statusUrl: string) {
  try {
    const { data } = await axios.get(statusUrl, { timeout: 8000 });
    return {
      indicator: data.status?.indicator ?? "none",
      description: data.status?.description ?? "All Systems Operational",
    };
  } catch {
    return { indicator: "unknown", description: "Não foi possível verificar" };
  }
}

export async function checkAllDependencies() {
  const { rows: services } = await db.query(`SELECT * FROM external_services`);

  for (const service of services) {
    const { indicator, description } = await fetchServiceStatus(
      service.status_url,
    );

    const { rows: openIncidents } = await db.query(
      `SELECT id FROM external_service_incidents
       WHERE service_id = $1 AND resolved_at IS NULL
       LIMIT 1`,
      [service.id],
    );

    const wasDown = openIncidents.length > 0;
    const isDown = indicator !== "none" && indicator !== "unknown";

    if (isDown && !wasDown) {
      await db.query(
        `INSERT INTO external_service_incidents (service_id, indicator, description)
         VALUES ($1, $2, $3)`,
        [service.id, indicator, description],
      );
      await notifyUsers(service, indicator, description);
    } else if (!isDown && wasDown) {
      await db.query(
        `UPDATE external_service_incidents
         SET resolved_at = NOW()
         WHERE service_id = $1 AND resolved_at IS NULL`,
        [service.id],
      );
    }
  }
}

async function notifyUsers(
  service: any,
  indicator: string,
  description: string,
) {
  const { rows: users } = await db.query(
    `SELECT u.email, u.name FROM users u
     INNER JOIN user_dependencies ud ON ud.user_id = u.id
     WHERE ud.service_id = $1`,
    [service.id],
  );

  for (const user of users) {
    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: user.email,
      subject: `⚠️ ${service.name} está com problemas`,
      html: `
        <p>Olá, ${user.name}!</p>
        <p>O serviço <strong>${service.name}</strong> que você monitora como dependência está com problemas.</p>
        <p><strong>Status:</strong> ${description}</p>
        <p><strong>Severidade:</strong> ${indicator}</p>
        <p>Acompanhe em <a href="${service.website_url}">${service.website_url}</a></p>
        <p>— UpStat</p>
      `,
    });
  }
}
