// controllers/users/updateUser.js
// User tu cap nhat ho so. Chi chinh minh hoac admin moi duoc sua.
const { updateRows, insertRows, selectRows, supabaseAdmin } = require("../../services/supabase.service");

const updateUser = async (req, res) => {
  try {
    const { uid } = req.params;
    if (!uid) return res.status(400).json({ error: "Thiếu uid" });

    const authUid = req.supabaseUser?.authUser?.id;
    const role = req.supabaseUser?.profile?.role;
    if (!authUid) return res.status(401).json({ error: "Chưa đăng nhập" });
    if (authUid !== uid && role !== "admin") {
      return res.status(403).json({ error: "Không có quyền cập nhật người dùng này" });
    }

    const { name, bio, phone, gender, birthdate, avatar_url, fcm_token } = req.body;
    const patch = {};
    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ error: "Tên không được để trống" });
      patch.name = String(name).trim();
    }
    if (bio !== undefined) patch.bio = bio ? String(bio).trim() : null;
    if (phone !== undefined) patch.phone = phone ? String(phone).trim() : null;
    if (gender !== undefined) patch.gender = gender ? String(gender).trim() : null;
    if (birthdate !== undefined) patch.birthdate = birthdate || null;
    if (avatar_url !== undefined) patch.avatar_url = avatar_url || null;
    if (fcm_token !== undefined) patch.fcm_token = fcm_token || null;
    if (Object.keys(patch).length === 0)
      return res.status(400).json({ error: "Không có dữ liệu để cập nhật" });
    patch.updated_at = new Date().toISOString();

    const { data: updated, error } = await updateRows(
      supabaseAdmin, "users", patch, { uid }
    );
    if (error) throw error;

    // Tao notification cho user
    try {
      await insertRows(supabaseAdmin, "notifications", {
        uid,
        title: "Thông tin đã được cập nhật",
        content: "Hồ sơ của bạn vừa được cập nhật thành công.",
        icon: "person",
        color: "#4caf50",
      });
    } catch (e) { /* ignore */ }

    res.status(200).json({
      message: "Cập nhật thông tin thành công",
      user: updated && updated[0] ? updated[0] : null,
    });
  } catch (err) {
    console.error("updateUser error:", err);
    res.status(500).json({ error: "Lỗi máy chủ: " + err.message });
  }
};

module.exports = updateUser;
