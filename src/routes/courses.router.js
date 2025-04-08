const express = require("express");
const router = express.Router();
const courseController = require("../controllers/courses.controller");

router.get("/courses", courseController.getAllCourses);
router.get("/courses/:course_id", courseController.getCourseById);
router.post("/courses", courseController.createCourse);
router.put("/courses/:course_id", courseController.updateCourse);
router.patch("/courses/:course_id/status", courseController.changeCourseStatus);
router.delete("/courses/:course_id", courseController.deleteCourse);

module.exports = router;
