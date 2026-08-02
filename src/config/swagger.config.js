const swaggerUi = require("swagger-ui-express");

// Giữ đồng bộ với danh sách mount trong src/app.js
const mountedRouters = [
  { mountPath: "/api/notifications", router: require("../routes/notifications.router") },
  { mountPath: "/api/course-categories", router: require("../routes/courseCategories.router") },
  { mountPath: "/api/courses", router: require("../routes/courses.router") },
  { mountPath: "/api/lessons", router: require("../routes/lessons.router") },
  { mountPath: "/api/enrollments", router: require("../routes/enrollments.router") },
  { mountPath: "/api/quizzes", router: require("../routes/quizzes.router") },
  { mountPath: "/api/questions", router: require("../routes/questions.router") },
  { mountPath: "/api/quiz-results", router: require("../routes/quizResults.router") },
  { mountPath: "/api/users", router: require("../routes/user.router") },
  { mountPath: "/api/reviews", router: require("../routes/reviews.router") },
  { mountPath: "/api/bookmarks", router: require("../routes/bookmarks.router") },
  { mountPath: "/api/mentor-requests", router: require("../routes/mentorRequest.router") },
  { mountPath: "/api/app-stats", router: require("../routes/appStats.router") },
];

function collectPaths() {
  const paths = {};

  const add = (fullPath, method) => {
    const swaggerPath = fullPath.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
    paths[swaggerPath] = paths[swaggerPath] || {};

    const parameters = [];
    const paramNames = swaggerPath.match(/\{([^}]+)\}/g) || [];
    for (const match of paramNames) {
      parameters.push({
        name: match.slice(1, -1),
        in: "path",
        required: true,
        schema: { type: "string" },
      });
    }

    paths[swaggerPath][method] = {
      summary: `${method.toUpperCase()} ${fullPath}`,
      security: [{ devKey: [] }, { bearerAuth: [] }],
      parameters,
      responses: {
        200: { description: "Thành công" },
        400: { description: "Dữ liệu không hợp lệ" },
        401: { description: "Chưa xác thực (thiếu/không đúng key hoặc token)" },
        500: { description: "Lỗi server" },
      },
    };
  };

  for (const { mountPath, router } of mountedRouters) {
    for (const layer of router.stack) {
      if (!layer.route) continue;
      const fullPath = mountPath + layer.route.path;
      for (const method of Object.keys(layer.route.methods)) {
        if (method !== "all") add(fullPath, method);
      }
    }
  }

  add("/health", "get");
  return paths;
}

function buildSpec() {
  const devKeyExample = process.env.DEV_API_KEY || "";

  return {
    openapi: "3.0.3",
    info: {
      title: "Online Learning API",
      version: "1.0.0",
      description:
        "API đồ án Online Learning.\n\n**Test nhanh không cần JWT:** bấm nút **Authorize**, nhập `x-api-key` hoặc `Bearer` bằng giá trị dev key (đã điền sẵn, từ biến `DEV_API_KEY` trong `.env`).",
    },
    servers: [{ url: "/" }],
    components: {
      securitySchemes: {
        devKey: {
          type: "apiKey",
          in: "header",
          name: "x-dev-api-key",
          description: `Dev key cho môi trường dev: bấm Authorize rồi dán giá trị sau vào ô x-api-key: \`${devKeyExample || "(chưa cấu hình DEV_API_KEY trong .env)"}\`. Chỉ hoạt động khi NODE_ENV khác production.`,
        },
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT trả về từ POST /api/users/login. Dev: có thể nhập thẳng dev key vào ô này.",
        },
      },
    },
    paths: collectPaths(),
  };
}

module.exports = { buildSpec, swaggerUi };
