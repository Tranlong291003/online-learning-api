const { pool } = require("../config/db.config");
const { sendServerError } = require("../utils/errorResponse");
const notificationService = require("../services/notificationService");
const { resolveActorUid } = require("../middleware/actor");

// User gửi yêu cầu nâng cấp
exports.createRequest = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Vui lòng gửi file ảnh minh chứng (field 'image')" });
    }

    // Lấy uid từ token; chỉ admin mới được gửi thay người khác
    const user_uid = resolveActorUid(req, res, req.body.user_uid || req.body.uid);
    if (!user_uid) return;

    // Kiểm tra nếu đã có yêu cầu pending
    const check = await pool.query(
      "SELECT id FROM upgrade_requests WHERE user_uid = $1 AND status = 'pending'",
      [user_uid]
    );
    if (check.rows.length > 0) {
      return res.status(400).json({
        error: "Bạn đã gửi yêu cầu và đang chờ duyệt. Vui lòng chờ kết quả trước khi gửi tiếp.",
      });
    }

    const image_url = `/uploads/mentor_requests/${req.file.filename}`;
    const insertResult = await pool.query(
      `INSERT INTO upgrade_requests (user_uid, status, reason, image_url, created_at, updated_at)
       VALUES ($1, 'pending', NULL, $2, NOW(), NOW())
       RETURNING id`,
      [user_uid, image_url]
    );

    // Thông báo trong app cho user (khớp với các controller khác)
    const notiTitle = "Đã gửi yêu cầu nâng cấp Mentor";
    const notiContent = "Yêu cầu nâng cấp Mentor của bạn đang chờ duyệt.";

    await pool.query(
      `INSERT INTO notifications (uid, title, content, icon, color, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, false, NOW())`,
      [user_uid, notiTitle, notiContent, "mentor", "#ff9800"]
    );

    res.status(201).json({ message: "Yêu cầu đã được gửi", image_url });
  } catch (err) {
    sendServerError(res, "Lỗi máy chủ", err);
  }
};

// Admin duyệt hoặc từ chối yêu cầu
exports.updateStatusRequest = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Bạn không có quyền thực hiện thao tác này" });
    }

    const { id } = req.params;
    const { status, reason } = req.body;

    if (status !== "approved" && status !== "rejected") {
      return res.status(400).json({ error: "Trạng thái không hợp lệ" });
    }

    // Cập nhật trạng thái
    await pool.query(
      `UPDATE upgrade_requests SET status = $1, reason = $2, updated_at = NOW() WHERE id = $3`,
      [status, status === "rejected" ? reason : null, id]
    );

    // Lấy user_uid
    const result = await pool.query("SELECT user_uid FROM upgrade_requests WHERE id = $1", [id]);
    const user_uid = result.rows[0]?.user_uid;

    let fcmToken = null;
    if (user_uid) {
      const userResult = await pool.query("SELECT fcm_token FROM users WHERE uid = $1", [user_uid]);
      fcmToken = userResult.rows[0]?.fcm_token;
    }

    // Nếu duyệt, cập nhật role
    if (status === "approved" && user_uid) {
      await pool.query("UPDATE users SET role = 'mentor' WHERE uid = $1", [user_uid]);
    }

    // Ghi thông báo trong app, rồi gửi FCM kèm đúng noti_id
    if (user_uid) {
      const title = status === "approved"
        ? "Yêu cầu nâng cấp Mentor đã được duyệt"
        : "Yêu cầu nâng cấp Mentor đã bị từ chối";
      const content = status === "approved"
        ? "Chúc mừng bạn đã trở thành Mentor!"
        : `Yêu cầu nâng cấp Mentor của bạn đã bị từ chối. Lý do: ${reason || "Không có lý do cụ thể"}`;
      const icon = status === "approved" ? "success" : "warning";
      const color = status === "approved" ? "#4caf50" : "#f44336";

      const notiResult = await pool.query(
        `INSERT INTO notifications (uid, title, content, icon, color, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, false, NOW())
         RETURNING noti_id`,
        [user_uid, title, content, icon, color]
      );
      const noti_id = notiResult.rows[0].noti_id;

      if (fcmToken) {
        try {
          await notificationService.sendNotification(
            fcmToken, noti_id, user_uid, title, content, icon, color
          );
        } catch (e) {
          console.log("Lỗi gửi FCM:", e.message);
        }
      }
    }

    res.json({ message: `Yêu cầu đã được ${status === "approved" ? "duyệt" : "từ chối"}` });
  } catch (err) {
    sendServerError(res, "Lỗi máy chủ", err);
  }
};

// Lấy danh sách yêu cầu nâng cấp
exports.getRequests = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Bạn không có quyền thực hiện thao tác này" });
    }

    const { status } = req.query;

    let query = `
      SELECT r.*, u.name AS user_name
      FROM upgrade_requests r
      LEFT JOIN users u ON r.user_uid = u.uid
    `;
    const values = [];

    if (status) {
      query += " WHERE r.status = $1";
      values.push(status);
    }
    query += " ORDER BY r.created_at DESC";

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    sendServerError(res, "Lỗi máy chủ", err);
  }
};
