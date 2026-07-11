// controllers/bookmarks/createBookmark.js
// User bookmark mot khoa hoc. UNIQUE (user_uid, course_id) -> 23505 neu da bookmark.
const { insertRows, supabaseAdmin } = require("../../services/supabase.service");

const createBookmark = async (req, res) => {
  try {
    const { course_id } = req.body;
    const user_uid = req.supabaseUser?.authUser?.id;

    if (!user_uid) return res.status(401).json({ error: "Chưa đăng nhập" });
    if (!course_id || isNaN(Number(course_id)))
      return res.status(400).json({ error: "course_id không hợp lệ" });

    const { data: inserted, error: insErr } = await insertRows(
      supabaseAdmin, "bookmarks", { user_uid, course_id: Number(course_id) }
    );
    if (insErr) {
      if (insErr.code === "23505") {
        return res.status(409).json({ error: "Khóa học đã có trong danh sách yêu thích" });
      }
      throw insErr;
    }

    res.status(201).json({
      message: "Đã thêm vào danh sách yêu thích",
      data: inserted && inserted[0] ? inserted[0] : null,
    });
  } catch (err) {
    console.error("createBookmark error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = createBookmark;
