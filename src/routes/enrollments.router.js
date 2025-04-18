const express = require("express");
const router = express.Router();

const enrollmentsController = require("../controllers/enrollments/enrollments.controller");

router.post("/register", enrollmentsController.enrollCourse);
router.get("/user/:user_id", enrollmentsController.getCoursesByUser);
router.delete("/delete/:enrollment_id", enrollmentsController.deleteEnrollment);
router.get(
  "/progress/:user_id/:course_id",
  enrollmentsController.getCourseProgressForUser
);
module.exports = router;
