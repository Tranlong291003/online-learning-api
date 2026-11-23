import { httpServerHandler } from "cloudflare:node";
import { env } from "cloudflare:workers";

process.env.CF_WORKER = "true";
process.env.JWT_SECRET = env.JWT_SECRET || process.env.JWT_SECRET || "";
for (const key of [
  "JWT_ISSUER",
  "JWT_AUDIENCE",
  "ACCESS_TOKEN_TTL",
  "REFRESH_TOKEN_TTL_DAYS",
  "REFRESH_TOKEN_TTL_DAYS_REMEMBER",
  "BCRYPT_ROUNDS",
  "PASSWORD_MIN_LENGTH",
  "MAX_LOGIN_ATTEMPTS",
  "LOGIN_LOCK_MINUTES",
  "RESET_TOKEN_TTL_MINUTES",
  "CORS_ORIGIN",
  "AI_BASE_URL",
  "AI_API_KEY",
  "AI_MODEL",
  "YOUTUBE_API_KEY",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
]) {
  if (env[key] !== undefined) process.env[key] = String(env[key]);
}
const [{ default: app }, { default: database }] = await Promise.all([
  import("./app.js"),
  import("./config/db.config.js"),
]);

database.setCloudflareBindings(env);
app.listen(8787);

export default httpServerHandler({ port: 8787 });
