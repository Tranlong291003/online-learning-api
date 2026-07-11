const express = require("express");
const router = express.Router();
const courseController = require("../controllers/courses/courses.controller");
const uploadCourseThumbnail = require("../config/multer.course.config");
const authMiddleware = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags: [{ name: Courses, description: Quản lý khóa học } ]
 */
router.use(authMiddleware);

/**
 * @swagger
 * /api/courses:
 *   get:
 *     summary: Lấy danh sách khóa học (có filter)
 *     tags: [Courses]
 *     parameters:
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: category_id, schema: { type: integer } }
 *       - { in: query, name: status, schema: { type: string, enum: [pending, approved, rejected] } }
 *     responses: { 200: { description: Thành công } }
 */
router.get("/", courseController.getAllCourses);

/**
 * @swagger
 * /api/courses/mentor/{instructor_uid}:
 *   get:
 *     summary: Lấy các khóa học của 1 mentor
 *     tags: [Courses]
 *     parameters: [{ in: path, name: instructor_uid, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Thành công } }
 */
router.get("/mentor/:instructor_uid", courseController.getMentorCourses);

/**
 * @swagger
 * /api/courses/{course_id}:
 *   get:
 *     summary: Chi tiết khóa học
 *     tags: [Courses]
 *     parameters: [{ in: path, name: course_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Thành công } }
 */
router.get("/:course_id", courseController.getCourseById);

/**
 * @swagger
 * /api/courses/update/{course_id}:
 *   put:
 *     summary: Cập nhật khóa học
 *     tags: [Courses]
 *     parameters: [{ in: path, name: course_id, required: true, schema: { type: integer } }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               price: { type: number }
 *               thumbnail: { type: string, format: binary }
 *     responses: { 200: { description: Thành công } }
 */
router.put(
  "/update/:course_id",
  uploadCourseThumbnail.single("thumbnail"),
  courseController.updateCourse
);

/**
 * @swagger
 * /api/courses/{course_id}/status:
 *   patch:
 *     summary: Đổi trạng thái khóa học (admin/mentor)
 *     tags: [Courses]
 *     parameters: [{ in: path, name: course_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Thành công } }
 */
router.patch("/:course_id/status", courseController.changeCourseStatus);

/**
 * @swagger
 * /api/courses/delete/{course_id}:
 *   delete:
 *     summary: Xóa khóa học
 *     tags: [Courses]
 *     parameters: [{ in: path, name: course_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Thành công } }
 */
router.delete("/delete/:course_id", courseController.deleteCourse);

/**
 * @swagger
 * /api/courses/create:
 *   post:
 *     summary: Tạo khóa học mới (mentor)
 *     tags: [Courses]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, category_id]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               category_id: { type: integer }
 *               price: { type: number }
 *               thumbnail: { type: string, format: binary }
 *     responses: { 201: { description: Đã tạo thành công } }
 */
router.post(
  "/create",
  uploadCourseThumbnail.single("thumbnail"),
  courseController.createCourse
);

module.exports = router;
