const { sql, poolPromise } = require("../../config/db.config");

const gradeQuizResult = async (req, res) => {
  const { result_id } = req.params; // result_id từ URL
  const { explanation, score, uid } = req.body; // Lấy uid từ body

  if (!explanation || score === undefined || !uid) {
    return res
      .status(400)
      .json({ error: "Thiếu thông tin chấm điểm hoặc giải thích" });
  }

  try {
    const pool = await poolPromise; // Sử dụng poolPromise để kết nối
    const request = new sql.Request(pool);

    // Truy vấn lấy id và role của người chấm điểm dựa trên uid
    request.input("uid", sql.NVarChar, uid);
    const userResult = await request.query(
      "SELECT id, role FROM users WHERE uid = @uid"
    );

    // Kiểm tra nếu không tìm thấy người dùng
    if (userResult.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người chấm điểm" });
    }

    const graded_by = userResult.recordset[0].id; // ID của người chấm điểm
    const userRole = userResult.recordset[0].role; // Role của người dùng

    // Kiểm tra quyền chấm điểm (chỉ admin hoặc giảng viên mới có quyền)
    if (userRole !== "admin" && userRole !== "giang_vien") {
      return res.status(403).json({
        error: "Bạn không có quyền chấm điểm bài kiểm tra",
      });
    }

    // Khai báo các tham số cần thiết
    request.input("result_id", sql.Int, result_id); // Sử dụng result_id
    request.input("explanation", sql.NVarChar, explanation);
    request.input("score", sql.Float, score);
    request.input("graded_by", sql.Int, graded_by);

    // Thực hiện cập nhật điểm và trạng thái bài làm
    const result = await request.query(
      "UPDATE quiz_results SET explanation = @explanation, score = @score, status = 'da_cham', graded_by = @graded_by, graded_at = GETDATE() WHERE result_id = @result_id" // Cập nhật với result_id
    );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Kết quả không tồn tại" });
    }

    res.status(200).json({ message: "Chấm điểm bài kiểm tra thành công" });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Lỗi khi chấm điểm bài kiểm tra: " + err.message });
  }
};

module.exports = gradeQuizResult;
