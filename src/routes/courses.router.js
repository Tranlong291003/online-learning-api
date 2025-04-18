const express = require("express");
const router = express.Router();
const courseController = require("../controllers/courses/courses.controller");

router.get("/", courseController.getAllCourses);
router.get("/:course_id", courseController.getCourseById);
router.post("/", courseController.createCourse);
router.put("/:course_id", courseController.updateCourse);
router.patch("/:course_id/status", courseController.changeCourseStatus);
router.delete("/:course_id", courseController.deleteCourse);

module.exports = router;
