const express = require("express");
const router = express.Router();
const uploadCategoryIcon = require("../config/multer.category.config");
const courseCategoryController = require("../controllers/courseCategories/courseCategories.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Tất cả các route đều cần token
router.use(authMiddleware);

router.get("/", courseCategoryController.getAllCategories);

router.post(
  "/create",
  uploadCategoryIcon.single("icon"),
  courseCategoryController.createCategory
);

router.put(
  "/update/:category_id",
  uploadCategoryIcon.single("icon"),
  courseCategoryController.updateCategory
);

router.delete("/delete/:category_id", courseCategoryController.deleteCategory);

module.exports = router;
