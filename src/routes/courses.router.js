const express = require("express");
const router = express.Router();
const courseController = require("../controllers/courses/courses.controller");
const uploadCourseThumbnail = require("../config/multer.course.config");
const authMiddleware = require("../middleware/auth.middleware");
const { authorize } = require("../middleware/authorize.middleware");

// Tất cả các route đều cần token
router.use(authMiddleware);

// Đọc: mọi user đã đăng nhập.
router.get("/", courseController.getAllCourses);
router.get("/mentor/:instructor_uid", courseController.getMentorCourses);

// Ghi: chỉ admin và mentor. Các quy tắc phụ thuộc dữ liệu (mentor chỉ sửa được
// khóa học của chính mình, chỉ admin được duyệt) nằm trong controller.
router.post(
  "/create",
  authorize("admin", "mentor", { message: "Bạn không có quyền tạo khóa học" }),
  uploadCourseThumbnail.single("thumbnail"),
  courseController.createCourse
);

router.put(
  "/update/:course_id",
  authorize("admin", "mentor", { message: "Bạn không có quyền sửa khóa học" }),
  uploadCourseThumbnail.single("thumbnail"),
  courseController.updateCourse
);

// Duyệt / từ chối (admin) hoặc gửi lại chờ duyệt (mentor) — controller phân biệt.
router.patch(
  "/:course_id/status",
  authorize("admin", "mentor", {
    message: "Bạn không có quyền cập nhật trạng thái khóa học",
  }),
  courseController.changeCourseStatus
);

router.delete(
  "/delete/:course_id",
  authorize("admin", "mentor", { message: "Bạn không có quyền xóa khóa học" }),
  courseController.deleteCourse
);

// Đặt sau cùng: các path tĩnh ở trên phải được khớp trước, nếu không
// "/create" và "/mentor/:uid" sẽ bị route này nuốt mất.
router.get("/:course_id", courseController.getCourseById);

module.exports = router;
