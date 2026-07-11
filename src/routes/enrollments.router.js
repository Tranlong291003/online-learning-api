const express = require("express");
const router = express.Router();
const enrollmentsController = require("../controllers/enrollments/enrollments.controller");
const authMiddleware = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags: [{ name: Enrollments, description: Đăng ký khóa học và tiến độ học tập } ]
 */
router.use(authMiddleware);

/**
 * @swagger
 * /api/enrollments/register:
 *   post:
 *     summary: Đăng ký một khóa học
 *     tags: [Enrollments]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [course_id]
 *             properties: { course_id: { type: integer } }
 *     responses: { 201: { description: Đã đăng ký thành công } }
 */
router.post("/register", enrollmentsController.enrollCourse);

/**
 * @swagger
 * /api/enrollments/user/{uid}:
 *   get:
 *     summary: Lấy các khóa học đã đăng ký
 *     tags: [Enrollments]
 *     parameters: [{ in: path, name: uid, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Thành công } }
 */
router.get("/user/:uid", enrollmentsController.getCoursesByUser);

/**
 * @swagger
 * /api/enrollments/delete/{enrollment_id}:
 *   delete:
 *     summary: Hủy đăng ký khóa học
 *     tags: [Enrollments]
 *     parameters: [{ in: path, name: enrollment_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: Thành công } }
 */
router.delete("/delete/:enrollment_id", enrollmentsController.deleteEnrollment);

/**
 * @swagger
 * /api/enrollments/progress:
 *   get:
 *     summary: Lấy tiến độ khóa học của user
 *     tags: [Enrollments]
 *     parameters:
 *       - { in: query, name: user_uid, schema: { type: string } }
 *       - { in: query, name: course_id, schema: { type: integer } }
 *     responses: { 200: { description: Thành công } }
 */
router.get("/progress", enrollmentsController.getCourseProgressForUser);

/**
 * @swagger
 * /api/enrollments/check/{uid}/{course_id}:
 *   get:
 *     summary: Kiểm tra user đã đăng ký khóa học chưa
 *     tags: [Enrollments]
 *     parameters:
 *       - { in: path, name: uid, required: true, schema: { type: string } }
 *       - { in: path, name: course_id, required: true, schema: { type: integer } }
 *     responses: { 200: { description: Thành công } }
 */
router.get("/check/:uid/:course_id", enrollmentsController.checkEnrollStatus);

module.exports = router;
