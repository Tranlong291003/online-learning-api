// controllers/enrollments/deleteEnrollment.js
// User huy dang ky khoa hoc. Xoa row enrollments (schema khong co cot status).
const { deleteRows, supabaseAdmin } = require("../../services/supabase.service");

const deleteEnrollment = async (req, res) => {
  try {
    const { course_id } = req.body;
    const user_uid = req.supabaseUser?.authUser?.id;

    if (!user_uid) return res.status(401).json({ error: "Chưa đăng nhập" });
    if (!course_id || isNaN(Number(course_id)))
      return res.status(400).json({ error: "course_id không hợp lệ" });

    const { error: delErr } = await deleteRows(
      supabaseAdmin, "enrollments", { user_uid, course_id: Number(course_id) }
    );
    if (delErr) throw delErr;

    res.status(200).json({ message: "Hủy đăng ký khóa học thành công" });
  } catch (err) {
    console.error("deleteEnrollment error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = deleteEnrollment;
