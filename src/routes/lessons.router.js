const express = require("express");
const router = express.Router();
const lessonController = require("../controllers/lessons/lessons.controller");
const uploadLessonFiles = require("../config/multer.lesson.config");

router.get("/:course_id", lessonController.getAllLessons);
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
router.post("/:lesson_id/complete", lessonController.completeLesson);
// router.post("/:lesson_id/complete", lessonsController.completeLesson);

module.exports = router;
