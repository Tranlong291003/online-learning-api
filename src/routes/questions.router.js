const express = require("express");
const router = express.Router();
const questionController = require("../controllers/questions/questions.controller");
const authMiddleware = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags: [{ name: Questions, description: Câu hỏi trong quiz } ]
 */
router.use(authMiddleware);

/**
 * @swagger
 * /api/questions/{quiz_id}:
 *   get:
 *     summary: Lấy danh sách câu hỏi theo quiz
 *     tags: [Questions]
 *     parameters: [{ in: path, name: quiz_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Thành công } }
 */
router.get("/:quiz_id", questionController.getQuestionsByQuiz);

/**
 * @swagger
 * /api/questions/createbyuser:
 *   post:
 *     summary: Tạo câu hỏi thủ công
 *     tags: [Questions]
 *     responses: { 201: { description: Đã tạo thành công } }
 */
router.post("/createbyuser", questionController.createQuestionManual);

/**
 * @swagger
 * /api/questions/createbyai:
 *   post:
 *     summary: Sinh câu hỏi bằng AI
 *     tags: [Questions]
 *     responses: { 201: { description: Đã tạo thành công } }
 */
router.post("/createbyai", questionController.createQuestionFromAi);

/**
 * @swagger
 * /api/questions/update/{question_id}:
 *   put:
 *     summary: Cập nhật câu hỏi
 *     tags: [Questions]
 *     parameters: [{ in: path, name: question_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Thành công } }
 */
router.put("/update/:question_id", questionController.updateQuestion);

/**
 * @swagger
 * /api/questions/delete/{question_id}:
 *   delete:
 *     summary: Xóa câu hỏi
 *     tags: [Questions]
 *     parameters: [{ in: path, name: question_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Thành công } }
 */
router.delete("/delete/:question_id", questionController.deleteQuestion);

module.exports = router;
