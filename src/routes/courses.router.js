const express = require("express");
const router = express.Router();
const controller = require("../controllers/courses.controller");

router.get("/", controller.getAllCourses);
router.get("/:id", controller.getCourseById);
router.post("/", controller.createCourse);
router.put("/:id", controller.updateCourse);
router.patch("/:id/status", controller.changeCourseStatus);
router.delete("/:id", controller.deleteCourse);

module.exports = router;
