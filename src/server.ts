import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db } from "./config/database";
import routes from "./routes";
import { startPingJob } from "./jobs/ping.job";
import { startWeeklyReportJob } from "./jobs/weekly-report.job";
import { startSSLCheckJob } from "./jobs/ssl-check.job";
import { startDNSCheckJob } from "./jobs/dns-check.job";
import { startSLAReportJob } from "./jobs/sla-report.job";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3333;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json());

app.get("/health", (_, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() }),
);

app.use("/api", routes);

async function bootstrap() {
  try {
    await db.query("SELECT 1");
    console.log("Database connected.");

    startPingJob();
    startWeeklyReportJob();
    startSSLCheckJob();
    startDNSCheckJob();
    startSLAReportJob();

    app.listen(PORT, () => {
      console.log(`UpStat API running on http://localhost:${PORT}`);
    });
  } catch (e) {
    console.error("Failed to start server: ", e);
    process.exit(1);
  }
}

bootstrap();
