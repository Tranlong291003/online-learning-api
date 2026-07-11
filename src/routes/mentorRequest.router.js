const express = require("express");
const router = express.Router();
const mentorRequestController = require("../controllers/mentorRequest.controller");
const authMiddleware = require("../middleware/auth.middleware");
const uploadMentorRequestImage = require("../config/multer.mentorRequest.config");

/**
 * @swagger
 * tags: [{ name: MentorRequests, description: Yeu cau nang cap len Mentor } ]
 */
router.use(authMiddleware);

/**
 * @swagger
 * /api/mentor-requests:
 *   post:
 *     summary: User gui yeu cau nang cap (kem anh minh chung)
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
 *     responses: { 201: { description: Created } }
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
 *     summary: Admin duyet/tu choi
 *     tags: [MentorRequests]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: OK } }
 */
router.put("/:id/status", mentorRequestController.updateStatusRequest);

/**
 * @swagger
 * /api/mentor-requests:
 *   get:
 *     summary: Lay danh sach yeu cau (admin)
 *     tags: [MentorRequests]
 *     responses: { 200: { description: OK } }
 */
router.get("/", mentorRequestController.getRequests);

module.exports = router;
