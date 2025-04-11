const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// Import các route
const courseCategoryRoutes = require("./routes/courseCategories.router");
const courseRoutes = require("./routes/courses.router");
const lessonRoutes = require("./routes/lessons.router");
const enrollmentRoutes = require("./routes/enrollments.router");
const progressRoutes = require("./routes/progress.router"); // Đảm bảo đúng đường dẫn
const quizzesRoutes = require("./routes/quizzes.router");
const questionsRoutes = require("./routes/questions.Router");

// Gắn route với đường dẫn cụ thể
app.use("/api", courseCategoryRoutes);
app.use("/api", courseRoutes);
app.use("/api", lessonRoutes);
app.use("/api", enrollmentRoutes);
app.use("/api", progressRoutes);
app.use("/api", quizzesRoutes);
app.use("/api", questionsRoutes);

module.exports = app;
