import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import { db } from "./database";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: `${process.env.APP_URL}/api/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0].value;
        if (!email) return done(new Error("Email não encontrado"));

        const { rows } = await db.query(
          "SELECT * FROM users WHERE email = $1",
          [email],
        );

        if (rows.length) {
          return done(null, rows[0]);
        }

        const { rows: newUser } = await db.query(
          "INSERT INTO users (name, email, password, is_verified) VALUES ($1, $2, $3, true) RETURNING *",
          [profile.displayName, email, "oauth"],
        );

        return done(null, newUser[0]);
      } catch (e) {
        return done(e as Error);
      }
    },
  ),
);

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      callbackURL: `${process.env.APP_URL}/api/auth/github/callback`,
      scope: ["user:email"],
    },
    async (
      accessToken: string,
      refreshToken: string,
      profile: any,
      done: any,
    ) => {
      console.log("github profile emails:", profile.emails);
      try {
        const email = profile.emails?.[0].value;
        console.log("email:", email);
        if (!email) return done(new Error("Email não encontrado"));

        console.log("buscando usuario no banco...");
        const { rows } = await db.query(
          `SELECT * FROM users WHERE email = $1`,
          [email],
        );
        console.log("usuario encontrado:", rows.length);

        if (rows.length) {
          console.log("usuario ja existe, retornando...");
          return done(null, rows[0]);
        }

        console.log("criando usuario...");
        const { rows: newUser } = await db.query(
          `INSERT INTO users (name, email, password_hash, is_verified)
       VALUES ($1, $2, $3, true) RETURNING *`,
          [profile.displayName || profile.username, email, "oauth"],
        );
        console.log("usuario criado:", newUser[0]);
        return done(null, newUser[0]);
      } catch (err) {
        console.error("github strategy erro:", err);
        return done(err as Error);
      }
    },
  ),
);

export default passport;
