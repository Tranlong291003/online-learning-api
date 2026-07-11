const express = require("express");
const router = express.Router();
const quizzesController = require("../controllers/quizzes/quizzes.controller");
const authMiddleware = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags: [{ name: Quizzes, description: Bai kiem tra (trac nghiem + tu luan) } ]
 */
router.use(authMiddleware);

/**
 * @swagger
 * /api/quizzes/getquizbycoures/{course_id}:
 *   get:
 *     summary: Lay quiz theo khoa hoc
 *     tags: [Quizzes]
 *     parameters: [{ in: path, name: course_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: OK } }
 */
router.get("/getquizbycoures/:course_id", quizzesController.getQuizzesByCourse);

/**
 * @swagger
 * /api/quizzes/create:
 *   post:
 *     summary: Tao quiz moi
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
 *     responses: { 201: { description: Created } }
 */
router.post("/create", quizzesController.createQuiz);

/**
 * @swagger
 * /api/quizzes/update/{quiz_id}:
 *   put:
 *     summary: Cap nhat quiz
 *     tags: [Quizzes]
 *     parameters: [{ in: path, name: quiz_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: OK } }
 */
router.put("/update/:quiz_id", quizzesController.updateQuiz);

/**
 * @swagger
 * /api/quizzes/delete/{quiz_id}:
 *   delete:
 *     summary: Xoa quiz
 *     tags: [Quizzes]
 *     parameters: [{ in: path, name: quiz_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: OK } }
 */
router.delete("/delete/:quiz_id", quizzesController.deleteQuiz);

/**
 * @swagger
 * /api/quizzes/getquizuser/{user_uid}:
 *   get:
 *     summary: Lay quiz trong cac khoa hoc user da dang ky
 *     tags: [Quizzes]
 *     parameters: [{ in: path, name: user_uid, required: true, schema: { type: string } }]
 *     responses: { 200: { description: OK } }
 */
router.get("/getquizuser/:user_uid", quizzesController.getUserCoursesAndQuizzes);

module.exports = router;
