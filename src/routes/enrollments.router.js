const express = require("express");
const router = express.Router();

const enrollmentsController = require("../controllers/enrollments/enrollments.controller");

router.post("/register", enrollmentsController.enrollCourse);
router.get("/user/:uid", enrollmentsController.getCoursesByUser);
router.delete("/delete/:enrollment_id", enrollmentsController.deleteEnrollment);
router.get("/progress", enrollmentsController.getCourseProgressForUser);
router.get("/check/:uid/:course_id", enrollmentsController.checkEnrollStatus);
module.exports = router;
