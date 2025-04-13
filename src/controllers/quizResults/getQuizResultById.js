const { sql, poolConnect, pool } = require("../../config/db.config");

const getQuizResultById = async (req, res) => {
  const { id } = req.params; // result_id từ URL

  try {
    const pool = await poolConnect; // Kết nối DB
    const request = new sql.Request(pool);

    // Lấy kết quả từ bảng quiz_results
    request.input("result_id", sql.Int, id);
    const result = await request.query(
      "SELECT * FROM quiz_results WHERE result_id = @result_id"
    );

    // Kiểm tra có dữ liệu không
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy kết quả bài làm" });
    }

    const quiz_id = result.recordset[0].quiz_id;
    const answersData = result.recordset[0].answers; // Chuỗi "[3,1,4]" hoặc null
    console.log("Answers Data:", answersData);

    // Kiểm tra trường hợp null hoặc rỗng
    if (!answersData) {
      return res.status(400).json({
        error: "Dữ liệu câu trả lời (answers) đang null hoặc rỗng",
      });
    }

    // Parse thành mảng
    let userAnswers;
    try {
      userAnswers = JSON.parse(answersData);
      // Ở đây userAnswers sẽ trở thành [3,1,4] hoặc [1,2,3,4,1,2], ...
    } catch (error) {
      return res.status(400).json({
        error: "Dữ liệu câu trả lời không phải JSON hợp lệ",
        details: error.message,
      });
    }

    // Lấy danh sách câu hỏi
    request.input("quiz_id", sql.Int, quiz_id);
    const questions = await request.query(
      "SELECT question_id, question, options, correct_index FROM quiz_questions WHERE quiz_id = @quiz_id"
    );

    // Xử lý options của mỗi câu hỏi (thường cũng lưu dạng JSON string)
    const questionWithAnswers = questions.recordset.map((q, index) => {
      let parsedOptions = [];
      try {
        // parse options thành mảng nếu nó là JSON
        parsedOptions = JSON.parse(q.options);
      } catch (parseOptionsError) {
        console.error("Lỗi parse options:", parseOptionsError);
      }

      return {
        question_id: q.question_id,
        question: q.question,
        options: parsedOptions, // Mảng các lựa chọn
        correct_answer: q.correct_index,
        user_answer: userAnswers[index],
      };
    });

    // Trả kết quả về cho client
    return res.json({
      message: "Kết quả bài làm",
      data: {
        quiz_id,
        user_id: result.recordset[0].user_id,
        score: result.recordset[0].score,
        explanation: result.recordset[0].explanation,
        questions: questionWithAnswers,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Lỗi khi lấy kết quả bài làm: " + err.message,
    });
  }
};

module.exports = getQuizResultById;
