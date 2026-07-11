const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification/notification.controller");
const authMiddleware = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags: [{ name: Notifications, description: Thông báo cho user } ]
 */
router.use(authMiddleware);

/**
 * @swagger
 * /api/notifications/create:
 *   post:
 *     summary: Tạo thông báo (admin)
 *     tags: [Notifications]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [uid, title, content]
 *             properties:
 *               uid: { type: string }
 *               title: { type: string }
 *               content: { type: string }
 *               icon: { type: string }
 *               color: { type: string }
 *     responses: { 201: { description: Đã tạo thành công } }
 */
router.post("/create", notificationController.createNotification);

/**
 * @swagger
 * /api/notifications:
 *   post:
 *     summary: Lấy thông báo của user hiện tại
 *     tags: [Notifications]
 *     responses: { 200: { description: Thành công } }
 */
router.post("/", notificationController.getNotifications);

/**
 * @swagger
 * /api/notifications/mark-read:
 *   post:
 *     summary: Đánh dấu đã đọc
 *     tags: [Notifications]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [noti_id]
 *             properties: { noti_id: { type: string, format: uuid } }
 *     responses: { 200: { description: Thành công } }
 */
router.post("/mark-read", notificationController.markAsRead);

/**
 * @swagger
 * /api/notifications/delete/{id}:
 *   delete:
 *     summary: Xóa thông báo
 *     tags: [Notifications]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Thành công } }
 */
router.delete("/delete/:id", notificationController.deleteNotification);

module.exports = router;
