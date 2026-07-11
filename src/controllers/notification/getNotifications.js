// controllers/notification/getNotifications.js
// Lay danh sach thong bao cua user. Mac dinh chi lay cua chinh user, admin lay duoc tat ca.
const { supabaseAdmin } = require("../../services/supabase.service");

const getNotifications = async (req, res) => {
  try {
    const user_uid = req.supabaseUser?.authUser?.id;
    const role = req.supabaseUser?.profile?.role;
    if (!user_uid) return res.status(401).json({ error: "Chưa đăng nhập" });

    const targetUid = role === "admin" && req.query.uid ? req.query.uid : user_uid;

    const onlyUnread = req.query.unread === "true";
    let query = supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("uid", targetUid)
      .order("created_at", { ascending: false });
    if (onlyUnread) query = query.eq("is_read", false);
    if (req.query.limit) {
      const lim = Number(req.query.limit);
      if (Number.isInteger(lim) && lim > 0) query = query.limit(lim);
    }
    const { data, error } = await query;
    if (error) throw error;

    const unreadCount = (data || []).filter((n) => !n.is_read).length;

    res.status(200).json({
      message: "Danh sách thông báo",
      data: data || [],
      unread_count: unreadCount,
    });
  } catch (err) {
    console.error("getNotifications error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getNotifications;
