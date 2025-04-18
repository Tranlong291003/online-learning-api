const { sql, poolPromise } = require("../../config/db.config");

const getAllCategories = async (req, res) => {
  try {
    // Wait for the pool connection to be established
    const pool = await poolPromise;

    // Use the pool to create a new SQL request
    const request = new sql.Request(pool);

    // Perform the query to get course categories
    const result = await request.query("SELECT * FROM course_categories");

    // Send back the data if the query is successful
    res.status(200).json({
      message: "Lấy danh mục thành công",
      data: result.recordset,
    });
  } catch (err) {
    // Log error for debugging purposes
    console.error("Error fetching course categories:", err);

    // Return a server error if an issue occurs
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getAllCategories;
