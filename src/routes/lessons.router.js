const express = require("express");
const router = express.Router();
const lessonController = require("../controllers/lessons/lessons.controller");
const uploadLessonFiles = require("../config/multer.lesson.config");
const authMiddleware = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/authorize.middleware");

// Tất cả các route đều cần token
router.use(authMiddleware);

// Đọc: mọi user đã đăng nhập (học viên phải xem được bài học của khóa đã đăng ký).
router.get("/courses/:course_id/:userUid", lessonController.getAllLessons);
router.get("/detail/:lessonId", lessonController.getLessonDetail);

// Ghi: admin/mentor. Controller kiểm tra thêm quyền sở hữu khóa học/bài học.
router.post(
  "/create",
  authorize("admin", "mentor", { message: "Bạn không có quyền tạo bài học" }),
  uploadLessonFiles.fields([
    { name: "pdf", maxCount: 1 },
    { name: "slide", maxCount: 1 },
  ]),
  lessonController.createLesson
);

router.put(
  "/update/:lesson_id",
  authorize("admin", "mentor", { message: "Bạn không có quyền cập nhật bài học" }),
  uploadLessonFiles.fields([
    { name: "pdf", maxCount: 1 },
    { name: "slide", maxCount: 1 },
  ]),
  lessonController.updateLesson
);

router.delete(
  "/delete/:lesson_id",
  authorize("admin", "mentor", { message: "Bạn không có quyền xóa bài học" }),
  lessonController.deleteLesson
);

// Mọi user đã đăng nhập đều đánh dấu hoàn thành bài học cho chính mình.
router.post("/complete", lessonController.completeLesson);

module.exports = router;
