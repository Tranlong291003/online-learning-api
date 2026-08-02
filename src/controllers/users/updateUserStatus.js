const { pool } = require("../../config/db.config");
const admin = require("../../config/firebase.config");

const updateUserStatus = async (req, res) => {
  const uid = req.params.id;
  const { status } = req.body;

  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Bạn không có quyền cập nhật trạng thái người dùng" });
  }

  if (!["active", "disabled"].includes(status)) {
    return res.status(400).json({ error: "Trạng thái không hợp lệ" });
  }

  const isActive = status === "active";

  try {
    // Cập nhật trong PostgreSQL
    const result = await pool.query(
      `UPDATE users
       SET is_active = $1, updated_at = NOW()
       WHERE uid = $2
       RETURNING uid`,
      [isActive, uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    let firebase_synced = false;
    try {
      await admin.auth().updateUser(uid, { disabled: !isActive });
      firebase_synced = true;
    } catch (firebaseError) {
      console.warn("Firebase updateUser status sync failed:", firebaseError.message);
    }

    res.json({
      message: "Trạng thái người dùng đã được cập nhật thành công",
      firebase_synced,
    });
  } catch (err) {
    console.error("Error in updateUserStatus:", err);

    res.status(500).json({
      error: "Lỗi khi cập nhật trạng thái người dùng: " + err.message,
    });
  }
};

module.exports = updateUserStatus;
