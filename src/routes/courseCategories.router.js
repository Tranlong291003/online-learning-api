const express = require("express");
const router = express.Router();
const uploadCategoryIcon = require("../config/multer.category.config");
const courseCategoryController = require("../controllers/courseCategories/courseCategories.controller");
const authMiddleware = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags: [{ name: CourseCategories, description: Danh muc khoa hoc } ]
 */
router.use(authMiddleware);

/**
 * @swagger
 * /api/course-categories:
 *   get:
 *     summary: Lay tat ca danh muc
 *     tags: [CourseCategories]
 *     responses: { 200: { description: OK } }
 */
router.get("/", courseCategoryController.getAllCategories);

/**
 * @swagger
 * /api/course-categories/create:
 *   post:
 *     summary: Tao danh muc moi
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
 *     responses: { 201: { description: Created } }
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
 *     summary: Cap nhat danh muc
 *     tags: [CourseCategories]
 *     parameters: [{ in: path, name: category_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: OK } }
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
 *     summary: Xoa danh muc
 *     tags: [CourseCategories]
 *     parameters: [{ in: path, name: category_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: OK } }
 */
router.delete("/delete/:category_id", courseCategoryController.deleteCategory);

module.exports = router;
