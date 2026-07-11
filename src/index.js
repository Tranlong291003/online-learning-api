// =============================================================
// Server entrypoint (Supabase refactored)
// Supports both: `node src/index.js` (local) + Vercel serverless
// =============================================================
const app = require("./app");

// Local dev: listen on PORT. On Vercel, this file is NOT executed — Vercel
// uses `src/app.js` directly as a serverless function (see vercel.json).
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => {
    console.log(`[server] API running at http://localhost:${PORT}`);
  });

  const shutdown = (signal) => {
    console.log(`\n[server] ${signal} received. Closing...`);
    server.close(() => {
      console.log("[server] HTTP closed.");
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("uncaughtException", (err) => {
    console.error("[server] uncaughtException:", err);
  });
  process.on("unhandledRejection", (err) => {
    console.error("[server] unhandledRejection:", err);
  });
}

module.exports = app;
