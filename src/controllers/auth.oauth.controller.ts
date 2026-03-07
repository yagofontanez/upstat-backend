import { Request, Response } from "express";
import jwt from "jsonwebtoken";

export function oauthCallback(req: Request, res: Response) {
  console.log("oauthCallback req.user: ", req.user);
  const user = req.user as any;

  if (!user)
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth`);

  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" },
  );

  console.log("token gerado: ", token);

  res.redirect(`${process.env.FRONTEND_URL}/oauth/callback?token=${token}`);
}
