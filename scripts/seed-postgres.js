const { Pool } = require("pg");
require("dotenv").config();

function createPool() {
  const useSsl = process.env.DB_SSL === "true";

  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
  }

  const required = ["DB_HOST", "DB_DATABASE", "DB_USER", "DB_PASSWORD"];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required DB env vars: ${missing.join(", ")}`);
  }

  return new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });
}

async function seed(pool) {
  await pool.query("BEGIN");

  try {
    await pool.query(`
      INSERT INTO users
        (uid, email, name, avatar_url, bio, phone, gender, birthdate, role, fcm_token, is_active, created_at, updated_at)
      VALUES
        ('demo-admin', 'admin@example.com', 'Admin Demo', '/uploads/avatars/demo-admin.png', 'System administrator demo account', '0900000001', 'other', '1995-01-01', 'admin', 'demo-admin-fcm', true, NOW(), NOW()),
        ('demo-mentor-1', 'mentor1@example.com', 'Mentor JavaScript', '/uploads/avatars/demo-mentor-1.png', 'Frontend and JavaScript mentor', '0900000002', 'male', '1992-02-02', 'mentor', 'demo-mentor-1-fcm', true, NOW(), NOW()),
        ('demo-mentor-2', 'mentor2@example.com', 'Mentor Data', '/uploads/avatars/demo-mentor-2.png', 'Database and backend mentor', '0900000003', 'female', '1993-03-03', 'mentor', 'demo-mentor-2-fcm', true, NOW(), NOW()),
        ('demo-user-1', 'student1@example.com', 'Student One', '/uploads/avatars/demo-user-1.png', 'Online learning student', '0900000004', 'female', '2001-04-04', 'user', 'demo-user-1-fcm', true, NOW(), NOW()),
        ('demo-user-2', 'student2@example.com', 'Student Two', '/uploads/avatars/demo-user-2.png', 'Mobile learning student', '0900000005', 'male', '2002-05-05', 'user', 'demo-user-2-fcm', true, NOW(), NOW())
      ON CONFLICT (uid) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        avatar_url = EXCLUDED.avatar_url,
        bio = EXCLUDED.bio,
        phone = EXCLUDED.phone,
        gender = EXCLUDED.gender,
        birthdate = EXCLUDED.birthdate,
        role = EXCLUDED.role,
        fcm_token = EXCLUDED.fcm_token,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
    `);

    await pool.query(`
      INSERT INTO course_categories (category_id, name, description, icon, created_at, updated_at)
      VALUES
        (1, 'Web Development', 'HTML, CSS, JavaScript and frontend frameworks', '/uploads/categories/web.png', NOW(), NOW()),
        (2, 'Backend API', 'Node.js, Express and server-side engineering', '/uploads/categories/backend.png', NOW(), NOW()),
        (3, 'Database', 'SQL, PostgreSQL and data modeling', '/uploads/categories/database.png', NOW(), NOW()),
        (4, 'AI Tools', 'Applied AI tools for productivity and learning', '/uploads/categories/ai.png', NOW(), NOW())
      ON CONFLICT (category_id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        icon = EXCLUDED.icon,
        updated_at = NOW()
    `);

    await pool.query(`
      INSERT INTO courses
        (course_id, title, description, instructor_uid, category_id, level, price, discount_price, status, approved_at, language, tags, thumbnail_url, created_at, updated_at, rejection_reason)
      VALUES
        (1, 'JavaScript Foundation', 'Learn modern JavaScript from zero to practical projects.', 'demo-mentor-1', 1, 'beginner', 499000, 199000, 'approved', NOW(), 'vi', 'javascript,frontend,web', '/uploads/courses/js-foundation.png', NOW(), NOW(), NULL),
        (2, 'Node.js REST API', 'Build production-ready REST APIs with Express and PostgreSQL.', 'demo-mentor-2', 2, 'intermediate', 799000, 299000, 'approved', NOW(), 'vi', 'nodejs,express,api', '/uploads/courses/node-api.png', NOW(), NOW(), NULL),
        (3, 'PostgreSQL Practical', 'Schema design, SQL queries, indexes and data integrity.', 'demo-mentor-2', 3, 'intermediate', 699000, 249000, 'approved', NOW(), 'vi', 'postgresql,sql,database', '/uploads/courses/postgres.png', NOW(), NOW(), NULL),
        (4, 'AI for Learning', 'Use AI tools to learn faster and create better study workflows.', 'demo-mentor-1', 4, 'beginner', 399000, 149000, 'pending', NULL, 'vi', 'ai,prompt,learning', '/uploads/courses/ai-learning.png', NOW(), NOW(), NULL)
      ON CONFLICT (course_id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        instructor_uid = EXCLUDED.instructor_uid,
        category_id = EXCLUDED.category_id,
        level = EXCLUDED.level,
        price = EXCLUDED.price,
        discount_price = EXCLUDED.discount_price,
        status = EXCLUDED.status,
        approved_at = EXCLUDED.approved_at,
        language = EXCLUDED.language,
        tags = EXCLUDED.tags,
        thumbnail_url = EXCLUDED.thumbnail_url,
        updated_at = NOW(),
        rejection_reason = EXCLUDED.rejection_reason
    `);

    await pool.query(`
      INSERT INTO lessons
        (lesson_id, course_id, title, video_url, pdf_url, slide_url, content, "order", created_at, updated_at, creator_uid, video_id, video_duration)
      VALUES
        (1, 1, 'JS Variables and Types', 'https://www.youtube.com/watch?v=demojs1', '/uploads/lessons/pdf/js-types.pdf', '/uploads/lessons/slides/js-types.pptx', 'Variables, primitives and type conversion.', 1, NOW(), NOW(), 'demo-mentor-1', 'demojs1', '12:30'),
        (2, 1, 'Functions and Scope', 'https://www.youtube.com/watch?v=demojs2', '/uploads/lessons/pdf/js-functions.pdf', '/uploads/lessons/slides/js-functions.pptx', 'Functions, closures and lexical scope.', 2, NOW(), NOW(), 'demo-mentor-1', 'demojs2', '15:10'),
        (3, 2, 'Express Project Setup', 'https://www.youtube.com/watch?v=demonode1', '/uploads/lessons/pdf/express-setup.pdf', '/uploads/lessons/slides/express-setup.pptx', 'Create an Express API project.', 1, NOW(), NOW(), 'demo-mentor-2', 'demonode1', '10:45'),
        (4, 2, 'Routes and Controllers', 'https://www.youtube.com/watch?v=demonode2', '/uploads/lessons/pdf/routes.pdf', '/uploads/lessons/slides/routes.pptx', 'Organize route handlers and controllers.', 2, NOW(), NOW(), 'demo-mentor-2', 'demonode2', '18:20'),
        (5, 3, 'Tables and Keys', 'https://www.youtube.com/watch?v=demopg1', '/uploads/lessons/pdf/tables-keys.pdf', '/uploads/lessons/slides/tables-keys.pptx', 'Primary keys, foreign keys and constraints.', 1, NOW(), NOW(), 'demo-mentor-2', 'demopg1', '14:00'),
        (6, 3, 'Indexes and Query Plans', 'https://www.youtube.com/watch?v=demopg2', '/uploads/lessons/pdf/indexes.pdf', '/uploads/lessons/slides/indexes.pptx', 'Indexes and performance basics.', 2, NOW(), NOW(), 'demo-mentor-2', 'demopg2', '16:40'),
        (7, 4, 'Prompt Basics', 'https://www.youtube.com/watch?v=demoai1', '/uploads/lessons/pdf/prompt-basics.pdf', '/uploads/lessons/slides/prompt-basics.pptx', 'How to ask AI tools useful questions.', 1, NOW(), NOW(), 'demo-mentor-1', 'demoai1', '09:30'),
        (8, 4, 'AI Study Workflow', 'https://www.youtube.com/watch?v=demoai2', '/uploads/lessons/pdf/ai-workflow.pdf', '/uploads/lessons/slides/ai-workflow.pptx', 'Build an AI assisted study routine.', 2, NOW(), NOW(), 'demo-mentor-1', 'demoai2', '13:20')
      ON CONFLICT (lesson_id) DO UPDATE SET
        course_id = EXCLUDED.course_id,
        title = EXCLUDED.title,
        video_url = EXCLUDED.video_url,
        pdf_url = EXCLUDED.pdf_url,
        slide_url = EXCLUDED.slide_url,
        content = EXCLUDED.content,
        "order" = EXCLUDED."order",
        updated_at = NOW(),
        creator_uid = EXCLUDED.creator_uid,
        video_id = EXCLUDED.video_id,
        video_duration = EXCLUDED.video_duration
    `);

    await pool.query(`
      INSERT INTO enrollments (enrollment_id, user_uid, course_id, enrolled_at)
      VALUES
        (1, 'demo-user-1', 1, NOW()),
        (2, 'demo-user-1', 2, NOW()),
        (3, 'demo-user-1', 3, NOW()),
        (4, 'demo-user-2', 1, NOW()),
        (5, 'demo-user-2', 3, NOW())
      ON CONFLICT (enrollment_id) DO UPDATE SET
        user_uid = EXCLUDED.user_uid,
        course_id = EXCLUDED.course_id
    `);

    await pool.query(`
      INSERT INTO quizzes
        (quiz_id, course_id, title, description, type, time_limit, attempt_limit, created_at, updated_at, creator_uid)
      VALUES
        (1, 1, 'JavaScript Basics Quiz', 'Check your JavaScript foundation.', 'trac_nghiem', 15, 3, NOW(), NOW(), 'demo-mentor-1'),
        (2, 2, 'REST API Quiz', 'Express routing and API design.', 'trac_nghiem', 20, 3, NOW(), NOW(), 'demo-mentor-2'),
        (3, 3, 'PostgreSQL Written Quiz', 'Short answer questions about PostgreSQL.', 'tu_luan', 30, 2, NOW(), NOW(), 'demo-mentor-2')
      ON CONFLICT (quiz_id) DO UPDATE SET
        course_id = EXCLUDED.course_id,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        type = EXCLUDED.type,
        time_limit = EXCLUDED.time_limit,
        attempt_limit = EXCLUDED.attempt_limit,
        updated_at = NOW(),
        creator_uid = EXCLUDED.creator_uid
    `);

    await pool.query(`
      INSERT INTO quiz_questions
        (question_id, quiz_id, question, options, correct_index, expected_keywords, created_at, updated_at)
      VALUES
        (1, 1, 'Which keyword declares a block-scoped variable?', '["var","let","function","return"]', 1, NULL, NOW(), NOW()),
        (2, 1, 'What is the result of typeof []?', '["array","object","list","undefined"]', 1, NULL, NOW(), NOW()),
        (3, 2, 'Which HTTP method is commonly used to create a resource?', '["GET","POST","DELETE","OPTIONS"]', 1, NULL, NOW(), NOW()),
        (4, 2, 'Express middleware receives which arguments?', '["req,res,next","app,db,next","ctx,next","request,response"]', 0, NULL, NOW(), NOW()),
        (5, 3, 'Explain why foreign keys are useful.', NULL, NULL, 'integrity,relationship,constraint', NOW(), NOW())
      ON CONFLICT (question_id) DO UPDATE SET
        quiz_id = EXCLUDED.quiz_id,
        question = EXCLUDED.question,
        options = EXCLUDED.options,
        correct_index = EXCLUDED.correct_index,
        expected_keywords = EXCLUDED.expected_keywords,
        updated_at = NOW()
    `);

    await pool.query(`
      INSERT INTO quiz_results
        (result_id, user_uid, quiz_id, score, submitted_at, explanation, answers, status, graded_by_uid, graded_at)
      VALUES
        (1, 'demo-user-1', 1, 100, NOW(), 'Great work.', '[1,1]', 'graded', 'demo-mentor-1', NOW()),
        (2, 'demo-user-1', 2, 50, NOW(), 'Review HTTP method usage.', '[1,2]', 'graded', 'demo-mentor-2', NOW()),
        (3, 'demo-user-2', 3, 0, NOW(), NULL, '["Foreign keys keep data connected"]', 'cho_cham', NULL, NULL)
      ON CONFLICT (result_id) DO UPDATE SET
        user_uid = EXCLUDED.user_uid,
        quiz_id = EXCLUDED.quiz_id,
        score = EXCLUDED.score,
        explanation = EXCLUDED.explanation,
        answers = EXCLUDED.answers,
        status = EXCLUDED.status,
        graded_by_uid = EXCLUDED.graded_by_uid,
        graded_at = EXCLUDED.graded_at
    `);

    await pool.query(`
      INSERT INTO notifications
        (noti_id, uid, title, content, icon, color, is_read, created_at)
      VALUES
        (1, 'demo-user-1', 'Welcome', 'Welcome to the online learning platform.', 'school', '#2196f3', false, NOW()),
        (2, 'demo-user-1', 'Course enrolled', 'You enrolled in Node.js REST API.', 'book', '#4caf50', false, NOW()),
        (3, 'demo-mentor-1', 'Course approved', 'JavaScript Foundation has been approved.', 'check', '#4caf50', true, NOW()),
        (4, 'demo-user-2', 'Quiz pending grade', 'Your PostgreSQL written quiz is waiting for review.', 'quiz', '#ff9800', false, NOW())
      ON CONFLICT (noti_id) DO UPDATE SET
        uid = EXCLUDED.uid,
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        icon = EXCLUDED.icon,
        color = EXCLUDED.color,
        is_read = EXCLUDED.is_read,
        created_at = EXCLUDED.created_at
    `);

    await pool.query(`
      INSERT INTO lesson_progress
        (user_uid, course_id, lesson_id, is_completed, completed_at, created_at)
      VALUES
        ('demo-user-1', 1, 1, true, NOW(), NOW()),
        ('demo-user-1', 1, 2, true, NOW(), NOW()),
        ('demo-user-1', 2, 3, true, NOW(), NOW()),
        ('demo-user-1', 2, 4, false, NULL, NOW()),
        ('demo-user-2', 1, 1, true, NOW(), NOW()),
        ('demo-user-2', 3, 5, false, NULL, NOW())
      ON CONFLICT (user_uid, lesson_id) DO UPDATE SET
        course_id = EXCLUDED.course_id,
        is_completed = EXCLUDED.is_completed,
        completed_at = EXCLUDED.completed_at
    `);

    await pool.query(`
      INSERT INTO course_reviews
        (review_id, course_id, user_uid, rating, comment, created_at, updated_at)
      VALUES
        (1, 1, 'demo-user-1', 5, 'Clear lessons and useful examples.', NOW(), NOW()),
        (2, 2, 'demo-user-1', 4, 'Good API course, needs more deployment examples.', NOW(), NOW()),
        (3, 1, 'demo-user-2', 5, 'Very beginner friendly.', NOW(), NOW()),
        (4, 3, 'demo-user-2', 4, 'Helpful PostgreSQL overview.', NOW(), NOW())
      ON CONFLICT (review_id) DO UPDATE SET
        course_id = EXCLUDED.course_id,
        user_uid = EXCLUDED.user_uid,
        rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        updated_at = NOW()
    `);

    await pool.query(`
      INSERT INTO bookmarks
        (bookmark_id, course_id, user_uid, created_at)
      VALUES
        (1, 1, 'demo-user-1', NOW()),
        (2, 3, 'demo-user-1', NOW()),
        (3, 2, 'demo-user-2', NOW()),
        (4, 4, 'demo-user-2', NOW())
      ON CONFLICT (bookmark_id) DO UPDATE SET
        course_id = EXCLUDED.course_id,
        user_uid = EXCLUDED.user_uid
    `);

    await pool.query(`
      INSERT INTO upgrade_requests
        (id, user_uid, status, reason, image_url, created_at, updated_at)
      VALUES
        (1, 'demo-user-1', 'pending', NULL, '/uploads/mentor_requests/demo-user-1.png', NOW(), NOW()),
        (2, 'demo-user-2', 'rejected', 'Need more teaching experience.', '/uploads/mentor_requests/demo-user-2.png', NOW(), NOW()),
        (3, 'demo-mentor-1', 'approved', NULL, '/uploads/mentor_requests/demo-mentor-1.png', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        user_uid = EXCLUDED.user_uid,
        status = EXCLUDED.status,
        reason = EXCLUDED.reason,
        image_url = EXCLUDED.image_url,
        updated_at = NOW()
    `);

    const sequences = [
      ["course_categories", "category_id"],
      ["courses", "course_id"],
      ["lessons", "lesson_id"],
      ["enrollments", "enrollment_id"],
      ["quizzes", "quiz_id"],
      ["quiz_questions", "question_id"],
      ["quiz_results", "result_id"],
      ["notifications", "noti_id"],
      ["course_reviews", "review_id"],
      ["bookmarks", "bookmark_id"],
      ["upgrade_requests", "id"],
    ];

    for (const [table, column] of sequences) {
      await pool.query(
        `SELECT setval(pg_get_serial_sequence($1, $2), COALESCE((SELECT MAX(${column}) FROM ${table}), 1), true)`,
        [table, column]
      );
    }

    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  const pool = createPool();
  try {
    await seed(pool);
    console.log("PostgreSQL demo data seeded successfully.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("PostgreSQL demo data seed failed:", error.message);
  process.exit(1);
});
