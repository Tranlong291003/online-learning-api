// controllers/enrollCourse.js
const { sql, poolPromise } = require("../../config/db.config");
const { sendNotification } = require("../../services/notificationService"); // Import service gửi FCM

const enrollCourse = async (req, res) => {
  const { userUid, courseId } = req.body; // Dùng userUid và courseId thay vì uid và course_id

  if (!userUid || !courseId) {
    return res.status(400).json({ error: "Thiếu userUid hoặc courseId" });
  }

  try {
    const pool = await poolPromise;
    const request = new sql.Request(pool);

    // Kiểm tra khóa học có tồn tại và lấy title khóa học
    request.input("courseId", sql.Int, courseId);
    const courseResult = await request.query(`
      SELECT course_id, title FROM courses WHERE course_id = @courseId
    `);

    if (courseResult.recordset.length === 0) {
      return res.status(404).json({ error: "Khóa học không tồn tại" });
    }

    const courseTitle = courseResult.recordset[0].title;

    // Kiểm tra đã đăng ký chưa
    request.input("userUid", sql.NVarChar, userUid); // Dùng userUid trong bảng enrollments
    const exist = await request.query(`
      SELECT * FROM enrollments
      WHERE user_uid = @userUid AND course_id = @courseId
    `);

    if (exist.recordset.length > 0) {
      return res.status(400).json({ error: "Bạn đã đăng ký khóa học này" });
    }

    // Thực hiện đăng ký
    await request.query(`
      INSERT INTO enrollments (user_uid, course_id, enrolled_at)
      VALUES (@userUid, @courseId, GETDATE())
    `);

    // Lấy thông tin user để gửi thông báo FCM
    const userResult = await pool
      .request()
      .input("userUid", sql.NVarChar, userUid).query(`
        SELECT * FROM users WHERE uid = @userUid
      `);

    const user = userResult.recordset[0];

    // Chuẩn bị thông báo
    const notificationTitle = "Đăng ký khóa học thành công";
    const notificationBody = `Bạn đã đăng ký khóa học "${courseTitle}" thành công!`;
    const fcmToken = user.fcm_token;

    // Tạo bản ghi notification trong DB và lấy noti_id
    const notificationResult = await pool
      .request()
      .input("uid", sql.NVarChar, user.uid)
      .input("title", sql.NVarChar, notificationTitle)
      .input("content", sql.NVarChar, notificationBody)
      .input("icon", sql.NVarChar, "book")
      .input("color", sql.NVarChar, "#4caf50")
      .input("is_read", sql.Bit, false)
      .input("created_at", sql.DateTime, new Date()).query(`
        INSERT INTO notifications (uid, title, content, icon, color, is_read, created_at)
        OUTPUT INSERTED.noti_id
        VALUES (@uid, @title, @content, @icon, @color, @is_read, @created_at)
      `);

    const noti_id = notificationResult.recordset[0].noti_id;

    // Gửi FCM
    await sendNotification(
      fcmToken,
      noti_id,
      user.uid,
      notificationTitle,
      notificationBody,
      "book",
      "#4caf50"
    );

    // Trả về response
    res.status(201).json({
      message: "Đăng ký khóa học thành công",
      notification: {
        noti_id,
        title: notificationTitle,
        body: notificationBody,
        sent: true,
      },
    });
  } catch (err) {
    console.error("enrollCourse error:", err);
    res.status(500).json({ error: "Lỗi đăng ký học: " + err.message });
  }
};

module.exports = enrollCourse;
