const { pool } = require("../../config/db.config");
const admin = require("../../config/firebase.config");

const updateRole = async (req, res) => {
  const { uid, role } = req.body;

  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Bạn không có quyền thay đổi vai trò" });
  }

  if (!uid || !role) {
    return res.status(400).json({ error: "Thiếu uid hoặc role" });
  }

  const validRoles = ["user", "mentor", "admin"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: "Role không hợp lệ" });
  }

  try {
    // Cập nhật trong PostgreSQL
    const result = await pool.query(
      "UPDATE users SET role = $1, updated_at = NOW() WHERE uid = $2 RETURNING uid",
      [role, uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    let firebase_synced = false;
    try {
      await admin.auth().setCustomUserClaims(uid, { role: role });
      firebase_synced = true;
    } catch (firebaseError) {
      console.warn("Firebase custom claims sync failed:", firebaseError.message);
    }

    res.json({
      success: true,
      message: `Đã cập nhật role thành ${role}`,
      firebase_synced,
    });
  } catch (err) {
    console.error("Error in updateRole:", err);
    res.status(500).json({ error: "Lỗi khi cập nhật role: " + err.message });
  }
};

module.exports = updateRole;
