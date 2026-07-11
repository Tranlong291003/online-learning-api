// controllers/courses/updateCourse.js
const { updateRows, selectRows, supabaseAdmin } = require("../../services/supabase.service");
const { uploadBuffer, removeObject } = require("../../services/supabaseStorage.service");

const randomStr = () => Math.random().toString(36).slice(2, 8);

const updateCourse = async (req, res) => {
  let uploadedKey = null;
  try {
    const { course_id } = req.params;
    const { title, description, category_id, price, level, discount_price, status } = req.body;
    const userUid = req.supabaseUser?.authUser?.id;

    if (!userUid) return res.status(401).json({ error: "Chưa đăng nhập" });

    const { data: course, error: findErr } = await selectRows(
      supabaseAdmin, "courses", "*",
      { eq: { course_id: Number(course_id) }, single: true }
    );
    if (findErr) throw findErr;
    if (!course) return res.status(404).json({ error: "Không tìm thấy khóa học" });

    if (course.instructor_uid !== userUid)
      return res.status(403).json({ error: "Bạn không có quyền sửa khóa học này" });

    // Reject neu dang approved va mentor muon doi category (admin cho phep)
    if (category_id && category_id !== course.category_id && course.status === "approved")
      return res.status(400).json({ error: "Khóa học đã được duyệt, không thể đổi danh mục" });

    if (category_id) {
      const { data: cat } = await selectRows(
        supabaseAdmin, "course_categories", "category_id",
        { eq: { category_id: Number(category_id) }, single: true }
      );
      if (!cat) return res.status(404).json({ error: "Danh mục không tồn tại" });
    }

    const patch = { updated_at: new Date().toISOString() };
    if (title && title.trim()) patch.title = title.trim();
    if (description && description.trim()) patch.description = description.trim();
    if (category_id) patch.category_id = Number(category_id);
    if (price !== undefined) patch.price = Number(price) || 0;
    if (discount_price !== undefined) patch.discount_price = discount_price ? Number(discount_price) : null;
    if (level) patch.level = level;
    if (status) patch.status = status;

    // Replace thumbnail neu co file moi
    if (req.file && req.file.buffer) {
      const ext = (req.file.originalname || "").split(".").pop() || "jpg";
      const key = `courses/${Date.now()}-${randomStr()}.${ext}`;
      uploadedKey = key;
      const contentType = req.file.mimetype || "image/jpeg";
      const newUrl = await uploadBuffer("uploads", key, req.file.buffer, contentType);
      patch.thumbnail_url = newUrl;
      // Xoa anh cu (best-effort)
      if (course.thumbnail_url) await removeObject("uploads", course.thumbnail_url).catch(() => {});
    }

    const { error: updErr } = await updateRows(
      supabaseAdmin, "courses", patch, { course_id: Number(course_id) }
    );
    if (updErr) {
      if (uploadedKey) await removeObject("uploads", uploadedKey).catch(() => {});
      throw updErr;
    }

    // Tra ve ban ghi moi
    const { data: fresh } = await selectRows(
      supabaseAdmin, "courses", "*",
      { eq: { course_id: Number(course_id) }, single: true }
    );
    res.status(200).json({ message: "Cập nhật khóa học thành công", data: fresh });
  } catch (err) {
    if (uploadedKey) await removeObject("uploads", uploadedKey).catch(() => {});
    console.error("updateCourse error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = updateCourse;

