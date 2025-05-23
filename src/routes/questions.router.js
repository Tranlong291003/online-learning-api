const express = require("express");
const router = express.Router();
const questionController = require("../controllers/questions/questions.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Tất cả các route đều cần token
router.use(authMiddleware);

router.get("/:quiz_id", questionController.getQuestionsByQuiz);
router.post("/createbyuser", questionController.createQuestionManual);
router.post("/createbyai", questionController.createQuestionFromAi);
router.put("/update/:question_id", questionController.updateQuestion);
router.delete("/delete/:question_id", questionController.deleteQuestion);

module.exports = router;
