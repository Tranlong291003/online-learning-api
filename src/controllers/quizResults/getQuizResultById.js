const { pool } = require("../../config/db.config");
const { sendServerError } = require("../../utils/errorResponse");
const { OpenAI } = require("openai");
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const { parsePositiveInt } = require("../../utils/parseId");

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 1,
    timeout: 3000,
  });
}

const BATCH_SIZE = 5;
const REQUEST_TIMEOUT = 3000;
const MAX_CONCURRENT_WORKERS = 10;
const MAX_CONCURRENT_REQUESTS = 20;
const explanationCache = new Map();

// Worker thread code
if (!isMainThread) {
  const processExplanation = async (question, options, correctIndex) => {
    const cacheKey = `${question}-${options.join("-")}-${correctIndex}`;
    if (explanationCache.has(cacheKey)) return explanationCache.get(cacheKey);

    const prompt = `Giải thích chi tiết về câu hỏi: ${question}
Các lựa chọn: ${options.join(" | ")}
Đáp án đúng: ${correctIndex + 1}`;

    try {
      const openai = getOpenAIClient();
      if (!openai) {
        return "Đáp án đúng vì tuân thủ nội dung bài học.";
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      const aiRes = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 200,
      }, { signal: controller.signal });

      clearTimeout(timeoutId);
      const explanation = aiRes.choices[0].message.content;
      explanationCache.set(cacheKey, explanation);
      return explanation;
    } catch (error) {
      return "Đáp án đúng vì tuân thủ các nguyên tắc và best practice.";
    }
  };

  const processBatch = async () => {
    const { questions } = workerData;
    const promises = questions.map((q) =>
      processExplanation(q.question.question, q.parsedOptions, q.question.correct_index)
        .then((explanation) => ({ question_id: q.question.question_id, explanation }))
    );
    const results = await Promise.all(promises);
    parentPort.postMessage(results);
  };

  processBatch();
}

// Main thread code
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
      const isCorrect = userAnswer !== null && userAnswer === q.correct_index;
      return { question: q, parsedOptions, userAnswer, isCorrect, needsExplanation: !isCorrect };
    });

    const questionsNeedingExplanation = questionsForAI.filter((q) => q.needsExplanation);

    // Xử lý AI với Worker threads
    const totalQuestions = questionsNeedingExplanation.length;
    const optimalWorkers = Math.min(MAX_CONCURRENT_WORKERS, Math.ceil(totalQuestions / BATCH_SIZE));

    const batches = [];
    for (let i = 0; i < totalQuestions; i += BATCH_SIZE) {
      batches.push(questionsNeedingExplanation.slice(i, i + BATCH_SIZE));
    }

    const results = [];
    for (let i = 0; i < batches.length; i += optimalWorkers) {
      const currentBatches = batches.slice(i, i + optimalWorkers);

      // Chạy từng worker, giới hạn số worker đồng thời trong cả request.
      // Không dùng semaphore acquire/release: release trong finally sẽ chạy ngay
      // sau khi tạo Worker (chưa xong việc) nên không giới hạn được gì.
      const runWorker = (batch) =>
        new Promise((resolve, reject) => {
          const worker = new Worker(__filename, { workerData: { questions: batch } });
          worker.on("message", resolve);
          worker.on("error", reject);
          worker.on("exit", (code) => {
            if (code !== 0) reject(new Error(`Worker dừng với mã lỗi ${code}`));
          });
        });

      const batchPromises = [];
      const queue = [...currentBatches];
      const workers = Array.from(
        { length: Math.min(MAX_CONCURRENT_REQUESTS, queue.length) },
        async () => {
          while (queue.length > 0) {
            const batch = queue.shift();
            batchPromises.push(await runWorker(batch));
          }
        }
      );
      await Promise.all(workers);

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.flat());
    }

    const explanationMap = new Map(results.map((e) => [e.question_id, e.explanation]));

    const questionWithAnswers = questionsForAI.map((q) => ({
      question_id: q.question.question_id,
      question: q.question.question,
      options: q.parsedOptions,
      correct_answer: q.question.correct_index,
      user_answer: q.userAnswer,
      is_correct: q.isCorrect,
      explanation: q.needsExplanation ? explanationMap.get(q.question.question_id) : null,
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

if (isMainThread) module.exports = getQuizResultById;
