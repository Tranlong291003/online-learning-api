const { pool } = require("../../config/db.config");
const { resolveActorUid } = require("../../middleware/actor");

const createBookmark = async (req, res) => {
  try {
    const { courseId } = req.body;
    if (!courseId) {
      return res.status(400).json({ error: "courseId là bắt buộc" });
    }

    // Lấy uid từ token; chỉ admin mới được bookmark thay người khác
    const userUid = resolveActorUid(req, res, req.body.userUid || req.body.uid);
    if (!userUid) return;

    // Kiểm tra khóa học tồn tại trước khi insert. Nếu bỏ bước này, course_id
    // không tồn tại sẽ vi phạm khoá ngoại và trả 500 kèm tên constraint nội bộ,
    // trong khi lỗi thật là "dữ liệu client gửi sai" (404).
    const courseResult = await pool.query(
      "SELECT course_id FROM courses WHERE course_id = $1",
      [courseId]
    );
    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy khóa học" });
    }

    // Kiểm tra đã bookmark chưa
    const exists = await pool.query(
      "SELECT 1 FROM bookmarks WHERE course_id = $1 AND user_uid = $2",
      [courseId, userUid]
    );

    if (exists.rows.length > 0) {
      return res.status(400).json({ error: "Bạn đã bookmark khóa học này rồi" });
    }

    // Thêm bookmark
    const result = await pool.query(
      `INSERT INTO bookmarks (course_id, user_uid, created_at)
       VALUES ($1, $2, NOW())
       RETURNING bookmark_id`,
      [courseId, userUid]
    );

    const bookmarkId = result.rows[0].bookmark_id;
    return res.status(201).json({ data: { bookmark_id: bookmarkId } });
  } catch (err) {
    return res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = createBookmark;
