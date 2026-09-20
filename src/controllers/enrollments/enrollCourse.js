const { pool } = require("../../config/db.config");
const { sendNotification } = require("../../services/notificationService");
const { resolveActorUid } = require("../../middleware/actor");

const enrollCourse = async (req, res) => {
  const { courseId } = req.body;

  if (!courseId) {
    return res.status(400).json({ error: "Thiếu courseId" });
  }

  // Lấy uid từ token; chỉ admin mới được đăng ký thay người khác
  const userUid = resolveActorUid(req, res, req.body.userUid || req.body.uid);
  if (!userUid) return;

  try {
    // Kiểm tra khóa học
    const courseResult = await pool.query(
      "SELECT course_id, title FROM courses WHERE course_id = $1",
      [courseId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: "Khóa học không tồn tại" });
    }

    const courseTitle = courseResult.rows[0].title;

    // Lấy thông tin user (liệt kê cột tường minh để không lộ password_hash)
    const userResult = await pool.query(
      `SELECT uid, email, name, avatar_url, role, is_active, fcm_token
       FROM users WHERE uid = $1`,
      [userUid]
    );
    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    // Kiểm tra đã đăng ký
    const exist = await pool.query(
      "SELECT * FROM enrollments WHERE user_uid = $1 AND course_id = $2",
      [userUid, courseId]
    );

    if (exist.rows.length > 0) {
      return res.status(400).json({ error: "Bạn đã đăng ký khóa học này" });
    }

    // Đăng ký
    const enrollmentResult = await pool.query(
      "INSERT INTO enrollments (user_uid, course_id, enrolled_at) VALUES ($1, $2, NOW()) RETURNING enrollment_id",
      [userUid, courseId]
    );
    const enrollment_id = enrollmentResult.rows[0].enrollment_id;

    // Tạo notification
    const notificationTitle = "Đăng ký khóa học thành công";
    const notificationBody = `Bạn đã đăng ký khóa học "${courseTitle}" thành công!`;

    const notiResult = await pool.query(
      `INSERT INTO notifications (uid, title, content, icon, color, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, false, NOW())
       RETURNING noti_id`,
      [user.uid, notificationTitle, notificationBody, "book", "#4caf50"]
    );

    const noti_id = notiResult.rows[0].noti_id;

    // Gửi FCM nếu cấu hình Firebase hợp lệ. Lỗi push notification không được làm hỏng flow đăng ký.
    let sent = false;
    if (user.fcm_token) {
      try {
        await sendNotification(
          user.fcm_token,
          noti_id,
          user.uid,
          notificationTitle,
          notificationBody,
          "book",
          "#4caf50"
        );
        sent = true;
      } catch (error) {
        console.warn("send enrollment notification failed:", error.message);
      }
    }

    res.status(201).json({
      message: "Đăng ký khóa học thành công",
      enrollment_id,
      notification: {
        noti_id,
        title: notificationTitle,
        body: notificationBody,
        sent,
      },
    });
  } catch (err) {
    console.error("enrollCourse error:", err);
    res.status(500).json({ error: "Lỗi đăng ký học: " + err.message });
  }
};

module.exports = enrollCourse;
