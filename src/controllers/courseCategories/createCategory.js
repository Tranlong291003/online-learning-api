const path = require("path");
const { pool } = require("../../config/db.config");
const { sendNotification } = require("../../services/notificationService");
const { resolveActorUid } = require("../../middleware/actor");

const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    const iconFile = req.file;

    if (!name) return res.status(400).json({ error: "Tên danh mục không được bỏ trống" });

    // Lấy uid từ token; chỉ admin mới được thao tác thay người khác
    const uid = resolveActorUid(req, res, req.body.uid);
    if (!uid) return;

    // Kiểm quyền
    const roleResult = await pool.query(
      "SELECT role FROM users WHERE uid = $1",
      [uid]
    );
    const userRole = roleResult.rows[0]?.role;
    if (userRole !== "mentor" && userRole !== "admin") {
      return res.status(403).json({ error: "Bạn không có quyền tạo danh mục" });
    }

    // Insert category
    const iconPath = iconFile ? `/uploads/categories/${iconFile.filename}` : null;
    const insertResult = await pool.query(
      `INSERT INTO course_categories (name, description, icon, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING category_id`,
      [name, description, iconPath]
    );
    const category_id = insertResult.rows[0].category_id;

    // Lấy FCM token
    const userResult = await pool.query(
      "SELECT fcm_token FROM users WHERE uid = $1",
      [uid]
    );
    const fcmToken = userResult.rows[0]?.fcm_token;

    // Tạo notification
    const notificationTitle = "Tạo danh mục thành công";
    const notificationBody = `Danh mục ${name} đã được tạo thành công.`;

    const notiResult = await pool.query(
      `INSERT INTO notifications (uid, title, content, icon, color, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, false, NOW())
       RETURNING noti_id`,
      [uid, notificationTitle, notificationBody, "category", "#2196f3"]
    );
    const noti_id = notiResult.rows[0].noti_id;

    // Gửi FCM
    let sent = false;
    if (fcmToken) {
      try {
        await sendNotification(fcmToken, noti_id, uid, notificationTitle, notificationBody, "category", "#2196f3");
        sent = true;
      } catch (error) {
        console.warn("send category notification failed:", error.message);
      }
    }

    return res.status(201).json({
      message: "✅ Tạo danh mục thành công",
      category_id,
      notification: { noti_id, title: notificationTitle, body: notificationBody, sent },
    });
  } catch (err) {
    console.error("createCategory error:", err);
    return res.status(500).json({ error: "❌ Lỗi tạo danh mục: " + err.message });
  }
};

module.exports = createCategory;
