const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");

// Tất cả các route đều cần token.
// Không giới hạn theo role: mọi user đã đăng nhập đều thao tác trên tài nguyên
// của CHÍNH MÌNH, và quy tắc sở hữu đó được kiểm tra trong controller
// (xem src/middleware/actor.js).
router.use(authMiddleware);

const enrollmentsController = require("../controllers/enrollments/enrollments.controller");

router.post("/register", enrollmentsController.enrollCourse);
router.get("/user/:uid", enrollmentsController.getCoursesByUser);
router.delete("/delete/:enrollment_id", enrollmentsController.deleteEnrollment);
router.get("/progress", enrollmentsController.getCourseProgressForUser);
router.get("/check/:uid/:course_id", enrollmentsController.checkEnrollStatus);
module.exports = router;
