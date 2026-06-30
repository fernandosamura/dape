import "./bootstrap";
import fs from "fs";
import path from "path";
import "reflect-metadata";
import "express-async-errors";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import * as Sentry from "@sentry/node";
import rateLimit from "express-rate-limit";
import { doubleCsrf } from "csrf-csrf";

import "./database";
import uploadConfig from "./config/upload";
import AppError from "./errors/AppError";
import routes from "./routes";
import { logger } from "./utils/logger";
import { messageQueue, sendScheduledMessages } from "./queues";
import bodyParser from 'body-parser';

Sentry.init({ dsn: process.env.SENTRY_DSN });

const app = express();

// Necessário para req.ip correto atrás de nginx/docker proxy
// Sem isso, req.ip retorna o IP interno do proxy para todos os usuários,
// o que afeta rate limiting e getSessionIdentifier do CSRF.
app.set("trust proxy", 1);

app.set("queues", {
  messageQueue,
  sendScheduledMessages
});

const bodyparser = require('body-parser');
app.use(bodyParser.json({ limit: '10mb' }));

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://daple.pubplus.com.br',
  'http://daple.pubplus.com.br',
  'http://2.25.196.154',
  'https://2.25.196.154',
].filter(Boolean);

app.use(
  cors({
    credentials: true,
    maxAge: 0,
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    }
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(Sentry.Handlers.requestHandler());
app.use("/public", express.static(uploadConfig.directory));

// ── Rate limiting ──────────────────────────────────────────────────────────
// Rotas excluídas: webhooks (Asaas não controla cadência), /health (monitoring)
const skipRateLimit = (req: Request) =>
  req.path.startsWith("/webhooks/") || req.path === "/health";

// Global: 1000 req / 15 min por IP — protege toda a API
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipRateLimit,
    message: { error: "Muitas requisições. Tente novamente em alguns minutos." },
  })
);

// Autenticação: 100 req / 15 min — protege brute-force em /auth/*
app.use(
  "/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas tentativas de autenticação. Aguarde 15 minutos." },
  })
);
// ────────────────────────────────────────────────────────────────────────────

// ── CSRF (Double Submit Cookie) ────────────────────────────────────────────
// Protege mutações (POST/PUT/DELETE) contra ataques cross-site.
// Rotas excluídas: /auth/* (sem cookie de sessão ainda), /webhooks/* (Asaas),
//                  /forgot-password, /health (monitoring).
const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || "daple-csrf-default-secret-32ch!!",
  // csrf-csrf v4 exige getSessionIdentifier para amarrar o token à sessão/IP
  getSessionIdentifier: (req: Request) => (req as any).ip || "unknown",
  cookieName: "csrf-token",
  cookieOptions: {
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  },
  getTokenFromRequest: (req) => req.headers["x-csrf-token"] as string,
} as any);

// Endpoint público para o frontend buscar o token CSRF
app.get("/csrf-token", (req: Request, res: Response) => {
  const token = (generateCsrfToken as any)(req, res);
  return res.json({ token });
});

// Rotas que NÃO precisam de CSRF
const csrfExcludes = ["/auth/", "/webhooks/", "/forgetpassword", "/health", "/csrf-token"];
const skipCsrf = (req: Request) =>
  req.method === "GET" ||
  req.method === "HEAD" ||
  req.method === "OPTIONS" ||
  csrfExcludes.some(p => req.path.startsWith(p));

app.use((req: Request, res: Response, next: NextFunction) => {
  if (skipCsrf(req)) return next();
  return doubleCsrfProtection(req, res, next);
});
// ────────────────────────────────────────────────────────────────────────────

app.use(routes);

app.use(Sentry.Handlers.errorHandler());

app.use(async (err: any, req: Request, res: Response, _: NextFunction) => {

  // CSRF token inválido — retorna 403 com código identificável pelo frontend
  if (err?.code === "EBADCSRFTOKEN") {
    return res.status(403).json({ error: "CSRF_INVALID" });
  }

  if (err instanceof AppError) {
    logger.warn(err);
    return res.status(err.statusCode).json({ error: err.message });
  }

  const logEntry = JSON.stringify({
    timestamp: new Date().toISOString(),
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    user: req.user ? req.user.id : "unauthenticated"
  }) + "\n";

  try {
    const logsDir = path.join(__dirname, "..", "logs");
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(path.join(logsDir, "error.log"), logEntry);
  } catch (_logErr) {}

  logger.error(err);
  return res.status(500).json({ error: "ERR_INTERNAL_SERVER_ERROR" });
});

export default app;
