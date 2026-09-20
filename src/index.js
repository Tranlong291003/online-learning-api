require("dotenv").config();

const app = require("./app");
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

// Trên Vercel, file này KHÔNG được chạy — Vercel dùng thẳng `src/app.js`
// làm serverless function (xem vercel.json). Gọi app.listen() ở đó sẽ lỗi
// vì serverless không có cổng để bind, nên chỉ listen khi chạy thật (local/Docker).
if (!process.env.VERCEL) {
  const server = app.listen(PORT, HOST, () =>
    console.log(`🚀 API running at http://${HOST}:${PORT}`)
  );

  const shutdown = (signal) => {
    console.log(`\n${signal} received. Closing server...`);
    server.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
