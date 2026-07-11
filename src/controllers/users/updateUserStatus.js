// controllers/users/updateUserStatus.js
// Admin cap nhat is_active cho user.
const { updateRows, selectRows, supabaseAdmin } = require("../../services/supabase.service");

const updateUserStatus = async (req, res) => {
  try {
    const { uid } = req.params;
    const { status } = req.body;
    if (!uid) return res.status(400).json({ error: "Thiếu uid" });
    if (!["active", "disabled"].includes(status))
      return res.status(400).json({ error: "Trạng thái phải là 'active' hoặc 'disabled'" });

    const isActive = status === "active";
    const { data: updated, error } = await updateRows(
      supabaseAdmin, "users", { is_active: isActive, updated_at: new Date().toISOString() }, { uid }
    );
    if (error) throw error;
    if (!updated || !updated.length) return res.status(404).json({ error: "Không tìm thấy người dùng" });

    res.status(200).json({ message: "Cập nhật trạng thái thành công", user: updated[0] });
  } catch (err) {
    console.error("updateUserStatus error:", err);
    res.status(500).json({ error: "Lỗi máy chủ: " + err.message });
  }
};

module.exports = updateUserStatus;
