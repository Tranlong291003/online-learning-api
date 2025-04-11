const express = require("express");
const router = express.Router();
const quizzesController = require("../controllers/quizzes.controller");

router.get("/courses/:course_id/quizzes", quizzesController.getQuizzesByCourse);
router.post("/quizzes", quizzesController.createQuiz);
router.put("/quizzes/:quiz_id", quizzesController.updateQuiz);
router.delete("/quizzes/:quiz_id", quizzesController.deleteQuiz);

module.exports = router;
