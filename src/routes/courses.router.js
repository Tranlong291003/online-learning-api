const express = require("express");
const router = express.Router();
const courseController = require("../controllers/courses/courses.controller");
const uploadCourseThumbnail = require("../config/multer.course.config");
const authMiddleware = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags: [{ name: Courses, description: Quan ly khoa hoc } ]
 */
router.use(authMiddleware);

/**
 * @swagger
 * /api/courses:
 *   get:
 *     summary: Lay danh sach khoa hoc (co filter)
 *     tags: [Courses]
 *     parameters:
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: category_id, schema: { type: integer } }
 *       - { in: query, name: status, schema: { type: string, enum: [draft, published, archived] } }
 *     responses: { 200: { description: OK } }
 */
router.get("/", courseController.getAllCourses);

/**
 * @swagger
 * /api/courses/mentor/{instructor_uid}:
 *   get:
 *     summary: Lay cac khoa hoc cua 1 mentor
 *     tags: [Courses]
 *     parameters: [{ in: path, name: instructor_uid, required: true, schema: { type: string } }]
 *     responses: { 200: { description: OK } }
 */
router.get("/mentor/:instructor_uid", courseController.getMentorCourses);

/**
 * @swagger
 * /api/courses/{course_id}:
 *   get:
 *     summary: Chi tiet khoa hoc
 *     tags: [Courses]
 *     parameters: [{ in: path, name: course_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: OK } }
 */
router.get("/:course_id", courseController.getCourseById);

/**
 * @swagger
 * /api/courses/update/{course_id}:
 *   put:
 *     summary: Cap nhat khoa hoc
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
 *     responses: { 200: { description: OK } }
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
 *     summary: Doi trang thai khoa hoc (admin/mentor)
 *     tags: [Courses]
 *     parameters: [{ in: path, name: course_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: OK } }
 */
router.patch("/:course_id/status", courseController.changeCourseStatus);

/**
 * @swagger
 * /api/courses/delete/{course_id}:
 *   delete:
 *     summary: Xoa khoa hoc
 *     tags: [Courses]
 *     parameters: [{ in: path, name: course_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: OK } }
 */
router.delete("/delete/:course_id", courseController.deleteCourse);

/**
 * @swagger
 * /api/courses/create:
 *   post:
 *     summary: Tao khoa hoc moi (mentor)
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
 *     responses: { 201: { description: Created } }
 */
router.post(
  "/create",
  uploadCourseThumbnail.single("thumbnail"),
  courseController.createCourse
);

module.exports = router;
