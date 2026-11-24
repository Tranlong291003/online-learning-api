/**
 * Hằng số nghiệp vụ dùng chung.
 *
 * Trước đây mỗi controller tự khai báo danh sách giá trị hợp lệ của mình
 * (`VALID_LEVELS` trong createCourse, chuỗi "trac_nghiem"/"tu_luan" rải khắp
 * question/quiz controller...). Hệ quả là thêm một loại mới phải sửa nhiều nơi
 * và rất dễ sót — chỗ nào sót thì API âm thầm nhận giá trị lạ, rồi phần chấm
 * điểm hoặc hiển thị rẽ nhánh sai.
 */

/** Cấp độ khoá học. Khớp với cột courses.level. */
const COURSE_LEVELS = ["beginner", "intermediate", "advanced"];

/** Loại bài kiểm tra. Khớp với cột quizzes.type. */
const QUIZ_TYPES = ["trac_nghiem", "tu_luan"];

/** Trạng thái khoá học. Khớp với cột courses.status. */
const COURSE_STATUSES = ["pending", "approved", "rejected"];

module.exports = { COURSE_LEVELS, QUIZ_TYPES, COURSE_STATUSES };
