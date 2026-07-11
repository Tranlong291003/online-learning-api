// controllers/users/checkUserStatus.js
const { supabaseAdmin } = require("../../services/supabase.service");

const checkUserStatus = async (req, res) => {
  try {
    const { uid } = req.params;
    if (!uid) return res.status(400).json({ error: "Thiếu uid" });
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("is_active, role")
      .eq("uid", uid)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Không tìm thấy người dùng" });
    res.status(200).json({ is_active: data.is_active, role: data.role });
  } catch (err) {
    console.error("checkUserStatus error:", err);
    res.status(500).json({ error: "Lỗi máy chủ: " + err.message });
  }
};

module.exports = checkUserStatus;
