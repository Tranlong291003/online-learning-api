const { parsePositiveInt } = require("../../utils/parseId");
const { pool } = require("../../config/db.config");
const { sendServerError } = require("../../utils/errorResponse");
const { resolveActorUid } = require("../../middleware/actor");
const {
  extractVideoId,
  resolveVideoMetadata,
} = require("../../services/youtube");

const updateLesson = async (req, res) => {
  const lesson_id = parsePositiveInt(req.params.lesson_id);
  
  // Tham số phải là số nguyên dương. Nếu để nguyên chuỗi, PostgreSQL
  // ném "invalid input syntax for type integer" và API trả 500 — trong khi
  // lỗi thật là "client gửi sai" nên phải là 400.
  if (!lesson_id) {
    return res.status(400).json({ error: "lesson_id không hợp lệ" });
  }
  const { title, video_url, content, order } = req.body;

  // "order" là cột integer trong CSDL; chuỗi không phải số sẽ khiến PostgreSQL
  // ném lỗi cú pháp → 500 thay vì 400.
  let orderValue;
  if (order !== undefined) {
    try {
      orderValue = parseOptionalInt(order);
    } catch {
      return res.status(400).json({ error: "order phải là số nguyên không âm" });
    }
  }

  // Lấy uid từ token; chỉ admin mới được thao tác thay người khác
  const uid = resolveActorUid(req, res, req.body.uid);
  if (!uid) return;

  try {
    // Kiểm tra vai trò
    const roleResult = await pool.query(
      "SELECT role FROM users WHERE uid = $1",
      [uid]
    );
    const userRole = roleResult.rows[0]?.role;

    if (userRole !== "admin" && userRole !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền cập nhật bài học" });
    }

    // Lấy dữ liệu hiện tại
    const currentResult = await pool.query(
      "SELECT * FROM lessons WHERE lesson_id = $1",
      [lesson_id]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy bài học" });
    }

    const current = currentResult.rows[0];

    // Mentor chỉ được sửa bài học do mình tạo (giống deleteLesson).
    // Không kiểm tra thì mentor bất kỳ sửa được nội dung bài học của mentor khác.
    if (userRole === "mentor" && current.creator_uid !== uid) {
      return res.status(403).json({ error: "Bạn chỉ được cập nhật bài học do bạn tạo" });
    }

    // Xử lý file. File cũ không bị xoá: bản ghi mới nằm ở đường dẫn ngẫu nhiên
    // khác nên không ghi đè, và giữ lại tránh làm hỏng dữ liệu đang trỏ tới nó.
    let newPdfUrl = current.pdf_url;
    let newSlideUrl = current.slide_url;

    if (req.files?.pdf?.[0]) {
      newPdfUrl = req.files.pdf[0].publicPath;
    }

    if (req.files?.slide?.[0]) {
      newSlideUrl = req.files.slide[0].publicPath;
    }

    // Merge dữ liệu
    const updatedTitle = title ?? current.title;
    const updatedContent = content ?? current.content;
    const updatedOrder = orderValue !== undefined ? orderValue : current.order;

    // Đổi video thì phải tính lại video_id/video_duration.
    // Trước đây hai cột này giữ nguyên giá trị cũ sau khi sửa video_url, nên
    // bài học trỏ tới video mới nhưng vẫn mang id và thời lượng của video cũ.
    // Không truyền video_url (undefined) thì giữ nguyên video hiện tại.
    let updatedVideoUrl = current.video_url;
    let updatedVideoId = current.video_id;
    let updatedVideoDuration = current.video_duration;

    if (video_url !== undefined) {
      if (video_url === null || String(video_url).trim() === "") {
        // Cho phép gỡ video khỏi bài học (bài học chỉ còn nội dung chữ).
        updatedVideoUrl = null;
        updatedVideoId = null;
        updatedVideoDuration = null;
      } else {
        if (!extractVideoId(video_url)) {
          return res.status(400).json({ error: "URL YouTube không hợp lệ" });
        }
        const videoMeta = await resolveVideoMetadata(video_url);
        updatedVideoUrl = videoMeta.videoUrl;
        updatedVideoId = videoMeta.videoId;
        updatedVideoDuration = videoMeta.videoDuration;
      }
    }

    // Update
    const updateResult = await pool.query(
      `UPDATE lessons SET
        title = $1,
        video_url = $2,
        video_id = $3,
        video_duration = $4,
        pdf_url = $5,
        slide_url = $6,
        content = $7,
        "order" = $8,
        updated_at = NOW()
      WHERE lesson_id = $9
      RETURNING *`,
      [
        updatedTitle,
        updatedVideoUrl,
        updatedVideoId,
        updatedVideoDuration,
        newPdfUrl,
        newSlideUrl,
        updatedContent,
        updatedOrder,
        lesson_id,
      ]
    );

    res.status(200).json({
      message: "Cập nhật bài học thành công",
      data: updateResult.rows[0],
    });
  } catch (err) {
    sendServerError(res, "Lỗi cập nhật bài học", err);
  }
};

module.exports = updateLesson;
