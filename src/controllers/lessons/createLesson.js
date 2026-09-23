const { pool } = require("../../config/db.config");
const { parseOptionalInt } = require("../../utils/parseId");
const { sendServerError } = require("../../utils/errorResponse");
const axios = require("axios");
const { resolveActorUid } = require("../../middleware/actor");
const { canManageCourse } = require("../../utils/access");
const {
  extractVideoId,
  resolveVideoMetadata,
} = require("../../services/youtube");

/**
 * Kiểm tra video có cho phép nhúng (embed) không.
 *
 * Chỉ gọi khi có API key. Không có key thì bỏ qua bước này: trước đây hàm gọi
 * YouTube API vô điều kiện với `key: undefined`, API trả 400/403, và lỗi rơi
 * xuống catch chung thành 500 — mentor không tạo được bài học nào có video.
 *
 * Trả về false kèm thông báo khi chắc chắn video chặn nhúng.
 */
const checkEmbeddable = async (videoId) => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return { ok: true, skipped: true };

  try {
    const resp = await axios.get(
      "https://www.googleapis.com/youtube/v3/videos",
      {
        params: { part: "player", id: videoId, key: apiKey },
        timeout: 8000,
      }
    );
    const item = resp.data?.items?.[0];
    // items rỗng = video không tồn tại / riêng tư / đã xoá.
    if (!item) return { ok: false, reason: "Video không tồn tại hoặc không công khai" };
    if (!item.player?.embedHtml) {
      return { ok: false, reason: "Video này không cho phép nhúng" };
    }
    return { ok: true };
  } catch (err) {
    // Lỗi mạng hoặc hết quota không nên chặn mentor tạo bài học — video vẫn
    // phát được bình thường trên app, chỉ là chưa xác minh được quyền nhúng.
    console.warn(`Không kiểm tra được quyền nhúng video ${videoId}: ${err.message}`);
    return { ok: true, skipped: true };
  }
};

const createLesson = async (req, res) => {
  const { course_id, title, video_url, content, order } = req.body;

  if (!course_id || !title) {
    return res.status(400).json({
      error: "Các trường course_id và title là bắt buộc",
    });
  }

  // "order" là cột integer trong CSDL; chuỗi không phải số sẽ khiến PostgreSQL
  // ném lỗi cú pháp → 500 thay vì 400.
  let orderValue;
  try {
    orderValue = parseOptionalInt(order);
  } catch {
    return res.status(400).json({ error: "order phải là số nguyên không âm" });
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
      return res.status(403).json({ error: "Bạn không có quyền tạo bài học" });
    }

    // Kiểm tra khóa học tồn tại VÀ thuộc quyền người gọi. Thiếu bước kiểm tra
    // sở hữu thì mentor bất kỳ thêm được bài học vào khoá của mentor khác.
    const access = await canManageCourse(course_id, req.user);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    // Xử lý file
    const pdf_url = req.files?.pdf?.[0]?.publicPath || null;
    const slide_url = req.files?.slide?.[0]?.publicPath || null;

    // Xử lý video YouTube
    let videoMeta = { videoId: null, videoUrl: null, videoDuration: null };

    if (video_url) {
      if (!extractVideoId(video_url)) {
        return res.status(400).json({ error: "URL YouTube không hợp lệ" });
      }

      const embed = await checkEmbeddable(extractVideoId(video_url));
      if (!embed.ok) {
        return res.status(400).json({ error: embed.reason });
      }

      videoMeta = await resolveVideoMetadata(video_url);
    }

    // Insert lesson
    const insertResult = await pool.query(
      `INSERT INTO lessons (
        course_id, title, video_url, video_id, video_duration,
        pdf_url, slide_url, content, "order", creator_uid, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *`,
      [
        course_id,
        title,
        videoMeta.videoUrl,
        videoMeta.videoId,
        videoMeta.videoDuration,
        pdf_url,
        slide_url,
        content || null,
        orderValue,
        uid,
      ]
    );

    res.status(201).json({
      message: "Tạo bài học thành công",
      data: insertResult.rows[0],
    });
  } catch (err) {
    sendServerError(res, "Lỗi tạo bài học", err);
  }
};

module.exports = createLesson;
