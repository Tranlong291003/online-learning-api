const express = require("express");
const router = express.Router();
const bokkmarksController = require("../controllers/bookmarks/bookmark.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Tất cả các route đều cần token
router.use(authMiddleware);

// Lấy danh sách bookmark của người dùng
router.get("/:user_uid", bokkmarksController.getBookmarksByUser);
// Tạo bookmark mới
router.post("/create", bokkmarksController.createBookmark);
// Xóa bookmark
router.delete("/delete", bokkmarksController.deleteBookmark);

module.exports = router;
