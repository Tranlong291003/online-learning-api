// controllers/courseCategories/createLesson.js
require("dotenv").config(); // Load .env nếu chưa load ở index.js
const { sql, poolPromise } = require("../../config/db.config");
const axios = require("axios");

// Helper: extract videoId từ URL YouTube
const extractVideoId = (url) => {
  const m = /(?:v=|\/)([A-Za-z0-9_-]{11})/.exec(url || "");
  return m ? m[1] : null;
};

// Parse ISO8601 duration (PT#H#M#S) -> seconds
const parseISODuration = (iso) => {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const h = parseInt(m[1] || 0, 10);
  const min = parseInt(m[2] || 0, 10);
  const s = parseInt(m[3] || 0, 10);
  return h * 3600 + min * 60 + s;
};

// Format seconds -> HH:MM:SS
const formatDuration = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
    s
  ).padStart(2, "0")}`;
};

const createLesson = async (req, res) => {
  const { course_id, title, video_url, content, order, uid } = req.body;

  if (!course_id || !title || !uid) {
    return res.status(400).json({
      error: "Các trường course_id, title và uid là bắt buộc",
    });
  }

  let videoId = null;
  let durationInfo = null;

  try {
    const pool = await poolPromise;
    const request = pool.request();

    // Kiểm tra vai trò người dùng
    request.input("uid", sql.NVarChar, uid);
    const roleQuery = await request.query(`
      SELECT role FROM users WHERE uid = @uid
    `);

    const userRole = roleQuery.recordset[0]?.role;
    if (userRole !== "admin" && userRole !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền tạo bài học" });
    }

    // Kiểm tra khóa học tồn tại
    request.input("course_id", sql.Int, course_id);
    const courseCheck = await request.query(`
      SELECT course_id FROM courses WHERE course_id = @course_id
    `);

    if (courseCheck.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy khóa học" });
    }

    // Xử lý file PDF và Slide (nếu có)
    const pdf_url = req.files?.pdf?.[0]?.filename
      ? `/uploads/lessons/pdf/${req.files.pdf[0].filename}`
      : null;

    const slide_url = req.files?.slide?.[0]?.filename
      ? `/uploads/lessons/slides/${req.files.slide[0].filename}`
      : null;

    // Gán dữ liệu input
    if (video_url) {
      videoId = extractVideoId(video_url);
      if (!videoId) {
        return res.status(400).json({ error: "URL YouTube không hợp lệ" });
      }

      // Gọi YouTube Data API để lấy player + duration
      const API_KEY = process.env.YOUTUBE_API_KEY;
      const resp = await axios.get(
        "https://www.googleapis.com/youtube/v3/videos",
        {
          params: { part: "player,contentDetails", id: videoId, key: API_KEY },
        }
      );

      const item = resp.data.items[0];
      if (!item || !item.player || !item.player.embedHtml) {
        return res
          .status(400)
          .json({ error: "Video này không cho phép nhúng" });
      }
      const iso = item.contentDetails.duration;
      const seconds = parseISODuration(iso);
      const formatted = formatDuration(seconds);
      durationInfo = { raw: iso, seconds, formatted };
    }

    // Thêm bài học
    await request
      .input("title", sql.NVarChar, title)
      .input("video_url", sql.NVarChar, video_url || null)
      .input("video_id", sql.NVarChar, videoId || null) // Lưu videoId vào DB
      .input(
        "video_duration",
        sql.NVarChar,
        durationInfo ? durationInfo.formatted : null
      )
      .input("pdf_url", sql.NVarChar, pdf_url)
      .input("slide_url", sql.NVarChar, slide_url)
      .input("content", sql.NVarChar, content || null)
      .input("order", sql.Int, order || null)
      .input("creator_uid", sql.NVarChar, uid).query(`
        INSERT INTO lessons (
          course_id, title, video_url, video_id, video_duration, pdf_url, slide_url, content, [order], creator_uid, created_at
        ) VALUES (
          @course_id, @title, @video_url, @video_id, @video_duration, @pdf_url, @slide_url, @content, @order, @creator_uid, GETDATE()
        )
      `);

    // Lấy bài học vừa tạo
    const result = await request.query(`
      SELECT * FROM lessons
      WHERE course_id = @course_id AND title = @title
      ORDER BY created_at DESC
    `);

    res.status(201).json({
      message: "Tạo bài học thành công",
      data: result.recordset[0],
    });
  } catch (err) {
    res.status(500).json({
      error: "Lỗi tạo bài học: " + err.message,
    });
  }
};

module.exports = createLesson;
