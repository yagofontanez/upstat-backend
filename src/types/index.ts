export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  plan: "free" | "pro";
  created_at: Date;
  updated_at: Date;
}

export interface Monitor {
  id: string;
  user_id: string;
  name: string;
  url: string;
  interval_minutes: number;
  status: "pending" | "up" | "down" | "degraded";
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Ping {
  id: string;
  monitor_id: string;
  status: "up" | "down" | "timeout";
  status_code: number | null;
  latency_ms: number | null;
  checked_at: Date;
}

export interface Incident {
  id: string;
  monitor_id: string;
  started_at: Date;
  resolved_at: Date | null;
  duration_ms: number | null;
}

export interface Page {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  description: string | null;
  logo_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Notification {
  id: string;
  user_id: string;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  whatsapp_number: string | null;
  updated_at: Date;
}

export interface AuthRequest extends Express.Request {
  user?: { id: string; email: string; plan: "free" | "pro" };
}
