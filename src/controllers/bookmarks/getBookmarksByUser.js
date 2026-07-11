// controllers/bookmarks/getBookmarksByUser.js
// Lay danh sach khoa hoc user da bookmark, kem thong tin course.
const { supabaseAdmin } = require("../../services/supabase.service");

const getBookmarksByUser = async (req, res) => {
  try {
    const uid = req.params.uid || req.query.uid || req.supabaseUser?.authUser?.id;
    if (!uid) return res.status(400).json({ error: "Thiếu uid người dùng" });

    if (req.supabaseUser) {
      const self = req.supabaseUser.authUser?.id;
      const role = req.supabaseUser.profile?.role;
      if (self !== uid && role !== "admin") {
        return res.status(403).json({ error: "Không có quyền xem danh sách này" });
      }
    }

    const { data: bookmarks, error: bmErr } = await supabaseAdmin
      .from("bookmarks")
      .select("bookmark_id, course_id, created_at")
      .eq("user_uid", uid)
      .order("created_at", { ascending: false });
    if (bmErr) throw bmErr;
    if (!bookmarks || !bookmarks.length) {
      return res.status(200).json({ message: "Chưa có khóa học yêu thích", data: [] });
    }

    const courseIds = bookmarks.map((b) => b.course_id);
    const { data: courses, error: coursesErr } = await supabaseAdmin
      .from("courses")
      .select("course_id, title, thumbnail_url, instructor_uid, price, discount_price, level, status")
      .in("course_id", courseIds);
    if (coursesErr) throw coursesErr;
    const courseMap = Object.fromEntries((courses || []).map((c) => [c.course_id, c]));

    const data = bookmarks
      .map((b) => ({ ...b, course: courseMap[b.course_id] || null }))
      .filter((b) => b.course);

    res.status(200).json({ message: "Danh sách khóa học yêu thích", data });
  } catch (err) {
    console.error("getBookmarksByUser error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getBookmarksByUser;
