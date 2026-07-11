// controllers/notification/updateNotification.js
const { updateRows, selectRows, supabaseAdmin } = require("../../services/supabase.service");

const updateNotification = async (req, res) => {
  try {
    const { noti_id } = req.params;
    if (!noti_id) return res.status(400).json({ error: "Thiếu noti_id" });

    const user_uid = req.supabaseUser?.authUser?.id;
    const role = req.supabaseUser?.profile?.role;
    if (!user_uid) return res.status(401).json({ error: "Chưa đăng nhập" });

    const { data: noti, error: findErr } = await selectRows(
      supabaseAdmin, "notifications", "noti_id,uid",
      { eq: { noti_id }, single: true }
    );
    if (findErr) throw findErr;
    if (!noti) return res.status(404).json({ error: "Không tìm thấy thông báo" });
    if (role !== "admin" && noti.uid !== user_uid) {
      return res.status(403).json({ error: "Không có quyền sửa thông báo này" });
    }

    const allowed = ["title", "content", "icon", "color", "is_read"];
    const patch = {};
    for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];
    if (Object.keys(patch).length === 0)
      return res.status(400).json({ error: "Không có trường nào để cập nhật" });

    const { data: updated, error: updErr } = await updateRows(
      supabaseAdmin, "notifications", patch, { noti_id }
    );
    if (updErr) throw updErr;

    res.status(200).json({
      message: "Cập nhật thông báo thành công",
      data: updated && updated[0] ? updated[0] : null,
    });
  } catch (err) {
    console.error("updateNotification error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = updateNotification;
