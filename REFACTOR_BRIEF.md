# Schema Reference CHÍNH XÁC (Supabase Postgres)

## Bảng (đã verify từ schema.sql)

```sql
-- users (PK: id bigserial, UID: uid text UNIQUE)
id bigserial PK, uid text UNIQUE NOT NULL, email text NOT NULL, name text NOT NULL,
avatar_url text, bio text, phone text, role user_role DEFAULT 'user',  -- 'admin'|'user'|'mentor'
is_active boolean DEFAULT true, fcm_token text, gender text, birthdate date,
created_at timestamptz, updated_at timestamptz

-- course_categories
category_id bigserial PK, name text UNIQUE NOT NULL, description text, icon text,
created_at timestamptz DEFAULT now(), updated_at timestamptz

-- courses
course_id bigserial PK, title text NOT NULL, description text,
instructor_uid text NOT NULL, category_id integer,
level text, price integer, discount_price integer, thumbnail_url text,
status course_status DEFAULT 'pending',  -- 'pending'|'approved'|'rejected'
rejection_reason text, language text, tags text, approved_at timestamptz,
created_at timestamptz, updated_at timestamptz

-- enrollments (KHONG CO progress/last_lesson_id/status)
enrollment_id bigserial PK, user_uid text NOT NULL, course_id integer NOT NULL,
enrolled_at timestamptz DEFAULT now()
UNIQUE INDEX (user_uid, course_id)

-- lessons
lesson_id bigserial PK, course_id integer NOT NULL, title text NOT NULL,
video_url text, video_id text, video_duration text,  -- "HH:MM:SS"
pdf_url text, slide_url text, content text,
"order" integer,  -- reserved keyword
creator_uid text NOT NULL,
created_at timestamptz, updated_at timestamptz

-- lesson_progress (KHONG PHAI "lesson_completion")
progress_id bigserial PK, user_uid text NOT NULL, course_id integer NOT NULL,
lesson_id integer NOT NULL, is_completed boolean DEFAULT false,
completed_at timestamptz
UNIQUE INDEX (user_uid, course_id, lesson_id)

-- quizzes (type='trac_nghiem'|'tu_luan')
quiz_id bigserial PK, course_id integer NOT NULL, title text NOT NULL,
description text, type quiz_type DEFAULT 'trac_nghiem',
time_limit integer, attempt_limit integer,
creator_uid text NOT NULL,
created_at timestamptz, updated_at timestamptz

-- quiz_questions (KHONG PHAI "questions")
question_id bigserial PK, quiz_id integer NOT NULL, question text NOT NULL,
options text,                -- JSON string array
correct_index integer,       -- 0-based; NULL for tu_luan
expected_keywords text,
created_at timestamptz, updated_at timestamptz

-- quiz_results (status='cho_cham'|'da_cham')
result_id bigserial PK, user_uid text NOT NULL, quiz_id integer NOT NULL,
score double precision, answers text,  -- JSON string
explanation text,
status quiz_result_status DEFAULT 'cho_cham',
graded_by integer,           -- FK -> users.id (bigserial)
graded_at timestamptz, submitted_at timestamptz DEFAULT now()

-- course_reviews
review_id bigserial PK, course_id integer NOT NULL, user_uid text NOT NULL,
rating smallint NOT NULL, comment text,
created_at timestamptz DEFAULT now(), updated_at timestamptz
UNIQUE INDEX (user_uid, course_id)

-- bookmarks
bookmark_id bigserial PK, user_uid text NOT NULL, course_id integer NOT NULL,
created_at timestamptz DEFAULT now()
UNIQUE INDEX (user_uid, course_id)

-- notifications (uid, content - KHONG CO noti_type/link/message)
noti_id uuid PK DEFAULT gen_random_uuid(),
uid text NOT NULL, title text NOT NULL, content text NOT NULL,
icon text, color text, is_read boolean DEFAULT false,
created_at timestamptz DEFAULT now()

-- upgrade_requests
id bigserial PK, user_uid text NOT NULL,
status upgrade_request_status DEFAULT 'pending',
reason text, image_url text,
created_at timestamptz DEFAULT now(), updated_at timestamptz

-- KHONG CO fcm_tokens table (chi co users.fcm_token text)
```

## Quy tắc FK
- text *_uid -> users.uid
- graded_by -> users.id (integer)
- _id khac -> bigserial integer
