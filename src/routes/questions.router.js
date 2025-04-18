const express = require("express");
const router = express.Router();
const questionController = require("../controllers/questions/questions.controller");

router.get("/:quiz_id", questionController.getQuestionsByQuiz);
router.post("/create", questionController.createQuestion);
router.put("/update/:question_id", questionController.updateQuestion);
router.delete("/delete/:question_id", questionController.deleteQuestion);

module.exports = router;
