const express = require("express");
const cors = require("cors");
const app = express();
const path = require("path");
const localUploadsPath = path.join(
  typeof __dirname === "undefined" ? "." : __dirname,
  "public",
  "uploads"
);

// CORS: cho phép mọi origin ở dev; production nên set CORS_ORIGIN env.
const allowedOrigin = process.env.CORS_ORIGIN;
app.use(cors(allowedOrigin ? { origin: allowedOrigin } : {}));

// express.json với giới hạn body 1 MB để chống DoS bằng request body khổng lồ.
// Giá trị 1 MB đủ cho mọi endpoint hiện tại (payload lớn nhất ~quiz answers ~10 KB).
// Tăng lên nếu cần endpoint nhận payload lớn hơn.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Express 5 để `req.body` là undefined khi request không có body (Express 4 luôn cho {}).
// Rất nhiều controller đọc thẳng req.body.uid nên sẽ ném TypeError -> 500.
// Chuẩn hoá về {} để giữ hành vi cũ; đặt SAU express.json() để không bị ghi đè.
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Import các route
const authRoutes = require("./routes/auth.router");
const courseCategoryRoutes = require("./routes/courseCategories.router");
const courseRoutes = require("./routes/courses.router");
const lessonRoutes = require("./routes/lessons.router");
const enrollmentRoutes = require("./routes/enrollments.router");
const quizzesRoutes = require("./routes/quizzes.router");
const questionsRoutes = require("./routes/questions.router");
const quizResultsRoutes = require("./routes/quizResults.router");
const usersRoutes = require("./routes/user.router");
const notificationsRouter = require("./routes/notifications.router"); // Import router thông báo
const reviewsRouter = require("./routes/reviews.router");
const bookmarksRouter = require("./routes/bookmarks.router"); // Import router bookmark
const mentorRequestRouter = require("./routes/mentorRequest.router");
const appStatsRouter = require("./routes/appStats.router");

app.use("/api/auth", authRoutes); // Đăng ký / đăng nhập / làm mới token / hồ sơ
app.use("/api/notifications", notificationsRouter);
app.use("/api/course-categories", courseCategoryRoutes); // API cho danh mục khóa học
app.use("/api/courses", courseRoutes); // API cho các khóa học
app.use("/api/lessons", lessonRoutes); // API cho bài học
app.use("/api/enrollments", enrollmentRoutes); // API cho việc đăng ký khóa học
app.use("/api/quizzes", quizzesRoutes); // API cho các bài quiz
app.use("/api/questions", questionsRoutes); // API cho các câu hỏi
app.use("/api/quiz-results", quizResultsRoutes); // API cho kết quả quiz
app.use("/api/users", usersRoutes); // API cho người dùng
app.use("/api/reviews", reviewsRouter);
app.use("/api/bookmarks", bookmarksRouter); // API cho bookmark
app.use("/api/mentor-requests", mentorRequestRouter);
app.use("/api/app-stats", appStatsRouter);

// File upload được phục vụ TỪ CSDL, không phải từ đĩa.
//
// Trước đây là `express.static(path.join(__dirname, "public", "uploads"))`.
// Cách đó không chạy được khi triển khai serverless: thư mục mã nguồn chỉ
// đọc, nên không ghi được file mới, và đĩa cũng là tạm thời. Xem
// src/services/fileStorage.js.
//
// Thứ tự quan trọng: file trong CSDL phải được thử TRƯỚC. `express.static` gọi
// `next()` khi không thấy file và request rơi sang handler bên dưới, nên file
// cũ đóng gói kèm mã nguồn vẫn phục vụ được (nếu không có bản ghi mới hơn).
const { readFile: readUploadedFile, safeMimeType } = require("./services/fileStorage");

// Dùng RegExp thay vì "/uploads/*": Express 5 dùng path-to-regexp v8, nơi ký tự
// `*` trần không còn hợp lệ ("Missing parameter name"). Nhóm bắt đầu tiên ánh xạ
// vào req.params[0].
app.get(/^\/uploads\/(.+)$/, async (req, res, next) => {
  const publicPath = `/uploads/${req.params[0] || ""}`;

  let record;
  try {
    record = await readUploadedFile(publicPath);
  } catch (err) {
    // Lỗi CSDL không nên làm hỏng việc phục vụ file tĩnh: ghi log rồi thử đĩa.
    console.error("Lỗi đọc file upload từ CSDL:", err.message);
    return next();
  }

  if (!record) return next();

  // Loại MIME suy ra từ ĐUÔI FILE, không tin Content-Type client gửi lúc upload:
  // nếu tin client, kẻ tấn công có thể upload HTML kèm `text/html` rồi dụ người
  // khác mở link — script sẽ chạy trên chính origin của API.
  const mime = safeMimeType(publicPath, record.mime_type);

  // `nosniff` chặn trình duyệt tự đoán lại loại file; nếu không có, một file
  // khai báo ảnh nhưng chứa HTML vẫn có thể bị đoán thành HTML.
  res.setHeader("Content-Type", mime);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Length", String(record.content.length));
  // Tên file do server sinh và nội dung không đổi theo đường dẫn → cache được.
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  return res.end(record.content);
});

app.use("/uploads", express.static(localUploadsPath));

// Swagger UI - http://localhost:3000/api-docs
//
// Ngoài giao diện mặc định, có thêm một bảng "Đăng nhập nhanh" (xem
// src/config/swagger.ui.js) để không phải tự gọi /api/auth/login rồi chép token
// sang hộp thoại Authorize, và một lớp hiển thị kết luận thành công/lỗi cho mỗi
// lần gọi.
const {
  buildSpec,
  swaggerUi,
  SWAGGER_ASSET_BASE,
} = require("./config/swagger.config");
const { SWAGGER_UI_SCRIPT } = require("./config/swagger.ui");

// Tài nguyên giao diện mà trang HTML của Swagger UI tự tham chiếu (đường dẫn
// tương đối, xem template trong swagger-ui-express).
const SWAGGER_ASSET_FILES = [
  "swagger-ui.css",
  "swagger-ui-bundle.js",
  "swagger-ui-standalone-preset.js",
  "favicon-16x16.png",
  "favicon-32x32.png",
];

// Chuyển hướng các tài nguyên này sang CDN.
//
// Phải đặt TRƯỚC `swaggerUi.serve` và `swaggerUi.setup`. Hai middleware đó phục
// vụ tài nguyên từ node_modules/swagger-ui-dist — thư mục không tồn tại lúc chạy
// trên môi trường serverless, nên express.static không tìm thấy tệp rồi nhường cho middleware
// sau, và middleware sau trả về chính trang HTML. Trình duyệt nhận HTML ở vị trí
// CSS/JS nên trang tài liệu trắng trơn. Chặn ở đây thì yêu cầu không bao giờ đi
// tới chỗ sai đó.
//
// `swagger-ui-init.js` KHÔNG chuyển hướng: tệp đó được sinh tại chỗ cho từng
// request (chứa mô tả API), nên phải do máy chủ trả.
if (SWAGGER_ASSET_BASE) {
  app.get("/api-docs/:asset", (req, res, next) => {
    if (!SWAGGER_ASSET_FILES.includes(req.params.asset)) return next();
    // 302 kèm cache dài: tài nguyên ghim theo phiên bản nên nội dung không đổi.
    res.set("Cache-Control", "public, max-age=86400");
    return res.redirect(302, `${SWAGGER_ASSET_BASE}/${req.params.asset}`);
  });
}

if (process.env.CF_WORKER === "true") {
  app.get("/api-docs/ui.js", (_req, res) => {
    res.type("application/javascript").send(SWAGGER_UI_SCRIPT);
  });

  app.get("/api-docs", (_req, res) => {
    res.type("html").send(`<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f4f7fb"><title>LMS API — Tài liệu & kiểm thử</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${SWAGGER_ASSET_BASE}/swagger-ui.css">
<style>
:root{color-scheme:light;--ink:#172a46;--muted:#60718a;--blue:#2563eb;--line:#dce5f0;--paper:#fff;--bg:#f3f6fb}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:'DM Sans',system-ui,sans-serif}
.page-shell{max-width:1180px;margin:0 auto;padding:28px 24px 72px}.hero{position:relative;overflow:hidden;padding:34px 38px;border:1px solid #243e64;border-radius:24px;background:linear-gradient(118deg,#10243f 0%,#17375f 58%,#2458a6 100%);color:#fff;box-shadow:0 18px 45px #18375e21}
.hero:after{content:'';position:absolute;width:320px;height:320px;right:-85px;top:-175px;border:1px solid #ffffff24;border-radius:50%;box-shadow:0 0 0 36px #ffffff0b,0 0 0 72px #ffffff08}.eyebrow{display:inline-flex;align-items:center;gap:8px;margin-bottom:14px;color:#b9d4ff;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.live-dot{width:8px;height:8px;border-radius:50%;background:#5be0a4;box-shadow:0 0 0 4px #5be0a426}
.hero h1{position:relative;z-index:1;margin:0;font:800 clamp(28px,4vw,40px)/1.15 Manrope,sans-serif;letter-spacing:-.04em}.hero p{position:relative;z-index:1;max-width:650px;margin:12px 0 0;color:#d4e2f5;font-size:15px;line-height:1.7}.hero-links{position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}.hero-links a{padding:9px 13px;border:1px solid #ffffff35;border-radius:10px;color:#fff;text-decoration:none;font-size:13px;font-weight:600}.hero-links a:hover{background:#ffffff14}
#swagger-ui{margin-top:22px}.swagger-ui{font-family:'DM Sans',system-ui,sans-serif}.swagger-ui .information-container{display:none}.swagger-ui .wrapper{max-width:none;padding:0}.swagger-ui .opblock-tag{border-bottom:1px solid var(--line);font:700 18px Manrope,sans-serif;color:var(--ink)}.swagger-ui .opblock{border-radius:14px;box-shadow:0 4px 16px #17375e0b}.swagger-ui .opblock .opblock-summary{padding:9px 14px}.swagger-ui .opblock .opblock-summary-description{font-family:'DM Sans',sans-serif}.swagger-ui .btn{border-radius:8px}.swagger-ui select,.swagger-ui input[type=text],.swagger-ui textarea{border-radius:8px}.swagger-ui section.models{border-radius:14px}
#dev-tools{margin:0 0 22px!important;padding:22px 24px!important;border:1px solid var(--line)!important;border-radius:18px!important;background:var(--paper)!important;box-shadow:0 8px 28px #17375e0b;font-family:'DM Sans',sans-serif!important}
#dev-tools>div:first-child{font:700 19px Manrope,sans-serif!important;color:var(--ink)}#dev-tools>div:nth-child(2){font-size:14px!important;line-height:1.65!important;color:var(--muted)!important}#dev-tools code{padding:2px 6px;border-radius:5px;background:#edf3fc;color:#1f57a6}
#dev-tools button{min-height:40px;padding:8px 14px!important;border-radius:9px!important;font:600 13px 'DM Sans',sans-serif!important;transition:transform .15s,box-shadow .15s}#dev-tools button:hover{transform:translateY(-1px);box-shadow:0 5px 12px #17375e18}#dev-tools input{min-height:42px;padding:9px 11px!important;border-radius:9px!important;font:14px 'DM Sans',sans-serif!important}#dev-tools-status{font-size:13px!important}
.swagger-ui .scheme-container{position:sticky;top:0;z-index:5;border:1px solid var(--line);border-radius:14px;background:#ffffffed;box-shadow:0 8px 20px #17375e0c;backdrop-filter:blur(10px)}
@media(max-width:640px){.page-shell{padding:14px 12px 44px}.hero{padding:26px 22px;border-radius:18px}.hero p{font-size:14px}#dev-tools{padding:18px!important}.swagger-ui .opblock .opblock-summary-description{display:none}}
</style></head>
<body><main class="page-shell"><header class="hero"><div class="eyebrow"><span class="live-dot"></span> Cloudflare Workers · D1</div><h1>Online Learning API</h1><p>Tài liệu API và khu vực thử nghiệm trực tiếp. Đăng nhập demo một lần để tự gắn token, chọn endpoint, nhập dữ liệu mẫu và xem kết quả ngay bên dưới.</p><nav class="hero-links"><a href="#dev-tools">Đăng nhập demo</a><a href="#swagger-ui">Danh sách API</a><a href="/api-docs.json" target="_blank" rel="noreferrer">OpenAPI JSON ↗</a></nav></header><div id="swagger-ui"></div></main>
<script src="${SWAGGER_ASSET_BASE}/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({url:"/api-docs.json",dom_id:"#swagger-ui",persistAuthorization:true})</script>
<script src="/api-docs/ui.js"></script>
</body></html>`);
  });
} else {
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(buildSpec(), {
      swaggerOptions: { persistAuthorization: true },
      customJsStr: SWAGGER_UI_SCRIPT,
      customSiteTitle: "Online Learning API — Tài liệu",
    })
  );
}

// Cho phép tải JSON mô tả OpenAPI để dùng với công cụ ngoài (Postman, codegen).
app.get("/api-docs.json", (req, res) => {
  res.json(buildSpec());
});

// Global error handler
//
// Lỗi do client gửi dữ liệu sai (file bị từ chối, file quá lớn, sai field...)
// phải trả 4xx kèm câu giải thích. Trước đây chúng rơi hết vào nhánh 500 dưới
// đây, nên người dùng chỉ thấy "Internal server error" và không biết mình sai
// ở đâu — trong khi nguyên nhân thật là file .txt đặt tên .png hoặc file vượt
// giới hạn.
const multer = require("multer");
const { UploadRejectedError, MAX_UPLOAD_MB } = require("./services/fileStorage");

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: `File vượt quá giới hạn cho phép (tối đa ${MAX_UPLOAD_MB}MB)`,
  LIMIT_UNEXPECTED_FILE: "File gửi lên không đúng trường (field) mà API chấp nhận",
  LIMIT_FILE_COUNT: "Số lượng file vượt quá giới hạn",
  LIMIT_PART_COUNT: "Số phần dữ liệu gửi lên vượt quá giới hạn",
  LIMIT_FIELD_KEY: "Tên trường trong form quá dài",
  LIMIT_FIELD_VALUE: "Giá trị trường trong form quá dài",
  LIMIT_FIELD_COUNT: "Số trường trong form vượt quá giới hạn",
};

app.use((err, req, res, next) => {
  // 1. Lỗi do chính tầng lưu trữ file phát hiện (sai định dạng, không phải ảnh...)
  if (err instanceof UploadRejectedError) {
    return res.status(err.status || 400).json({
      success: false,
      error: err.message,
    });
  }

  // 2. Lỗi multer (giới hạn kích thước, sai tên field, quá nhiều file...)
  if (err instanceof multer.MulterError) {
    // File quá lớn là 413 (Payload Too Large); các lỗi còn lại là 400.
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res.status(status).json({
      success: false,
      error: MULTER_MESSAGES[err.code] || `Lỗi tải file lên (${err.code})`,
    });
  }

  // 3. JSON hỏng: body-parser gắn err.type = "entity.parse.failed"
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      error: "Nội dung JSON gửi lên không hợp lệ",
    });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      error: "Dữ liệu gửi lên quá lớn",
    });
  }

  // 4. Lỗi còn lại: ghi log đầy đủ ở server, KHÔNG trả chi tiết nội bộ ra
  // ngoài (tên bảng, tên cột, tên ràng buộc... đủ để dựng lại lược đồ CSDL).
  console.error("Error:", err);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message,
  });
});

module.exports = app;
