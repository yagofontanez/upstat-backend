import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { db } from "../config/database";
import { sendWelcomeEmail } from "../services/notification.service";

const registerSchema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30) +
    "-" +
    uuidv4().slice(0, 6)
  );
}

export async function register(req: Request, res: Response) {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues[0].message });
  }

  const { name, email, password } = result.data;

  try {
    const existing = await db.query("SELECT id FROM users WHERE email = $1", [
      email,
    ]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email já cadastrado" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    const slug = generateSlug(name);

    await db.query("BEGIN");

    await db.query(
      "INSERT INTO users (id, name, email, password) VALUES ($1, $2, $3, $4)",
      [userId, name, email, hashedPassword],
    );

    await db.query(
      "INSERT INTO pages (id, user_id, slug, title) VALUES ($1, $2, $3, $4)",
      [uuidv4(), userId, slug, `${name}'s Status Page`],
    );

    await db.query("INSERT INTO notifications (id, user_id) VALUES ($1, $2)", [
      uuidv4(),
      userId,
    ]);

    await db.query("COMMIT");

    const token = jwt.sign(
      { id: userId, email, plan: "free" },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" },
    );

    sendWelcomeEmail(email, name, slug).catch(console.error);

    return res.status(201).json({
      token,
      user: { id: userId, name, email, plan: "free" },
    });
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("Register error:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function login(req: Request, res: Response) {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Dados inválidos" });
  }

  const { email, password } = result.data;

  try {
    const { rows } = await db.query(
      "SELECT id, name, email, password, plan, onboarding_completed FROM users WHERE email = $1",
      [email],
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Email ou senha incorretos" });
    }

    const user = rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: "Email ou senha incorretos" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, plan: user.plan },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" },
    );

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        onboarding_completed: user.onboarding_completed,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function me(req: Request, res: Response) {
  try {
    const { rows } = await db.query(
      "SELECT id, name, email, plan, onboarding_completed, created_at FROM users WHERE id = $1",
      [req.user!.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    return res.json({ user: rows[0] });
  } catch (err) {
    console.error("Me error:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function refreshUser(req: Request, res: Response) {
  try {
    const { rows } = await db.query(
      "SELECT id, email, plan, onboarding_completed FROM users WHERE id = $1",
      [req.user!.id],
    );
    const user = rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, plan: user.plan },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" },
    );
    return res.json({ token });
  } catch (err) {
    console.error("Refresh user error:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function completeOnboarding(req: Request, res: Response) {
  try {
    await db.query(
      "UPDATE users SET onboarding_completed = true WHERE id = $1",
      [req.user!.id],
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao completar onboarding" });
  }
}
