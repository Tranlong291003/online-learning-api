const express = require("express");
const router = express.Router();
const uploadCategoryIcon = require("../config/multer.category.config");
const courseCategoryController = require("../controllers/courseCategories/courseCategories.controller");
const authMiddleware = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags: [{ name: CourseCategories, description: Danh mục khóa học } ]
 */
router.use(authMiddleware);

/**
 * @swagger
 * /api/course-categories:
 *   get:
 *     summary: Lấy tất cả danh mục
 *     tags: [CourseCategories]
 *     responses: { 200: { description: Thành công } }
 */
router.get("/", courseCategoryController.getAllCategories);

/**
 * @swagger
 * /api/course-categories/create:
 *   post:
 *     summary: Tạo danh mục mới
 *     tags: [CourseCategories]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               icon: { type: string, format: binary }
 *     responses: { 201: { description: Đã tạo thành công } }
 */
router.post(
  "/create",
  uploadCategoryIcon.single("icon"),
  courseCategoryController.createCategory
);

/**
 * @swagger
 * /api/course-categories/update/{category_id}:
 *   put:
 *     summary: Cập nhật danh mục
 *     tags: [CourseCategories]
 *     parameters: [{ in: path, name: category_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Thành công } }
 */
router.put(
  "/update/:category_id",
  uploadCategoryIcon.single("icon"),
  courseCategoryController.updateCategory
);

/**
 * @swagger
 * /api/course-categories/delete/{category_id}:
 *   delete:
 *     summary: Xóa danh mục
 *     tags: [CourseCategories]
 *     parameters: [{ in: path, name: category_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Thành công } }
 */
router.delete("/delete/:category_id", courseCategoryController.deleteCategory);

module.exports = router;
