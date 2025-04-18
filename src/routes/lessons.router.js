const express = require("express");
const router = express.Router();
const lessonController = require("../controllers/lessons/lessons.controller");

router.get("/:course_id", lessonController.getAllLessons);
router.post("/", lessonController.createLesson);
router.put("/:lesson_id", lessonController.updateLesson);
router.delete("/:lesson_id", lessonController.deleteLesson);
router.post("/:lesson_id/complete", lessonController.completeLesson);
// router.post("/:lesson_id/complete", lessonsController.completeLesson);

module.exports = router;
