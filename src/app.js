const express = require("express");
const cors = require("cors");
const app = express();
const path = require("path");

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
// Cách đó không chạy được khi triển khai: trên Vercel mã nguồn ở thư mục chỉ
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

app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

// Swagger UI - http://localhost:3000/api-docs
// Test nhanh: bấm Authorize, nhập dev key (x-api-key) từ .env
const { buildSpec, swaggerUi } = require("./config/swagger.config");
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(buildSpec(), {
    swaggerOptions: { persistAuthorization: true },
  })
);

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
