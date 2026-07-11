const app = require("./app");
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () =>
  console.log(`🚀 API running at http://localhost:${PORT}`)
);

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`\n${signal} received. Closing server...`);
  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });
  // Force exit sau 10s nếu connection còn treo
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
