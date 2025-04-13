const express = require("express");
const router = express.Router();
const controller = require("../controllers/enrollments/enrollments.controller");

router.post("/enrollments", controller.enrollCourse);
router.get("/enrollments/user/:user_id", controller.getCoursesByUser);
router.delete("/enrollments/:enrollment_id", controller.deleteEnrollment);
router.get(
  "/progress/:user_id/:course_id",
  controller.getCourseProgressForUser
);
module.exports = router;
