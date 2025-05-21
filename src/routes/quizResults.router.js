const express = require("express");
const router = express.Router();
const quizResultsController = require("../controllers/quizResults/quizResults.controller");

// Route để nộp bài làm
router.post("/submit", quizResultsController.submitQuizResult);

// Route để xem kết quả chi tiết của bài làm theo ID kết quả bài làm (quiz_result_id)
router.get("/:result_id", quizResultsController.getQuizResultById);

// Route để lấy kết quả của người học theo user_id
router.get("/users/:user_uid/results", quizResultsController.getResultsByUser);

// Route để chấm bài tự luận theo quiz_result_id
router.patch(
  "/quiz-results/:result_id/grade",
  quizResultsController.gradeQuizResult
);

module.exports = router;
