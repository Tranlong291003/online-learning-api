const express = require("express");
const router = express.Router();
const questionController = require("../controllers/questions/questions.controller");
const authMiddleware = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags: [{ name: Questions, description: Cau hoi trong quiz } ]
 */
router.use(authMiddleware);

/**
 * @swagger
 * /api/questions/{quiz_id}:
 *   get:
 *     summary: Lay danh sach cau hoi theo quiz
 *     tags: [Questions]
 *     parameters: [{ in: path, name: quiz_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: OK } }
 */
router.get("/:quiz_id", questionController.getQuestionsByQuiz);

/**
 * @swagger
 * /api/questions/createbyuser:
 *   post:
 *     summary: Tao cau hoi thu cong
 *     tags: [Questions]
 *     responses: { 201: { description: Created } }
 */
router.post("/createbyuser", questionController.createQuestionManual);

/**
 * @swagger
 * /api/questions/createbyai:
 *   post:
 *     summary: Sinh cau hoi bang AI
 *     tags: [Questions]
 *     responses: { 201: { description: Created } }
 */
router.post("/createbyai", questionController.createQuestionFromAi);

/**
 * @swagger
 * /api/questions/update/{question_id}:
 *   put:
 *     summary: Cap nhat cau hoi
 *     tags: [Questions]
 *     parameters: [{ in: path, name: question_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: OK } }
 */
router.put("/update/:question_id", questionController.updateQuestion);

/**
 * @swagger
 * /api/questions/delete/{question_id}:
 *   delete:
 *     summary: Xoa cau hoi
 *     tags: [Questions]
 *     parameters: [{ in: path, name: question_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: OK } }
 */
router.delete("/delete/:question_id", questionController.deleteQuestion);

module.exports = router;
