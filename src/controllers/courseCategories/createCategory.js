// controllers/courseCategories/createCategory.js
const path = require("path");
const { sql, poolPromise } = require("../../config/db.config");
const { sendNotification } = require("../../services/notificationService");

const createCategory = async (req, res) => {
  try {
    const { name, description, uid } = req.body;
    const iconFile = req.file;

    if (!name)
      return res
        .status(400)
        .json({ error: "Tên danh mục không được bỏ trống" });
    if (!uid) return res.status(400).json({ error: "UID không được bỏ trống" });

    const pool = await poolPromise;

    // 1. Kiểm quyền user
    const reqRole = new sql.Request(pool);
    reqRole.input("uid", sql.NVarChar, uid);
    const roleQ = await reqRole.query(
      "SELECT role FROM users WHERE uid = @uid"
    );
    const userRole = roleQ.recordset[0]?.role;
    if (userRole !== "mentor" && userRole !== "admin") {
      return res.status(403).json({ error: "Bạn không có quyền tạo danh mục" });
    }

    // 2. Chèn category vào DB
    const iconPath = iconFile
      ? `/uploads/categories/${iconFile.filename}`
      : null;

    const reqIns = new sql.Request(pool);
    reqIns.input("name", sql.NVarChar, name);
    reqIns.input("desc", sql.NVarChar, description);
    reqIns.input("icon", sql.NVarChar, iconPath);
    await reqIns.query(`
      INSERT INTO course_categories (name, description, icon, created_at)
      VALUES (@name, @desc, @icon, GETDATE())
    `);

    // 3. Lấy FCM token của user
    const reqUser = new sql.Request(pool);
    reqUser.input("uid", sql.NVarChar, uid);
    const userQ = await reqUser.query(
      "SELECT fcm_token FROM users WHERE uid = @uid"
    );
    const fcmToken = userQ.recordset[0]?.fcm_token;

    // 4. Tạo record notification
    const notificationTitle = "Tạo danh mục thành công";
    const notificationBody = `Danh mục ${name} đã được tạo thành công.`;
    const reqNoti = new sql.Request(pool);
    reqNoti
      .input("uid", sql.NVarChar, uid)
      .input("title", sql.NVarChar, notificationTitle)
      .input("content", sql.NVarChar, notificationBody)
      .input("icon", sql.NVarChar, "category")
      .input("color", sql.NVarChar, "#2196f3")
      .input("is_read", sql.Bit, false)
      .input("created_at", sql.DateTime, new Date());
    const notiResult = await reqNoti.query(`
      INSERT INTO notifications (uid, title, content, icon, color, is_read, created_at)
      OUTPUT INSERTED.noti_id
      VALUES (@uid, @title, @content, @icon, @color, @is_read, @created_at)
    `);
    const noti_id = notiResult.recordset[0].noti_id;

    // 5. Gửi FCM notification (nếu có token)
    let sent = false;
    if (fcmToken) {
      await sendNotification(
        fcmToken,
        noti_id,
        uid,
        notificationTitle,
        notificationBody,
        "category",
        "#2196f3"
      );
      sent = true;
    }

    // 6. Trả về client, có cả thông tin notification đã gửi
    return res.status(201).json({
      message: "✅ Tạo danh mục thành công",
      notification: {
        noti_id,
        title: notificationTitle,
        body: notificationBody,
        sent,
      },
    });
  } catch (err) {
    console.error("createCategory error:", err);
    return res
      .status(500)
      .json({ error: "❌ Lỗi tạo danh mục: " + err.message });
  }
};

module.exports = createCategory;
