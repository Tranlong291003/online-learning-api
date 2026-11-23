-- Schema D1 đối chiếu từ cấu trúc Supabase ngày 24-11-2026.
-- Chỉ dùng khi đã hoàn tất chuyển code và kiểm thử dữ liệu.
PRAGMA foreign_keys = ON;

CREATE TABLE "bookmarks" (
  "bookmark_id" INTEGER PRIMARY KEY,
  "user_uid" TEXT NOT NULL,
  "course_id" INTEGER NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(course_id),
  FOREIGN KEY (user_uid) REFERENCES users(uid)
);

CREATE TABLE "course_categories" (
  "category_id" INTEGER PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "icon" TEXT,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT
);

CREATE TABLE "course_reviews" (
  "review_id" INTEGER PRIMARY KEY,
  "course_id" INTEGER NOT NULL,
  "user_uid" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  FOREIGN KEY (course_id) REFERENCES courses(course_id),
  FOREIGN KEY (user_uid) REFERENCES users(uid)
);

CREATE TABLE "courses" (
  "course_id" INTEGER PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "instructor_uid" TEXT NOT NULL,
  "category_id" INTEGER,
  "level" TEXT,
  "price" INTEGER,
  "discount_price" INTEGER,
  "thumbnail_url" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "rejection_reason" TEXT,
  "language" TEXT,
  "tags" TEXT,
  "approved_at" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT,
  FOREIGN KEY (category_id) REFERENCES course_categories(category_id),
  FOREIGN KEY (instructor_uid) REFERENCES users(uid)
);

CREATE TABLE "enrollments" (
  "enrollment_id" INTEGER PRIMARY KEY,
  "user_uid" TEXT NOT NULL,
  "course_id" INTEGER NOT NULL,
  "enrolled_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(course_id),
  FOREIGN KEY (user_uid) REFERENCES users(uid)
);

CREATE TABLE "lesson_progress" (
  "progress_id" INTEGER PRIMARY KEY,
  "user_uid" TEXT NOT NULL,
  "course_id" INTEGER NOT NULL,
  "lesson_id" INTEGER NOT NULL,
  "is_completed" INTEGER NOT NULL DEFAULT 0,
  "completed_at" TEXT,
  FOREIGN KEY (course_id) REFERENCES courses(course_id),
  FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id),
  FOREIGN KEY (user_uid) REFERENCES users(uid)
);

CREATE TABLE "lessons" (
  "lesson_id" INTEGER PRIMARY KEY,
  "course_id" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "video_url" TEXT,
  "video_id" TEXT,
  "video_duration" TEXT,
  "pdf_url" TEXT,
  "slide_url" TEXT,
  "content" TEXT,
  "order" INTEGER,
  "creator_uid" TEXT NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT,
  FOREIGN KEY (course_id) REFERENCES courses(course_id),
  FOREIGN KEY (creator_uid) REFERENCES users(uid)
);

CREATE TABLE "notifications" (
  "noti_id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  "uid" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "icon" TEXT,
  "color" TEXT,
  "is_read" INTEGER NOT NULL DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uid) REFERENCES users(uid)
);

CREATE TABLE "password_resets" (
  "reset_id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  "uid" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TEXT NOT NULL,
  "used_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uid) REFERENCES users(uid),
  UNIQUE (token_hash)
);

CREATE TABLE "quiz_questions" (
  "question_id" INTEGER PRIMARY KEY,
  "quiz_id" INTEGER NOT NULL,
  "question" TEXT NOT NULL,
  "options" TEXT,
  "correct_index" INTEGER,
  "expected_keywords" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT,
  "question_key" TEXT,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id)
);

CREATE TABLE "quiz_results" (
  "result_id" INTEGER PRIMARY KEY,
  "user_uid" TEXT NOT NULL,
  "quiz_id" INTEGER NOT NULL,
  "score" REAL,
  "answers" TEXT,
  "explanation" TEXT,
  "status" TEXT NOT NULL DEFAULT 'cho_cham',
  "graded_by" INTEGER,
  "graded_at" TEXT,
  "submitted_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (graded_by) REFERENCES users(id),
  FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id),
  FOREIGN KEY (user_uid) REFERENCES users(uid)
);

CREATE TABLE "quizzes" (
  "quiz_id" INTEGER PRIMARY KEY,
  "course_id" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL DEFAULT 'trac_nghiem',
  "time_limit" INTEGER,
  "attempt_limit" INTEGER,
  "creator_uid" TEXT NOT NULL,
  "created_at" TEXT,
  "updated_at" TEXT,
  FOREIGN KEY (course_id) REFERENCES courses(course_id),
  FOREIGN KEY (creator_uid) REFERENCES users(uid)
);

CREATE TABLE "refresh_tokens" (
  "token_id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  "uid" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "family_id" TEXT NOT NULL,
  "expires_at" TEXT NOT NULL,
  "revoked_at" TEXT,
  "replaced_by" TEXT,
  "user_agent" TEXT,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uid) REFERENCES users(uid),
  UNIQUE (token_hash)
);

CREATE TABLE "upgrade_requests" (
  "id" INTEGER PRIMARY KEY,
  "user_uid" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "reason" TEXT,
  "image_url" TEXT,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  FOREIGN KEY (user_uid) REFERENCES users(uid)
);

CREATE TABLE "uploaded_files" (
  "file_id" INTEGER PRIMARY KEY,
  "public_path" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "content" BLOB NOT NULL,
  "original_name" TEXT,
  "owner_uid" TEXT,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  UNIQUE (public_path)
);

CREATE TABLE "users" (
  "id" INTEGER PRIMARY KEY,
  "uid" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "avatar_url" TEXT,
  "bio" TEXT,
  "phone" TEXT,
  "role" TEXT NOT NULL DEFAULT 'user',
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "fcm_token" TEXT,
  "gender" TEXT,
  "birthdate" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT,
  "password_hash" TEXT,
  "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TEXT,
  UNIQUE (uid)
);

CREATE INDEX "idx_bookmarks_course_id" ON "bookmarks" (course_id);
CREATE INDEX "idx_bookmarks_user_uid" ON "bookmarks" (user_uid);
CREATE UNIQUE INDEX "uq_bookmarks_user_course" ON "bookmarks" (user_uid, course_id);
CREATE INDEX "idx_course_reviews_course_id" ON "course_reviews" (course_id);
CREATE INDEX "idx_course_reviews_user_uid" ON "course_reviews" (user_uid);
CREATE UNIQUE INDEX "uq_course_reviews_user_course" ON "course_reviews" (user_uid, course_id);
CREATE INDEX "idx_courses_category" ON "courses" (category_id);
CREATE INDEX "idx_courses_category_id" ON "courses" (category_id);
CREATE INDEX "idx_courses_instructor" ON "courses" (instructor_uid);
CREATE INDEX "idx_courses_instructor_uid" ON "courses" (instructor_uid);
CREATE INDEX "idx_courses_status" ON "courses" (status);
CREATE INDEX "idx_enrollments_course" ON "enrollments" (course_id);
CREATE INDEX "idx_enrollments_course_id" ON "enrollments" (course_id);
CREATE INDEX "idx_enrollments_user" ON "enrollments" (user_uid);
CREATE INDEX "idx_enrollments_user_uid" ON "enrollments" (user_uid);
CREATE UNIQUE INDEX "uq_enrollments_user_course" ON "enrollments" (user_uid, course_id);
CREATE INDEX "idx_lesson_progress_course" ON "lesson_progress" (course_id);
CREATE INDEX "idx_lesson_progress_lesson" ON "lesson_progress" (lesson_id);
CREATE INDEX "idx_lesson_progress_user" ON "lesson_progress" (user_uid);
CREATE UNIQUE INDEX "uq_lesson_progress_user_course_lesson" ON "lesson_progress" (user_uid, course_id, lesson_id);
CREATE INDEX "idx_lessons_course" ON "lessons" (course_id);
CREATE INDEX "idx_lessons_course_id" ON "lessons" (course_id);
CREATE INDEX "idx_lessons_creator_uid" ON "lessons" (creator_uid);
CREATE INDEX "idx_notifications_is_read" ON "notifications" (uid, is_read);
CREATE INDEX "idx_notifications_uid" ON "notifications" (uid);
CREATE INDEX "idx_password_resets_uid" ON "password_resets" (uid);
CREATE INDEX "idx_quiz_questions_question_key" ON "quiz_questions" (question_key);
CREATE INDEX "idx_quiz_questions_quiz" ON "quiz_questions" (quiz_id);
CREATE INDEX "idx_quiz_questions_quiz_id" ON "quiz_questions" (quiz_id);
CREATE UNIQUE INDEX "quiz_questions_quiz_id_question_key_key" ON "quiz_questions" (quiz_id, question_key) WHERE question_key IS NOT NULL;
CREATE INDEX "idx_quiz_results_quiz_id" ON "quiz_results" (quiz_id);
CREATE INDEX "idx_quiz_results_user" ON "quiz_results" (user_uid);
CREATE INDEX "idx_quiz_results_user_uid" ON "quiz_results" (user_uid);
CREATE INDEX "idx_quizzes_course" ON "quizzes" (course_id);
CREATE INDEX "idx_quizzes_course_id" ON "quizzes" (course_id);
CREATE INDEX "idx_quizzes_creator_uid" ON "quizzes" (creator_uid);
CREATE INDEX "idx_refresh_tokens_expires" ON "refresh_tokens" (expires_at);
CREATE INDEX "idx_refresh_tokens_family" ON "refresh_tokens" (family_id);
CREATE INDEX "idx_refresh_tokens_uid" ON "refresh_tokens" (uid);
CREATE INDEX "idx_upgrade_requests_status" ON "upgrade_requests" (status);
CREATE INDEX "idx_upgrade_requests_user" ON "upgrade_requests" (user_uid);
CREATE INDEX "idx_upgrade_requests_user_uid" ON "upgrade_requests" (user_uid);
CREATE INDEX "idx_uploaded_files_owner" ON "uploaded_files" (owner_uid);
CREATE INDEX "idx_users_email" ON "users" (email);
CREATE INDEX "idx_users_fcm_token" ON "users" (fcm_token);
CREATE INDEX "idx_users_role" ON "users" (role);
