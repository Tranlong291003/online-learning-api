const express = require("express");
const router = express.Router();
const uploadCategoryIcon = require("../config/multer.category.config");
const courseCategoryController = require("../controllers/courseCategories/courseCategories.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/authorize.middleware");

// Tất cả các route đều cần token
router.use(authMiddleware);

router.get("/", courseCategoryController.getAllCategories);

router.post(
  "/create",
  authorize("admin", "mentor", { message: "Bạn không có quyền tạo danh mục" }),
  uploadCategoryIcon.single("icon"),
  courseCategoryController.createCategory
);

router.put(
  "/update/:category_id",
  authorize("admin", "mentor", { message: "Bạn không có quyền thay đổi danh mục" }),
  uploadCategoryIcon.single("icon"),
  courseCategoryController.updateCategory
);

router.delete(
  "/delete/:category_id",
  authorize("admin", "mentor", { message: "Bạn không có quyền xóa danh mục" }),
  courseCategoryController.deleteCategory
);

module.exports = router;
