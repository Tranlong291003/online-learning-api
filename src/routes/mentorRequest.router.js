const express = require("express");
const router = express.Router();
const mentorRequestController = require("../controllers/mentorRequest.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/authorize.middleware");
const uploadMentorRequestImage = require("../config/multer.mentorRequest.config");

// Tất cả các route đều cần token
router.use(authMiddleware);

// User gửi yêu cầu nâng cấp (gửi kèm file ảnh minh chứng)
router.post(
  "/",
  uploadMentorRequestImage.single("image"),
  mentorRequestController.createRequest
);

// Admin duyệt hoặc từ chối yêu cầu (yêu cầu đăng nhập)
router.put(
  "/:id/status",
  authorize("admin"),
  mentorRequestController.updateStatusRequest
);

// Lấy danh sách yêu cầu nâng cấp
router.get("/", authorize("admin"), mentorRequestController.getRequests);

module.exports = router;
