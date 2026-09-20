/**
 * Trả lỗi 500 mà KHÔNG rò chi tiết nội bộ ra client.
 *
 * Vấn đề: 56 chỗ trong controllers làm `res.status(500).json({ error: "Lỗi ... " + err.message })`.
 * Vì chúng tự gửi response nên đi vòng qua error handler chung ở `app.js` — handler
 * đó có phân biệt `NODE_ENV === "production"` nhưng không bao giờ được dùng tới.
 *
 * Hệ quả đã quan sát được trên production: lỗi khoá ngoại trả về nguyên văn
 *   `insert or update on table "courses" violates foreign key constraint "fk_courses_category_id"`
 * tức là lộ tên bảng, tên cột, tên ràng buộc — đủ để dựng lại lược đồ CSDL.
 *
 * Cách dùng:
 *   } catch (err) {
 *     return sendServerError(res, "Lỗi tạo khóa học", err);
 *   }
 *
 * @param {import("express").Response} res
 * @param {string} context Mô tả ngắn, an toàn để lộ ra ngoài (vd: "Lỗi tạo khóa học").
 * @param {Error} err Lỗi gốc — chỉ ghi vào log, không trả cho client.
 */
function sendServerError(res, context, err) {
  // Log đầy đủ ở server để còn debug được.
  console.error(`[500] ${context}:`, err && err.message ? err.message : err);

  const isProduction = process.env.NODE_ENV === "production";

  return res.status(500).json({
    error: context,
    // Chi tiết chỉ xuất hiện ngoài production, để dev thấy ngay nguyên nhân.
    // Đây là hành vi cũ được giữ nguyên cho môi trường phát triển.
    ...(isProduction ? {} : { detail: err && err.message ? err.message : String(err) }),
  });
}

module.exports = { sendServerError };
