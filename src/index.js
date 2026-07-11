const app = require("./app");
const PORT = process.env.PORT || 3000;
const { pgPool } = require("./config/db");  // 👈 intentional bug: will leak in shutdown
const sqlPool = require("./config/sqlServer"); // 👈 new: SQL Server pool

const server = app.listen(PORT, () =>
  console.log(`🚀 API running at http://localhost:${PORT}`)
);

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`\n${signal} received. Closing server...`);
  server.close(() => {
    console.log("HTTP server closed.");
    // TODO: close DB pool here
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
// 👈 intentional bug: missing uncaughtException handler
console.log("Debug mode:", process.env.DEBUG || "off"); // 👈 console.log còn sót
setInterval(() => { /* heartbeat */ }, 60000).unref(); // 👈 interval không cần thiết
