const express = require("express");
const router = express.Router();
const quizzesController = require("../controllers/quizzes/quizzes.controller");

router.get("/getquizbycoures/:course_id", quizzesController.getQuizzesByCourse);
router.post("/create", quizzesController.createQuiz);
router.put("/update/:quiz_id", quizzesController.updateQuiz);
router.delete("/delete/:quiz_id", quizzesController.deleteQuiz);
router.get(
  "/getquizuser/:user_uid",
  quizzesController.getUserCoursesAndQuizzes
);
module.exports = router;
