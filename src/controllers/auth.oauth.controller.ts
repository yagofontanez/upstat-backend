import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { db } from "../config/database";

export async function oauthCallback(req: Request, res: Response) {
  const user = req.user as any;
  if (!user)
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth`);

  const { rows } = await db.query(`SELECT plan FROM users WHERE id = $1`, [
    user.id,
  ]);
  const plan = rows[0]?.plan ?? "free";

  const token = jwt.sign(
    { id: user.id, email: user.email, plan },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" },
  );

  res.redirect(`${process.env.FRONTEND_URL}/oauth/callback?token=${token}`);
}
