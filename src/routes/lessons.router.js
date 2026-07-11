const express = require("express");
const router = express.Router();
const lessonController = require("../controllers/lessons/lessons.controller");
const uploadLessonFiles = require("../config/multer.lesson.config");
const authMiddleware = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags: [{ name: Lessons, description: Bai hoc trong khoa hoc } ]
 */
router.use(authMiddleware);

/**
 * @swagger
 * /api/lessons/courses/{course_id}/{userUid}:
 *   get:
 *     summary: Lay tat ca bai hoc theo khoa hoc
 *     tags: [Lessons]
 *     parameters:
 *       - { in: path, name: course_id, required: true, schema: { type: integer } }
 *       - { in: path, name: userUid, required: true, schema: { type: string } }
 *     responses: { 200: { description: OK } }
 */
router.get("/courses/:course_id/:userUid", lessonController.getAllLessons);

/**
 * @swagger
 * /api/lessons/create:
 *   post:
 *     summary: Tao bai hoc moi (mentor)
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
 *     responses: { 201: { description: Created } }
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
 *     summary: Cap nhat bai hoc
 *     tags: [Lessons]
 *     parameters: [{ in: path, name: lesson_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: OK } }
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
 *     summary: Xoa bai hoc
 *     tags: [Lessons]
 *     parameters: [{ in: path, name: lesson_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: OK } }
 */
router.delete("/delete/:lesson_id", lessonController.deleteLesson);

/**
 * @swagger
 * /api/lessons/complete:
 *   post:
 *     summary: Danh dau hoan thanh bai hoc
 *     tags: [Lessons]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lesson_id]
 *             properties: { lesson_id: { type: integer } }
 *     responses: { 200: { description: OK } }
 */
router.post("/complete", lessonController.completeLesson);

/**
 * @swagger
 * /api/lessons/detail/{lessonId}:
 *   get:
 *     summary: Chi tiet bai hoc
 *     tags: [Lessons]
 *     parameters: [{ in: path, name: lessonId, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: OK } }
 */
router.get("/detail/:lessonId", lessonController.getLessonDetail);

module.exports = router;
