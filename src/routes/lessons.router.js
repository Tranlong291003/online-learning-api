const express = require("express");
const router = express.Router();
const lessonController = require("../controllers/lessons/lessons.controller");
const uploadLessonFiles = require("../config/multer.lesson.config");
const authMiddleware = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags: [{ name: Lessons, description: Bài học trong khóa học } ]
 */
router.use(authMiddleware);

/**
 * @swagger
 * /api/lessons/courses/{course_id}/{userUid}:
 *   get:
 *     summary: Lấy tất cả bài học theo khóa học
 *     tags: [Lessons]
 *     parameters:
 *       - { in: path, name: course_id, required: true, schema: { type: integer } }
 *       - { in: path, name: userUid, required: true, schema: { type: string } }
 *     responses: { 200: { description: Thành công } }
 */
router.get("/courses/:course_id/:userUid", lessonController.getAllLessons);

/**
 * @swagger
 * /api/lessons/create:
 *   post:
 *     summary: Tạo bài học mới (mentor)
 *     tags: [Lessons]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [course_id, title]
 *             properties:
 *               course_id: { type: integer }
 *               title: { type: string }
 *               youtube_url: { type: string }
 *               pdf: { type: string, format: binary }
 *               slide: { type: string, format: binary }
 *     responses: { 201: { description: Đã tạo thành công } }
 */
router.post(
  "/create",
  uploadLessonFiles.fields([
    { name: "pdf", maxCount: 1 },
    { name: "slide", maxCount: 1 },
  ]),
  lessonController.createLesson
);

/**
 * @swagger
 * /api/lessons/update/{lesson_id}:
 *   put:
 *     summary: Cập nhật bài học
 *     tags: [Lessons]
 *     parameters: [{ in: path, name: lesson_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Thành công } }
 */
router.put(
  "/update/:lesson_id",
  uploadLessonFiles.fields([
    { name: "pdf", maxCount: 1 },
    { name: "slide", maxCount: 1 },
  ]),
  lessonController.updateLesson
);

/**
 * @swagger
 * /api/lessons/delete/{lesson_id}:
 *   delete:
 *     summary: Xóa bài học
 *     tags: [Lessons]
 *     parameters: [{ in: path, name: lesson_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Thành công } }
 */
router.delete("/delete/:lesson_id", lessonController.deleteLesson);

/**
 * @swagger
 * /api/lessons/complete:
 *   post:
 *     summary: Đánh dấu hoàn thành bài học
 *     tags: [Lessons]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lesson_id]
 *             properties: { lesson_id: { type: integer } }
 *     responses: { 200: { description: Thành công } }
 */
router.post("/complete", lessonController.completeLesson);

/**
 * @swagger
 * /api/lessons/detail/{lessonId}:
 *   get:
 *     summary: Chi tiết bài học
 *     tags: [Lessons]
 *     parameters: [{ in: path, name: lessonId, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Thành công } }
 */
router.get("/detail/:lessonId", lessonController.getLessonDetail);

module.exports = router;
