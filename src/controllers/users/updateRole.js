// src/controllers/user/updateRole.js
const { sql, poolPromise } = require("../../config/db.config");
const { sendNotification } = require("../../services/notificationService");

/**
 * PUT /api/user/updaterole
 * Body: { targetUid: string, role: "admin"|"user"|"mentor" }
 */
const updateRole = async (req, res) => {
  const { targetUid, role } = req.body;
  const validRoles = ["admin", "user", "mentor"];

  // 1. Validate input
  if (!targetUid) {
    return res.status(400).json({ error: "Thiếu targetUid" });
  }
  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({
      error: `Role không hợp lệ. Chọn một trong: ${validRoles.join(", ")}`,
    });
  }

  try {
    const pool = await poolPromise;

    // 2. Cập nhật role và updated_at
    const updateRes = await pool
      .request()
      .input("targetUid", sql.NVarChar, targetUid)
      .input("role", sql.NVarChar, role).query(`
        UPDATE users
        SET role = @role,
            updated_at = GETDATE()
        WHERE uid = @targetUid
      `);

    if (updateRes.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    // 3. Lấy thông tin user (uid, role, fcm_token)
    const { recordset } = await pool
      .request()
      .input("targetUid", sql.NVarChar, targetUid)
      .query("SELECT uid, role, fcm_token FROM users WHERE uid = @targetUid");
    const user = recordset[0];

    // 4. Tạo bản ghi notification
    const title = "Quyền truy cập đã được cập nhật";
    const content = `Quyền của bạn đã được đổi thành '${user.role}'.`;
    const notifRes = await pool
      .request()
      .input("uid", sql.NVarChar, user.uid)
      .input("title", sql.NVarChar, title)
      .input("content", sql.NVarChar, content)
      .input("icon", sql.NVarChar, "security")
      .input("color", sql.NVarChar, "#2196f3")
      .input("is_read", sql.Bit, false)
      .input("created_at", sql.DateTime, new Date()).query(`
        INSERT INTO notifications (uid, title, content, icon, color, is_read, created_at)
        OUTPUT INSERTED.noti_id
        VALUES (@uid, @title, @content, @icon, @color, @is_read, @created_at)
      `);
    const notiId = notifRes.recordset[0].noti_id;

    // 5. Gửi FCM
    await sendNotification(
      user.fcm_token,
      notiId,
      user.uid,
      title,
      content,
      "security",
      "#2196f3"
    );

    // 6. Trả về response
    res.json({
      message: "Cập nhật role thành công và thông báo đã được gửi",
      user: { uid: user.uid, role: user.role },
      notification: { notiId, title, content, sent: true },
    });
  } catch (err) {
    console.error("updateRole error:", err);
    res.status(500).json({ error: "Lỗi máy chủ: " + err.message });
  }
};

module.exports = updateRole;
