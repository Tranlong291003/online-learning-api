/**
 * Mô tả request body của từng endpoint, dùng cho Swagger UI.
 *
 * Vì sao cần file riêng: trước đây `swagger.config.js` chỉ suy ra đường dẫn
 * bằng cách duyệt `router.stack` rồi sinh một entry trống — không có
 * `requestBody`, nên Swagger UI chỉ hiện danh sách URL, muốn gọi phải tự viết
 * JSON bằng tay và không biết endpoint cần trường gì.
 *
 * Ở đây mỗi endpoint được khai báo tường minh: trường nào bắt buộc, kiểu gì,
 * ví dụ ra sao. Swagger UI dùng phần này để dựng ô nhập và điền sẵn ví dụ, nên
 * người dùng chỉ cần sửa giá trị rồi bấm Execute.
 *
 * Khoá là "METHOD /đường/dẫn/đầy/đủ" (khớp cách đặt tên trong router).
 *
 * ⚠️ Khi thêm/sửa endpoint, cập nhật cả file này. Bộ kiểm thử
 * `test/api/swagger.test.js` sẽ báo nếu có endpoint thiếu mô tả.
 */

// ---------- Từ viết tắt cho mô tả trường ----------
const t = {
  /** Chuỗi */
  s: (description, example) => ({ type: "string", description, example }),
  /** Số nguyên */
  n: (description, example) => ({ type: "integer", description, example }),
  /** Số thực */
  num: (description, example) => ({ type: "number", description, example }),
  /** Đúng/sai */
  b: (description, example) => ({ type: "boolean", description, example }),
  /** Mảng chuỗi */
  arr: (description, example) => ({
    type: "array",
    description,
    items: { type: "string" },
    example,
  }),
  /** Tệp gửi lên (multipart) */
  file: (description) => ({ type: "string", format: "binary", description }),
  /** Object tự do — dùng cho `answers` của quiz */
  map: (description, example) => ({
    type: "object",
    description,
    additionalProperties: true,
    example,
  }),
  /** Nhận cả số lẫn chuỗi số (nhiều endpoint chấp nhận cả hai) */
  idOrStr: (description, example) => ({
    description: `${description} (nhận cả số lẫn chuỗi số)`,
    oneOf: [{ type: "integer" }, { type: "string" }],
    example,
  }),
};

/** Thân request dạng JSON. */
const json = (properties, required = [], example = null) => ({
  contentType: "application/json",
  properties,
  required,
  example: example || Object.fromEntries(
    required.filter((k) => properties[k]).map((k) => [k, properties[k].example])
  ),
});

/** Thân request dạng form (có tệp gửi kèm). */
const form = (properties, required = [], example = null) => ({
  contentType: "multipart/form-data",
  properties,
  required,
  example: example || Object.fromEntries(
    required.filter((k) => properties[k]).map((k) => [k, properties[k].example])
  ),
});

// ---------- Ví dụ dùng lại nhiều nơi ----------
const DEMO_EMAIL = "student01@demo.onlinelearning.vn";
const DEMO_PASSWORD = "Demo@123456";

/**
 * Bảng mô tả. Nhóm theo router cho dễ tra.
 */
const REQUEST_BODIES = {
  // ===================== /api/auth =====================
  "POST /api/auth/register": json(
    {
      email: t.s("Email đăng nhập (duy nhất)", "nguoidung.moi@example.com"),
      password: t.s("Mật khẩu, tối thiểu 8 ký tự", "MatKhau@123456"),
      name: t.s("Tên hiển thị", "Người dùng mới"),
      avatar_url: t.s("Ảnh đại diện (tuỳ chọn)", "https://example.com/avatar.png"),
      bio: t.s("Giới thiệu ngắn", "Sinh viên CNTT"),
      phone: t.s("Số điện thoại", "0901234567"),
      fcmToken: t.s("Token thông báo đẩy (tuỳ chọn)", ""),
    },
    ["email", "password", "name"]
  ),

  "POST /api/auth/login": json(
    {
      email: t.s("Email hoặc tên đăng nhập", DEMO_EMAIL),
      password: t.s("Mật khẩu", DEMO_PASSWORD),
      fcmToken: t.s("Token thông báo đẩy (tuỳ chọn)", ""),
      remember: t.b("Ghi nhớ đăng nhập (refresh token sống lâu hơn)", false),
    },
    ["email", "password"]
  ),

  "POST /api/auth/refresh": json(
    { refresh_token: t.s("Refresh token nhận được khi đăng nhập", "") },
    ["refresh_token"]
  ),

  "POST /api/auth/forgot-password": json(
    { email: t.s("Email cần đặt lại mật khẩu", DEMO_EMAIL) },
    ["email"]
  ),

  "POST /api/auth/reset-password": json(
    {
      token: t.s("Token nhận từ bước quên mật khẩu", ""),
      new_password: t.s("Mật khẩu mới, tối thiểu 8 ký tự", "MatKhauMoi@123"),
    },
    ["token", "new_password"]
  ),

  "POST /api/auth/change-password": json(
    {
      current_password: t.s("Mật khẩu đang dùng", DEMO_PASSWORD),
      new_password: t.s("Mật khẩu mới", "MatKhauMoi@123"),
    },
    ["current_password", "new_password"]
  ),

  "POST /api/auth/logout": json({
    refresh_token: t.s("Refresh token của phiên hiện tại", ""),
    all_devices: t.b("Đăng xuất khỏi mọi thiết bị", false),
  }),

  // ===================== /api/users =====================
  "POST /api/users/create": json(
    {
      email: t.s("Email đăng nhập", "nguoidung.moi@example.com"),
      password: t.s("Mật khẩu", "MatKhau@123456"),
      name: t.s("Tên hiển thị", "Người dùng mới"),
    },
    ["email", "password", "name"]
  ),

  "POST /api/users/login": json(
    {
      email: t.s("Email", DEMO_EMAIL),
      password: t.s("Mật khẩu", DEMO_PASSWORD),
    },
    ["email", "password"]
  ),

  "PATCH /api/users/:id/status": json(
    { status: t.s("Trạng thái tài khoản: active hoặc disabled", "disabled") },
    ["status"]
  ),

  "PUT /api/users/updaterole": json(
    {
      uid: t.s("uid người dùng cần đổi vai trò", "demo-student-01"),
      role: t.s("Vai trò mới: admin, mentor hoặc user", "mentor"),
    },
    ["uid", "role"]
  ),

  "PUT /api/users/update/:id": form(
    {
      name: t.s("Tên hiển thị", "Trần Văn An"),
      bio: t.s("Giới thiệu ngắn", "Sinh viên năm 3 CNTT"),
      phone: t.s("Số điện thoại", "0901235002"),
      gender: t.s("Giới tính: male hoặc female", "male"),
      birthdate: t.s("Ngày sinh, dạng YYYY-MM-DD", "2003-05-21"),
      avatar: t.file("Ảnh đại diện (JPEG/PNG, tối đa 4MB)"),
    },
    [],
    { name: "Trần Văn An", bio: "Sinh viên năm 3 CNTT" }
  ),

  // ===================== /api/course-categories =====================
  "POST /api/course-categories/create": form(
    {
      name: t.s("Tên danh mục", "Lập trình Web"),
      description: t.s("Mô tả danh mục", "Khoá học về HTML, CSS, JavaScript"),
      icon: t.file("Ảnh icon (JPEG/PNG, tối đa 4MB)"),
    },
    ["name"]
  ),

  "PUT /api/course-categories/update/:category_id": form(
    {
      name: t.s("Tên danh mục", "Lập trình Web"),
      description: t.s("Mô tả danh mục", "Cập nhật mô tả"),
      icon: t.file("Ảnh icon mới (JPEG/PNG)"),
    },
    ["name"]
  ),

  "DELETE /api/course-categories/delete/:category_id": json({
    uid: t.s("Chỉ admin gửi khi thao tác hộ người khác", ""),
  }),

  // ===================== /api/courses =====================
  "POST /api/courses/create": form(
    {
      title: t.s("Tiêu đề khoá học", "HTML CSS từ Zero đến Hero"),
      category_id: t.idOrStr("ID danh mục", 23),
      description: t.s("Mô tả khoá học", "Khoá học nền tảng cho người mới"),
      level: t.s("Cấp độ: beginner, intermediate hoặc advanced", "beginner"),
      price: t.n("Giá gốc (đồng)", 399000),
      discount_price: t.n("Giá khuyến mãi (đồng)", 199000),
      language: t.s("Ngôn ngữ khoá học", "vi"),
      tags: t.arr("Nhãn tìm kiếm (mảng chuỗi hoặc JSON)", ["html", "css"]),
      thumbnail: t.file("Ảnh bìa (JPEG/PNG, tối đa 4MB)"),
    },
    ["title", "category_id"],
    { title: "Khoá học mới", category_id: 23, level: "beginner", price: 399000 }
  ),

  "PUT /api/courses/update/:course_id": form(
    {
      title: t.s("Tiêu đề mới", "Tên khoá học đã sửa"),
      description: t.s("Mô tả mới", ""),
      level: t.s("Cấp độ: beginner, intermediate hoặc advanced", "intermediate"),
      price: t.n("Giá gốc (đồng)", 499000),
      discount_price: t.n("Giá khuyến mãi (đồng)", 299000),
      language: t.s("Ngôn ngữ", "vi"),
      tags: t.arr("Nhãn tìm kiếm", ["html", "css", "frontend"]),
      thumbnail: t.file("Ảnh bìa mới (JPEG/PNG)"),
    },
    [],
    { title: "Tên khoá học đã sửa", price: 499000 }
  ),

  "PATCH /api/courses/:course_id/status": json(
    {
      status: t.s(
        "Trạng thái: approved (admin duyệt), rejected (admin từ chối), pending (mentor gửi lại sau khi bị từ chối)",
        "approved"
      ),
      rejectionReason: t.s("Lý do từ chối — chỉ dùng khi status=rejected", "Thiếu mô tả chi tiết"),
    },
    ["status"]
  ),

  "DELETE /api/courses/delete/:course_id": json({
    uid: t.s("Chỉ admin gửi khi thao tác hộ người khác", ""),
  }),

  // ===================== /api/lessons =====================
  "POST /api/lessons/create": form(
    {
      course_id: t.idOrStr("ID khoá học", 227),
      title: t.s("Tiêu đề bài học", "Bài 1: Giới thiệu HTML"),
      video_url: t.s("Link YouTube (tuỳ chọn, server tự lấy thời lượng)", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
      content: t.s("Nội dung văn bản của bài học", "Nội dung bài học…"),
      order: t.n("Thứ tự trong khoá", 1),
      pdf: t.file("Tài liệu PDF/PPT/PPTX (tối đa 4MB)"),
      slide: t.file("Slide PDF/PPT/PPTX (tối đa 4MB)"),
    },
    ["course_id", "title"],
    { course_id: 227, title: "Bài 1: Giới thiệu HTML", order: 1 }
  ),

  "PUT /api/lessons/update/:lesson_id": form(
    {
      title: t.s("Tiêu đề mới", "Bài 1: Giới thiệu HTML (đã sửa)"),
      video_url: t.s("Link YouTube mới", ""),
      content: t.s("Nội dung mới", ""),
      order: t.n("Thứ tự mới", 2),
      pdf: t.file("Tài liệu PDF mới"),
      slide: t.file("Slide mới"),
    },
    [],
    { title: "Bài 1: Giới thiệu HTML (đã sửa)" }
  ),

  "DELETE /api/lessons/delete/:lesson_id": json({
    uid: t.s("Chỉ admin gửi khi thao tác hộ người khác", ""),
  }),

  "POST /api/lessons/complete": json(
    {
      courseId: t.idOrStr("ID khoá học (phải đã đăng ký)", 227),
      lessonId: t.idOrStr("ID bài học", 708),
    },
    ["courseId", "lessonId"],
    { courseId: 227, lessonId: 708 }
  ),

  // ===================== /api/enrollments =====================
  "POST /api/enrollments/register": json(
    {
      courseId: t.idOrStr("ID khoá học cần đăng ký", 227),
      userUid: t.s("Chỉ admin gửi khi đăng ký hộ người khác", ""),
    },
    ["courseId"],
    { courseId: 227 }
  ),

  // ===================== /api/quizzes =====================
  "POST /api/quizzes/create": json(
    {
      course_id: t.idOrStr("ID khoá học (phải thuộc quyền bạn)", 227),
      title: t.s("Tiêu đề bài kiểm tra", "Quiz cuối khoá HTML CSS"),
      type: t.s("Loại: trac_nghiem (trắc nghiệm) hoặc tu_luan (tự luận)", "trac_nghiem"),
      time_limit: t.n("Thời gian làm bài (phút)", 20),
      attempt_limit: t.n("Số lần được làm", 3),
    },
    ["course_id", "title"],
    { course_id: 227, title: "Quiz cuối khoá HTML CSS", type: "trac_nghiem", time_limit: 20 }
  ),

  "PUT /api/quizzes/update/:quiz_id": json(
    {
      title: t.s("Tiêu đề mới", "Quiz cuối khoá HTML CSS (đã sửa)"),
      type: t.s("Loại bài kiểm tra", "trac_nghiem"),
      time_limit: t.n("Thời gian làm bài (phút)", 30),
      attempt_limit: t.n("Số lần được làm", 2),
    },
    [],
    { title: "Quiz cuối khoá HTML CSS (đã sửa)", time_limit: 30 }
  ),

  "DELETE /api/quizzes/delete/:quiz_id": json({
    uid: t.s("Chỉ admin gửi khi thao tác hộ người khác", ""),
  }),

  // ===================== /api/questions =====================
  "POST /api/questions/createbyuser": json(
    {
      quiz_id: t.idOrStr("ID bài kiểm tra (phải thuộc quyền bạn)", 131),
      question: t.s("Nội dung câu hỏi", "Đơn vị nào co giãn theo font của phần tử cha?"),
      type: t.s("Loại câu hỏi, phải khớp loại của quiz", "trac_nghiem"),
      options: t.arr("Các phương án (bắt buộc với trắc nghiệm)", ["px", "rem", "em", "cm"]),
      correct_index: t.n(
        "Thứ tự đáp án đúng — đếm từ 1 (1 = đáp án đầu tiên). Server lưu 0-based.",
        3
      ),
      expected_keywords: t.s("Từ khoá chấm điểm — chỉ dùng cho câu hỏi tự luận", ""),
    },
    ["quiz_id", "question"],
    {
      quiz_id: 131,
      question: "Đơn vị nào co giãn theo font của phần tử cha?",
      type: "trac_nghiem",
      options: ["px", "rem", "em", "cm"],
      correct_index: 3,
    }
  ),

  "POST /api/questions/createbyai": json(
    {
      quiz_id: t.idOrStr("ID bài kiểm tra (phải thuộc quyền bạn)", 131),
      topic: t.s("Chủ đề để AI sinh câu hỏi", "HTML ngữ nghĩa và Box Model"),
      number: t.n("Số câu hỏi cần sinh (1–20)", 3),
      difficulty: t.s("Độ khó: easy, medium hoặc hard", "medium"),
      type: t.s("Loại câu hỏi: trac_nghiem hoặc tu_luan", "trac_nghiem"),
      language: t.s("Ngôn ngữ câu hỏi", "vi"),
    },
    ["quiz_id", "topic", "difficulty"],
    { quiz_id: 131, topic: "HTML ngữ nghĩa", number: 3, difficulty: "medium", type: "trac_nghiem", language: "vi" }
  ),

  "PUT /api/questions/update/:question_id": json(
    {
      question: t.s("Nội dung câu hỏi mới", "Câu hỏi đã sửa?"),
      options: t.arr("Các phương án (bắt buộc với trắc nghiệm)", ["px", "rem", "em", "cm"]),
      correct_index: t.n("Thứ tự đáp án đúng, đếm từ 1", 4),
      expected_keywords: t.s("Từ khoá chấm điểm (tự luận)", ""),
    },
    [],
    { question: "Câu hỏi đã sửa?", options: ["px", "rem", "em", "cm"], correct_index: 4 }
  ),

  "DELETE /api/questions/delete/:question_id": json({
    uid: t.s("Chỉ admin gửi khi thao tác hộ người khác", ""),
  }),

  // ===================== /api/quiz-results =====================
  "POST /api/quiz-results/submit": json(
    {
      quiz_id: t.idOrStr("ID bài kiểm tra", 131),
      answers: t.map(
        "Map question_id → chỉ số đáp án đã chọn (0-based, khớp correct_index trả về). null = bỏ qua câu này.",
        { "429": 2, "430": 1 }
      ),
      explanation: t.s("Ghi chú của người làm bài (tuỳ chọn)", ""),
    },
    ["quiz_id", "answers"],
    { quiz_id: 131, answers: { "429": 2, "430": 1 } }
  ),

  "PATCH /api/quiz-results/quiz-results/:result_id/grade": json(
    {
      explanation: t.s("Nhận xét của người chấm", "Trình bày rõ ràng, đúng trọng tâm."),
      score: t.num("Điểm (thang 10)", 9),
    },
    ["explanation", "score"],
    { explanation: "Trình bày rõ ràng, đúng trọng tâm.", score: 9 }
  ),

  // ===================== /api/reviews =====================
  "POST /api/reviews/create": json(
    {
      course_id: t.idOrStr("ID khoá học", 227),
      rating: t.n("Điểm đánh giá 1–5", 5),
      comment: t.s("Nhận xét", "Khoá học dễ hiểu, ví dụ sát thực tế."),
      user_uid: t.s("Chỉ admin gửi khi đánh giá hộ người khác", ""),
    },
    ["course_id", "rating"],
    { course_id: 227, rating: 5, comment: "Khoá học dễ hiểu, ví dụ sát thực tế." }
  ),

  "PUT /api/reviews/update/:reviewId": json(
    {
      rating: t.n("Điểm đánh giá mới 1–5", 4),
      comment: t.s("Nhận xét mới", "Đã cập nhật nhận xét."),
      user_uid: t.s("Chỉ admin gửi khi sửa hộ người khác", ""),
    },
    [],
    { rating: 4, comment: "Đã cập nhật nhận xét." }
  ),

  "DELETE /api/reviews/delete/:reviewId": json({
    user_uid: t.s("Chỉ admin gửi khi xoá hộ người khác", ""),
  }),

  // ===================== /api/bookmarks =====================
  "POST /api/bookmarks/create": json(
    {
      courseId: t.idOrStr("ID khoá học cần lưu", 227),
      userUid: t.s("Chỉ admin gửi khi lưu hộ người khác", ""),
    },
    ["courseId"],
    { courseId: 227 }
  ),

  "DELETE /api/bookmarks/delete": json(
    {
      bookmarkId: t.idOrStr("ID bookmark cần xoá", 404),
      userUid: t.s("Chỉ admin gửi khi xoá hộ người khác", ""),
    },
    ["bookmarkId"],
    { bookmarkId: 404 }
  ),

  // ===================== /api/notifications =====================
  "POST /api/notifications/create": json(
    {
      title: t.s("Tiêu đề thông báo", "Thông báo kiểm thử"),
      content: t.s("Nội dung thông báo", "Nội dung kiểm thử"),
      uid: t.s("Người nhận — chỉ admin gửi khi tạo cho người khác", "demo-student-01"),
      icon: t.s("Tên icon hiển thị", "bell"),
      color: t.s("Màu hiển thị (mã hex)", "#2196f3"),
    },
    ["title", "content"],
    { title: "Thông báo kiểm thử", content: "Nội dung kiểm thử", icon: "bell", color: "#2196f3" }
  ),

  "POST /api/notifications": json({
    uid: t.s("Để trống = lấy thông báo của chính mình", ""),
  }),

  "POST /api/notifications/mark-read": json(
    { noti_id: t.s("ID thông báo (định dạng UUID)", "00000000-0000-0000-0000-000000000000") },
    ["noti_id"]
  ),

  "PUT /api/notifications/update/:id": json({
    uid: t.s("Để trống = thao tác trên thông báo của chính mình", ""),
  }),

  "DELETE /api/notifications/delete/:id": json({
    uid: t.s("Để trống = thao tác trên thông báo của chính mình", ""),
  }),

  // ===================== /api/mentor-requests =====================
  "POST /api/mentor-requests": form(
    {
      image: t.file("Ảnh minh chứng (JPEG/PNG, tối đa 4MB) — bắt buộc"),
      user_uid: t.s("Chỉ admin gửi khi gửi hộ người khác", ""),
    },
    ["image"]
  ),

  "PUT /api/mentor-requests/:id/status": json(
    {
      status: t.s("approved (duyệt) hoặc rejected (từ chối)", "approved"),
      reason: t.s("Lý do — chỉ dùng khi từ chối", "Chưa đủ minh chứng kinh nghiệm"),
    },
    ["status"]
  ),

  // ===================== /api/app-stats =====================
  "POST /api/app-stats": json({
    uid: t.s("Để trống = xem thống kê theo tài khoản đang đăng nhập", ""),
  }),
};

/**
 * Tham số trên query (chỉ GET mới cần; tham số đường dẫn do config tự sinh).
 */
const QUERY_PARAMS = {
  "GET /api/enrollments/progress": [
    {
      name: "courseId",
      in: "query",
      required: true,
      description: "ID khoá học cần xem tiến độ",
      schema: { type: "integer" },
      example: 227,
    },
  ],
};

module.exports = { REQUEST_BODIES, QUERY_PARAMS };
