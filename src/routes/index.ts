import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import {
  register,
  login,
  me,
  refreshUser,
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

// Page (authenticated)
router.get("/page", authMiddleware, getMyPage);
router.put("/page", authMiddleware, updatePage);

// Public page
router.get("/status/:slug", getPublicPage);

// Settings
router.get("/settings/notifications", authMiddleware, getNotifications);
router.put("/settings/notifications", authMiddleware, updateNotifications);

// Billing
router.post("/billing/upgrade", authMiddleware, upgrade);
router.post("/billing/webhook", webhook);

export default router;
