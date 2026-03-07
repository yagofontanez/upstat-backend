import { chromium } from "playwright";
import { db } from "../config/database";
import { Resend } from "resend";

export interface SyntheticStep {
  order_index: number;
  action: "navigate" | "click" | "fill" | "waitFor" | "assertText";
  selector?: string;
  value?: string;
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function runSyntheticMonitor(monitorId: string) {
  const { rows: monitors } = await db.query(
    `SELECT * FROM synthetic_monitors WHERE id = $1`,
    [monitorId],
  );

  if (!monitors.length) return;
  const monitor = monitors[0];

  const { rows: steps } = await db.query(
    `SELECT * FROM synthetic_steps WHERE monitor_id = $1 ORDER BY order_index ASC`,
    [monitorId],
  );

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const startTime = Date.now();

  let status = "pass";
  let failedStepIndex = null;
  let failedStepAction = null;
  let errorMessage = null;
  let screenshotUrl = null;

  try {
    for (const step of steps) {
      try {
        if (step.action === "navigate") {
          await page.goto(step.value, { timeout: 15000 });
        } else if (step.action === "click") {
          await page.click(step.selector, { timeout: 10000 });
        } else if (step.action === "fill") {
          await page.fill(step.selector, step.value, { timeout: 10000 });
        } else if (step.action === "waitFor") {
          await page.waitForSelector(step.selector, { timeout: 10000 });
        } else if (step.action === "assertText") {
          const text = await page.textContent(step.selector);
          if (!text?.includes(step.value)) {
            throw new Error(
              `Texto esperado "${step.value}" não encontrado em "${step.selector}"`,
            );
          }
        }
      } catch (err: any) {
        status = "fail";
        failedStepIndex = step.order_index;
        failedStepAction = step.action;
        errorMessage = err.message;

        const screenshotBuffer = await page.screenshot({ fullPage: false });
        screenshotUrl = await saveScreenshot(monitorId, screenshotBuffer);
        break;
      }
    }
  } finally {
    await browser.close();
  }

  const duration = Date.now() - startTime;

  await db.query(
    `INSERT INTO synthetic_results
     (monitor_id, status, failed_step_index, failed_step_action, error_message, screenshot_url, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      monitorId,
      status,
      failedStepIndex,
      failedStepAction,
      errorMessage,
      screenshotUrl,
      duration,
    ],
  );

  if (status === "fail") {
    await notifySyntheticFailure(
      monitor,
      failedStepIndex,
      failedStepAction,
      errorMessage,
      screenshotUrl,
    );
  }

  return { status, duration, failedStepIndex, errorMessage };
}

async function saveScreenshot(
  monitorId: string,
  buffer: Buffer,
): Promise<string> {
  const fs = await import("fs");
  const path = await import("path");
  const dir = "./public/screenshots";

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filename = `${monitorId}-${Date.now()}.png`;
  fs.writeFileSync(path.join(dir, filename), buffer);

  return `/screenshots/${filename}`;
}

async function notifySyntheticFailure(
  monitor: any,
  failedStep: number | null,
  failedAction: string | null,
  error: string | null,
  screenshotUrl: string | null,
) {
  const { rows: users } = await db.query(
    `SELECT email, name FROM users WHERE id = $1`,
    [monitor.user_id],
  );
  if (!users.length) return;

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: users[0].email,
    subject: `⚠️ Synthetic monitor falhou: ${monitor.name}`,
    html: `
      <p>Olá, ${users[0].name}!</p>
      <p>O monitor sintético <strong>${monitor.name}</strong> falhou.</p>
      ${failedStep !== null ? `<p><strong>Step falhou:</strong> #${failedStep + 1} — ${failedAction}</p>` : ""}
      ${error ? `<p><strong>Erro:</strong> ${error}</p>` : ""}
      ${screenshotUrl ? `<p><strong>Screenshot:</strong> <a href="https://upstat.online${screenshotUrl}">Ver screenshot</a></p>` : ""}
      <p>— UpStat</p>
    `,
  });
}
