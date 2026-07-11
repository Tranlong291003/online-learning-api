const express = require("express");
const router = express.Router();
const quizzesController = require("../controllers/quizzes/quizzes.controller");
const authMiddleware = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags: [{ name: Quizzes, description: Bài kiểm tra (trắc nghiệm + tự luận) } ]
 */
router.use(authMiddleware);

/**
 * @swagger
 * /api/quizzes/getquizbycoures/{course_id}:
 *   get:
 *     summary: Lấy quiz theo khóa học
 *     tags: [Quizzes]
 *     parameters: [{ in: path, name: course_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Thành công } }
 */
router.get("/getquizbycoures/:course_id", quizzesController.getQuizzesByCourse);

/**
 * @swagger
 * /api/quizzes/create:
 *   post:
 *     summary: Tạo quiz mới
 *     tags: [Quizzes]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [course_id, title, type]
 *             properties:
 *               course_id: { type: integer }
 *               title: { type: string }
 *               description: { type: string }
 *               type: { type: string, enum: [trac_nghiem, tu_luan] }
 *               time_limit: { type: integer }
 *               attempt_limit: { type: integer }
 *     responses: { 201: { description: Đã tạo thành công } }
 */
router.post("/create", quizzesController.createQuiz);

/**
 * @swagger
 * /api/quizzes/update/{quiz_id}:
 *   put:
 *     summary: Cập nhật quiz
 *     tags: [Quizzes]
 *     parameters: [{ in: path, name: quiz_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Thành công } }
 */
router.put("/update/:quiz_id", quizzesController.updateQuiz);

/**
 * @swagger
 * /api/quizzes/delete/{quiz_id}:
 *   delete:
 *     summary: Xóa quiz
 *     tags: [Quizzes]
 *     parameters: [{ in: path, name: quiz_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Thành công } }
 */
router.delete("/delete/:quiz_id", quizzesController.deleteQuiz);

/**
 * @swagger
 * /api/quizzes/getquizuser/{user_uid}:
 *   get:
 *     summary: Lấy quiz trong các khóa học user đã đăng ký
 *     tags: [Quizzes]
 *     parameters: [{ in: path, name: user_uid, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Thành công } }
 */
router.get("/getquizuser/:user_uid", quizzesController.getUserCoursesAndQuizzes);

module.exports = router;
