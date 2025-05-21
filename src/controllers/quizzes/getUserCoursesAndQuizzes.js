const { sql, poolPromise } = require("../../config/db.config");

const getUserQuizzesGroupedByEnrollment = async (req, res) => {
  const { user_uid } = req.params;

  if (!user_uid) {
    return res.status(400).json({ error: "Thiếu user_uid" });
  }

  try {
    const pool = await poolPromise;
    const request = new sql.Request(pool);
    request.input("user_uid", sql.NVarChar, user_uid);

    // 1. Lấy danh sách course_id user đã đăng ký và khóa học đó còn tồn tại
    const enrolledCourseIdsResult = await request.query(`
      SELECT e.course_id
      FROM enrollments e
      INNER JOIN courses c ON e.course_id = c.course_id
      WHERE e.user_uid = @user_uid
    `);
    const enrolledCourseIds = enrolledCourseIdsResult.recordset.map(
      (r) => r.course_id
    );

    // 2. Lấy danh sách course_id user chưa đăng ký (các khóa trong courses mà không có trong enrolledCourseIds)
    const notEnrolledCourseIdsResult = await request.query(`
      SELECT course_id FROM courses
      WHERE course_id NOT IN (
        SELECT e.course_id
        FROM enrollments e
        INNER JOIN courses c ON e.course_id = c.course_id
        WHERE e.user_uid = @user_uid
      )
    `);
    const notEnrolledCourseIds = notEnrolledCourseIdsResult.recordset.map(
      (r) => r.course_id
    );

    // 3. Lấy quiz cho các khóa học đã đăng ký
    let enrolledCourses = {};
    if (enrolledCourseIds.length > 0) {
      const request2 = new sql.Request(pool);
      request2.input("courseIds", sql.VarChar, enrolledCourseIds.join(","));

      const quizzesEnrolledResult = await request2.query(`
        SELECT q.quiz_id, q.course_id, q.title, q.description, q.type, q.time_limit, q.attempt_limit, q.creator_uid, q.created_at, q.updated_at,
               c.title as course_title
        FROM quizzes q
        INNER JOIN courses c ON q.course_id = c.course_id
        WHERE q.course_id IN (SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@courseIds, ','))
        ORDER BY q.course_id
      `);

      quizzesEnrolledResult.recordset.forEach((quiz) => {
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
      const request3 = new sql.Request(pool);
      request3.input("courseIds", sql.VarChar, notEnrolledCourseIds.join(","));

      const quizzesNotEnrolledResult = await request3.query(`
        SELECT q.quiz_id, q.course_id, q.title, q.description, q.type, q.time_limit, q.attempt_limit, q.creator_uid, q.created_at, q.updated_at,
               c.title as course_title
        FROM quizzes q
        INNER JOIN courses c ON q.course_id = c.course_id
        WHERE q.course_id IN (SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@courseIds, ','))
        ORDER BY q.course_id
      `);

      quizzesNotEnrolledResult.recordset.forEach((quiz) => {
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

    // 5. Chuyển object thành mảng để trả về
    const enrolledCoursesList = Object.values(enrolledCourses);
    const notEnrolledCoursesList = Object.values(notEnrolledCourses);

    // 6. Trả kết quả
    res.status(200).json({
      message:
        "Danh sách bài kiểm tra phân theo khóa học đã đăng ký và chưa đăng ký",
      data: {
        enrolledCourses: enrolledCoursesList,
        notEnrolledCourses: notEnrolledCoursesList,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: "Lỗi khi lấy dữ liệu: " + err.message,
    });
  }
};

module.exports = getUserQuizzesGroupedByEnrollment;
