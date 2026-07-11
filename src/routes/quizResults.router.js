const express = require("express");
const router = express.Router();
const quizResultsController = require("../controllers/quizResults/quizResults.controller");
const authMiddleware = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags: [{ name: QuizResults, description: Ket qua nop bai quiz } ]
 */
router.use(authMiddleware);

/**
 * @swagger
 * /api/quiz-results/submit:
 *   post:
 *     summary: Nop bai quiz
 *     tags: [QuizResults]
 *     responses: { 201: { description: Created } }
 */
router.post("/submit", quizResultsController.submitQuizResult);

/**
 * @swagger
 * /api/quiz-results/{result_id}:
 *   get:
 *     summary: Xem chi tiet ket qua theo id
 *     tags: [QuizResults]
 *     parameters: [{ in: path, name: result_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: OK } }
 */
router.get("/:result_id", quizResultsController.getQuizResultById);

/**
 * @swagger
 * /api/quiz-results/users/{user_uid}/results:
 *   get:
 *     summary: Lay cac ket qua cua user
 *     tags: [QuizResults]
 *     parameters: [{ in: path, name: user_uid, required: true, schema: { type: string } }]
 *     responses: { 200: { description: OK } }
 */
router.get("/users/:user_uid/results", quizResultsController.getResultsByUser);

/**
 * @swagger
 * /api/quiz-results/quiz-results/{result_id}/grade:
 *   patch:
 *     summary: Cham bai tu luan
 *     tags: [QuizResults]
 *     parameters: [{ in: path, name: result_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: OK } }
 */
router.patch(
  "/quiz-results/:result_id/grade",
  quizResultsController.gradeQuizResult
);

module.exports = router;
