const express = require("express");
const router = express.Router();
const quizResultsController = require("../controllers/quizResults/quizResults.controller");
const authMiddleware = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags: [{ name: QuizResults, description: Kết quả nộp bài quiz } ]
 */
router.use(authMiddleware);

/**
 * @swagger
 * /api/quiz-results/submit:
 *   post:
 *     summary: Nộp bài quiz
 *     tags: [QuizResults]
 *     responses: { 201: { description: Đã tạo thành công } }
 */
router.post("/submit", quizResultsController.submitQuizResult);

/**
 * @swagger
 * /api/quiz-results/{result_id}:
 *   get:
 *     summary: Xem chi tiết kết quả theo id
 *     tags: [QuizResults]
 *     parameters: [{ in: path, name: result_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Thành công } }
 */
router.get("/:result_id", quizResultsController.getQuizResultById);

/**
 * @swagger
 * /api/quiz-results/users/{user_uid}/results:
 *   get:
 *     summary: Lấy các kết quả của user
 *     tags: [QuizResults]
 *     parameters: [{ in: path, name: user_uid, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Thành công } }
 */
router.get("/users/:user_uid/results", quizResultsController.getResultsByUser);

/**
 * @swagger
 * /api/quiz-results/quiz-results/{result_id}/grade:
 *   patch:
 *     summary: Chấm bài tự luận
 *     tags: [QuizResults]
 *     parameters: [{ in: path, name: result_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Thành công } }
 */
router.patch(
  "/quiz-results/:result_id/grade",
  quizResultsController.gradeQuizResult
);

module.exports = router;
