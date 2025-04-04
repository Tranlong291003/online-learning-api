const express = require("express");
const router = express.Router();
const controller = require("../controllers/enrollments.controller");

router.post("/", controller.enrollCourse);
router.get("/:id", controller.getProgress);
router.get("/user/:id", controller.getCoursesByUser);
router.delete("/:id", controller.deleteEnrollment);

module.exports = router;
