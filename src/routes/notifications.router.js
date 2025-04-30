const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification/notification.controller");

// Endpoint để tạo thông báo mới
router.post("/create", notificationController.createNotification);

// Endpoint để lấy thông báo mới nhất của người dùng
router.get("/", notificationController.getNotifications); // Lấy thông báo mới nhất

// Endpoint để cập nhật trạng thái thông báo
router.put("/update/:id", notificationController.updateNotification); // Sử dụng noti_id ở đây

// Endpoint để xóa thông báo
router.delete("/delete/:id", notificationController.deleteNotification); // Sử dụng noti_id ở đây

module.exports = router;
