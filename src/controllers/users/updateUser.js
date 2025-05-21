// src/controllers/user/updateUser.js

const path = require("path");
const { sql, poolPromise } = require("../../config/db.config");
const { sendNotification } = require("../../services/notificationService");

/**
 * PUT /api/users/:id
 * middleware multer.single('avatar') đã chạy trước
 */
const updateUser = async (req, res) => {
  const uid = req.params.id;
  const { name, bio, phone, gender, birthdate } = req.body;

  // Chuẩn bị avatar_url nếu có
  let avatarUrl = null;
  if (req.file) {
    avatarUrl = `/uploads/avatars/${path.basename(req.file.path)}`;
  }

  // Xây mảng SET động
  const setClauses = [];
  const inputs = [];

  if (name != null) {
    setClauses.push("name = @name");
    inputs.push(["name", name]);
  }
  if (bio != null) {
    setClauses.push("bio = @bio");
    inputs.push(["bio", bio]);
  }
  if (phone != null) {
    setClauses.push("phone = @phone");
    inputs.push(["phone", phone]);
  }
  if (gender != null) {
    setClauses.push("gender = @gender");
    inputs.push(["gender", gender]);
  }
  if (birthdate != null) {
    // Convert string -> Date nếu cần
    const bd = new Date(birthdate);
    setClauses.push("birthdate = @birthdate");
    inputs.push(["birthdate", bd]);
  }
  if (avatarUrl) {
    setClauses.push("avatar_url = @avatar_url");
    inputs.push(["avatar_url", avatarUrl]);
  }

  // Không có gì để update
  if (setClauses.length === 0) {
    return res.status(400).json({ error: "Không có dữ liệu để cập nhật" });
  }

  // Luôn cập nhật updated_at
  setClauses.push("updated_at = GETDATE()");

  try {
    const pool = await poolPromise;
    const request = pool.request().input("uid", sql.NVarChar, uid);

    // Gán các input động
    for (const [key, val] of inputs) {
      if (key === "birthdate") {
        request.input(key, sql.DateTime, val);
      } else {
        request.input(key, sql.NVarChar, val);
      }
    }

    // Thực hiện UPDATE
    const result = await request.query(`
      UPDATE users
      SET ${setClauses.join(", ")}
      WHERE uid = @uid
    `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    // Lấy lại dữ liệu user sau khi update
    const { recordset } = await pool
      .request()
      .input("uid", sql.NVarChar, uid)
      .query("SELECT * FROM users WHERE uid = @uid");

    const user = recordset[0];

    // Chuẩn bị thông báo
    const notificationTitle = "Thông tin đã được cập nhật";
    const bdDisplay = user.birthdate
      ? new Date(user.birthdate).toLocaleDateString("vi-VN")
      : "Chưa cập nhật";
    const notificationBody = `Hồ sơ của bạn đã được cập nhật: Tên=${user.name}, SĐT=${user.phone}, Giới tính=${user.gender}, Ngày sinh=${bdDisplay}.`;
    const fcmToken = user.fcm_token;

    // Tạo bản ghi notification trong DB và lấy noti_id
    const notificationResult = await pool
      .request()
      .input("uid", sql.NVarChar, user.uid)
      .input("title", sql.NVarChar, notificationTitle)
      .input("content", sql.NVarChar, notificationBody)
      .input("icon", sql.NVarChar, "person")
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
      "person",
      "#4caf50"
    );

    // Trả về response
    res.json({
      message: "Cập nhật thành công và thông báo đã được gửi",
      user,
      notification: {
        noti_id,
        title: notificationTitle,
        body: notificationBody,
        sent: true,
      },
    });
  } catch (err) {
    console.error("updateUser error:", err);
    res.status(500).json({ error: "Lỗi máy chủ: " + err.message });
  }
};

module.exports = updateUser;
