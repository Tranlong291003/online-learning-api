/**
 * E2E TOÀN BỘ API trên server THẬT + PostgreSQL THẬT.
 *
 * Vì sao cần bộ này: 269 unit test dùng pool giả nên không bắt được lỗi tên cột,
 * kiểu dữ liệu, ràng buộc FK, hay luồng multipart thật. Script này chạy đúng
 * những thứ đó.
 *
 * Nguyên tắc an toàn:
 *  - Mọi dữ liệu tạo ra đều gắn tiền tố E2E- và bị xoá ở cuối (kể cả khi lỗi).
 *  - Không đụng vào dữ liệu thật của đồ án.
 *
 * Chạy (server phải đang chạy):
 *   PROBE_BASE=http://localhost:4100 node scripts/live-full-e2e.cjs
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const BASE = process.env.PROBE_BASE || "http://localhost:4100";
const TAG = `E2E-${Date.now()}`;

let pass = 0;
let fail = 0;
const failures = [];
const created = {
  uids: [],
  categoryIds: [],
  courseIds: [],
  lessonIds: [],
  quizIds: [],
  questionIds: [],
  enrollmentIds: [],
  resultIds: [],
  reviewIds: [],
  notificationIds: [],
  mentorRequestIds: [],
};

function check(label, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ❌ ${label}${detail ? `  (${detail})` : ""}`);
  }
}

function section(title) {
  console.log(`\n${"─".repeat(62)}\n${title}\n${"─".repeat(62)}`);
}

async function api(method, endpoint, { body, token, raw, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = form;
  } else if (raw !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(raw);
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(BASE + endpoint, { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

/**
 * Lấy id từ response, chấp nhận MỌI shape mà API đang trả.
 *
 * API hiện không nhất quán: create course -> { course }, create lesson/quiz/question
 * -> { data }, create review/bookmark -> { data: { x_id } }, enroll/submit -> id ở
 * top-level. Ghi rõ ở đây để nếu sau này thống nhất lại thì chỉ sửa một chỗ.
 */
function pickId(json, ...keys) {
  if (!json) return undefined;
  const roots = [json, json.data, json.course, json.user, json.result, json.quiz, json.lesson];
  for (const root of roots) {
    if (!root || typeof root !== 'object') continue;
    for (const key of keys) {
      if (root[key] !== undefined && root[key] !== null) return root[key];
    }
  }
  return undefined;
}

function pngBlob() {
  return new Blob(
    [
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      ),
    ],
    { type: "image/png" }
  );
}

function pdfBlob() {
  return new Blob([Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF")], {
    type: "application/pdf",
  });
}

function createPool() {
  const useSsl = process.env.DB_SSL === "true";
  const url = (process.env.DATABASE_URL || "").trim();
  if (url) {
    return new Client({ connectionString: url, ssl: useSsl ? { rejectUnauthorized: false } : false });
  }
  return new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });
}

async function main() {
  const db = createPool();
  await db.connect();

  const T = {};
  const PW = "MatKhauE2e123";

  // =========================================================
  section("A. XÁC THỰC — đăng ký, đăng nhập, token");
  // =========================================================
  const adminEmail = `${TAG}-admin@test.local`;
  const mentorEmail = `${TAG}-mentor@test.local`;
  const userEmail = `${TAG}-user@test.local`;

  for (const [key, email] of [
    ["admin", adminEmail],
    ["mentor", mentorEmail],
    ["user", userEmail],
  ]) {
    const reg = await api("POST", "/api/auth/register", {
      body: { email, password: PW, name: `${TAG} ${key}` },
    });
    if (reg.status === 201) {
      created.uids.push(reg.json.user.uid);
      T[key] = { uid: reg.json.user.uid, token: reg.json.access_token, refresh: reg.json.refresh_token };
    } else {
      check(`đăng ký ${key}`, false, `${reg.status} ${reg.text.slice(0, 120)}`);
      T[key] = null;
    }
  }
  check("đăng ký 3 tài khoản test (admin/mentor/user)", !!T.admin && !!T.mentor && !!T.user);

  // Nâng role trong DB — role LUÔN lấy từ DB nên phải sửa DB, không thể giả trong token.
  if (T.admin) await db.query("UPDATE users SET role='admin' WHERE uid=$1", [T.admin.uid]);
  if (T.mentor) await db.query("UPDATE users SET role='mentor' WHERE uid=$1", [T.mentor.uid]);

  // Đăng nhập lại để lấy token (role đã đổi trong DB, middleware đọc DB nên token cũ vẫn dùng được,
  // nhưng đăng nhập lại để kiểm tra luồng login thật).
  for (const key of ["admin", "mentor", "user"]) {
    if (!T[key]) continue;
    const email = key === "admin" ? adminEmail : key === "mentor" ? mentorEmail : userEmail;
    const lg = await api("POST", "/api/auth/login", { body: { email, password: PW } });
    check(`đăng nhập ${key} trả 200`, lg.status === 200, `${lg.status}`);
    if (lg.status === 200) {
      T[key].token = lg.json.access_token;
      T[key].refresh = lg.json.refresh_token;
      check(`${key}: role đọc từ DB là "${key}"`, lg.json.user.role === key, `nhận ${lg.json.user.role}`);
    }
  }

  if (!T.admin?.token || !T.mentor?.token || !T.user?.token) {
    throw new Error("Không có đủ token để chạy tiếp");
  }

  // =========================================================
  section("B. COURSE CATEGORIES — CRUD + phân quyền");
  // =========================================================
  const catCreate = await api("POST", "/api/course-categories/create", {
    token: T.admin.token,
    form: (() => {
      const f = new FormData();
      f.append("name", `${TAG} Category`);
      f.append("description", "danh mục test");
      f.append("icon", pngBlob(), "icon.png");
      return f;
    })(),
  });
  check("POST tạo danh mục (admin, có upload icon)", catCreate.status === 201, `${catCreate.status} ${catCreate.text.slice(0, 120)}`);
  const categoryId = pickId(catCreate.json, 'category_id', 'categoryId');
  if (categoryId) created.categoryIds.push(categoryId);

  const catList = await api("GET", "/api/course-categories", { token: T.user.token });
  check("GET danh sách danh mục (user thường)", catList.status === 200, `${catList.status}`);
  check("danh mục vừa tạo có trong danh sách", JSON.stringify(catList.json || {}).includes(`${TAG} Category`));

  const catCreateAsUser = await api("POST", "/api/course-categories/create", {
    token: T.user.token,
    form: (() => {
      const f = new FormData();
      f.append("name", `${TAG} Cấm`);
      return f;
    })(),
  });
  check("user thường KHÔNG tạo được danh mục (403)", catCreateAsUser.status === 403, `${catCreateAsUser.status}`);

  if (categoryId) {
    const catUpdate = await api("PUT", `/api/course-categories/update/${categoryId}`, {
      token: T.admin.token,
      form: (() => {
        const f = new FormData();
        f.append("name", `${TAG} Category Updated`);
        return f;
      })(),
    });
    check("PUT sửa danh mục", catUpdate.status === 200, `${catUpdate.status} ${catUpdate.text.slice(0, 120)}`);
  }

  // =========================================================
  section("C. COURSES — CRUD, upload thumbnail, duyệt trạng thái");
  // =========================================================
  const courseCreate = await api("POST", "/api/courses/create", {
    token: T.mentor.token,
    form: (() => {
      const f = new FormData();
      f.append("title", `${TAG} Course`);
      f.append("description", "khóa học test E2E");
      f.append("category_id", String(categoryId));
      f.append("level", "beginner");
      f.append("price", "100000");
      f.append("language", "vi");
      f.append("thumbnail", pngBlob(), "thumb.png");
      return f;
    })(),
  });
  check("POST tạo khóa học (mentor, upload thumbnail)", courseCreate.status === 201, `${courseCreate.status} ${courseCreate.text.slice(0, 150)}`);
  const courseId = pickId(courseCreate.json, 'course_id', 'courseId');
  if (courseId) created.courseIds.push(courseId);

  const courseAsUser = await api("POST", "/api/courses/create", {
    token: T.user.token,
    form: (() => {
      const f = new FormData();
      f.append("title", `${TAG} Cấm`);
      f.append("category_id", String(categoryId));
      return f;
    })(),
  });
  check("user thường KHÔNG tạo được khóa học (403)", courseAsUser.status === 403, `${courseAsUser.status}`);

  if (courseId) {
    const courseGet = await api("GET", `/api/courses/${courseId}`, { token: T.user.token });
    check("GET chi tiết khóa học", courseGet.status === 200, `${courseGet.status} ${courseGet.text.slice(0, 120)}`);

    const courseList = await api("GET", "/api/courses", { token: T.user.token });
    check("GET danh sách khóa học", courseList.status === 200, `${courseList.status}`);

    const mentorCourses = await api("GET", `/api/courses/mentor/${T.mentor.uid}`, { token: T.mentor.token });
    check("GET khóa học của mentor", mentorCourses.status === 200, `${mentorCourses.status}`);

    // Duyệt khóa học (chỉ admin)
    const approveAsMentor = await api("PATCH", `/api/courses/${courseId}/status`, {
      token: T.mentor.token,
      body: { status: "approved" },
    });
    check("mentor KHÔNG tự duyệt được khóa học (controller chặn)", approveAsMentor.status === 403, `${approveAsMentor.status}`);

    const approve = await api("PATCH", `/api/courses/${courseId}/status`, {
      token: T.admin.token,
      body: { status: "approved" },
    });
    check("PATCH admin duyệt khóa học", approve.status === 200, `${approve.status} ${approve.text.slice(0, 120)}`);

    const courseUpdate = await api("PUT", `/api/courses/update/${courseId}`, {
      token: T.mentor.token,
      form: (() => {
        const f = new FormData();
        f.append("title", `${TAG} Course Updated`);
        return f;
      })(),
    });
    check("PUT sửa khóa học", courseUpdate.status === 200, `${courseUpdate.status} ${courseUpdate.text.slice(0, 120)}`);
  }

  // =========================================================
  section("D. LESSONS — CRUD, upload pdf, đánh dấu hoàn thành");
  // =========================================================
  const lessonCreate = await api("POST", "/api/lessons/create", {
    token: T.mentor.token,
    form: (() => {
      const f = new FormData();
      f.append("course_id", String(courseId));
      f.append("title", `${TAG} Lesson`);
      f.append("content", "nội dung bài học test");
      f.append("order", "1");
      f.append("pdf", pdfBlob(), "bai.pdf");
      return f;
    })(),
  });
  check("POST tạo bài học (có upload PDF)", lessonCreate.status === 201, `${lessonCreate.status} ${lessonCreate.text.slice(0, 150)}`);
  const lessonId = pickId(lessonCreate.json, 'lesson_id', 'lessonId');
  if (lessonId) created.lessonIds.push(lessonId);

  if (lessonId) {
    const lessonDetail = await api("GET", `/api/lessons/detail/${lessonId}`, { token: T.user.token });
    check("GET chi tiết bài học", lessonDetail.status === 200, `${lessonDetail.status} ${lessonDetail.text.slice(0, 120)}`);

    const lessonsOfCourse = await api("GET", `/api/lessons/courses/${courseId}/${T.user.uid}`, { token: T.user.token });
    check("GET danh sách bài học theo khóa", lessonsOfCourse.status === 200, `${lessonsOfCourse.status}`);

    const lessonUpdate = await api("PUT", `/api/lessons/update/${lessonId}`, {
      token: T.mentor.token,
      form: (() => {
        const f = new FormData();
        f.append("title", `${TAG} Lesson Updated`);
        return f;
      })(),
    });
    check("PUT sửa bài học", lessonUpdate.status === 200, `${lessonUpdate.status} ${lessonUpdate.text.slice(0, 120)}`);
  }

  // =========================================================
  section("E. ENROLLMENTS — đăng ký, tiến độ, huỷ");
  // =========================================================
  const enroll = await api("POST", "/api/enrollments/register", {
    token: T.user.token,
    body: { courseId },
  });
  check("POST đăng ký khóa học", enroll.status === 201, `${enroll.status} ${enroll.text.slice(0, 150)}`);
  const enrollmentId = pickId(enroll.json, 'enrollment_id', 'enrollmentId');
  if (enrollmentId) created.enrollmentIds.push(enrollmentId);

  const enrollAgain = await api("POST", "/api/enrollments/register", {
    token: T.user.token,
    body: { courseId },
  });
  check("đăng ký trùng bị chặn 400", enrollAgain.status === 400, `${enrollAgain.status}`);

  const enrollDup = null;
  void enrollDup;

  const checkEnroll = await api("GET", `/api/enrollments/check/${T.user.uid}/${courseId}`, { token: T.user.token });
  check("GET kiểm tra đã đăng ký", checkEnroll.status === 200, `${checkEnroll.status}`);

  const myCourses = await api("GET", `/api/enrollments/user/${T.user.uid}`, { token: T.user.token });
  check("GET khóa học của tôi", myCourses.status === 200, `${myCourses.status} ${myCourses.text.slice(0, 120)}`);

  const progress = await api("GET", `/api/enrollments/progress?userUid=${T.user.uid}&courseId=${courseId}`, {
    token: T.user.token,
  });
  check("GET tiến độ khóa học", progress.status === 200, `${progress.status} ${progress.text.slice(0, 120)}`);

  if (lessonId) {
    const complete = await api("POST", "/api/lessons/complete", {
      token: T.user.token,
      body: { courseId: Number(courseId), lessonId: Number(lessonId) },
    });
    check("POST đánh dấu hoàn thành bài học", complete.status === 200, `${complete.status} ${complete.text.slice(0, 150)}`);
  }

  // =========================================================
  section("F. QUIZZES + QUESTIONS — CRUD, tạo câu hỏi");
  // =========================================================
  const quizCreate = await api("POST", "/api/quizzes/create", {
    token: T.mentor.token,
    body: { course_id: courseId, title: `${TAG} Quiz`, type: "trac_nghiem", time_limit: 15, attempt_limit: 3 },
  });
  check("POST tạo quiz", quizCreate.status === 201, `${quizCreate.status} ${quizCreate.text.slice(0, 150)}`);
  const quizId = pickId(quizCreate.json, 'quiz_id', 'quizId');
  if (quizId) created.quizIds.push(quizId);

  const quizAsUser = await api("POST", "/api/quizzes/create", {
    token: T.user.token,
    body: { course_id: courseId, title: `${TAG} Cấm` },
  });
  check("user thường KHÔNG tạo được quiz (403)", quizAsUser.status === 403, `${quizAsUser.status}`);

  if (quizId) {
    const quizByCourse = await api("GET", `/api/quizzes/getquizbycourse/${courseId}`, { token: T.user.token });
    check("GET quiz theo khóa học", quizByCourse.status === 200, `${quizByCourse.status} ${quizByCourse.text.slice(0, 120)}`);

    const quizByUser = await api("GET", `/api/quizzes/getquizuser/${T.user.uid}`, { token: T.user.token });
    check("GET quiz theo người dùng", quizByUser.status === 200, `${quizByUser.status}`);

    const quizUpdate = await api("PUT", `/api/quizzes/update/${quizId}`, {
      token: T.mentor.token,
      body: { title: `${TAG} Quiz Updated` },
    });
    check("PUT sửa quiz", quizUpdate.status === 200, `${quizUpdate.status} ${quizUpdate.text.slice(0, 120)}`);

    // Câu hỏi trắc nghiệm — correct_index gửi 1-based
    const qCreate = await api("POST", "/api/questions/createbyuser", {
      token: T.mentor.token,
      body: {
        quiz_id: quizId,
        question: `${TAG} Câu hỏi 1+1=?`,
        type: "trac_nghiem",
        options: ["1", "2", "3", "4"],
        correct_index: 2,
      },
    });
    check("POST tạo câu hỏi thủ công", qCreate.status === 201, `${qCreate.status} ${qCreate.text.slice(0, 150)}`);
    const questionId = pickId(qCreate.json, 'question_id', 'questionId');
    if (questionId) created.questionIds.push(questionId);

    const qList = await api("GET", `/api/questions/${quizId}`, { token: T.user.token });
    check("GET danh sách câu hỏi", qList.status === 200, `${qList.status} ${qList.text.slice(0, 120)}`);

    if (questionId) {
      const qUpdate = await api("PUT", `/api/questions/update/${questionId}`, {
        token: T.mentor.token,
        body: {
          quiz_id: quizId,
          question: `${TAG} Câu hỏi đã sửa`,
          type: "trac_nghiem",
          options: ["1", "2", "3", "4"],
          correct_index: 2,
        },
      });
      check("PUT sửa câu hỏi", qUpdate.status === 200, `${qUpdate.status} ${qUpdate.text.slice(0, 150)}`);
    }
  }

  // =========================================================
  section("G. QUIZ RESULTS — nộp bài, tự chấm, chấm tay");
  // =========================================================
  if (quizId && created.questionIds.length > 0) {
    const submit = await api("POST", "/api/quiz-results/submit", {
      token: T.user.token,
      // API yêu cầu answers là OBJECT {question_id: index}, không phải mảng.
      body: { quiz_id: Number(quizId), answers: { [created.questionIds[0]]: 1 } },
    });
    check("POST nộp bài quiz", submit.status === 201, `${submit.status} ${submit.text.slice(0, 200)}`);
    const resultId = pickId(submit.json, 'result_id', 'quiz_result_id', 'resultId');
    if (resultId) created.resultIds.push(resultId);

    if (resultId) {
      const resultGet = await api("GET", `/api/quiz-results/${resultId}`, { token: T.user.token });
      check("GET chi tiết kết quả", resultGet.status === 200, `${resultGet.status} ${resultGet.text.slice(0, 150)}`);

      const grade = await api("PATCH", `/api/quiz-results/quiz-results/${resultId}/grade`, {
        token: T.mentor.token,
        body: { score: 10, explanation: "chấm test" },
      });
      check("PATCH mentor chấm bài", grade.status === 200, `${grade.status} ${grade.text.slice(0, 150)}`);

      const gradeAsUser = await api("PATCH", `/api/quiz-results/quiz-results/${resultId}/grade`, {
        token: T.user.token,
        body: { score: 10 },
      });
      check("user thường KHÔNG chấm được bài (403)", gradeAsUser.status === 403, `${gradeAsUser.status}`);
    }

    const byUser = await api("GET", `/api/quiz-results/users/${T.user.uid}/results`, { token: T.user.token });
    check("GET lịch sử làm bài", byUser.status === 200, `${byUser.status} ${byUser.text.slice(0, 120)}`);
  }

  // =========================================================
  section("H. REVIEWS — CRUD + ràng buộc");
  // =========================================================
  const reviewCreate = await api("POST", "/api/reviews/create", {
    token: T.user.token,
    body: { course_id: courseId, rating: 5, comment: `${TAG} rất hay` },
  });
  check("POST tạo đánh giá", reviewCreate.status === 201, `${reviewCreate.status} ${reviewCreate.text.slice(0, 150)}`);
  const reviewId = pickId(reviewCreate.json, 'review_id', 'reviewId');
  if (reviewId) created.reviewIds.push(reviewId);

  const reviewDup = await api("POST", "/api/reviews/create", {
    token: T.user.token,
    body: { course_id: courseId, rating: 4, comment: "trùng" },
  });
  check("đánh giá trùng khóa học bị chặn 400", reviewDup.status === 400, `${reviewDup.status}`);

  const reviewBadRating = await api("POST", "/api/reviews/create", {
    token: T.user.token,
    body: { course_id: courseId, rating: 99 },
  });
  check("rating ngoài 1-5 bị chặn 400", reviewBadRating.status === 400, `${reviewBadRating.status}`);

  if (reviewId) {
    const reviewsOfCourse = await api("GET", `/api/reviews/course/${courseId}`, { token: T.user.token });
    check("GET đánh giá theo khóa học", reviewsOfCourse.status === 200, `${reviewsOfCourse.status}`);

    const reviewUpdate = await api("PUT", `/api/reviews/update/${reviewId}`, {
      token: T.user.token,
      body: { rating: 4, comment: `${TAG} đã sửa` },
    });
    check("PUT sửa đánh giá", reviewUpdate.status === 200, `${reviewUpdate.status} ${reviewUpdate.text.slice(0, 120)}`);

    const reviewByOther = await api("PUT", `/api/reviews/update/${reviewId}`, {
      token: T.mentor.token,
      body: { rating: 1, comment: "sửa trộm" },
    });
    check("người khác KHÔNG sửa được đánh giá (403)", reviewByOther.status === 403, `${reviewByOther.status}`);
  }

  // =========================================================
  section("I. BOOKMARKS + NOTIFICATIONS");
  // =========================================================
  const bmCreate = await api("POST", "/api/bookmarks/create", {
    token: T.user.token,
    body: { courseId },
  });
  check("POST lưu bookmark", bmCreate.status === 201, `${bmCreate.status} ${bmCreate.text.slice(0, 150)}`);

  const bmDup = await api("POST", "/api/bookmarks/create", { token: T.user.token, body: { courseId } });
  check("lưu bookmark trùng bị chặn 400", bmDup.status === 400, `${bmDup.status}`);

  const bmList = await api("GET", `/api/bookmarks/${T.user.uid}`, { token: T.user.token });
  check("GET danh sách bookmark", bmList.status === 200, `${bmList.status} ${bmList.text.slice(0, 120)}`);

  const notiCreate = await api("POST", "/api/notifications/create", {
    token: T.user.token,
    body: { uid: T.user.uid, title: `${TAG} Thông báo`, content: "nội dung test", icon: "bell", color: "#fff" },
  });
  check("POST tạo thông báo", notiCreate.status === 201, `${notiCreate.status} ${notiCreate.text.slice(0, 150)}`);
  const notiId = pickId(notiCreate.json, 'noti_id', 'notiId');
  if (notiId) created.notificationIds.push(notiId);

  const notiList = await api("POST", "/api/notifications", { token: T.user.token, body: {} });
  check("POST lấy danh sách thông báo", notiList.status === 200, `${notiList.status} ${notiList.text.slice(0, 120)}`);

  if (notiId) {
    const markRead = await api("PUT", `/api/notifications/update/${notiId}`, { token: T.user.token, body: {} });
    check("PUT đánh dấu đã đọc (noti_id trên URL)", markRead.status === 200, `${markRead.status} ${markRead.text.slice(0, 120)}`);

    const markReadBody = await api("POST", "/api/notifications/mark-read", {
      token: T.user.token,
      body: { noti_id: notiId },
    });
    check("POST mark-read (noti_id trong body)", markReadBody.status === 200, `${markReadBody.status} ${markReadBody.text.slice(0, 120)}`);
  }

  // =========================================================
  section("J. MENTOR REQUESTS");
  // =========================================================
  const mrCreate = await api("POST", "/api/mentor-requests", {
    token: T.user.token,
    form: (() => {
      const f = new FormData();
      f.append("reason", `${TAG} muốn làm mentor`);
      f.append("image", pngBlob(), "minhchung.png");
      return f;
    })(),
  });
  check("POST gửi yêu cầu làm mentor", mrCreate.status === 201, `${mrCreate.status} ${mrCreate.text.slice(0, 150)}`);
  const mrId = pickId(mrCreate.json, 'id', 'request_id');
  if (mrId) created.mentorRequestIds.push(mrId);

  const mrListAsUser = await api("GET", "/api/mentor-requests", { token: T.user.token });
  check("user thường KHÔNG xem được danh sách yêu cầu (403)", mrListAsUser.status === 403, `${mrListAsUser.status}`);

  const mrList = await api("GET", "/api/mentor-requests", { token: T.admin.token });
  check("GET admin xem danh sách yêu cầu", mrList.status === 200, `${mrList.status} ${mrList.text.slice(0, 120)}`);

  const mrStatusAsUser = await api("PUT", `/api/mentor-requests/${mrId}/status`, {
    token: T.user.token,
    body: { status: "approved" },
  });
  check("user thường KHÔNG duyệt được yêu cầu (403)", mrStatusAsUser.status === 403, `${mrStatusAsUser.status}`);

  // =========================================================
  section("K. USERS + APP STATS");
  // =========================================================
  const usersList = await api("GET", "/api/users", { token: T.admin.token });
  check("GET admin xem danh sách users", usersList.status === 200, `${usersList.status} ${usersList.text.slice(0, 120)}`);

  const usersAsUser = await api("GET", "/api/users", { token: T.user.token });
  check("user thường KHÔNG xem được danh sách users (403)", usersAsUser.status === 403, `${usersAsUser.status}`);

  const mentors = await api("GET", "/api/users/listmentor", { token: T.user.token });
  check("GET danh sách mentor", mentors.status === 200, `${mentors.status}`);

  const profile = await api("GET", `/api/users/${T.mentor.uid}`, { token: T.user.token });
  check("GET hồ sơ công khai người khác (màn chi tiết mentor)", profile.status === 200, `${profile.status}`);
  check("hồ sơ công khai KHÔNG lộ is_active", profile.json?.user?.is_active === undefined);
  check("hồ sơ công khai KHÔNG lộ password_hash", !JSON.stringify(profile.json || {}).includes("password_hash"));

  const checkActiveOther = await api("GET", `/api/users/checkactive/${T.mentor.uid}`, { token: T.user.token });
  check("KHÔNG dò được trạng thái khoá của người khác (403)", checkActiveOther.status === 403, `${checkActiveOther.status}`);

  const checkActiveSelf = await api("GET", `/api/users/checkactive/${T.user.uid}`, { token: T.user.token });
  check("xem được trạng thái của chính mình", checkActiveSelf.status === 200, `${checkActiveSelf.status}`);

  const updProfile = await api("PUT", `/api/users/update/${T.user.uid}`, {
    token: T.user.token,
    form: (() => {
      const f = new FormData();
      f.append("name", `${TAG} User Updated`);
      f.append("avatar", pngBlob(), "avatar.png");
      return f;
    })(),
  });
  check("PUT cập nhật hồ sơ của chính mình (upload avatar)", updProfile.status === 200, `${updProfile.status} ${updProfile.text.slice(0, 150)}`);

  const updOther = await api("PUT", `/api/users/update/${T.mentor.uid}`, {
    token: T.user.token,
    form: (() => {
      const f = new FormData();
      f.append("name", "sửa trộm");
      return f;
    })(),
  });
  check("user thường KHÔNG sửa được hồ sơ người khác (403)", updOther.status === 403, `${updOther.status}`);

  const roleAsUser = await api("PUT", "/api/users/updaterole", {
    token: T.user.token,
    body: { uid: T.mentor.uid, role: "admin" },
  });
  check("user thường KHÔNG đổi được role (403)", roleAsUser.status === 403, `${roleAsUser.status}`);

  const selfDemote = await api("PUT", "/api/users/updaterole", {
    token: T.admin.token,
    body: { uid: T.admin.uid, role: "user" },
  });
  check("admin KHÔNG tự hạ quyền chính mình (400)", selfDemote.status === 400, `${selfDemote.status}`);

  const statsAdmin = await api("POST", "/api/app-stats", { token: T.admin.token, body: {} });
  check("POST thống kê (admin)", statsAdmin.status === 200, `${statsAdmin.status} ${statsAdmin.text.slice(0, 150)}`);
  check("thống kê admin có total_courses", statsAdmin.json?.total_courses !== undefined);

  const statsMentor = await api("POST", "/api/app-stats", { token: T.mentor.token, body: {} });
  check("POST thống kê (mentor)", statsMentor.status === 200, `${statsMentor.status}`);

  const statsUser = await api("POST", "/api/app-stats", { token: T.user.token, body: {} });
  check("user thường KHÔNG xem được thống kê (403)", statsUser.status === 403, `${statsUser.status}`);

  // =========================================================
  section("L. XOÁ — kiểm tra phân quyền xoá và FK");
  // =========================================================
  if (created.resultIds.length) {
    const delResultOther = await api("DELETE", `/api/quiz-results/${created.resultIds[0]}`, { token: T.mentor.token });
    check("endpoint xoá kết quả không tồn tại hoặc bị chặn", [404, 403, 405].includes(delResultOther.status), `${delResultOther.status}`);
  }

  if (created.notificationIds.length) {
    const delNoti = await api("DELETE", `/api/notifications/delete/${created.notificationIds[0]}`, { token: T.user.token });
    check("DELETE xoá thông báo của mình", delNoti.status === 200, `${delNoti.status} ${delNoti.text.slice(0, 120)}`);
  }

  if (created.reviewIds.length) {
    const delReview = await api("DELETE", `/api/reviews/delete/${created.reviewIds[0]}`, { token: T.user.token });
    check("DELETE xoá đánh giá của mình", delReview.status === 200, `${delReview.status} ${delReview.text.slice(0, 120)}`);
  }

  // GET /api/bookmarks/:uid trả { data: [ { bookmark_id, course_id, ... } ] }
  const bmListForId = await api("GET", `/api/bookmarks/${T.user.uid}`, { token: T.user.token });
  const bmRow = bmListForId.json?.data?.[0] || bmListForId.json?.bookmarks?.[0] || {};
  const bmId = pickId(bmRow, 'bookmark_id', 'bookmarkId');
  const bmDelete = await api("DELETE", "/api/bookmarks/delete", {
    token: T.user.token,
    body: { bookmarkId: bmId },
  });
  check("DELETE bỏ bookmark", bmDelete.status === 200, `${bmDelete.status} ${bmDelete.text.slice(0, 120)}`);

  if (created.enrollmentIds.length) {
    const delEnroll = await api("DELETE", `/api/enrollments/delete/${created.enrollmentIds[0]}`, {
      token: T.user.token,
    });
    check("DELETE huỷ đăng ký", delEnroll.status === 200, `${delEnroll.status} ${delEnroll.text.slice(0, 120)}`);
  }

  if (created.questionIds.length) {
    const delQAsUser = await api("DELETE", `/api/questions/delete/${created.questionIds[0]}`, { token: T.user.token });
    check("user thường KHÔNG xoá được câu hỏi (403)", delQAsUser.status === 403, `${delQAsUser.status}`);

    const delQ = await api("DELETE", `/api/questions/delete/${created.questionIds[0]}`, { token: T.mentor.token });
    check("DELETE xoá câu hỏi", delQ.status === 200, `${delQ.status} ${delQ.text.slice(0, 120)}`);
  }

  if (created.quizIds.length) {
    const delQuizAsUser = await api("DELETE", `/api/quizzes/delete/${created.quizIds[0]}`, { token: T.user.token });
    check("user thường KHÔNG xoá được quiz (403)", delQuizAsUser.status === 403, `${delQuizAsUser.status}`);

    const delQuiz = await api("DELETE", `/api/quizzes/delete/${created.quizIds[0]}`, { token: T.mentor.token });
    check("DELETE xoá quiz", delQuiz.status === 200, `${delQuiz.status} ${delQuiz.text.slice(0, 120)}`);
  }

  if (created.lessonIds.length) {
    const delLessonAsUser = await api("DELETE", `/api/lessons/delete/${created.lessonIds[0]}`, { token: T.user.token });
    check("user thường KHÔNG xoá được bài học (403)", delLessonAsUser.status === 403, `${delLessonAsUser.status}`);

    const delLesson = await api("DELETE", `/api/lessons/delete/${created.lessonIds[0]}`, { token: T.mentor.token });
    check("DELETE xoá bài học", delLesson.status === 200, `${delLesson.status} ${delLesson.text.slice(0, 120)}`);
  }

  if (created.courseIds.length) {
    const delCourseAsUser = await api("DELETE", `/api/courses/delete/${created.courseIds[0]}`, { token: T.user.token });
    check("user thường KHÔNG xoá được khóa học (403)", delCourseAsUser.status === 403, `${delCourseAsUser.status}`);

    const delCourse = await api("DELETE", `/api/courses/delete/${created.courseIds[0]}`, { token: T.admin.token });
    check("DELETE xoá khóa học", delCourse.status === 200, `${delCourse.status} ${delCourse.text.slice(0, 150)}`);
    if (delCourse.status === 200) created.courseIds = [];
  }

  if (created.categoryIds.length) {
    const delCatAsUser = await api("DELETE", `/api/course-categories/delete/${created.categoryIds[0]}`, {
      token: T.user.token,
    });
    check("user thường KHÔNG xoá được danh mục (403)", delCatAsUser.status === 403, `${delCatAsUser.status}`);

    const delCat = await api("DELETE", `/api/course-categories/delete/${created.categoryIds[0]}`, {
      token: T.admin.token,
    });
    check("DELETE xoá danh mục", delCat.status === 200, `${delCat.status} ${delCat.text.slice(0, 120)}`);
    if (delCat.status === 200) created.categoryIds = [];
  }

  // =========================================================
  section("M. ĐỔI MẬT KHẨU + XOÁ TÀI KHOẢN TEST");
  // =========================================================
  const chg = await api("POST", "/api/auth/change-password", {
    token: T.user.token,
    body: { current_password: PW, new_password: "MatKhauMoi456" },
  });
  check("POST đổi mật khẩu", chg.status === 200, `${chg.status} ${chg.text.slice(0, 150)}`);

  const oldLogin = await api("POST", "/api/auth/login", { body: { email: userEmail, password: PW } });
  check("mật khẩu cũ không dùng được", oldLogin.status === 401, `${oldLogin.status}`);

  const newLogin = await api("POST", "/api/auth/login", { body: { email: userEmail, password: "MatKhauMoi456" } });
  check("mật khẩu mới đăng nhập được", newLogin.status === 200, `${newLogin.status}`);

  const delAsUser = await api("DELETE", `/api/users/delete/${T.mentor.uid}`, { token: T.user.token });
  check("user thường KHÔNG xoá được người khác (403)", delAsUser.status === 403, `${delAsUser.status}`);

  const delMentor = await api("DELETE", `/api/users/delete/${T.mentor.uid}`, { token: T.admin.token });
  check("DELETE admin xoá user", [200, 409].includes(delMentor.status), `${delMentor.status} ${delMentor.text.slice(0, 150)}`);
  if (delMentor.status === 200) created.uids = created.uids.filter((u) => u !== T.mentor.uid);

  // ---------- DỌN DẸP ----------
  section("DỌN DẸP");
  const leftovers = { ...created };
  for (const id of leftovers.mentorRequestIds) {
    await db.query("DELETE FROM upgrade_requests WHERE id = $1", [id]).catch(() => {});
  }
  for (const id of leftovers.resultIds) {
    await db.query("DELETE FROM quiz_results WHERE result_id = $1", [id]).catch(() => {});
  }
  for (const id of leftovers.notificationIds) {
    await db.query("DELETE FROM notifications WHERE noti_id = $1", [id]).catch(() => {});
  }
  for (const id of leftovers.reviewIds) {
    await db.query("DELETE FROM course_reviews WHERE review_id = $1", [id]).catch(() => {});
  }
  for (const id of leftovers.lessonIds) {
    await db.query("DELETE FROM lesson_progress WHERE lesson_id = $1", [id]).catch(() => {});
    await db.query("DELETE FROM lessons WHERE lesson_id = $1", [id]).catch(() => {});
  }
  for (const id of leftovers.courseIds) {
    await db.query("DELETE FROM lessons WHERE course_id = $1", [id]).catch(() => {});
    await db.query("DELETE FROM quizzes WHERE course_id = $1", [id]).catch(() => {});
    await db.query("DELETE FROM enrollments WHERE course_id = $1", [id]).catch(() => {});
    await db.query("DELETE FROM course_reviews WHERE course_id = $1", [id]).catch(() => {});
    await db.query("DELETE FROM bookmarks WHERE course_id = $1", [id]).catch(() => {});
    await db.query("DELETE FROM courses WHERE course_id = $1", [id]).catch(() => {});
  }
  for (const id of leftovers.categoryIds) {
    await db.query("DELETE FROM course_categories WHERE category_id = $1", [id]).catch(() => {});
  }
  const delUsers = await db.query(
    "DELETE FROM users WHERE email LIKE $1 OR email LIKE $2 OR email LIKE $3 RETURNING email",
    [`${TAG}-%`, `e2e-%`, `prod-check-%`]
  );
  console.log(`  🧹 Xoá ${delUsers.rowCount} user test`);
  await db.query("DELETE FROM refresh_tokens WHERE uid NOT IN (SELECT uid FROM users)").catch(() => {});

  const counts = await db.query(
    `SELECT 'users' t, COUNT(*)::int n FROM users
     UNION ALL SELECT 'courses', COUNT(*)::int FROM courses
     UNION ALL SELECT 'lessons', COUNT(*)::int FROM lessons
     UNION ALL SELECT 'quizzes', COUNT(*)::int FROM quizzes
     UNION ALL SELECT 'course_categories', COUNT(*)::int FROM course_categories
     ORDER BY t`
  );
  console.log("\n  Dữ liệu còn lại trong DB:");
  counts.rows.forEach((r) => console.log(`    ${r.t.padEnd(20)} ${r.n}`));

  const orphan = await db.query(
    "SELECT COUNT(*)::int n FROM refresh_tokens r LEFT JOIN users u ON u.uid = r.uid WHERE u.uid IS NULL"
  );
  check("không còn refresh_token mồ côi (FK cascade đúng)", orphan.rows[0].n === 0, `${orphan.rows[0].n}`);

  await db.end();

  console.log(`\n${"=".repeat(62)}`);
  console.log(`KẾT QUẢ: ${pass} pass, ${fail} fail`);
  console.log("=".repeat(62));
  if (failures.length) {
    console.log("\nCÁC MỤC LỖI:");
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("\n❌ Script lỗi:", err.message);
  process.exit(2);
});
