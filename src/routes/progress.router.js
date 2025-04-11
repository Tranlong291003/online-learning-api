const express = require("express");
const router = express.Router();
const progressController = require("../controllers/progress.controller");

// Route để lấy tiến độ học tập của người dùng trong một khóa học
router.get(
  "/progress/:user_id/:course_id",
  progressController.getCourseProgressForUser
);

module.exports = router;
