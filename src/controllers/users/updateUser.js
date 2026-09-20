const path = require("path");
const { sendServerError } = require("../../utils/errorResponse");
const { pool } = require("../../config/db.config");
const { sendNotification } = require("../../services/notificationService");

const updateUser = async (req, res) => {
  const uid = req.params.id;
  const { name, bio, phone, gender, birthdate } = req.body;

  // Đã được chặn ở tầng route (authorizeSelfOrAdmin). Giữ lại ở đây làm lớp
  // phòng thủ thứ hai, phòng khi route được mount lại mà quên middleware.
  if (req.user.role !== "admin" && String(req.user.uid) !== String(req.params.id)) {
    return res.status(403).json({ error: "Bạn không có quyền cập nhật người dùng này" });
  }

  let avatarUrl = null;
  if (req.file) {
    avatarUrl = `/uploads/avatars/${path.basename(req.file.path)}`;
  }

  // Xây mảng SET động cho PostgreSQL
  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  if (name != null) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(name);
  }
  if (bio != null) {
    setClauses.push(`bio = $${paramIndex++}`);
    values.push(bio);
  }
  if (phone != null) {
    setClauses.push(`phone = $${paramIndex++}`);
    values.push(phone);
  }
  if (gender != null) {
    setClauses.push(`gender = $${paramIndex++}`);
    values.push(gender);
  }
  if (birthdate != null) {
    setClauses.push(`birthdate = $${paramIndex++}`);
    values.push(new Date(birthdate));
  }
  if (avatarUrl) {
    setClauses.push(`avatar_url = $${paramIndex++}`);
    values.push(avatarUrl);
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ error: "Không có dữ liệu để cập nhật" });
  }

  setClauses.push("updated_at = NOW()");
  values.push(uid); // Thêm uid làm tham số cuối

  try {
    // UPDATE user
    // Liệt kê cột tường minh thay vì RETURNING *: bảng users có password_hash,
    // và trả về toàn bộ dòng sẽ đẩy hash mật khẩu ra cho client.
    const updateQuery = `
      UPDATE users
      SET ${setClauses.join(", ")}
      WHERE uid = $${paramIndex}
      RETURNING uid, email, name, avatar_url, bio, phone, gender, birthdate,
                role, is_active, fcm_token, created_at, updated_at
    `;
    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    const user = result.rows[0];

    // Tạo notification
    const notificationTitle = "Thông tin đã được cập nhật";
    const bdDisplay = user.birthdate
      ? new Date(user.birthdate).toLocaleDateString("vi-VN")
      : "Chưa cập nhật";
    const notificationBody = `Hồ sơ của bạn đã được cập nhật: Tên=${user.name}, SĐT=${user.phone}, Giới tính=${user.gender}, Ngày sinh=${bdDisplay}.`;
    const fcmToken = user.fcm_token;

    // Insert notification
    const notiResult = await pool.query(
      `INSERT INTO notifications (uid, title, content, icon, color, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING noti_id`,
      [user.uid, notificationTitle, notificationBody, "person", "#4caf50", false]
    );

    const noti_id = notiResult.rows[0].noti_id;

    let sent = false;
    if (fcmToken) {
      try {
        await sendNotification(
          fcmToken,
          noti_id,
          user.uid,
          notificationTitle,
          notificationBody,
          "person",
          "#4caf50"
        );
        sent = true;
      } catch (error) {
        console.warn("send profile update notification failed:", error.message);
      }
    }

    res.json({
      message: "Cập nhật thành công và thông báo đã được gửi",
      user,
      notification: {
        noti_id,
        title: notificationTitle,
        body: notificationBody,
        sent,
      },
    });
  } catch (err) {
    console.error("updateUser error:", err);
    sendServerError(res, "Lỗi máy chủ", err);
  }
};

module.exports = updateUser;
