// 📄 src/routes/lessons.router.js
const express = require("express");
const router = express.Router();
const controller = require("../controllers/lessons.controller");

router.get("/courses/:id/lessons", controller.getAllLessons);
router.post("/lessons", controller.createLesson);
router.put("/lessons/:id", controller.updateLesson);
router.delete("/lessons/:id", controller.deleteLesson);

module.exports = router;
