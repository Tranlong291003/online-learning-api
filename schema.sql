-- ============================================================
-- Online Learning API - Postgres schema (Supabase compatible)
-- Source: extracted from src/controllers/*.js (SQL Server → Postgres)
-- ============================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

-- user role
-- Canonical values: admin, user, mentor.
-- Note: a few legacy controllers (updateCategory, deleteCategory, gradeQuizResult)
-- previously accepted "giang_vien" as an alias. They have been refactored to use
-- "mentor" — see plan-5/plan-7. Do NOT reintroduce "giang_vien" into this enum.
CREATE TYPE user_role AS ENUM ('admin', 'user', 'mentor');

-- course status (from changeCourseStatus.js: pending/approved/rejected)
CREATE TYPE course_status AS ENUM ('pending', 'approved', 'rejected');

-- quiz type (from createQuiz.js: 'trac_nghiem' default, also 'tu_luan')
CREATE TYPE quiz_type AS ENUM ('trac_nghiem', 'tu_luan');

-- quiz_results status (from submitQuizResult.js: 'da_cham' | 'cho_cham')
CREATE TYPE quiz_result_status AS ENUM ('da_cham', 'cho_cham');

-- upgrade_requests status (mentorRequest.controller.js: 'pending' | 'approved' | 'rejected')
CREATE TYPE upgrade_request_status AS ENUM ('pending', 'approved', 'rejected');

-- user status (updateUserStatus.js: 'active' | 'disabled')
CREATE TYPE user_active_status AS ENUM ('active', 'disabled');

-- ============================================================
-- Bảng users: thông tin người dùng (Firebase Auth UID làm PK)
-- ============================================================
CREATE TABLE users (
  id            bigserial PRIMARY KEY,                            -- ID nội bộ (auto-increment) — referenced by quiz_results.graded_by
  uid           text NOT NULL UNIQUE,                             -- Firebase UID (varchar/string)
  email         text NOT NULL,
  name          text NOT NULL,
  avatar_url    text,
  bio           text,
  phone         text,
  role          user_role NOT NULL DEFAULT 'user',
  is_active     boolean NOT NULL DEFAULT true,                    -- BIT in SQL Server
  fcm_token     text,
  gender        text,
  birthdate     date,
  created_at    timestamptz,
  updated_at    timestamptz
);

CREATE INDEX idx_users_email      ON users (email);
CREATE INDEX idx_users_role       ON users (role);
CREATE INDEX idx_users_fcm_token  ON users (fcm_token);

-- ============================================================
-- Bảng course_categories: danh mục khóa học
-- ============================================================
CREATE TABLE course_categories (
  category_id   bigserial PRIMARY KEY,
  name          text NOT NULL,
  description   text,
  icon          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz
);

-- ============================================================
-- Bảng courses: khóa học
-- ============================================================
CREATE TABLE courses (
  course_id          bigserial PRIMARY KEY,
  title              text NOT NULL,
  description        text,
  instructor_uid     text NOT NULL,                              -- FK -> users.uid
  category_id        integer,                                    -- FK -> course_categories.category_id
  level              text,
  price              integer,
  discount_price     integer,
  thumbnail_url      text,
  status             course_status NOT NULL DEFAULT 'pending',
  rejection_reason   text,
  language           text,
  tags               text,
  approved_at        timestamptz,
  created_at         timestamptz,
  updated_at         timestamptz
);

CREATE INDEX idx_courses_instructor_uid ON courses (instructor_uid);
CREATE INDEX idx_courses_category_id    ON courses (category_id);
CREATE INDEX idx_courses_status         ON courses (status);

-- ============================================================
-- Bảng enrollments: đăng ký khóa học của user
-- ============================================================
CREATE TABLE enrollments (
  enrollment_id  bigserial PRIMARY KEY,
  user_uid       text NOT NULL,                                  -- FK -> users.uid
  course_id      integer NOT NULL,                               -- FK -> courses.course_id
  enrolled_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_enrollments_user_uid  ON enrollments (user_uid);
CREATE INDEX idx_enrollments_course_id ON enrollments (course_id);
-- Composite for "already enrolled" check
CREATE UNIQUE INDEX uq_enrollments_user_course ON enrollments (user_uid, course_id);

-- ============================================================
-- Bảng lessons: bài học trong khóa học
-- ============================================================
CREATE TABLE lessons (
  lesson_id       bigserial PRIMARY KEY,
  course_id       integer NOT NULL,                              -- FK -> courses.course_id
  title           text NOT NULL,
  video_url       text,
  video_id        text,
  video_duration  text,                                          -- format HH:MM:SS
  pdf_url         text,
  slide_url       text,
  content         text,                                         -- "content" is reserved in SQL Server (brackets used)
  "order"         integer,                                       -- "order" is reserved keyword
  creator_uid     text NOT NULL,                                 -- FK -> users.uid
  created_at      timestamptz,
  updated_at      timestamptz
);

CREATE INDEX idx_lessons_course_id   ON lessons (course_id);
CREATE INDEX idx_lessons_creator_uid ON lessons (creator_uid);

-- ============================================================
-- Bảng lesson_progress: tiến độ học của user cho từng lesson
-- ============================================================
CREATE TABLE lesson_progress (
  progress_id     bigserial PRIMARY KEY,                         -- inferred (needed for PK)
  user_uid        text NOT NULL,                                 -- FK -> users.uid
  course_id       integer NOT NULL,                              -- FK -> courses.course_id
  lesson_id       integer NOT NULL,                              -- FK -> lessons.lesson_id
  is_completed    boolean NOT NULL DEFAULT false,                -- BIT
  completed_at    timestamptz
);

CREATE INDEX idx_lesson_progress_user  ON lesson_progress (user_uid);
CREATE INDEX idx_lesson_progress_course ON lesson_progress (course_id);
CREATE INDEX idx_lesson_progress_lesson ON lesson_progress (lesson_id);
-- MERGE in completeLesson.js matches on (user_uid, course_id, lesson_id)
CREATE UNIQUE INDEX uq_lesson_progress_user_course_lesson
  ON lesson_progress (user_uid, course_id, lesson_id);

-- ============================================================
-- Bảng quizzes: bài kiểm tra
-- ============================================================
CREATE TABLE quizzes (
  quiz_id        bigserial PRIMARY KEY,
  course_id      integer NOT NULL,                               -- FK -> courses.course_id
  title          text NOT NULL,
  description    text,
  type           quiz_type NOT NULL DEFAULT 'trac_nghiem',       -- "type" reserved in SQL Server
  time_limit     integer,                                        -- minutes
  attempt_limit  integer,
  creator_uid    text NOT NULL,                                  -- FK -> users.uid
  created_at     timestamptz,
  updated_at     timestamptz
);

CREATE INDEX idx_quizzes_course_id   ON quizzes (course_id);
CREATE INDEX idx_quizzes_creator_uid ON quizzes (creator_uid);

-- ============================================================
-- Bảng quiz_questions: câu hỏi trong bài kiểm tra
-- ============================================================
CREATE TABLE quiz_questions (
  question_id        bigserial PRIMARY KEY,
  quiz_id            integer NOT NULL,                           -- FK -> quizzes.quiz_id
  question           text NOT NULL,
  options            text,                                       -- JSON string array (SQL NVarChar)
  correct_index      integer,                                    -- 0-based index; NULL for tu_luan
  expected_keywords  text,                                       -- comma-separated for tu_luan
  created_at         timestamptz,
  updated_at         timestamptz
);

CREATE INDEX idx_quiz_questions_quiz_id ON quiz_questions (quiz_id);

-- ============================================================
-- Bảng quiz_results: kết quả bài làm của user
-- ============================================================
CREATE TABLE quiz_results (
  result_id     bigserial PRIMARY KEY,
  user_uid      text NOT NULL,                                   -- FK -> users.uid
  quiz_id       integer NOT NULL,                                -- FK -> quizzes.quiz_id
  score         double precision,                                -- FLOAT
  answers       text,                                            -- JSON string
  explanation   text,
  status        quiz_result_status NOT NULL DEFAULT 'cho_cham',
  graded_by     integer,                                         -- FK -> users.id (auto-increment id, not uid)
  graded_at     timestamptz,
  submitted_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quiz_results_user_uid ON quiz_results (user_uid);
CREATE INDEX idx_quiz_results_quiz_id  ON quiz_results (quiz_id);

-- ============================================================
-- Bảng course_reviews: đánh giá khóa học
-- ============================================================
CREATE TABLE course_reviews (
  review_id    bigserial PRIMARY KEY,
  course_id    integer NOT NULL,                                 -- FK -> courses.course_id
  user_uid     text NOT NULL,                                    -- FK -> users.uid
  rating       smallint NOT NULL,                                -- TinyInt in SQL Server
  comment      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz
);

CREATE INDEX idx_course_reviews_course_id ON course_reviews (course_id);
CREATE INDEX idx_course_reviews_user_uid  ON course_reviews (user_uid);
CREATE UNIQUE INDEX uq_course_reviews_user_course ON course_reviews (user_uid, course_id);

-- ============================================================
-- Bảng bookmarks: bookmark khóa học của user
-- ============================================================
CREATE TABLE bookmarks (
  bookmark_id  bigserial PRIMARY KEY,
  user_uid     text NOT NULL,                                    -- FK -> users.uid
  course_id    integer NOT NULL,                                 -- FK -> courses.course_id
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookmarks_user_uid  ON bookmarks (user_uid);
CREATE INDEX idx_bookmarks_course_id ON bookmarks (course_id);
CREATE UNIQUE INDEX uq_bookmarks_user_course ON bookmarks (user_uid, course_id);

-- ============================================================
-- Bảng notifications: thông báo
-- noti_id is UUID (gen_random_uuid()) — matches SQL Server NEWID() / UniqueIdentifier
-- used by createNotification.js and updateNotification.js.
-- ============================================================
CREATE TABLE notifications (
  noti_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uid         text NOT NULL,                                       -- FK -> users.uid
  title       text NOT NULL,
  content     text NOT NULL,
  icon        text,
  color       text,
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_uid         ON notifications (uid);
CREATE INDEX idx_notifications_is_read     ON notifications (uid, is_read);

-- ============================================================
-- Bảng upgrade_requests: yêu cầu nâng cấp thành mentor
-- ============================================================
CREATE TABLE upgrade_requests (
  id          bigserial PRIMARY KEY,
  user_uid    text NOT NULL,                                     -- FK -> users.uid
  status      upgrade_request_status NOT NULL DEFAULT 'pending',
  reason      text,
  image_url   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz
);

CREATE INDEX idx_upgrade_requests_user_uid ON upgrade_requests (user_uid);
CREATE INDEX idx_upgrade_requests_status   ON upgrade_requests (status);

-- ============================================================
-- FOREIGN KEYS
-- (Đặt cuối file để tránh vấn đề thứ tự tạo bảng)
-- ============================================================

ALTER TABLE courses
  ADD CONSTRAINT fk_courses_instructor_uid
    FOREIGN KEY (instructor_uid) REFERENCES users(uid) ON DELETE CASCADE,
  ADD CONSTRAINT fk_courses_category_id
    FOREIGN KEY (category_id) REFERENCES course_categories(category_id) ON DELETE SET NULL;

ALTER TABLE enrollments
  ADD CONSTRAINT fk_enrollments_user_uid
    FOREIGN KEY (user_uid) REFERENCES users(uid) ON DELETE CASCADE,
  ADD CONSTRAINT fk_enrollments_course_id
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE;

ALTER TABLE lessons
  ADD CONSTRAINT fk_lessons_course_id
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_lessons_creator_uid
    FOREIGN KEY (creator_uid) REFERENCES users(uid);

ALTER TABLE lesson_progress
  ADD CONSTRAINT fk_lesson_progress_user_uid
    FOREIGN KEY (user_uid) REFERENCES users(uid) ON DELETE CASCADE,
  ADD CONSTRAINT fk_lesson_progress_course_id
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_lesson_progress_lesson_id
    FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id) ON DELETE CASCADE;

ALTER TABLE quizzes
  ADD CONSTRAINT fk_quizzes_course_id
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_quizzes_creator_uid
    FOREIGN KEY (creator_uid) REFERENCES users(uid);

ALTER TABLE quiz_questions
  ADD CONSTRAINT fk_quiz_questions_quiz_id
    FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id) ON DELETE CASCADE;

ALTER TABLE quiz_results
  ADD CONSTRAINT fk_quiz_results_user_uid
    FOREIGN KEY (user_uid) REFERENCES users(uid) ON DELETE CASCADE,
  ADD CONSTRAINT fk_quiz_results_quiz_id
    FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_quiz_results_graded_by
    FOREIGN KEY (graded_by) REFERENCES users(id);

ALTER TABLE course_reviews
  ADD CONSTRAINT fk_course_reviews_course_id
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_course_reviews_user_uid
    FOREIGN KEY (user_uid) REFERENCES users(uid) ON DELETE CASCADE;

ALTER TABLE bookmarks
  ADD CONSTRAINT fk_bookmarks_user_uid
    FOREIGN KEY (user_uid) REFERENCES users(uid) ON DELETE CASCADE,
  ADD CONSTRAINT fk_bookmarks_course_id
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE;

ALTER TABLE notifications
  ADD CONSTRAINT fk_notifications_uid
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE;

ALTER TABLE upgrade_requests
  ADD CONSTRAINT fk_upgrade_requests_user_uid
    FOREIGN KEY (user_uid) REFERENCES users(uid) ON DELETE CASCADE;
