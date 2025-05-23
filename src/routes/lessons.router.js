const express = require("express");
const router = express.Router();
const lessonController = require("../controllers/lessons/lessons.controller");
const uploadLessonFiles = require("../config/multer.lesson.config");
const authMiddleware = require("../middleware/auth.middleware");

// Tất cả các route đều cần token
router.use(authMiddleware);

router.get("/courses/:course_id/:userUid", lessonController.getAllLessons);
router.post(
  "/create",
  uploadLessonFiles.fields([
    { name: "pdf", maxCount: 1 },
    { name: "slide", maxCount: 1 },
  ]),
  lessonController.createLesson
);
router.put(
  "/update/:lesson_id",
  uploadLessonFiles.fields([
    { name: "pdf", maxCount: 1 },
    { name: "slide", maxCount: 1 },
  ]),
  lessonController.updateLesson
);
router.delete("/delete/:lesson_id", lessonController.deleteLesson);
router.post("/complete", lessonController.completeLesson);
router.get("/detail/:lessonId", lessonController.getLessonDetail);
// router.post("/:lesson_id/complete", lessonsController.completeLesson);

module.exports = router;
