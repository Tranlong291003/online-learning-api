const { pool } = require("../../config/db.config");
const { sendServerError } = require("../../utils/errorResponse");
const { parsePositiveInt } = require("../../utils/parseId");
const { askAi, isAiConfigured } = require("../../config/ai.config");

/**
 * Số câu hỏi xử lý song song trong một lượt.
 *
 * Giới hạn để không mở hàng trăm request tới dịch vụ AI cùng lúc (mỗi request
 * đều tốn quota và bộ nhớ). Trước đây giá trị này là số worker thread.
 */
const EXPLANATION_CONCURRENCY = 5;
const MAX_CONCURRENT_REQUESTS = 20;
/** Ngân sách thời gian cho một lời giải. Quá hạn thì dùng lời giải mặc định. */
const REQUEST_TIMEOUT = 3000;
const DEFAULT_EXPLANATION = "Đáp án đúng vì tuân thủ nội dung bài học.";

/**
 * Cache lời giải theo nội dung câu hỏi.
 *
 * Chỉ có tác dụng trong vòng đời một instance (mỗi lần khởi động lại là mất),
 * nhưng đủ để không gọi lại AI khi học viên mở lại cùng một bài làm.
 */
const explanationCache = new Map();
const EXPLANATION_CACHE_LIMIT = 500;

async function explainQuestion(question, options, correctIndex) {
  const cacheKey = `${question}-${options.join("-")}-${correctIndex}`;
  if (explanationCache.has(cacheKey)) return explanationCache.get(cacheKey);

  // Chưa cấu hình AI thì dùng lời giải mặc định — đây là tiện ích phụ, không
  // được làm hỏng việc trả kết quả bài làm.
  if (!isAiConfigured()) return DEFAULT_EXPLANATION;

  const prompt = `Giải thích chi tiết về câu hỏi: ${question}
Các lựa chọn: ${options.join(" | ")}
Đáp án đúng: ${correctIndex + 1}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const explanation = await askAi({
      prompt,
      temperature: 0.4,
      maxTokens: 200,
      // Ngân sách thời gian ngắn vì việc sinh lời giải chạy song song cho
      // nhiều câu; câu nào quá hạn thì dùng lời giải mặc định.
      timeout: REQUEST_TIMEOUT,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const text = String(explanation ?? "").trim();
    if (!text) return DEFAULT_EXPLANATION;

    // Giới hạn kích thước cache để tiến trình chạy lâu không phình bộ nhớ.
    if (explanationCache.size >= EXPLANATION_CACHE_LIMIT) explanationCache.clear();
    explanationCache.set(cacheKey, text);
    return text;
  } catch (error) {
    return DEFAULT_EXPLANATION;
  }
}

/**
 * Sinh lời giải cho danh sách câu hỏi, giới hạn số request đồng thời.
 *
 * Trước đây hàm này spawn `worker_threads` để chạy song song. Cách đó không
 * dùng được trên Cloudflare Workers (`worker_threads` không được hỗ trợ, và
 * `__filename` cũng không tồn tại), nên mọi bài làm có câu sai đều lỗi 500 trên
 * production. Hàng đợi bất đồng bộ dưới đây chạy được ở cả hai môi trường và
 * không cần khởi tạo thread.
 */
async function buildExplanations(questions) {
  const results = new Array(questions.length);
  let cursor = 0;
  let inFlight = 0;

  return new Promise((resolve) => {
    if (questions.length === 0) return resolve(results);

    const finish = () => {
      if (cursor >= questions.length && inFlight === 0) resolve(results);
    };

    const runNext = () => {
      while (inFlight < EXPLANATION_CONCURRENCY && cursor < questions.length) {
        const index = cursor++;
        const { question, parsedOptions } = questions[index];
        inFlight++;
        explainQuestion(
          question.question,
          parsedOptions,
          question.correct_index
        ).then((explanation) => {
          results[index] = { question_id: question.question_id, explanation };
          inFlight--;
          runNext();
          finish();
        });
      }
      finish();
    };

    runNext();
  });
}

const getQuizResultById = async (req, res) => {
  const result_id = parsePositiveInt(req.params.result_id);

  if (!result_id) {
    return res.status(400).json({ error: "result_id không hợp lệ" });
  }

  try {
    // Lấy kết quả
    const result = await pool.query("SELECT * FROM quiz_results WHERE result_id = $1", [result_id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy kết quả bài làm" });
    }

    const { quiz_id, user_uid: uid, answers: answersData, score, explanation } = result.rows[0];

    // Chống IDOR: chỉ chủ bài làm hoặc admin mới được xem kết quả.
    // Thiếu kiểm tra này thì bất kỳ user đã đăng nhập nào cũng đọc được
    // bài làm + điểm của mọi người khác bằng cách dò result_id.
    const actor = req.user || {};
    if (actor.role !== "admin" && String(actor.uid) !== String(uid)) {
      return res.status(403).json({ error: "Bạn không có quyền xem kết quả này" });
    }

    if (!answersData) {
      return res.status(400).json({ error: "Dữ liệu câu trả lời (answers) đang null hoặc rỗng" });
    }

    let userAnswers;
    try {
      userAnswers = JSON.parse(answersData);
    } catch (error) {
      return res.status(400).json({ error: "Dữ liệu câu trả lời không phải JSON hợp lệ" });
    }

    // JSON.parse("null") trả về null, và Object.keys(null) sẽ ném TypeError -> 500.
    // Dữ liệu cũ trong DB có thể không phải object, nên kiểm tra kiểu trước.
    if (userAnswers === null || typeof userAnswers !== "object" || Array.isArray(userAnswers)) {
      return res.status(400).json({ error: "Dữ liệu câu trả lời không đúng định dạng object" });
    }

    // Lấy câu hỏi
    const questionIds = Object.keys(userAnswers).map((id) => parseInt(id, 10));
    if (questionIds.length === 0) {
      return res.status(400).json({ error: "Không có câu trả lời nào được nộp" });
    }

    const questions = await pool.query(
      `SELECT question_id, question, options, correct_index
       FROM quiz_questions
       WHERE quiz_id = $1 AND question_id = ANY($2)`,
      [quiz_id, questionIds]
    );

    // Chuẩn bị dữ liệu
    const questionsForAI = questions.rows.map((q) => {
      let parsedOptions = [];
      try { parsedOptions = JSON.parse(q.options); } catch (_) {}
      const userAnswer = userAnswers[q.question_id];
      // Cùng lý do như submitQuizResult: đáp án có thể về dạng chuỗi ("1").
      const normalized =
        userAnswer === null || userAnswer === undefined || userAnswer === ""
          ? null
          : Number(userAnswer);
      const isCorrect = normalized !== null && normalized === Number(q.correct_index);
      return { question: q, parsedOptions, userAnswer, isCorrect, needsExplanation: !isCorrect };
    });

    const questionsNeedingExplanation = questionsForAI.filter((q) => q.needsExplanation);

    // Có tham số ?explanations=0 để bỏ qua lời giải AI (dùng cho client chỉ cần
    // điểm, hoặc khi dịch vụ AI chậm). Giới hạn số câu để một request không giữ
    // kết nối quá lâu.
    const wantsExplanations = String(req.query.explanations ?? "1") !== "0";
    const limited = questionsNeedingExplanation.slice(0, MAX_CONCURRENT_REQUESTS * 5);
    const explanationResults = wantsExplanations
      ? await buildExplanations(limited)
      : [];

    const explanationMap = new Map(
      explanationResults.filter(Boolean).map((e) => [e.question_id, e.explanation])
    );

    const questionWithAnswers = questionsForAI.map((q) => ({
      question_id: q.question.question_id,
      question: q.question.question,
      options: q.parsedOptions,
      correct_answer: q.question.correct_index,
      user_answer: q.userAnswer,
      is_correct: q.isCorrect,
      explanation: q.needsExplanation
        ? explanationMap.get(q.question.question_id) || null
        : null,
    }));

    const totalCorrect = questionWithAnswers.filter((q) => q.is_correct).length;
    const totalWrong = questionWithAnswers.length - totalCorrect;

    return res.json({
      message: "Kết quả bài làm",
      data: {
        quiz_id, user_uid: uid, score, explanation,
        total_correct_answers: totalCorrect, total_wrong_answers: totalWrong,
        questions: questionWithAnswers, processing_time: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error(err);
    return sendServerError(res, "Lỗi khi lấy kết quả bài làm", err);
  }
};

module.exports = getQuizResultById;
