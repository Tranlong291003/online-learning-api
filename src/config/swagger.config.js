const swaggerUi = require("swagger-ui-express");
const { REQUEST_BODIES, QUERY_PARAMS } = require("./swagger.schemas");

// Giữ đồng bộ với danh sách mount trong src/app.js
const mountedRouters = [
  { mountPath: "/api/auth", router: require("../routes/auth.router") },
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

/**
 * Dựng `requestBody` cho Swagger từ mô tả trong swagger.schemas.js.
 *
 * Trả về undefined nếu endpoint không nhận thân request — khi đó Swagger UI ẩn
 * hẳn ô nhập thay vì hiện ô trống gây hiểu nhầm.
 */
function buildRequestBody(key, spec) {
  if (!spec) return undefined;

  const { contentType, properties, required, example } = spec;

  return {
    required: required.length > 0,
    content: {
      [contentType]: {
        // Swagger UI đọc `example` để điền sẵn giá trị vào ô nhập.
        example,
        schema: {
          type: "object",
          properties,
          ...(required.length > 0 ? { required } : {}),
        },
      },
    },
  };
}

/** Mô tả ngắn hiện dưới tiêu đề endpoint. */
function buildDescription(cfg) {
  if (!cfg) {
    return "Endpoint này không nhận thân request (chỉ cần token và tham số trên URL).";
  }

  const lines = [];
  const requiredNames = cfg.required || [];
  const allNames = Object.keys(cfg.properties || {});

  if (requiredNames.length > 0) {
    lines.push(`**Bắt buộc:** \`${requiredNames.join("`, `")}\``);
  }
  const optional = allNames.filter((n) => !requiredNames.includes(n));
  if (optional.length > 0) {
    lines.push(`**Tuỳ chọn:** \`${optional.join("`, `")}\``);
  }
  if (cfg.contentType === "multipart/form-data") {
    lines.push(
      "Gửi dạng `multipart/form-data`. Bấm **Try it out**, điền các ô, rồi chọn tệp ở ô có kiểu `string($binary)`."
    );
  }
  return lines.join("\n\n");
}

function collectPaths() {
  const paths = {};
  const missingDescriptions = [];

  const add = (fullPath, method) => {
    const swaggerPath = fullPath.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
    // Khoá tra cứu dùng cùng dạng với swagger.schemas.js: giữ `:param` như khai
    // báo trong router (không đổi thành `{param}`) và bỏ dấu `/` cuối mà Express
    // thêm cho route khai báo "/". Nhờ vậy khoá bên mô tả viết đúng như nhìn
    // thấy trong file router, không phải nhớ hai quy ước khác nhau.
    const key = `${method.toUpperCase()} ${fullPath.replace(/\/$/, "")}`;
    paths[swaggerPath] = paths[swaggerPath] || {};

    // Tham số đường dẫn
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

    // Tham số query (khai báo thêm cho các GET cần lọc)
    const extraParams = QUERY_PARAMS[key];
    if (extraParams) parameters.push(...extraParams);

    // Thân request
    const bodySpec = REQUEST_BODIES[key];
    // Chỉ cảnh báo với method thường có thân request. GET đương nhiên không có
    // thân, còn DELETE trong API này hầu hết cũng vậy — cảnh báo chúng chỉ tạo
    // tiếng ồn che mất các trường hợp thiếu thật.
    if (!bodySpec && ["post", "put", "patch"].includes(method)) {
      missingDescriptions.push(key);
    }
    const requestBody = buildRequestBody(key, bodySpec);

    // Endpoint công khai (đăng ký/đăng nhập/quên mật khẩu) không cần token.
    // Swagger UI sẽ không gửi header Authorization cho các endpoint này, tránh
    // việc token cũ còn lưu trong trình duyệt gây 401 khó hiểu.
    const isPublic = /^POST \/api\/auth\/(register|login|refresh|forgot-password|reset-password)$/.test(key)
      || key === "POST /api/users/create"
      || key === "POST /api/users/login";

    const responses = {
      200: { description: "Thành công" },
      201: { description: "Tạo mới thành công" },
      400: { description: "Dữ liệu gửi lên không hợp lệ" },
      401: { description: "Chưa xác thực (thiếu token hoặc token hết hạn)" },
      403: { description: "Không đủ quyền, hoặc tài khoản đã bị khoá" },
      404: { description: "Không tìm thấy tài nguyên" },
      413: { description: "File gửi lên quá lớn" },
      500: { description: "Lỗi server (chi tiết không lộ ra ngoài)" },
    };

    // Chỉ giữ mã trạng thái hợp lý với từng method để danh sách gọn.
    if (method === "post") delete responses[200];
    else delete responses[201];

    paths[swaggerPath][method] = {
      tags: [tagFor(mountPathOf(fullPath))],
      summary: `${method.toUpperCase()} ${fullPath}`,
      description: buildDescription(bodySpec),
      ...(isPublic ? {} : { security: [{ devKey: [] }, { bearerAuth: [] }] }),
      parameters,
      ...(requestBody ? { requestBody } : {}),
      responses,
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

  // Cảnh báo lúc khởi động khi có endpoint chưa được mô tả. Giữ ở mức cảnh báo
  // (không chặn chạy) để môi trường production vẫn khởi động được.
  if (missingDescriptions.length > 0) {
    console.warn(
      `⚠️ Swagger: ${missingDescriptions.length} endpoint chưa có mô tả thân request ` +
        "(bổ sung vào src/config/swagger.schemas.js):\n  " +
        missingDescriptions.join("\n  ")
    );
  }

  return paths;
}

/** Lấy tiền tố nhóm từ đường dẫn đầy đủ, ví dụ /api/courses/create → /api/courses */
function mountPathOf(fullPath) {
  const parts = fullPath.split("/").filter(Boolean);
  return "/" + parts.slice(0, 2).join("/");
}

/** Tên nhóm hiện trên Swagger UI. */
const TAG_LABELS = {
  "/api/auth": "Xác thực",
  "/api/users": "Người dùng",
  "/api/course-categories": "Danh mục khoá học",
  "/api/courses": "Khoá học",
  "/api/lessons": "Bài học",
  "/api/enrollments": "Đăng ký khoá học",
  "/api/quizzes": "Bài kiểm tra",
  "/api/questions": "Câu hỏi",
  "/api/quiz-results": "Kết quả kiểm tra",
  "/api/reviews": "Đánh giá",
  "/api/bookmarks": "Khoá học đã lưu",
  "/api/notifications": "Thông báo",
  "/api/mentor-requests": "Yêu cầu nâng cấp mentor",
  "/api/app-stats": "Thống kê",
  "/health": "Hệ thống",
};

function tagFor(mountPath) {
  return TAG_LABELS[mountPath] || mountPath;
}

function buildSpec() {
  return {
    openapi: "3.0.3",
    info: {
      title: "Online Learning API",
      version: "1.0.0",
      description: [
        "REST API cho nền tảng học trực tuyến.",
        "",
        "### Cách dùng nhanh",
        "1. Mở `POST /api/auth/login`, bấm **Try it out**, dùng tài khoản demo có sẵn trong ô nhập, rồi **Execute**.",
        "2. Sao chép `access_token` trong kết quả.",
        "3. Bấm nút **Authorize** ở đầu trang, dán token vào ô **bearerAuth**, rồi **Authorize**.",
        "4. Từ đó mọi endpoint khác đã sẵn token; mỗi endpoint đều có ô nhập điền ví dụ sẵn, chỉ cần sửa giá trị và bấm **Execute**.",
        "",
        "### Tài khoản demo (mật khẩu chung `Demo@123456`)",
        "| Vai trò | Email |",
        "| --- | --- |",
        "| Quản trị viên | `admin@demo.onlinelearning.vn` |",
        "| Giảng viên | `mentor01@demo.onlinelearning.vn` … `mentor10@…` |",
        "| Học viên | `student01@demo.onlinelearning.vn` … `student20@…` |",
        "",
        "### Lưu ý",
        "- Endpoint công khai (đăng ký, đăng nhập, quên/đặt lại mật khẩu) không cần token.",
        "- Với endpoint có gửi tệp, chọn tệp ở ô có kiểu `string($binary)`; giới hạn 4MB.",
        "- Thông báo lỗi được trả về dạng `{ \"error\": \"...\" }` hoặc `{ \"message\": \"...\" }` tuỳ endpoint.",
      ].join("\n"),
    },
    servers: [
      { url: "https://online-learning-api.vercel.app", description: "Production (Vercel)" },
      { url: "http://localhost:3000", description: "Local dev" },
    ],
    tags: Object.entries(TAG_LABELS).map(([path, name]) => ({
      name,
      description:
        path === "/health"
          ? "Kiểm tra tình trạng server."
          : `Nhóm endpoint dưới tiền tố \`${path}\`.`,
    })),
    components: {
      securitySchemes: {
        // Dev key chỉ hoạt động ngoài production. Trên production, dùng token
        // thật lấy từ /api/auth/login.
        //
        // Không nêu tên biến môi trường ở đây: tài liệu này là công khai, và
        // câu hướng dẫn cho khoá chỉ dùng ở máy cá nhân chỉ gây nhầm lẫn cho
        // người đọc trên production.
        devKey: {
          type: "apiKey",
          in: "header",
          name: "x-dev-api-key",
          description:
            "Chỉ dùng khi chạy API ở máy cá nhân; giá trị lấy từ file cấu hình cục bộ. " +
            "Trên production khoá này bị tắt nên luôn trả 401 — hãy dùng bearerAuth.",
        },
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "Access token lấy từ `POST /api/auth/login` (trường `access_token`). " +
            "Token sống 15 phút; hết hạn thì gọi `POST /api/auth/refresh` để lấy token mới.",
        },
      },
    },
    paths: collectPaths(),
  };
}

module.exports = { buildSpec, swaggerUi };
