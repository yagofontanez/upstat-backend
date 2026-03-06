import { Request, Response } from "express";
import { db } from "../config/database";

export async function getBadge(req: Request, res: Response) {
  try {
    const { slug } = req.params;

    const { rows: pageRows } = await db.query(
      "SELECT id FROM pages WHERE slug = $1",
      [slug],
    );

    if (pageRows.length === 0) {
      return res.status(404).send("Not Found");
    }

    const { rows: monitors } = await db.query(
      `SELECT m.status FROM monitors m
         JOIN page_monitors pm ON pm.monitor_id = m.id
         WHERE pm.page_id = $1`,
      [pageRows[0].id],
    );

    const hasDown = monitors.some((m) => m.status === "down");
    const hasPending = monitors.some((m) => m.status === "pending");

    const label = "uptime";
    const status = hasPending
      ? "checking"
      : hasDown
        ? "degraded"
        : "operational";
    const color = hasPending ? "#F59E0B" : hasDown ? "#EF4444" : "#00D4AA";

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="160" height="20">
        <rect width="160" height="20" rx="4" fill="#0D1117"/>
        <rect x="0" y="0" width="60" height="20" rx="4" fill="#1C2128"/>
        <rect x="56" y="0" width="4" height="20" fill="#1C2128"/>
        <rect x="60" y="0" width="100" height="20" rx="4" fill="${color}" fill-opacity="0.15"/>
        <rect x="60" y="0" width="100" height="20" rx="4" fill="none" stroke="${color}" stroke-opacity="0.3" stroke-width="1"/>
        <text x="30" y="14" font-family="JetBrains Mono, monospace" font-size="11" fill="#8B949E" text-anchor="middle">${label}</text>
        <circle cx="72" cy="10" r="4" fill="${color}"/>
        <text x="118" y="14" font-family="JetBrains Mono, monospace" font-size="11" fill="${color}" text-anchor="middle" font-weight="700">${status}</text>
        </svg>`.trim();

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.send(svg);
  } catch (err) {
    console.error("Badge error:", err);
    return res.status(500).send("Error");
  }
}
