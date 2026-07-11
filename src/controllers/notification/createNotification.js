// controllers/notification/createNotification.js
// Tao notification moi. noti_id la UUID (gen_random_uuid()).
const { insertRows, supabaseAdmin } = require("../../services/supabase.service");

const createNotification = async (req, res) => {
  try {
    const { uid, title, content, icon, color } = req.body;

    if (!uid) return res.status(400).json({ error: "Vui lòng cung cấp uid người nhận" });
    if (!title || !title.trim()) return res.status(400).json({ error: "Vui lòng nhập tiêu đề" });
    if (!content || !content.trim()) return res.status(400).json({ error: "Vui lòng nhập nội dung" });

    const { data: inserted, error: insErr } = await insertRows(
      supabaseAdmin, "notifications",
      {
        uid,
        title: title.trim(),
        content: content.trim(),
        icon: icon || null,
        color: color || null,
      }
    );
    if (insErr) throw insErr;

    res.status(201).json({
      message: "Tạo thông báo thành công",
      data: inserted && inserted[0] ? inserted[0] : null,
    });
  } catch (err) {
    console.error("createNotification error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = createNotification;

