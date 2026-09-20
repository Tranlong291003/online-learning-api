-- =======================================
-- 🎓 DATABASE: OnlineLearningDB (PostgreSQL)
-- =======================================

-- Tạo database (chạy riêng với psql hoặc pgAdmin)
-- CREATE DATABASE online_learning_db;

-- =======================================
-- 🎓 BẢNG users – Người dùng hệ thống
-- =======================================
CREATE TABLE IF NOT EXISTS users (
    -- uid là định danh nghiệp vụ dùng xuyên suốt API (và là đích của mọi FK).
    uid             VARCHAR(50)     PRIMARY KEY,
    -- `id` là khoá kỹ thuật dạng số. quiz_results.graded_by là INT và trỏ vào
    -- cột này, nên nó BẮT BUỘC phải tồn tại — trước đây schema thiếu cột `id`
    -- trong khi vẫn khai FK REFERENCES users(id), khiến file schema không chạy được.
    id              SERIAL          UNIQUE,
    email           VARCHAR(100)    NOT NULL UNIQUE,
    name            VARCHAR(50)     NOT NULL,
    avatar_url      VARCHAR(255)    NULL,
    bio             TEXT            NULL,
    phone           VARCHAR(20)     NULL,
    gender          VARCHAR(10)     NULL,
    birthdate       DATE            NULL,
    role            VARCHAR(20)     NOT NULL DEFAULT 'user',
    -- NULL với tài khoản tạo trước khi API tự quản lý mật khẩu (user cũ bên
    -- Firebase). Không đăng nhập được bằng mật khẩu cho tới khi đặt lại.
    password_hash   VARCHAR(255)    NULL,
    -- Chống dò mật khẩu: đếm số lần sai liên tiếp và tạm khoá khi vượt ngưỡng.
    failed_login_attempts INT       NOT NULL DEFAULT 0,
    locked_until    TIMESTAMP       NULL,
    fcm_token       TEXT            NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP       NULL
);

-- =======================================
-- 🎓 BẢNG refresh_tokens – Phiên đăng nhập dài hạn
-- =======================================
-- Access token là JWT ngắn hạn (15 phút) nên không thể thu hồi giữa chừng.
-- Refresh token nằm trong bảng này mới thu hồi được: logout, đổi mật khẩu, hoặc
-- phát hiện token bị đánh cắp (dùng lại token đã rotate) đều xoá cả họ token.
--
-- CSDL chỉ lưu SHA-256 của token, không lưu token gốc: nếu DB bị lộ thì kẻ tấn
-- công cũng không dùng lại được giá trị trong bảng để lấy access token mới.
CREATE TABLE IF NOT EXISTS refresh_tokens (
    token_id        UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    uid             VARCHAR(50)     NOT NULL,
    token_hash      CHAR(64)        NOT NULL UNIQUE,
    -- Cả họ token (mọi lần rotate của cùng một phiên) chia sẻ family_id. Phát
    -- hiện token cũ bị dùng lại thì xoá theo family_id để vô hiệu hoá cả phiên.
    family_id       UUID            NOT NULL,
    expires_at      TIMESTAMP       NOT NULL,
    revoked_at      TIMESTAMP       NULL,
    replaced_by     UUID            NULL,
    user_agent      VARCHAR(255)    NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
);

-- =======================================
-- 🎓 BẢNG password_resets – Yêu cầu đặt lại mật khẩu
-- =======================================
-- Cũng chỉ lưu SHA-256 của token, cùng lý do như refresh_tokens.
-- `used_at` chặn dùng lại token sau khi đã đặt lại mật khẩu thành công.
CREATE TABLE IF NOT EXISTS password_resets (
    reset_id        UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    uid             VARCHAR(50)     NOT NULL,
    token_hash      CHAR(64)        NOT NULL UNIQUE,
    expires_at      TIMESTAMP       NOT NULL,
    used_at         TIMESTAMP       NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
);

-- =======================================
-- 🎓 BẢNG course_categories – Danh mục khóa học
-- =======================================
CREATE TABLE IF NOT EXISTS course_categories (
    category_id     SERIAL          PRIMARY KEY,
    name            VARCHAR(100)    NOT NULL,
    description     TEXT            NULL,
    icon            TEXT            NULL,
    created_at      TIMESTAMP       DEFAULT NOW(),
    updated_at      TIMESTAMP       NULL
);

-- =======================================
-- 🎓 BẢNG courses – Thông tin khóa học
-- =======================================
CREATE TABLE IF NOT EXISTS courses (
    course_id       SERIAL          PRIMARY KEY,
    title           VARCHAR(200)    NOT NULL,
    description     TEXT            NULL,
    instructor_uid  VARCHAR(50)     NOT NULL,
    category_id     INT             NOT NULL,
    level           VARCHAR(20)     NOT NULL,
    price           INT             NULL,
    discount_price  INT             NULL,
    status          VARCHAR(20)     NULL,
    approved_at     TIMESTAMP       NULL,
    language        VARCHAR(50)     NULL,
    tags            TEXT            NULL,
    thumbnail_url   VARCHAR(255)    NULL,
    created_at      TIMESTAMP       NULL,
    updated_at      TIMESTAMP       NULL,
    rejection_reason TEXT           NULL,
    FOREIGN KEY (instructor_uid) REFERENCES users(uid) ON DELETE NO ACTION,
    FOREIGN KEY (category_id) REFERENCES course_categories(category_id) ON DELETE NO ACTION
);

-- =======================================
-- 🎓 BẢNG lessons – Bài học trong khóa học
-- =======================================
CREATE TABLE IF NOT EXISTS lessons (
    lesson_id       SERIAL          PRIMARY KEY,
    course_id       INT             NOT NULL,
    title           VARCHAR(200)    NULL,
    video_url       VARCHAR(255)    NULL,
    pdf_url         VARCHAR(255)    NULL,
    slide_url       VARCHAR(255)    NULL,
    content         TEXT            NULL,
    "order"         INT             NULL,
    created_at      TIMESTAMP       DEFAULT NOW(),
    updated_at      TIMESTAMP       NULL,
    creator_uid     VARCHAR(50)     NULL,
    video_id        VARCHAR(20)     NULL,
    video_duration  VARCHAR(20)     NULL,
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
    FOREIGN KEY (creator_uid) REFERENCES users(uid) ON DELETE NO ACTION
);

-- =======================================
-- 🎓 BẢNG enrollments – Đăng ký học
-- =======================================
CREATE TABLE IF NOT EXISTS enrollments (
    enrollment_id   SERIAL          PRIMARY KEY,
    user_uid        VARCHAR(50)     NOT NULL,
    course_id       INT             NOT NULL,
    enrolled_at     TIMESTAMP       DEFAULT NOW(),
    FOREIGN KEY (user_uid) REFERENCES users(uid) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE NO ACTION
);

-- =======================================
-- 🎓 BẢNG quizzes – Bài kiểm tra
-- =======================================
CREATE TABLE IF NOT EXISTS quizzes (
    quiz_id         SERIAL          PRIMARY KEY,
    course_id       INT             NOT NULL,
    title           VARCHAR(200)    NOT NULL,
    description     TEXT            NULL,
    type            VARCHAR(20)     NOT NULL DEFAULT 'trac_nghiem',
    time_limit      INT             NULL,
    attempt_limit   INT             NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP       NULL,
    creator_uid     VARCHAR(50)     NOT NULL,
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
    FOREIGN KEY (creator_uid) REFERENCES users(uid) ON DELETE NO ACTION
);

-- =======================================
-- 🎓 BẢNG quiz_questions – Câu hỏi quiz
-- =======================================
CREATE TABLE IF NOT EXISTS quiz_questions (
    question_id     SERIAL          PRIMARY KEY,
    quiz_id         INT             NOT NULL,
    question        TEXT            NOT NULL,
    options         TEXT            NULL,
    correct_index   INT             NULL,
    expected_keywords TEXT          NULL,
    created_at      TIMESTAMP       DEFAULT NOW(),
    updated_at      TIMESTAMP       NULL,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id) ON DELETE CASCADE
);

-- =======================================
-- 🎓 BẢNG quiz_results – Kết quả làm bài
-- =======================================
CREATE TABLE IF NOT EXISTS quiz_results (
    result_id       SERIAL          PRIMARY KEY,
    user_uid        VARCHAR(50)     NOT NULL,
    quiz_id         INT             NOT NULL,
    score           REAL            DEFAULT 0,
    submitted_at    TIMESTAMP       DEFAULT NOW(),
    explanation     TEXT            NULL,
    answers         TEXT            NULL,
    status          VARCHAR(20)     DEFAULT 'cho_cham',
    -- Lưu users.id (INT) chứ không phải users.uid (VARCHAR) — khớp với DB thật
    -- và với gradeQuizResult.js (giá trị $3 là số nguyên).
    graded_by       INT             NULL,
    graded_at       TIMESTAMPTZ     NULL,
    FOREIGN KEY (user_uid) REFERENCES users(uid) ON DELETE CASCADE,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id) ON DELETE NO ACTION,
    FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE NO ACTION
);

-- =======================================
-- 🎓 BẢNG notifications – Thông báo hệ thống
-- =======================================
CREATE TABLE IF NOT EXISTS notifications (
    noti_id         SERIAL          PRIMARY KEY,
    uid             VARCHAR(50)     NOT NULL,
    title           VARCHAR(200)    NOT NULL,
    content         TEXT            NOT NULL,
    icon            VARCHAR(50)     NULL,
    color           VARCHAR(20)     NULL,
    is_read         BOOLEAN         NULL,
    created_at      TIMESTAMP       NULL,
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
);

-- =======================================
-- 🎓 BẢNG lesson_progress – Tiến độ bài học
-- =======================================
CREATE TABLE IF NOT EXISTS lesson_progress (
    progress_id     SERIAL          PRIMARY KEY,
    user_uid        VARCHAR(50)     NOT NULL,
    course_id       INT             NOT NULL,
    lesson_id       INT             NOT NULL,
    is_completed    BOOLEAN         NOT NULL DEFAULT FALSE,
    completed_at    TIMESTAMP       NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    -- completeLesson.js dùng ON CONFLICT (user_uid, course_id, lesson_id) nên
    -- cần unique constraint đúng 3 cột này (khớp DB thật).
    CONSTRAINT uq_lesson_progress_user_course_lesson
        UNIQUE (user_uid, course_id, lesson_id),
    FOREIGN KEY (user_uid) REFERENCES users(uid) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE NO ACTION,
    FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id) ON DELETE NO ACTION
);

-- =======================================
-- 🎓 BẢNG course_reviews – Đánh giá khóa học
-- =======================================
CREATE TABLE IF NOT EXISTS course_reviews (
    review_id       SERIAL          PRIMARY KEY,
    course_id       INT             NOT NULL,
    user_uid        VARCHAR(50)     NOT NULL,
    rating          SMALLINT        NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment         TEXT            NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP       NULL,
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
    FOREIGN KEY (user_uid) REFERENCES users(uid) ON DELETE NO ACTION,
    UNIQUE (course_id, user_uid)
);

-- =======================================
-- 🎓 BẢNG bookmarks – Đánh dấu khóa học
-- =======================================
CREATE TABLE IF NOT EXISTS bookmarks (
    bookmark_id     SERIAL          PRIMARY KEY,
    course_id       INT             NOT NULL,
    user_uid        VARCHAR(50)     NOT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
    FOREIGN KEY (user_uid) REFERENCES users(uid) ON DELETE NO ACTION,
    UNIQUE (course_id, user_uid)
);

-- =======================================
-- 🎓 BẢNG upgrade_requests – Yêu cầu nâng cấp mentor
-- =======================================
CREATE TABLE IF NOT EXISTS upgrade_requests (
    id              SERIAL          PRIMARY KEY,
    user_uid        VARCHAR(50)     NOT NULL,
    status          VARCHAR(20)     NOT NULL,
    reason          VARCHAR(500)    NULL,
    image_url       VARCHAR(255)    NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP       NULL,
    FOREIGN KEY (user_uid) REFERENCES users(uid) ON DELETE CASCADE
);

-- =======================================
-- 🎓 TẠO INDEXES cho performance
-- =======================================
CREATE INDEX IF NOT EXISTS idx_courses_instructor ON courses(instructor_uid);
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category_id);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_uid);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_course ON quizzes(course_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_user ON quiz_results(user_uid);
CREATE INDEX IF NOT EXISTS idx_notifications_uid ON notifications(uid);
CREATE INDEX IF NOT EXISTS idx_upgrade_requests_user ON upgrade_requests(user_uid);
CREATE INDEX IF NOT EXISTS idx_upgrade_requests_status ON upgrade_requests(status);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_uid ON refresh_tokens(uid);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_resets_uid ON password_resets(uid);
