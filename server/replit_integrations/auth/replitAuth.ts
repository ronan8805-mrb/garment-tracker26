import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import createMemoryStore from "memorystore";
import { randomBytes } from "crypto";

// Signing secret for session cookies. In production a missing SESSION_SECRET
// must never fall back to a known value; use a random one instead (logins
// then reset whenever the server restarts, so set SESSION_SECRET on Railway).
function sessionSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "WARNING: SESSION_SECRET is not set. Using a random secret; everyone will be logged out on each restart.",
    );
    return randomBytes(48).toString("hex");
  }
  return "local-dev-secret-key-change-in-prod";
}

// One shared session middleware (also used to authenticate WebSocket connections)
let sessionMiddleware: RequestHandler | null = null;

export function getSession(): RequestHandler {
  if (sessionMiddleware) return sessionMiddleware;
  sessionMiddleware = createSession();
  return sessionMiddleware;
}

function createSession(): RequestHandler {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const secret = sessionSecret();

  if (process.env.DATABASE_URL) {
    const pgStore = connectPg(session);
    const sessionStore = new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      ttl: sessionTtl,
      tableName: "sessions",
    });
    return session({
      secret,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        maxAge: sessionTtl,
      },
    });
  }

  const MemoryStore = createMemoryStore(session);
  return session({
    secret,
    store: new MemoryStore({ checkPeriod: sessionTtl }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
}

export const isAuthenticated: RequestHandler = async (_req, res, _next) => {
  return res.status(401).json({ message: "Unauthorized" });
};
