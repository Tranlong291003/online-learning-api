const express = require("express");
const router = express.Router();
const lessonController = require("../controllers/lessons.controller");

router.get("/courses/:course_id/lessons", lessonController.getAllLessons);
router.post("/lessons", lessonController.createLesson);
router.put("/lessons/:lesson_id", lessonController.updateLesson);
router.delete("/lessons/:lesson_id", lessonController.deleteLesson);
router.post("/lessons/:lesson_id/complete", lessonController.completeLesson);
// router.post("/:lesson_id/complete", lessonsController.completeLesson);

module.exports = router;
