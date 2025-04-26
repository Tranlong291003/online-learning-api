const { sql, poolPromise } = require("../../config/db.config");
const admin = require("../../config/firebase.config"); // Firebase Admin SDK

// Cập nhật trạng thái user (active/disabled) dựa trên uid
const updateUserStatus = async (req, res) => {
  const uid = req.params.id; // uid từ URL
  const { status } = req.body; // 'active' hoặc 'disabled'

  // Validate status
  if (!["active", "disabled"].includes(status)) {
    return res.status(400).json({ error: "Trạng thái không hợp lệ" });
  }

  // Chuyển sang BIT: active → 1, disabled → 0
  const isActive = status === "active" ? 1 : 0;

  try {
    // 1) Cập nhật trong SQL Server
    const pool = await poolPromise;
    const request = pool
      .request()
      .input("uid", sql.NVarChar, uid)
      .input("is_active", sql.Bit, isActive);

    const result = await request.query(`
      UPDATE users
      SET
        is_active = @is_active,
        updated_at = GETDATE()
      WHERE uid = @uid
    `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    // 2) Cập nhật trong Firebase Auth: disabled = !isActive
    await admin.auth().updateUser(uid, { disabled: !isActive });

    res.json({ message: "Trạng thái người dùng đã được cập nhật thành công" });
  } catch (err) {
    console.error("Error in updateUserStatus:", err);

    // Nếu Firebase không tìm thấy user
    if (err.code === "auth/user-not-found") {
      return res
        .status(404)
        .json({ error: "Không tìm thấy người dùng trên Firebase" });
    }

    res.status(500).json({
      error: "Lỗi khi cập nhật trạng thái người dùng: " + err.message,
    });
  }
};

module.exports = updateUserStatus;
