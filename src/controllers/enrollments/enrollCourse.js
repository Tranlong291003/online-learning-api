// controllers/enrollments/enrollCourse.js
// User dang ky khoa hoc. UNIQUE (user_uid, course_id) -> 23505 neu da enroll.
const { insertRows, selectRows, supabaseAdmin } = require("../../services/supabase.service");

const enrollCourse = async (req, res) => {
  try {
    const { course_id } = req.body;
    const user_uid = req.supabaseUser?.authUser?.id;

    if (!user_uid) return res.status(401).json({ error: "Chưa đăng nhập" });
    if (!course_id || isNaN(Number(course_id)))
      return res.status(400).json({ error: "course_id không hợp lệ" });

    const { data: course, error: courseErr } = await selectRows(
      supabaseAdmin, "courses", "course_id,title,status,price",
      { eq: { course_id: Number(course_id) }, single: true }
    );
    if (courseErr) throw courseErr;
    if (!course) return res.status(404).json({ error: "Không tìm thấy khóa học" });
    if (course.status !== "approved")
      return res.status(400).json({ error: "Khóa học chưa được duyệt hoặc đã bị từ chối" });

    const { data: inserted, error: insErr } = await insertRows(
      supabaseAdmin, "enrollments", { user_uid, course_id: Number(course_id) }
    );
    if (insErr) {
      if (insErr.code === "23505") {
        return res.status(409).json({ error: "Bạn đã đăng ký khóa học này rồi" });
      }
      throw insErr;
    }

    res.status(201).json({
      message: "Đăng ký khóa học thành công",
      data: inserted && inserted[0] ? inserted[0] : null,
    });
  } catch (err) {
    console.error("enrollCourse error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = enrollCourse;
