const express = require("express");
const router = express.Router();
const questionController = require("../controllers/questions/questions.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/authorize.middleware");

// Tất cả các route đều cần token
router.use(authMiddleware);

router.get("/:quiz_id", questionController.getQuestionsByQuiz);
router.post(
  "/createbyuser",
  authorize("admin", "mentor", { message: "Bạn không có quyền tạo câu hỏi" }),
  questionController.createQuestionManual
);
router.post(
  "/createbyai",
  authorize("admin", "mentor", { message: "Bạn không có quyền tạo câu hỏi AI" }),
  questionController.createQuestionFromAi
);
router.put(
  "/update/:question_id",
  authorize("admin", "mentor", { message: "Bạn không có quyền cập nhật câu hỏi" }),
  questionController.updateQuestion
);
router.delete(
  "/delete/:question_id",
  authorize("admin", "mentor", { message: "Bạn không có quyền xóa câu hỏi" }),
  questionController.deleteQuestion
);

module.exports = router;
