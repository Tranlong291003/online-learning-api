require("dotenv").config();
const { pool } = require("../../config/db.config");
const axios = require("axios");
const { resolveActorUid } = require("../../middleware/actor");

const extractVideoId = (url) => {
  const m = /(?:v=|\/)([A-Za-z0-9_-]{11})/.exec(url || "");
  return m ? m[1] : null;
};

const parseISODuration = (iso) => {
  // YouTube có thể trả contentDetails.duration = undefined (live stream, video
  // đang xử lý). Gọi .match() trên undefined sẽ ném TypeError -> 500.
  if (typeof iso !== "string") return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const h = parseInt(m[1] || 0, 10);
  const min = parseInt(m[2] || 0, 10);
  const s = parseInt(m[3] || 0, 10);
  return h * 3600 + min * 60 + s;
};

const formatDuration = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const createLesson = async (req, res) => {
  const { course_id, title, video_url, content, order } = req.body;

  if (!course_id || !title) {
    return res.status(400).json({
      error: "Các trường course_id và title là bắt buộc",
    });
  }

  // Lấy uid từ token; chỉ admin mới được thao tác thay người khác
  const uid = resolveActorUid(req, res, req.body.uid);
  if (!uid) return;

  let videoId = null;
  let durationInfo = null;

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

    // Kiểm tra khóa học
    const courseCheck = await pool.query(
      "SELECT course_id FROM courses WHERE course_id = $1",
      [course_id]
    );
    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy khóa học" });
    }

    // Xử lý file
    const pdf_url = req.files?.pdf?.[0]?.filename
      ? `/uploads/lessons/pdf/${req.files.pdf[0].filename}`
      : null;
    const slide_url = req.files?.slide?.[0]?.filename
      ? `/uploads/lessons/slides/${req.files.slide[0].filename}`
      : null;

    // Xử lý video YouTube
    if (video_url) {
      videoId = extractVideoId(video_url);
      if (!videoId) {
        return res.status(400).json({ error: "URL YouTube không hợp lệ" });
      }

      const API_KEY = process.env.YOUTUBE_API_KEY;
      const resp = await axios.get(
        "https://www.googleapis.com/youtube/v3/videos",
        {
          params: { part: "player,contentDetails", id: videoId, key: API_KEY },
        }
      );

      const item = resp.data.items[0];
      if (!item || !item.player || !item.player.embedHtml) {
        return res.status(400).json({ error: "Video này không cho phép nhúng" });
      }
      const iso = item.contentDetails.duration;
      const seconds = parseISODuration(iso);
      const formatted = formatDuration(seconds);
      durationInfo = { raw: iso, seconds, formatted };
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
        video_url || null,
        videoId || null,
        durationInfo ? durationInfo.formatted : null,
        pdf_url,
        slide_url,
        content || null,
        order || null,
        uid,
      ]
    );

    res.status(201).json({
      message: "Tạo bài học thành công",
      data: insertResult.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi tạo bài học: " + err.message });
  }
};

module.exports = createLesson;
