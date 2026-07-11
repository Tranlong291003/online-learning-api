const express = require("express");
const router = express.Router();
const mentorRequestController = require("../controllers/mentorRequest.controller");
const authMiddleware = require("../middleware/auth.middleware");
const uploadMentorRequestImage = require("../config/multer.mentorRequest.config");

/**
 * @swagger
 * tags: [{ name: MentorRequests, description: Yêu cầu nâng cấp lên Mentor } ]
 */
router.use(authMiddleware);

/**
 * @swagger
 * /api/mentor-requests:
 *   post:
 *     summary: User gửi yêu cầu nâng cấp (kèm ảnh minh chứng)
 *     tags: [MentorRequests]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               reason: { type: string }
 *               image: { type: string, format: binary }
 *     responses: { 201: { description: Đã tạo thành công } }
 */
router.post(
  "/",
  uploadMentorRequestImage.single("image"),
  mentorRequestController.createRequest
);

/**
 * @swagger
 * /api/mentor-requests/{id}/status:
 *   put:
 *     summary: Admin duyệt/từ chối
 *     tags: [MentorRequests]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Thành công } }
 */
router.put("/:id/status", mentorRequestController.updateStatusRequest);

/**
 * @swagger
 * /api/mentor-requests:
 *   get:
 *     summary: Lấy danh sách yêu cầu (admin)
 *     tags: [MentorRequests]
 *     responses: { 200: { description: Thành công } }
 */
router.get("/", mentorRequestController.getRequests);

module.exports = router;
