const express = require("express");
const router = express.Router();
const quizzesController = require("../controllers/quizzes/quizzes.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/authorize.middleware");

// Tất cả các route đều cần token
router.use(authMiddleware);

router.get("/getquizbycourse/:course_id", quizzesController.getQuizzesByCourse);
// Alias tương thích ngược cho FE cũ đang gọi sai chính tả. Sẽ bỏ ở phiên bản sau.
router.get("/getquizbycoures/:course_id", quizzesController.getQuizzesByCourse);
router.post(
  "/create",
  authorize("admin", "mentor", { message: "Bạn không có quyền tạo bài kiểm tra" }),
  quizzesController.createQuiz
);
router.put(
  "/update/:quiz_id",
  authorize("admin", "mentor", { message: "Bạn không có quyền sửa bài kiểm tra này" }),
  quizzesController.updateQuiz
);
router.delete(
  "/delete/:quiz_id",
  authorize("admin", "mentor", { message: "Bạn không có quyền xoá bài kiểm tra này" }),
  quizzesController.deleteQuiz
);
router.get(
  "/getquizuser/:user_uid",
  quizzesController.getUserCoursesAndQuizzes
);

module.exports = router;
