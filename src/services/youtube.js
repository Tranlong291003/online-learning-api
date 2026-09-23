// Tiện ích dùng chung cho mọi thứ liên quan tới video YouTube.
//
// Trước đây `createLesson` tự định nghĩa riêng phần tách video id và gọi
// YouTube API, còn `updateLesson` thì không cập nhật `video_id`/`video_duration`
// khi đổi `video_url` — đổi video xong DB vẫn giữ id và thời lượng của video cũ,
// nên trang chi tiết bài học hiển thị sai. Gom về một chỗ để cả hai đường ghi
// dữ liệu dùng chung một cách xử lý.
//
// Lưu ý: YouTube Data API v3 cần API key. Khi không có key (hoặc key hết quota),
// ta suy ra `video_id` từ URL và để `video_duration` là null thay vì chặn thao
// tác của mentor — độ dài video chỉ là thông tin hiển thị.

const axios = require("axios");

// YouTube dùng 11 ký tự [A-Za-z0-9_-] cho video id.
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Tách video id từ các dạng URL YouTube hay gặp:
 *   https://www.youtube.com/watch?v=<id>
 *   https://youtu.be/<id>
 *   https://www.youtube.com/embed/<id>   |  /v/<id>  |  /shorts/<id>  |  /live/<id>
 * Trả về null nếu không nhận ra.
 */
const extractVideoId = (url) => {
  if (typeof url !== "string" || url.trim() === "") return null;

  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/(?:embed|v|shorts|live)\/([A-Za-z0-9_-]{11})/,
  ];

  for (const re of patterns) {
    const m = re.exec(url);
    if (m) return m[1];
  }
  return null;
};

/** Chuẩn hoá URL về dạng https://www.youtube.com/watch?v=<id>. */
const canonicalWatchUrl = (videoId) =>
  `https://www.youtube.com/watch?v=${videoId}`;

/** Đổi ISO-8601 duration (PT1H2M3S) của YouTube thành số giây. */
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

/**
 * Đổi số giây thành "HH:MM:SS".
 *
 * Schema cột `lessons.video_duration` là VARCHAR(20) và `getAllCourses` chỉ parse
 * hai dạng "HH:MM:SS" / "MM:SS" để cộng tổng thời lượng khoá học, nên luôn xuất
 * ra "HH:MM:SS".
 */
const formatDuration = (seconds) => {
  const total = Number(seconds) || 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

/**
 * Tra thời lượng video qua YouTube Data API v3.
 * Không có API key / lỗi mạng / quota → trả 0 để nơi gọi tự quyết định.
 */
const fetchYoutubeDurationSeconds = async (videoId) => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey || !videoId) return 0;

  try {
    const { data } = await axios.get(
      "https://www.googleapis.com/youtube/v3/videos",
      {
        params: { part: "contentDetails", id: videoId, key: apiKey },
        timeout: 8000,
      }
    );
    const iso = data?.items?.[0]?.contentDetails?.duration;
    return parseISODuration(iso);
  } catch (err) {
    console.warn(
      `Không lấy được thời lượng video ${videoId} từ YouTube API: ${err.message}`
    );
    return 0;
  }
};

/**
 * Từ một URL bất kỳ của người dùng, trả về bộ ba để ghi vào bảng `lessons`.
 *
 * `videoId` luôn được suy ra từ URL (không phụ thuộc API), còn `videoDuration`
 * là null khi không tra được — giữ nguyên NULL thay vì ghi "00:00:00" để FE
 * phân biệt được "chưa biết thời lượng" với "video dài 0 giây".
 */
const resolveVideoMetadata = async (url) => {
  const videoId = extractVideoId(url);
  if (!videoId) {
    return { videoId: null, videoUrl: url ?? null, videoDuration: null };
  }

  const seconds = await fetchYoutubeDurationSeconds(videoId);
  return {
    videoId,
    videoUrl: canonicalWatchUrl(videoId),
    videoDuration: seconds > 0 ? formatDuration(seconds) : null,
  };
};

/** Kiểm tra một video id có thật trên YouTube không (dùng cho script seed). */
const youtubeVideoExists = async (videoId) => {
  if (!VIDEO_ID_RE.test(videoId || "")) return false;
  try {
    const res = await axios.get("https://www.youtube.com/oembed", {
      params: { url: canonicalWatchUrl(videoId), format: "json" },
      timeout: 8000,
      validateStatus: null,
    });
    return res.status === 200;
  } catch {
    return false;
  }
};

module.exports = {
  extractVideoId,
  canonicalWatchUrl,
  parseISODuration,
  formatDuration,
  fetchYoutubeDurationSeconds,
  resolveVideoMetadata,
  youtubeVideoExists,
};
