// controllers/users/deleteUser.js
// Xoa user (admin). Xoa ca auth user va row trong public.users.
const { supabaseAdmin } = require("../../services/supabase.service");

const deleteUser = async (req, res) => {
  try {
    const id = req.params.id; // uid (text) tu route
    if (!id) return res.status(400).json({ error: "Thieu id" });

    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authErr && !String(authErr.message).includes("not found")) {
      console.warn("[deleteUser] auth delete warn:", authErr.message);
    }

    const { error } = await supabaseAdmin.from("users").delete().eq("uid", id);
    if (error) throw error;

    res.status(200).json({ message: "Xoa user thanh cong" });
  } catch (err) {
    console.error("deleteUser error:", err);
    res.status(500).json({ error: "Loi server: " + err.message });
  }
};

module.exports = deleteUser;
