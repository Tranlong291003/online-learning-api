const express = require("express");
const router = express.Router();
const quizResultsController = require("../controllers/quizResults.controller");

// Route để nộp bài làm
router.post("/quiz-results", quizResultsController.submitQuizResult);

// Route để xem kết quả chi tiết của bài làm
router.get("/quiz-results/:id", quizResultsController.getQuizResultById);

// Route để lấy kết quả của người học
router.get("/users/:id/results", quizResultsController.getResultsByUser);

// Route để chấm bài tự luận
router.patch("/quiz-results/:id/grade", quizResultsController.gradeQuizResult);

module.exports = router;
