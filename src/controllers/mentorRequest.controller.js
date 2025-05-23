const { sql, poolPromise } = require("../config/db.config");
const notificationService = require("../services/notificationService");

// User gửi yêu cầu nâng cấp
exports.createRequest = async (req, res) => {
  try {
    const { user_uid } = req.body;
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "Vui lòng gửi file ảnh minh chứng (field 'image')" });
    }
    const pool = await poolPromise;
    // Kiểm tra nếu đã có yêu cầu pending
    const check = await pool
      .request()
      .input("user_uid", sql.NVarChar(50), user_uid)
      .query(
        `SELECT id FROM upgrade_requests WHERE user_uid = @user_uid AND status = 'pending'`
      );
    if (check.recordset.length > 0) {
      return res.status(400).json({
        error:
          "Bạn đã gửi yêu cầu và đang chờ duyệt. Vui lòng chờ kết quả trước khi gửi tiếp.",
      });
    }
    const image_url = `/uploads/mentor_requests/${req.file.filename}`;
    const now = new Date();
    await pool
      .request()
      .input("user_uid", sql.NVarChar(50), user_uid)
      .input("status", sql.NVarChar(20), "pending")
      .input("reason", sql.NVarChar(500), null)
      .input("image_url", sql.NVarChar(255), image_url)
      .input("created_at", sql.DateTime, now)
      .input("updated_at", sql.DateTime, now)
      .query(`INSERT INTO upgrade_requests (user_uid, status, reason, image_url, created_at, updated_at)
              VALUES (@user_uid, @status, @reason, @image_url, @created_at, @updated_at)`);
    res.status(201).json({ message: "Yêu cầu đã được gửi", image_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Admin duyệt hoặc từ chối yêu cầu
exports.updateStatusRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const now = new Date();
    if (status !== "approved" && status !== "rejected") {
      return res.status(400).json({ error: "Trạng thái không hợp lệ" });
    }
    const pool = await poolPromise;
    // Cập nhật trạng thái yêu cầu
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("status", sql.NVarChar(20), status)
      .input("reason", sql.NVarChar(500), status === "rejected" ? reason : null)
      .input("updated_at", sql.DateTime, now)
      .query(
        `UPDATE upgrade_requests SET status = @status, reason = @reason, updated_at = @updated_at WHERE id = @id`
      );
    // Lấy user_uid và fcm_token
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT user_uid FROM upgrade_requests WHERE id = @id`);
    const user_uid = result.recordset[0]?.user_uid;
    let fcmToken = null;
    if (user_uid) {
      const userResult = await pool
        .request()
        .input("uid", sql.NVarChar(50), user_uid)
        .query(`SELECT fcm_token FROM users WHERE uid = @uid`);
      fcmToken = userResult.recordset[0]?.fcm_token;
    }
    // Nếu duyệt, cập nhật role user thành mentor
    if (status === "approved" && user_uid) {
      await pool
        .request()
        .input("uid", sql.NVarChar(50), user_uid)
        .query(`UPDATE users SET role = 'mentor' WHERE uid = @uid`);
    }
    // Gửi thông báo FCM nếu có fcmToken
    if (fcmToken) {
      const title =
        status === "approved"
          ? "Yêu cầu nâng cấp Mentor đã được duyệt"
          : "Yêu cầu nâng cấp Mentor đã bị từ chối";
      const content =
        status === "approved"
          ? "Chúc mừng bạn đã trở thành Mentor!"
          : `Yêu cầu nâng cấp Mentor của bạn đã bị từ chối. Lý do: ${
              reason || "Không có lý do cụ thể"
            }`;
      try {
        await notificationService.sendNotification(
          fcmToken,
          id, // noti_id
          user_uid,
          title,
          content,
          "mentor", // icon
          status === "approved" ? "#4caf50" : "#f44336" // color
        );
      } catch (e) {
        // Không throw lỗi gửi thông báo, chỉ log
        console.log("Lỗi gửi FCM:", e.message);
      }
    }
    res.json({
      message: `Yêu cầu đã được ${status === "approved" ? "duyệt" : "từ chối"}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy danh sách yêu cầu nâng cấp
exports.getRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const pool = await poolPromise;
    let query = `
      SELECT r.*, u.name AS user_name
      FROM upgrade_requests r
      LEFT JOIN users u ON r.user_uid = u.uid
    `;
    if (status) {
      query += " WHERE r.status = @status";
    }
    query += " ORDER BY r.created_at DESC";
    const request = pool.request();
    if (status) {
      request.input("status", sql.NVarChar(20), status);
    }
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
