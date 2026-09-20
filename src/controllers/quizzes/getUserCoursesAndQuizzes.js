const { pool } = require("../../config/db.config");
const { sendServerError } = require("../../utils/errorResponse");
const { resolveActorUid } = require("../../middleware/actor");

const getUserQuizzesGroupedByEnrollment = async (req, res) => {
  // Chỉ được xem quiz theo khóa học đã đăng ký của chính mình
  const user_uid = resolveActorUid(req, res, req.params.user_uid);
  if (!user_uid) return;

  try {
    // 1. Lấy danh sách course_id user đã đăng ký
    const enrolledResult = await pool.query(
      `SELECT e.course_id
       FROM enrollments e
       INNER JOIN courses c ON e.course_id = c.course_id
       WHERE e.user_uid = $1`,
      [user_uid]
    );
    const enrolledCourseIds = enrolledResult.rows.map((r) => r.course_id);

    // 2. Lấy danh sách course_id user chưa đăng ký
    const notEnrolledResult = await pool.query(
      `SELECT course_id FROM courses
       WHERE course_id NOT IN (
         SELECT e.course_id
         FROM enrollments e
         INNER JOIN courses c ON e.course_id = c.course_id
         WHERE e.user_uid = $1
       )`,
      [user_uid]
    );
    const notEnrolledCourseIds = notEnrolledResult.rows.map((r) => r.course_id);

    // 3. Lấy quiz cho các khóa học đã đăng ký
    let enrolledCourses = {};
    if (enrolledCourseIds.length > 0) {
      const quizzesEnrolledResult = await pool.query(
        `SELECT q.quiz_id, q.course_id, q.title, q.description, q.type, q.time_limit, q.attempt_limit, q.creator_uid, q.created_at, q.updated_at,
                c.title as course_title
         FROM quizzes q
         INNER JOIN courses c ON q.course_id = c.course_id
         WHERE q.course_id = ANY($1)
         ORDER BY q.course_id`,
        [enrolledCourseIds]
      );

      quizzesEnrolledResult.rows.forEach((quiz) => {
        if (!enrolledCourses[quiz.course_id]) {
          enrolledCourses[quiz.course_id] = {
            course_id: quiz.course_id,
            course_title: quiz.course_title,
            quizzes: [],
          };
        }
        enrolledCourses[quiz.course_id].quizzes.push({
          quiz_id: quiz.quiz_id,
          title: quiz.title,
          description: quiz.description,
          type: quiz.type,
          time_limit: quiz.time_limit,
          attempt_limit: quiz.attempt_limit,
          creator_uid: quiz.creator_uid,
          created_at: quiz.created_at,
          updated_at: quiz.updated_at,
        });
      });
    }

    // 4. Lấy quiz cho các khóa học chưa đăng ký
    let notEnrolledCourses = {};
    if (notEnrolledCourseIds.length > 0) {
      const quizzesNotEnrolledResult = await pool.query(
        `SELECT q.quiz_id, q.course_id, q.title, q.description, q.type, q.time_limit, q.attempt_limit, q.creator_uid, q.created_at, q.updated_at,
                c.title as course_title
         FROM quizzes q
         INNER JOIN courses c ON q.course_id = c.course_id
         WHERE q.course_id = ANY($1)
         ORDER BY q.course_id`,
        [notEnrolledCourseIds]
      );

      quizzesNotEnrolledResult.rows.forEach((quiz) => {
        if (!notEnrolledCourses[quiz.course_id]) {
          notEnrolledCourses[quiz.course_id] = {
            course_id: quiz.course_id,
            course_title: quiz.course_title,
            quizzes: [],
          };
        }
        notEnrolledCourses[quiz.course_id].quizzes.push({
          quiz_id: quiz.quiz_id,
          title: quiz.title,
          description: quiz.description,
          type: quiz.type,
          time_limit: quiz.time_limit,
          attempt_limit: quiz.attempt_limit,
          creator_uid: quiz.creator_uid,
          created_at: quiz.created_at,
          updated_at: quiz.updated_at,
        });
      });
    }

    // 5. Chuyển object thành mảng
    const enrolledCoursesList = Object.values(enrolledCourses);
    const notEnrolledCoursesList = Object.values(notEnrolledCourses);

    res.status(200).json({
      message:
        "Danh sách bài kiểm tra phân theo khóa học đã đăng ký và chưa đăng ký",
      data: {
        enrolledCourses: enrolledCoursesList,
        notEnrolledCourses: notEnrolledCoursesList,
      },
    });
  } catch (err) {
    sendServerError(res, "Lỗi khi lấy dữ liệu", err);
  }
};

module.exports = getUserQuizzesGroupedByEnrollment;
