const express = require("express");
const router = express.Router();
const courseController = require("../controllers/courses/courses.controller");
const uploadCourseThumbnail = require("../config/multer.course.config");

router.get("/", courseController.getAllCourses);
router.get("/mentor/:instructor_uid", courseController.getMentorCourses);
router.get("/:course_id", courseController.getCourseById);
router.put(
  "/update/:course_id",
  uploadCourseThumbnail.single("thumbnail"),
  courseController.updateCourse
);
router.patch("/:course_id/status", courseController.changeCourseStatus);
router.delete("/delete/:course_id", courseController.deleteCourse);
router.post(
  "/create",
  uploadCourseThumbnail.single("thumbnail"),
  courseController.createCourse
);
module.exports = router;
