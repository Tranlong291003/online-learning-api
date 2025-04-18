const { sql, poolConnect, pool } = require("../../config/db.config");

const getResultsByUser = async (req, res) => {
  const { id } = req.params; // user_id từ URL

  try {
    const pool = await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);
    request.input("user_id", sql.Int, id);

    const result = await request.query(
      "SELECT * FROM quiz_results WHERE user_id = @user_id"
    );

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Người dùng chưa có kết quả nào" });
    }

    res.json({
      message: "Kết quả của người học",
      data: result.recordset,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Lỗi khi lấy kết quả người học: " + err.message });
  }
};
module.exports = getResultsByUser;
