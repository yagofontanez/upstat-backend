import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface JwtPayload {
  id: string;
  email: string;
  plan?: string;
}

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      plan?: string;
      name?: string;
    }
    interface Request {
      user?: User;
    }
  }
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.user = decoded as Express.User;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}
