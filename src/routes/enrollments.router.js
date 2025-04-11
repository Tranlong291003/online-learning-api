const express = require("express");
const router = express.Router();
const controller = require("../controllers/enrollments.controller");

router.post("/enrollments", controller.enrollCourse);
router.get("/enrollments/user/:user_id", controller.getCoursesByUser);
router.delete("/enrollments/:enrollment_id", controller.deleteEnrollment);

module.exports = router;
