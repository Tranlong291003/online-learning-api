const { pool } = require("../../config/db.config");
const { sendServerError } = require("../../utils/errorResponse");
const { resolveActorUid } = require("../../middleware/actor");
const { canManageQuiz } = require("../../utils/access");
const {
  askAi,
  isAiConfigured,
  notConfiguredMessage,
} = require("../../config/ai.config");

const createQuestionFromAi = async (req, res) => {
  const {
    quiz_id,
    topic,
    number = 3,
    difficulty,
    type = "trac_nghiem",
    language = "vi",
  } = req.body;

  if (!quiz_id || !topic) {
    return res.status(400).json({ error: "Thiếu quiz_id hoặc topic" });
  }

  // Lấy uid từ token; chỉ admin mới được thao tác thay người khác
  const uid = resolveActorUid(req, res, req.body.uid);
  if (!uid) return;

  const allowedDifficulties = ["easy", "medium", "hard"];
  if (!allowedDifficulties.includes(difficulty)) {
    return res.status(400).json({
      error: "Giá trị difficulty không hợp lệ. Chỉ chấp nhận: easy, medium, hard",
    });
  }

  // `number` được dùng trực tiếp làm độ dài mảng gọi OpenAI song song, nên phải
  // chặn ở đây: một số lớn (vd 1e6) sẽ tạo hàng trăm nghìn request đồng thời và
  // làm cạn heap của tiến trình Node (server sập OOM).
  const MAX_AI_QUESTIONS = 20;
  const count = Number(number);
  if (!Number.isInteger(count) || count < 1 || count > MAX_AI_QUESTIONS) {
    return res.status(400).json({
      error: `Số lượng câu hỏi không hợp lệ. Chỉ chấp nhận số nguyên từ 1 đến ${MAX_AI_QUESTIONS}`,
    });
  }
  const difficultyMap = { easy: "dễ", medium: "trung bình", hard: "khó" };
  const difficultyText = difficultyMap[difficulty];

  try {
    // Thiếu cấu hình AI là chuyện của môi trường, không phải lỗi người gọi.
    // Trả 503 kèm tên biến còn thiếu để người vận hành biết cần điền gì.
    if (!isAiConfigured()) {
      return res.status(503).json({ error: notConfiguredMessage() });
    }

    // Kiểm tra role
    const roleRes = await pool.query("SELECT role FROM users WHERE uid = $1", [uid]);
    const role = roleRes.rows[0]?.role;
    if (role !== "admin" && role !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền tạo câu hỏi AI" });
    }

    // Kiểm tra quiz + quyền sở hữu. Mentor chỉ được sinh câu hỏi cho quiz do
    // chính mình tạo (xem src/utils/access.js).
    const access = await canManageQuiz(quiz_id, req.user);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const quizType = access.quiz.type;
    if (quizType !== type) {
      return res.status(400).json({
        error: `Loại quiz không khớp: DB là '${quizType}', bạn gửi '${type}'`,
      });
    }

    // Tạo prompt cho 1 câu hỏi.
    //
    // `correct_index_base` được yêu cầu kèm để mô hình TỰ KHAI thứ tự đáp án
    // đúng đếm từ 0 hay từ 1. Đây là cách duy nhất chắc chắn: nhìn vào dữ liệu
    // trả về không phân biệt được (đáp án ở vị trí thứ hai có thể là 1 theo
    // cách đếm từ 0, hoặc 2 theo cách đếm từ 1). Mô hình tự nói ra thì không
    // phải đoán.
    const singlePrompt = (topic, difficulty) => `
Bạn là một chuyên gia giáo dục. Hãy tạo **một câu hỏi trắc nghiệm độc đáo** liên quan đến chủ đề "${topic}".

Yêu cầu:
- **Độ khó**: ${difficulty}
- **Ngôn ngữ**: Tiếng Việt
- **Hình thức**: 4 lựa chọn, 1 đáp án đúng

Định dạng trả về (chỉ JSON, không kèm giải thích, không bọc trong markdown):
{
  "question": "...",
  "options": ["...", "...", "...", "..."],
  "correct_index": 0,
  "correct_index_base": "0"
}

Quan trọng: ghi vào "correct_index_base" xem bạn đang đếm vị trí đáp án đúng
từ 0 hay từ 1 ("0" = lựa chọn đầu tiên là 0, "1" = lựa chọn đầu tiên là 1),
sao cho khớp với giá trị "correct_index" bạn trả về.
`;

    // Gửi nhiều request song song
    const aiTexts = await Promise.all(
      Array.from({ length: count }).map(() =>
        askAi({ prompt: singlePrompt(topic, difficultyText), temperature: 0.7, maxTokens: 700 })
      )
    );

    // Parse kết quả
    let questions = [];
    for (const text of aiTexts) {
      let raw = String(text ?? "").trim();
      if (raw.startsWith("```")) {
        raw = raw.replace(/```json|```/g, "").trim();
      }
      try {
        const q = JSON.parse(raw);
        questions.push(q);
      } catch (err) {
        console.error("Lỗi parse JSON:", raw);
        return res.status(500).json({ error: "AI trả về không đúng định dạng JSON", raw });
      }
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "AI trả về không phải mảng câu hỏi hoặc mảng rỗng" });
    }

    // Validate và quy đổi correct_index về 0-based để lưu.
    //
    // ⚠️ Mỗi mô hình AI có thể đánh số đáp án theo cách khác nhau — có mô hình
    // đếm từ 0, có mô hình đếm từ 1. Trước đây mã LUÔN trừ đi 1, giả định mọi
    // mô hình đều 1-based. Với mô hình trả 0-based thì đáp án đúng bị lưu lệch
    // một bậc, và cả câu hỏi lẫn bài chấm đều sai trong khi API vẫn báo thành
    // công (không có gì báo lỗi).
    //
    // Cách xử lý ở đây không phụ thuộc mô hình: prompt yêu cầu 4 lựa chọn nên
    // giá trị 0..3 chỉ có một cách hiểu (0-based), còn 1..4 chỉ có một cách hiểu
    // (1-based). Chỉ khi giá trị nằm trong khoảng chồng lấn 1..3 mới phải xét:
    //  - mô hình tự khai quy ước (trường correct_index_base) thì theo lời khai;
    //  - nếu không khai, mặc định hiểu là 1-based như hành vi cũ, nhưng trả kèm
    //    trường `canh_bao` để người tạo biết cần soát lại đáp án.
    //
    // Cách này không đọc được ý định của mô hình thay người dùng; nó chỉ bảo đảm
    // giá trị lưu xuống luôn nằm trong khoảng hợp lệ, và nói rõ khi không chắc.
    if (type === "trac_nghiem") {
      for (const q of questions) {
        if (!q.question || typeof q.question !== "string") {
          return res.status(400).json({ error: "Câu hỏi không hợp lệ", question: q });
        }
        if (!Array.isArray(q.options) || q.options.length !== 4) {
          return res.status(400).json({ error: "Options phải là mảng có đúng 4 phần tử", question: q });
        }
        if (
          typeof q.correct_index !== "number" ||
          !Number.isInteger(q.correct_index) ||
          q.correct_index < 0 ||
          q.correct_index > 4
        ) {
          return res.status(400).json({
            error: "correct_index phải là số nguyên trong khoảng 0..4",
            question: q,
          });
        }

        const declared0Based = q.correct_index_base === "0";
        const declared1Based = q.correct_index_base === "1";

        let zeroBased;
        let uncertain = false;

        if (declared0Based) {
          zeroBased = q.correct_index;
        } else if (declared1Based) {
          zeroBased = q.correct_index - 1;
        } else if (q.correct_index === 0) {
          // Chỉ 0-based mới sinh ra giá trị 0.
          zeroBased = 0;
        } else if (q.correct_index === 4) {
          // Chỉ 1-based mới sinh ra giá trị 4 (với 4 lựa chọn).
          zeroBased = 3;
        } else {
          // Khoảng chồng lấn 1..3: không phân biệt được từ dữ liệu trả về.
          zeroBased = q.correct_index - 1;
          uncertain = true;
        }

        if (zeroBased < 0 || zeroBased > 3) {
          return res.status(400).json({
            error: "correct_index nằm ngoài khoảng hợp lệ sau khi quy đổi",
            question: q,
          });
        }

        q._zeroBasedIndex = zeroBased;
        q._indexUncertain = uncertain;
      }
    }

    // Lưu vào DB trong 1 transaction: nếu 1 câu lỗi thì không để lại dữ liệu rác
    const client = await pool.connect();
    let savedQuestions;
    try {
      await client.query("BEGIN");
      savedQuestions = await Promise.all(
        questions.map(async (q) => {
          const question = q.question;
          const options = type === "trac_nghiem" ? JSON.stringify(q.options) : null;
          const correct_index = type === "trac_nghiem" ? q._zeroBasedIndex : null;
          const inserted = await client.query(
            `INSERT INTO quiz_questions (quiz_id, question, options, correct_index, created_at)
             VALUES ($1, $2, $3, $4, NOW())
             RETURNING question_id`,
            [quiz_id, question, options, correct_index]
          );

          // Bỏ các trường nội bộ trước khi trả về, và nói rõ câu nào chưa chắc
          // chắn về vị trí đáp án để người tạo soát lại.
          const { _zeroBasedIndex, _indexUncertain, ...publicQuestion } = q;
          return {
            ...publicQuestion,
            correct_index_stored: correct_index,
            ...(type === "trac_nghiem" && _indexUncertain
              ? {
                  canh_bao:
                    "Không xác định chắc chắn cách đánh số đáp án của mô hình; " +
                    "đã hiểu theo quy ước 1-based. Vui lòng kiểm tra lại đáp án đúng.",
                }
              : {}),
            question_id: inserted.rows[0].question_id,
          };
        })
      );
      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }

    res.status(201).json({
      message: `✅ Đã tạo thành công ${questions.length} câu hỏi từ AI`,
      topic,
      questions: savedQuestions,
    });
  } catch (err) {
    console.error("Lỗi tạo câu hỏi từ AI:", err);

    // Dịch vụ AI bên ngoài hỏng/hết credit/hết hạn mức là lỗi phía upstream,
    // không phải lỗi của API này -> trả 503 để client biết là tạm thời,
    // thay vì 500 khiến người dùng tưởng server mình hỏng.
    const upstreamStatus = err?.status || err?.response?.status;
    if (upstreamStatus === 429) {
      return res.status(503).json({
        error:
          "Dịch vụ AI tạm thời không khả dụng (hết hạn mức). Vui lòng thử lại sau hoặc dùng tạo câu hỏi thủ công.",
      });
    }
    if (upstreamStatus === 401 || upstreamStatus === 403) {
      return res.status(503).json({
        error:
          "Dịch vụ AI tạm thời không khả dụng (API key không hợp lệ). Kiểm tra lại AI_API_KEY trong cấu hình.",
      });
    }
    if (upstreamStatus >= 500 || err?.code === "ETIMEDOUT" || err?.code === "ECONNREFUSED") {
      return res.status(503).json({
        error: "Dịch vụ AI tạm thời không khả dụng. Vui lòng thử lại sau.",
      });
    }

    sendServerError(res, "Lỗi khi tạo câu hỏi từ AI", err);
  }
};

module.exports = createQuestionFromAi;
