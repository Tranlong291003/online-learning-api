const path = require("path");
const { sql, poolPromise } = require("../../config/db.config");
const { sendNotification } = require("../../services/notificationService"); // Thêm service gửi thông báo

/**
 * PUT /api/users/:id
 * middleware multer.single('avatar') phải chạy trước
 */
const updateUser = async (req, res) => {
  const uid = req.params.id;
  const { name, bio, phone } = req.body;

  /* ---------- Chuẩn bị avatar_url (nếu có) ---------- */
  let avatarUrl = null;
  if (req.file) {
    avatarUrl = `/uploads/avatars/${path.basename(req.file.path)}`;
  }

  /* ---------- Xây mảng SET động ---------- */
  const setClauses = [];
  const inputs = []; // gom input để thêm vào request sau

  if (name !== undefined && name != null) {
    setClauses.push("name = @name");
    inputs.push(["name", name]);
  }
  if (bio !== undefined && bio != null) {
    setClauses.push("bio = @bio");
    inputs.push(["bio", bio]);
  }
  if (phone !== undefined && phone != null) {
    setClauses.push("phone = @phone");
    inputs.push(["phone", phone]);
  }
  if (avatarUrl) {
    setClauses.push("avatar_url = @avatar_url");
    inputs.push(["avatar_url", avatarUrl]);
  }

  // chẳng có gì để update
  if (setClauses.length === 0) {
    return res.status(400).json({ error: "Không có dữ liệu để cập nhật" });
  }

  // luôn cập nhật updated_at
  setClauses.push("updated_at = GETDATE()");

  try {
    const pool = await poolPromise;
    const request = pool.request().input("uid", sql.NVarChar, uid);

    // thêm các input động
    for (const [key, val] of inputs) {
      request.input(key, sql.NVarChar, val);
    }

    /* ---------- UPDATE ---------- */
    const result = await request.query(`
      UPDATE users
      SET ${setClauses.join(", ")}
      WHERE uid = @uid
    `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    /* ---------- SELECT lại user ---------- */
    const { recordset } = await pool
      .request()
      .input("uid", sql.NVarChar, uid)
      .query("SELECT * FROM users WHERE uid = @uid");

    const user = recordset[0];

    // Tạo thông báo mới trong bảng notifications
    const notificationTitle = "Thông tin đã được cập nhật";
    const notificationBody = `Thông tin của bạn (Tên: ${user.name}, Số điện thoại: ${user.phone}) đã được cập nhật thành công.`;
    const fcmToken = user.fcm_token;

    // Tạo thông báo mới trong cơ sở dữ liệu
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
        OUTPUT INSERTED.noti_id  -- Lấy ID thông báo vừa tạo
        VALUES (@uid, @title, @content, @icon, @color, @is_read, @created_at)
      `);

    const noti_id = notificationResult.recordset[0].noti_id;

    // Gửi thông báo tới người dùng
    await sendNotification(
      fcmToken,
      noti_id,
      user.uid,
      notificationTitle,
      notificationBody,
      "person",
      "#4caf50"
    );

    res.json({
      message: "Cập nhật thành công và thông báo đã được gửi",
      user: recordset[0],
      notification: {
        noti_id: noti_id,
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
