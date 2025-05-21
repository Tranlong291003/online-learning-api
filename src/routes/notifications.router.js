const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification/notification.controller");

// Endpoint để tạo thông báo mới
router.post("/create", notificationController.createNotification);

// Endpoint để lấy thông báo của user
router.post("/", notificationController.getNotifications);

// Endpoint để đánh dấu thông báo đã đọc
router.post("/mark-read", notificationController.markAsRead);

// Endpoint để xóa thông báo
router.delete("/delete/:id", notificationController.deleteNotification);

module.exports = router;
