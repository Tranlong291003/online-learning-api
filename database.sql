-- =======================================
-- 🎓 DATABASE: OnlineLearningDB
-- =======================================
-- Tạo mới database
CREATE DATABASE OnlineLearningDB;
GO

-- Sử dụng database vừa tạo
USE OnlineLearningDB;
GO

-- =======================================
-- 🎓 BẢNG users – Người dùng hệ thống
-- =======================================
CREATE TABLE users (
    uid         NVARCHAR(50)    PRIMARY KEY,            -- 🔑 Firebase UID làm PK
    email       NVARCHAR(100)   NOT NULL,               -- Email người dùng
    name        NVARCHAR(50)    NOT NULL,               -- Tên hiển thị
    avatar_url  NVARCHAR(255)   NULL,                   -- Ảnh đại diện
    bio         NVARCHAR(MAX)   NULL,                   -- Tiểu sử
    phone       NVARCHAR(20)    NULL,                   -- SĐT
    gender      NVARCHAR(10)    NULL,                   -- Giới tính
    birthdate   DATE            NULL,                   -- Ngày sinh
    role        NVARCHAR(20)    NOT NULL
                              DEFAULT 'user',          -- Vai trò: user | mentor | admin
    fcm_token   NVARCHAR(MAX)   NULL,                   -- Token FCM để gửi push notification
    is_active   BIT             NOT NULL
                              DEFAULT 1,               -- Trạng thái hoạt động
    created_at  DATETIME        NOT NULL
                              DEFAULT GETDATE(),       -- Ngày tạo
    updated_at  DATETIME        NULL                    -- Ngày cập nhật
);
GO

-- =======================================
-- 🎓 BẢNG course_categories – Danh mục khóa học
-- =======================================
CREATE TABLE course_categories (
    category_id   INT PRIMARY KEY IDENTITY(1,1),     -- 🔑 Mã danh mục
    name          NVARCHAR(100)    NOT NULL,          -- Tên danh mục
    description   NVARCHAR(MAX),                      -- Mô tả
    icon          NVARCHAR(MAX),                     -- Biểu tượng (URL hoặc tên)
    created_at    DATETIME        DEFAULT GETDATE(),  -- Ngày tạo
    updated_at    DATETIME                           -- Ngày cập nhật
);
GO

-- =======================================
-- 🎓 BẢNG courses – Thông tin khóa học
-- =======================================
CREATE TABLE courses (
    course_id       INT             IDENTITY(1,1) PRIMARY KEY,  -- 🔑 Mã khóa học tự tăng
    title           NVARCHAR(200)   NOT NULL,                   -- Tên khóa học
    description     NVARCHAR(MAX)   NULL,                       -- Mô tả
    instructor_uid  NVARCHAR(50)    NOT NULL,                   -- FK → users(uid)
    category_id     INT             NOT NULL,                   -- FK → course_categories(category_id)
    level           NVARCHAR(20)    NOT NULL,                   -- Trình độ: co_ban | trung_cap | nang_cao
    price           INT             NULL,                       -- Giá gốc (NULL nếu không đặt)
    discount_price  INT             NULL,                       -- Giá khuyến mãi
    status          NVARCHAR(20)    NULL,                       -- Trạng thái: cho_duyet | dang_hoc | hoan_thanh | ...
    approved_at     DATETIME        NULL,                       -- Ngày duyệt
    language        NVARCHAR(50)    NULL,                       -- Ngôn ngữ
    tags            NVARCHAR(MAX)   NULL,                       -- Từ khóa tìm kiếm
    thumbnail_url   NVARCHAR(255)   NULL,                       -- URL ảnh thu nhỏ
    created_at      DATETIME        NULL,                       -- Ngày tạo
    updated_at      DATETIME        NULL,                       -- Ngày cập nhật
    rejection_reason NVARCHAR(MAX)  NULL,                       -- Lý do từ chối (nếu status = rejeted)
    FOREIGN KEY (instructor_uid) REFERENCES users(uid) ON DELETE NO ACTION,
    FOREIGN KEY (category_id)      REFERENCES course_categories(category_id) ON DELETE NO ACTION
);
GO

-- =======================================
-- 🎓 BẢNG lessons – Bài học trong khóa học
-- =======================================
CREATE TABLE lessons (
    lesson_id      INT             IDENTITY(1,1) PRIMARY KEY,  -- 🔑 Mã bài học tự tăng
    course_id      INT             NOT NULL,                   -- FK → courses(course_id)
    title          NVARCHAR(200)   NULL,                       -- Tên bài học
    video_url      NVARCHAR(255)   NULL,                       -- Link video
    pdf_url        NVARCHAR(255)   NULL,                       -- Link PDF
    slide_url      NVARCHAR(255)   NULL,                       -- Link slide
    content        NVARCHAR(MAX)   NULL,                       -- Nội dung bài học
    [order]        INT             NULL,                       -- Thứ tự hiển thị
    created_at     DATETIME        NULL  DEFAULT GETDATE(),    -- Ngày tạo
    updated_at     DATETIME        NULL,                       -- Ngày cập nhật
    creator_uid    NVARCHAR(50)    NULL,                       -- FK → users(uid), người tạo bài
    video_id       NVARCHAR(20)    NULL,                       -- ID nội bộ video (nếu cần)
    video_duration NVARCHAR(20)    NULL,                       -- Thời lượng video
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
    FOREIGN KEY (creator_uid) REFERENCES users(uid) ON DELETE NO ACTION
);
GO

-- =======================================
-- 🎓 BẢNG enrollments – Đăng ký học
-- =======================================
CREATE TABLE enrollments (
    enrollment_id INT PRIMARY KEY IDENTITY(1,1),     -- 🔑 Mã đăng ký
    user_uid      NVARCHAR(50) NOT NULL,            -- FK → users(uid)
    course_id     INT           NOT NULL,            -- FK → courses
    enrolled_at   DATETIME      DEFAULT GETDATE(),   -- Ngày đăng ký
    FOREIGN KEY (user_uid)  REFERENCES users(uid)       ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE NO ACTION
);
GO

-- =======================================
-- 🎓 BẢNG quizzes – Bài kiểm tra
-- =======================================
CREATE TABLE quizzes (
    quiz_id        INT             IDENTITY(1,1) PRIMARY KEY,   -- 🔑 Mã quiz tự tăng
    course_id      INT             NOT NULL,                     -- FK → courses(course_id)
    title          NVARCHAR(200)   NOT NULL,                     -- Tiêu đề
    description    NVARCHAR(MAX)   NULL,                         -- Mô tả quiz
    [type]         NVARCHAR(20)    NOT NULL
                   CONSTRAINT DF_quizzes_type DEFAULT 'trac_nghiem',  -- Loại quiz (trac_nghiem | tu_luan | …)
    time_limit     INT             NULL,                         -- Giới hạn thời gian (phút)
    attempt_limit  INT             NULL,                         -- Số lần làm tối đa
    created_at     DATETIME        NOT NULL
                   CONSTRAINT DF_quizzes_created_at DEFAULT GETDATE(), -- Ngày tạo
    updated_at     DATETIME        NULL,                         -- Ngày cập nhật
    creator_uid    NVARCHAR(50)    NOT NULL,                     -- FK → users(uid), người tạo quiz
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
    FOREIGN KEY (creator_uid) REFERENCES users(uid) ON DELETE NO ACTION
);
GO

-- =======================================
-- 🎓 BẢNG quiz_questions – Câu hỏi quiz
-- =======================================
CREATE TABLE quiz_questions (
    question_id       INT             IDENTITY(1,1) PRIMARY KEY,    -- 🔑 Mã câu hỏi tự tăng
    quiz_id           INT             NOT NULL,                     -- FK → quizzes(quiz_id)
    question          NVARCHAR(MAX)   NOT NULL,                     -- Nội dung câu hỏi
    options           NVARCHAR(MAX)   NULL,                         -- Các lựa chọn (JSON/text)
    correct_index     INT             NULL,                         -- Chỉ số đáp án đúng (0-based)
    expected_keywords NVARCHAR(MAX)   NULL,                         -- Từ khóa kỳ vọng (tự luận)
    created_at        DATETIME        NULL  DEFAULT GETDATE(),      -- Ngày tạo
    updated_at        DATETIME        NULL,                         -- Ngày cập nhật
    FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id) ON DELETE CASCADE
);
GO

-- =======================================
-- 🎓 BẢNG quiz_results – Kết quả làm bài
-- =======================================
CREATE TABLE quiz_results (
    result_id      INT PRIMARY KEY IDENTITY(1,1),   -- 🔑 Mã kết quả
    user_uid       NVARCHAR(50) NOT NULL,          -- FK → users(uid)
    quiz_id        INT           NOT NULL,          -- FK → quizzes
    score          FLOAT         DEFAULT 0,         -- Điểm số
    submitted_at   DATETIME      DEFAULT GETDATE(), -- Thời gian nộp
    explanation    NVARCHAR(MAX),                    -- Feedback/Giải thích
    answers        NVARCHAR(MAX),                    -- Câu trả lời (JSON/text)
    status         NVARCHAR(20) DEFAULT 'cho_cham', -- Trạng thái
    graded_by_uid  NVARCHAR(50),                   -- Người chấm (uid)
    graded_at      DATETIME,                        -- Thời gian chấm
    FOREIGN KEY (user_uid)       REFERENCES users(uid)       ON DELETE CASCADE,
    FOREIGN KEY (quiz_id)        REFERENCES quizzes(quiz_id) ON DELETE NO ACTION,
    FOREIGN KEY (graded_by_uid)  REFERENCES users(uid)       ON DELETE NO ACTION
);
GO

-- =======================================
-- 🎓 BẢNG notifications – Thông báo hệ thống
-- =======================================
CREATE TABLE notifications (
    noti_id     INT             IDENTITY(1,1) PRIMARY KEY,  -- 🔑 Mã thông báo tự tăng
    uid         NVARCHAR(50)    NOT NULL,                   -- FK → users(uid)
    title       NVARCHAR(200)   NOT NULL,                   -- Tiêu đề
    content     NVARCHAR(MAX)   NOT NULL,                   -- Nội dung
    icon        NVARCHAR(50)    NULL,                       -- Biểu tượng (tùy chọn)
    color       NVARCHAR(20)    NULL,                       -- Màu (tùy chọn)
    is_read     BIT             NULL,                       -- Trạng thái đã đọc
    created_at  DATETIME        NULL,                       -- Thời điểm tạo
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
);
GO

-- =======================================
-- 🎓 BẢNG lesson_progress – Tiến độ bài học
-- =======================================
CREATE TABLE lesson_progress (
    user_uid     NVARCHAR(50)     NOT NULL,                  -- FK → users(uid)
    course_id    INT              NOT NULL,                  -- FK → courses(course_id)
    lesson_id    INT              NOT NULL,                  -- FK → lessons(lesson_id)
    is_completed BIT              NOT NULL
                                    DEFAULT 0,              -- Đã hoàn thành hay chưa
    completed_at DATETIME2(0)     NULL,                      -- Thời gian hoàn thành
    created_at   DATETIME2(0)     NOT NULL
                                    DEFAULT SYSDATETIME(),  -- Thời gian ghi nhận
    PRIMARY KEY (user_uid, lesson_id),
    FOREIGN KEY (user_uid)  REFERENCES users(uid)     ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE NO ACTION,
    FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id) ON DELETE NO ACTION
);
GO

-- =======================================
-- 🎓 BẢNG course_reviews – Đánh giá khóa học
-- =======================================
CREATE TABLE course_reviews (
    review_id     INT           PRIMARY KEY IDENTITY(1,1),   -- 🔑 Mã đánh giá
    course_id     INT           NOT NULL,                     -- FK → courses
    user_uid      NVARCHAR(50)  NOT NULL,                     -- FK → users
    rating        TINYINT       NOT NULL                      -- Điểm (1–5)
                   CHECK (rating BETWEEN 1 AND 5),
    comment       NVARCHAR(MAX),                              -- Nhận xét
    created_at    DATETIME      NOT NULL
                   CONSTRAINT DF_course_reviews_created_at DEFAULT GETDATE(),
    updated_at    DATETIME,                                   -- Ngày cập nhật
    CONSTRAINT FK_course_reviews_courses
      FOREIGN KEY (course_id)
      REFERENCES courses(course_id)
      ON DELETE CASCADE,
    CONSTRAINT FK_course_reviews_users
      FOREIGN KEY (user_uid)
      REFERENCES users(uid)
      ON DELETE NO ACTION,
    CONSTRAINT UQ_course_reviews_unique_per_user_course
      UNIQUE (course_id, user_uid)                         -- Mỗi user chỉ review mỗi course một lần
);
GO

-- =======================================
-- 🎓 BẢNG bookmarks – Đánh dấu khóa học
-- =======================================
CREATE TABLE bookmarks (
    bookmark_id    INT IDENTITY(1,1) PRIMARY KEY,
    course_id      INT       NOT NULL,
    user_uid       NVARCHAR(50) NOT NULL,
    created_at     DATETIME  NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_bookmarks_courses FOREIGN KEY(course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
    CONSTRAINT FK_bookmarks_users   FOREIGN KEY(user_uid)  REFERENCES users(uid) ON DELETE NO ACTION,
    CONSTRAINT UQ_bookmarks UNIQUE(course_id, user_uid)
);
GO

-- =======================================
-- 🎓 BẢNG user_requests – Yêu cầu người dùng
-- =======================================
CREATE TABLE user_requests (
    id           INT             IDENTITY(1,1) PRIMARY KEY,  -- 🔑 Mã yêu cầu tự tăng
    user_uid     NVARCHAR(50)    NOT NULL,                   -- FK → users(uid)
    status       NVARCHAR(20)    NOT NULL,                   -- Trạng thái yêu cầu
    reason       NVARCHAR(500)   NULL,                       -- Lý do (nếu có)
    image_url    NVARCHAR(255)   NULL,                       -- URL ảnh đính kèm (nếu có)
    created_at   DATETIME        NOT NULL
                                DEFAULT GETDATE(),         -- Ngày tạo
    updated_at   DATETIME        NULL,                       -- Ngày cập nhật
    CONSTRAINT FK_UserRequests_User FOREIGN KEY(user_uid)
        REFERENCES users(uid) ON DELETE CASCADE
);
GO