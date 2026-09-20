const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification/notification.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Tất cả các route đều cần token.
// Không giới hạn theo role: mọi user đã đăng nhập đều thao tác trên tài nguyên
// của CHÍNH MÌNH, và quy tắc sở hữu đó được kiểm tra trong controller
// (xem src/middleware/actor.js).
router.use(authMiddleware);

// Endpoint để tạo thông báo mới
router.post("/create", notificationController.createNotification);

// Endpoint để lấy thông báo của user
router.post("/", notificationController.getNotifications);

// Endpoint để đánh dấu thông báo đã đọc (noti_id nằm trong body)
router.post("/mark-read", notificationController.markAsRead);

// Endpoint để đánh dấu đã đọc theo noti_id trên URL
router.put("/update/:id", notificationController.updateNotification);

// Endpoint để xóa thông báo
router.delete("/delete/:id", notificationController.deleteNotification);

module.exports = router;
