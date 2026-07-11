// controllers/courses/deleteCourse.js
const {
  selectRows,
  deleteRows,
  supabaseAdmin,
} = require("../../services/supabase.service");

const deleteCourse = async (req, res) => {
  try {
    const { course_id } = req.params;
    const { uid } = req.body;
    if (!uid || !course_id)
      return res.status(400).json({ error: "Thiếu uid hoặc course_id" });

    const { data: user, error: uErr } = await selectRows(
      supabaseAdmin,
      "users",
      "role",
      { eq: { uid }, single: true }
    );
    if (uErr) throw uErr;
    if (!user) return res.status(404).json({ error: "Không tìm thấy người dùng" });
    if (user.role !== "admin" && user.role !== "mentor")
      return res.status(403).json({ error: "Bạn không có quyền xóa khóa học" });

    const { data: course, error: cErr } = await selectRows(
      supabaseAdmin,
      "courses",
      "instructor_uid",
      { eq: { course_id: Number(course_id) }, single: true }
    );
    if (cErr) throw cErr;
    if (!course) return res.status(404).json({ error: "Không tìm thấy khóa học để xóa" });

    if (user.role === "mentor" && course.instructor_uid !== uid) {
      return res.status(403).json({ error: "Bạn chỉ được phép xóa khóa học do bạn tạo" });
    }

    const { error: delErr } = await deleteRows(
      supabaseAdmin,
      "courses",
      { course_id: Number(course_id) }
    );
    if (delErr) throw delErr;

    res.status(200).json({ message: "Xóa khóa học thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi xóa khóa học: " + err.message });
  }
};

module.exports = deleteCourse;
