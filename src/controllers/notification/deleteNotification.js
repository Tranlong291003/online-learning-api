// controllers/notification/deleteNotification.js
// Xoa notification theo noti_id (cua user dang dang nhap).
const { supabaseAdmin } = require("../../services/supabase.service");

module.exports = async function deleteNotification(req, res) {
  try {
    const uid = req.supabaseUser.authUser.id;
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Thieu noti_id" });

    const { error } = await supabaseAdmin
      .from("notifications")
      .delete()
      .eq("noti_id", id)
      .eq("uid", uid);
    if (error) throw error;
    res.status(200).json({ message: "Da xoa thong bao" });
  } catch (err) {
    console.error("deleteNotification error:", err);
    res.status(500).json({ error: err.message });
  }
};
