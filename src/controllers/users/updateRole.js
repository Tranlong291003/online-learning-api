// controllers/users/updateRole.js
// Admin cap nhat role cua user.
const { supabaseAdmin } = require("../../services/supabase.service");

const updateRole = async (req, res) => {
  try {
    const { uid, role } = req.body;
    if (!uid || !role) {
      return res.status(400).json({ error: "Thieu uid hoac role" });
    }
    const allowed = ["user", "mentor", "admin"];
    if (!allowed.includes(role)) {
      return res.status(400).json({ error: "role khong hop le (user|mentor|admin)" });
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("uid", uid)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Khong tim thay user" });

    res.status(200).json({ message: "Cap nhat role thanh cong", user: data });
  } catch (err) {
    console.error("updateRole error:", err);
    res.status(500).json({ error: "Loi server: " + err.message });
  }
};

module.exports = updateRole;
