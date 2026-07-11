const express = require("express");
const router = express.Router();
const enrollmentsController = require("../controllers/enrollments/enrollments.controller");
const authMiddleware = require("../middleware/auth.middleware");

/**
 * @swagger
 * tags: [{ name: Enrollments, description: Dang ky khoa hoc va tien do } ]
 */
router.use(authMiddleware);

/**
 * @swagger
 * /api/enrollments/register:
 *   post:
 *     summary: Dang ky mot khoa hoc
 *     tags: [Enrollments]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [course_id]
 *             properties: { course_id: { type: integer } }
 *     responses: { 201: { description: Created } }
 */
router.post("/register", enrollmentsController.enrollCourse);

/**
 * @swagger
 * /api/enrollments/user/{uid}:
 *   get:
 *     summary: Lay cac khoa hoc da dang ky
 *     tags: [Enrollments]
 *     parameters: [{ in: path, name: uid, required: true, schema: { type: string } }]
 *     responses: { 200: { description: OK } }
 */
router.get("/user/:uid", enrollmentsController.getCoursesByUser);

/**
 * @swagger
 * /api/enrollments/delete/{enrollment_id}:
 *   delete:
 *     summary: Huy dang ky
 *     tags: [Enrollments]
 *     parameters: [{ in: path, name: enrollment_id, required: true, schema: { type: integer } }]
 *     responses: { 200: { description: OK } }
 */
router.delete("/delete/:enrollment_id", enrollmentsController.deleteEnrollment);

/**
 * @swagger
 * /api/enrollments/progress:
 *   get:
 *     summary: Lay tien do khoa hoc cua user
 *     tags: [Enrollments]
 *     parameters:
 *       - { in: query, name: user_uid, schema: { type: string } }
 *       - { in: query, name: course_id, schema: { type: integer } }
 *     responses: { 200: { description: OK } }
 */
router.get("/progress", enrollmentsController.getCourseProgressForUser);

/**
 * @swagger
 * /api/enrollments/check/{uid}/{course_id}:
 *   get:
 *     summary: Kiem tra user da dang ky khoa hoc chua
 *     tags: [Enrollments]
 *     parameters:
 *       - { in: path, name: uid, required: true, schema: { type: string } }
 *       - { in: path, name: course_id, required: true, schema: { type: integer } }
 *     responses: { 200: { description: OK } }
 */
router.get("/check/:uid/:course_id", enrollmentsController.checkEnrollStatus);

module.exports = router;
