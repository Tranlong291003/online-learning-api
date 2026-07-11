// controllers/notification/markAsRead.js
// Danh dau thong bao da doc (1 hoac tat ca).
const { updateRows, supabaseAdmin } = require("../../services/supabase.service");

const markAsRead = async (req, res) => {
  try {
    const user_uid = req.supabaseUser?.authUser?.id;
    const role = req.supabaseUser?.profile?.role;
    if (!user_uid) return res.status(401).json({ error: "Chưa đăng nhập" });

    if (req.body.all === true) {
      const { error: upErr } = await supabaseAdmin
        .from("notifications")
        .update({ is_read: true })
        .eq("uid", user_uid)
        .eq("is_read", false);
      if (upErr) throw upErr;
      return res.status(200).json({ message: "Đã đánh dấu tất cả thông báo là đã đọc" });
    }

    const { noti_id } = req.body;
    if (!noti_id) return res.status(400).json({ error: "Thiếu noti_id hoặc all=true" });

    const { data: noti } = await supabaseAdmin
      .from("notifications")
      .select("uid")
      .eq("noti_id", noti_id)
      .maybeSingle();
    if (!noti) return res.status(404).json({ error: "Không tìm thấy thông báo" });
    if (role !== "admin" && noti.uid !== user_uid) {
      return res.status(403).json({ error: "Không có quyền cập nhật thông báo này" });
    }

    const { data, error } = await updateRows(
      supabaseAdmin, "notifications", { is_read: true }, { noti_id }
    );
    if (error) throw error;

    res.status(200).json({
      message: "Đã đánh dấu đã đọc",
      data: data && data[0] ? data[0] : null,
    });
  } catch (err) {
    console.error("markAsRead error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = markAsRead;
