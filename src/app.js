const express = require("express");
const cors = require("cors");
const app = express();
const path = require("path");

app.use(cors());
app.use(express.json());

// Import các route
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

app.use("/uploads", express.static("src/public/uploads"));

module.exports = app;
