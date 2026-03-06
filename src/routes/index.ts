import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import {
  register,
  login,
  me,
  refreshUser,
  completeOnboarding,
} from "../controllers/auth.controller";
import {
  listMonitors,
  createMonitor,
  getMonitor,
  deleteMonitor,
  getMonitorPings,
  getMonitorIncidents,
  getMonitorUptimeHistory,
  toggleMonitor,
  pingMonitorNow,
  exportMonitorPings,
} from "../controllers/monitors.controller";
import {
  getPublicPage,
  getMyPage,
  updatePage,
} from "../controllers/pages.controller";
import {
  getNotifications,
  updateNotifications,
} from "../controllers/settings.controller";
import { upgrade, webhook } from "../controllers/billing.controller";
import { getBadge } from "../controllers/badge.controller";
import {
  getVapidKey,
  subscribe,
  unsubscribe,
} from "../controllers/push.controller";
import { db } from "../config/database";

const router = Router();

// Auth
router.post("/auth/register", register);
router.post("/auth/login", login);
router.get("/auth/me", authMiddleware, me);
router.post("/auth/refresh", authMiddleware, refreshUser);

// Monitors
router.get("/monitors", authMiddleware, listMonitors);
router.post("/monitors", authMiddleware, createMonitor);
router.get("/monitors/:id", authMiddleware, getMonitor);
router.delete("/monitors/:id", authMiddleware, deleteMonitor);
router.get("/monitors/:id/pings", authMiddleware, getMonitorPings);
router.get("/monitors/:id/incidents", authMiddleware, getMonitorIncidents);
router.get(
  "/monitors/:id/uptime-history",
  authMiddleware,
  getMonitorUptimeHistory,
);
router.patch("/monitors/:id/toggle", authMiddleware, toggleMonitor);
router.post("/monitors/:id/ping", authMiddleware, pingMonitorNow);
router.get("/monitors/:id/export", authMiddleware, exportMonitorPings);

// Page (authenticated)
router.get("/page", authMiddleware, getMyPage);
router.put("/page", authMiddleware, updatePage);

// Public page
router.get("/status/:slug", getPublicPage);
router.get("/badge/:slug", getBadge);

// Settings
router.get("/settings/notifications", authMiddleware, getNotifications);
router.put("/settings/notifications", authMiddleware, updateNotifications);

// Billing
router.post("/billing/upgrade", authMiddleware, upgrade);
router.post("/billing/webhook", webhook);

// Push Notifications
router.get("/push/vapid-key", authMiddleware, getVapidKey);
router.post("/push/subscribe", authMiddleware, subscribe);
router.post("/push/unsubscribe", authMiddleware, unsubscribe);

// Onboarding
router.post("/auth/onboarding/complete", authMiddleware, completeOnboarding);

// Widget - Public route
router.get("/widget/:slug", async (req, res) => {
  const { slug } = req.params;

  const pageRes = await db.query("SELECT * FROM status_pages WHERE slug = $1", [
    slug,
  ]);

  if (pageRes.rows.length === 0)
    return res.status(404).json({ error: "Not found" });

  const page = pageRes.rows[0];

  const monitorsRes = await db.query(
    `SELECT m.status FROM monitors m
     JOIN status_page_monitors spm ON spm.monitor_id = m.id
     WHERE spm.page_id = $1 AND m.is_active = true`,
    [page.id],
  );

  const monitors = monitorsRes.rows;
  const total = monitors.length;
  const down = monitors.filter((m) => m.status === "down").length;
  const overall =
    down === 0 ? "operational" : down === total ? "down" : "degraded";

  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.json({ overall, down, total, slug, title: page.title });
});

export default router;
