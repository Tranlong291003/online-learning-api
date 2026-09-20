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

// Dùng path tuyệt đối để không phụ thuộc thư mục chạy lệnh (cwd)
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
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message,
  });
});

module.exports = app;
