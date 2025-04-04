// 📄 src/app.js
const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

const userRoutes = require("./routes/users.router");
const courseCategoryRoutes = require("./routes/courseCategories.router");
const lessonRoutes = require("./routes/lessons.router"); // Thêm route cho lessons

app.use("/api/users", userRoutes);
app.use("/api/course-categories", courseCategoryRoutes);
app.use("/api", lessonRoutes); // Đăng ký route lessons

module.exports = app;
