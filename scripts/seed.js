// =============================================================
// scripts/seed.js — Tạo dữ liệu demo (8 categories + 24 courses + lessons + mentor user)
// Chạy: node scripts/seed.js
// Lưu ý: dùng supabaseAdmin, KHÔNG thay đổi user có sẵn
// =============================================================
require("dotenv").config();
const { supabaseAdmin } = require("../src/config/supabase.config");

// ============================================================
// DEMO DATA
// ============================================================
const CATEGORIES = [
  { name: "Lập trình Web",     description: "HTML, CSS, JS, React, Next.js" },
  { name: "Lập trình Mobile",  description: "Flutter, React Native, iOS, Android" },
  { name: "Backend & DevOps",  description: "Node.js, Docker, Kubernetes, CI/CD" },
  { name: "Data Science & AI", description: "Python, Machine Learning, Deep Learning" },
  { name: "Thiết kế UX/UI",    description: "Figma, Adobe XD, Design System" },
  { name: "Marketing & Sales", description: "SEO, Facebook Ads, Content" },
  { name: "Ngoại ngữ",         description: "IELTS, TOEIC, Tiếng Anh giao tiếp" },
  { name: "Kỹ năng mềm",       description: "Thuyết trình, Quản lý thời gian, Leadership" },
];

// 24 khoa hoc, moi category 3 khoa. YouTube IDs da verify.
const COURSES = [
  // Lập trình Web (1)
  { cat: 0, title: "HTML CSS từ Zero đến Hero",                description: "Học HTML5, CSS3, Flexbox, Grid, Responsive từ cơ bản đến nâng cao. Xây dựng 5+ project thực tế.", price: 499000, level: "beginner",     thumbnail: "https://i.ytimg.com/vi/DPnqb66SmPc/maxresdefault.jpg", yt: "DPnqb66SmPc", lessons: ["Giới thiệu HTML", "Cú pháp CSS cơ bản", "Flexbox toàn tập", "CSS Grid nâng cao", "Responsive Web Design"] },
  { cat: 0, title: "JavaScript Modern (ES6+) cho người mới",    description: "Nắm vững ES6, ES2020, async/await, Promise, modules, classes. Làm nền tảng cho React/Vue.", price: 699000, level: "beginner",     thumbnail: "https://i.ytimg.com/vi/W6NZfCO5SIk/maxresdefault.jpg", yt: "W6NZfCO5SIk", lessons: ["Biến let/const", "Arrow function", "Promise & async/await", "Destructuring", "Module ES6"] },
  { cat: 0, title: "ReactJS + NextJS toàn tập",                description: "React Hooks, Context, Redux Toolkit, Next.js App Router, Server Components.", price: 1299000, level: "intermediate", thumbnail: "https://i.ytimg.com/vi/Tn6-PIqc4UM/maxresdefault.jpg", yt: "Tn6-PIqc4UM", lessons: ["JSX & Component", "useState useEffect", "React Router", "Redux Toolkit", "Next.js App Router"] },

  // Lập trình Mobile (2)
  { cat: 1, title: "Flutter cơ bản cho người mới bắt đầu",     description: "Dart, Widget, State management (Provider, Riverpod), làm app thương mại điện tử.", price: 999000, level: "beginner",     thumbnail: "https://i.ytimg.com/vi/x0uinJvhZe8/maxresdefault.jpg", yt: "x0uinJvhZe8", lessons: ["Cài đặt Flutter", "Widget cơ bản", "State management", "Provider package", "Build app E-commerce"] },
  { cat: 1, title: "React Native thực chiến",                  description: "Xây dựng app cross-platform iOS/Android, Navigation, Firebase, push notification.", price: 1199000, level: "intermediate", thumbnail: "https://i.ytimg.com/vi/0-S5a0MeXPc/maxresdefault.jpg", yt: "0-S5a0MeXPc", lessons: ["Setup RN", "Navigation", "Redux + RN", "Firebase Auth", "Publish App Store"] },
  { cat: 1, title: "iOS Swift từ A-Z",                          description: "Xcode, SwiftUI, UIKit, CoreData, API integration, App Store submission.", price: 1499000, level: "beginner",     thumbnail: "https://i.ytimg.com/vi/09TeUXjzpKs/maxresdefault.jpg", yt: "09TeUXjzpKs", lessons: ["Xcode tour", "SwiftUI basics", "State & Binding", "Networking", "Submit to App Store"] },

  // Backend & DevOps (3)
  { cat: 2, title: "Node.js & Express nâng cao",                description: "REST API, JWT, OAuth2, Prisma/Supabase, testing, performance, security.", price: 899000, level: "intermediate", thumbnail: "https://i.ytimg.com/vi/L72fhGm1tfE/maxresdefault.jpg", yt: "L72fhGm1tfE", lessons: ["Node.js core", "Express middleware", "JWT auth", "Prisma ORM", "Deploy production"] },
  { cat: 2, title: "Docker thực chiến cho Developer",           description: "Container, Docker Compose, multi-stage build, image optimization, CI/CD.", price: 799000, level: "intermediate", thumbnail: "https://i.ytimg.com/vi/3c-iBn73dDE/maxresdefault.jpg", yt: "3c-iBn73dDE", lessons: ["Docker là gì", "Container vs VM", "Dockerfile", "Docker Compose", "Multi-stage build"] },
  { cat: 2, title: "Kubernetes từ Zero",                         description: "Pod, Deployment, Service, Helm, monitoring, scaling cho hệ thống production.", price: 1499000, level: "advanced",     thumbnail: "https://i.ytimg.com/vi/X48VuDVv0WA/maxresdefault.jpg", yt: "X48VuDVv0WA", lessons: ["K8s architecture", "Pod & Deployment", "Service & Ingress", "ConfigMap & Secret", "Helm chart"] },

  // Data Science & AI (4)
  { cat: 3, title: "Python cho Data Science",                   description: "NumPy, Pandas, Matplotlib, Seaborn, phân tích dữ liệu thực tế với Kaggle dataset.", price: 999000, level: "beginner",     thumbnail: "https://i.ytimg.com/vi/r-uOLxNrNk8/maxresdefault.jpg", yt: "r-uOLxNrNk8", lessons: ["NumPy basics", "Pandas DataFrame", "Data cleaning", "Visualization", "Case study thực tế"] },
  { cat: 3, title: "Machine Learning cơ bản",                    description: "Linear/Logistic Regression, Decision Tree, Random Forest, XGBoost, Scikit-learn.", price: 1299000, level: "intermediate", thumbnail: "https://i.ytimg.com/vi/i_LwzRVP7bg/maxresdefault.jpg", yt: "i_LwzRVP7bg", lessons: ["ML là gì", "Linear Regression", "Classification", "Tree-based models", "Model evaluation"] },
  { cat: 3, title: "Deep Learning với PyTorch",                  description: "Neural Network, CNN, RNN, Transformer, training trên GPU với PyTorch.", price: 1799000, level: "advanced",     thumbnail: "https://i.ytimg.com/vi/c36lUUr864M/maxresdefault.jpg", yt: "c36lUUr864M", lessons: ["Neural network", "PyTorch basics", "CNN cho ảnh", "RNN/LSTM", "Transformer"] },

  // Thiết kế UX/UI (5)
  { cat: 4, title: "Figma từ cơ bản đến nâng cao",              description: "Auto layout, Components, Variants, Prototype, Design System chuyên nghiệp.", price: 599000, level: "beginner",     thumbnail: "https://i.ytimg.com/vi/jwCmIBJ8Jtc/maxresdefault.jpg", yt: "jwCmIBJ8Jtc", lessons: ["Figma UI", "Auto layout", "Components", "Prototype", "Design system"] },
  { cat: 4, title: "UX Research & Testing",                      description: "Phương pháp nghiên cứu user, persona, user journey, A/B test, usability test.", price: 799000, level: "intermediate", thumbnail: "https://i.ytimg.com/vi/dLrdBCxojjw/maxresdefault.jpg", yt: "dLrdBCxojjw", lessons: ["UX Research là gì", "User Persona", "User Journey", "Usability Testing", "A/B Test"] },
  { cat: 4, title: "Thiết kế Mobile App chuyên nghiệp",         description: "iOS Human Interface, Material Design, motion design, micro-interaction.", price: 899000, level: "intermediate", thumbnail: "https://i.ytimg.com/vi/FT3b0NhMJ94/maxresdefault.jpg", yt: "FT3b0NhMJ94", lessons: ["iOS HIG", "Material Design", "Typography", "Color & Contrast", "Motion Design"] },

  // Marketing & Sales (6)
  { cat: 5, title: "Facebook Ads từ A-Z",                        description: "Setup pixel, target audience, A/B test, lookalike, scale ads bền vững.", price: 799000, level: "beginner",     thumbnail: "https://i.ytimg.com/vi/YPi6xbOPgL4/maxresdefault.jpg", yt: "YPi6xbOPgL4", lessons: ["Meta Business Suite", "Pixel & CAPI", "Audience", "Creative Ads", "Scale & Optimize"] },
  { cat: 5, title: "SEO toàn tập 2024",                          description: "On-page, Off-page, Technical SEO, content strategy, Google Search Console.", price: 999000, level: "intermediate", thumbnail: "https://i.ytimg.com/vi/xsVTje-mxTY/maxresdefault.jpg", yt: "xsVTje-mxTY", lessons: ["SEO cơ bản", "Keyword research", "On-page SEO", "Link building", "SEO Tools"] },
  { cat: 5, title: "Content Marketing chuyên nghiệp",            description: "Chiến lược content, viết bài SEO, video script, social media content plan.", price: 599000, level: "beginner",     thumbnail: "https://i.ytimg.com/vi/HU3CnpfA0V0/maxresdefault.jpg", yt: "HU3CnpfA0V0", lessons: ["Content strategy", "Editorial calendar", "SEO Writing", "Video script", "Repurpose content"] },

  // Ngoại ngữ (7)
  { cat: 6, title: "IELTS 7.0+ chiến lược từ 0",                 description: "Lộ trình 4 kỹ năng, chiến thuật làm bài, từ vựng học thuật, mock test thực tế.", price: 1299000, level: "intermediate", thumbnail: "https://i.ytimg.com/vi/NwjKqBG-vO4/maxresdefault.jpg", yt: "NwjKqBG-vO4", lessons: ["IELTS format", "Listening tips", "Reading strategies", "Writing Task 1+2", "Speaking"] },
  { cat: 6, title: "Tiếng Anh giao tiếp cho người đi làm",       description: "Email, meeting, presentation, negotiation. Phát âm chuẩn bản xứ.", price: 699000, level: "beginner",     thumbnail: "https://i.ytimg.com/vi/Q-AJpAm9Dhg/maxresdefault.jpg", yt: "Q-AJpAm9Dhg", lessons: ["Giao tiếp cơ bản", "Email công việc", "Meeting vocabulary", "Presentation", "Pronunciation"] },
  { cat: 6, title: "TOEIC 750+ toàn tập",                       description: "Chiến thuật làm bài TOEIC, từ vựng, ngữ pháp, 7 part listening + reading.", price: 799000, level: "intermediate", thumbnail: "https://i.ytimg.com/vi/P7Yu7Wm5FNs/maxresdefault.jpg", yt: "P7Yu7Wm5FNs", lessons: ["TOEIC format", "Part 1-4 Listening", "Part 5-6 Grammar", "Part 7 Reading", "Mock test"] },

  // Kỹ năng mềm (8)
  { cat: 7, title: "Kỹ năng thuyết trình trước đám đông",       description: "Cấu trúc bài thuyết trình, body language, xử lý câu hỏi, tự tin trước 1000 người.", price: 499000, level: "beginner",     thumbnail: "https://i.ytimg.com/vi/d8D2e3l1_DY/maxresdefault.jpg", yt: "d8D2e3l1_DY", lessons: ["Chuẩn bị nội dung", "Slide design", "Voice & tone", "Body language", "Q&A"] },
  { cat: 7, title: "Quản lý thời gian cho người bận rộn",        description: "Pomodoro, Eisenhower matrix, GTD, xây dựng thói quen, cân bằng công việc - cuộc sống.", price: 399000, level: "beginner",     thumbnail: "https://i.ytimg.com/vi/z6wMDp1FAeg/maxresdefault.jpg", yt: "z6wMDp1FAeg", lessons: ["Pomodoro", "Eisenhower matrix", "GTD method", "Habit tracking", "Work-life balance"] },
  { cat: 7, title: "Leadership cho người mới quản lý",          description: "Phong cách lãnh đạo, giao việc, đánh giá nhân viên, xây dựng team hiệu suất cao.", price: 899000, level: "intermediate", thumbnail: "https://i.ytimg.com/vi/2vjPBrBU-TM/maxresdefault.jpg", yt: "2vjPBrBU-TM", lessons: ["Leadership style", "Delegation", "Feedback", "1-on-1 meeting", "Team building"] },
];

// ============================================================
// HELPERS
// ============================================================
const log = (...a) => console.log("[seed]", ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureMentor() {
  // Tao mentor user (Supabase Auth) neu chua co
  const email = "mentor.demo@onlinelearning.vn";
  const password = "Demo@12345";

  // Kiem tra da ton tai trong public.users chua
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("uid, role, name, email")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    log("Mentor da ton tai:", existing.email);
    return existing;
  }

  // Tao trong auth
  const { data: auth, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr || !auth?.user) throw new Error("auth.createUser failed: " + authErr?.message);
  const uid = auth.user.id;

  // Insert public.users
  const { data: ins, error: insErr } = await supabaseAdmin
    .from("users")
    .insert({
      uid,
      email,
      name: "Mentor Demo",
      role: "mentor",
      is_active: true,
      bio: "Giảng viên demo với 10+ năm kinh nghiệm",
    })
    .select()
    .single();
  if (insErr) throw new Error("insert users failed: " + insErr.message);
  log("Da tao mentor:", email, "/", password);
  return ins;
}

async function seedCategories() {
  log("Seeding categories...");
  // Wipe + recreate de tranh race FK
  await supabaseAdmin.from("courses").delete().neq("course_id", 0);
  await supabaseAdmin.from("course_categories").delete().neq("category_id", 0);
  const inserted = [];
  for (const c of CATEGORIES) {
    const { data, error } = await supabaseAdmin
      .from("course_categories")
      .insert(c)
      .select()
      .single();
    if (error) throw new Error("insert category failed: " + error.message);
    log("  +", c.name, "->", data.category_id);
    inserted.push(data);
  }
  return inserted;
}

async function seedCourses(mentor, categories) {
  log("Seeding courses...");
  // Wipe truoc
  await supabaseAdmin.from("courses").delete().neq("course_id", 0);
  const courses = [];
  for (const c of COURSES) {
    const cat = categories[c.cat];
    if (!cat) continue;
    const { data: existed } = await supabaseAdmin
      .from("courses")
      .select("course_id")
      .eq("title", c.title)
      .maybeSingle();
    if (existed) {
      log("  - skip (exists):", c.title);
      courses.push(existed);
      continue;
    }
    const { data, error } = await supabaseAdmin
      .from("courses")
      .insert({
        title: c.title,
        description: c.description,
        category_id: cat.category_id,
        instructor_uid: mentor.uid,
        price: c.price,
        discount_price: c.price > 1000000 ? Math.floor(c.price * 0.7) : null,
        level: c.level,
        thumbnail_url: c.thumbnail,
        status: "approved",
      })
      .select()
      .single();
    if (error) {
      log("  ! insert course failed:", c.title, "->", error.message);
      continue;
    }
    if (!data || !data.instructor_uid) {
      log("  ! insert course returned no data:", c.title);
      continue;
    }
    log("  +", c.title, "-> course_id:", data.course_id, "instructor:", data.instructor_uid);
    courses.push({ ...data, _yt: c.yt, _lessons: c.lessons });
  }
  return courses;
}

async function seedLessons(courses) {
  log("Seeding lessons...");
  log("  Found", courses.length, "courses to process");
  let count = 0;
  for (const course of courses) {
    log("  - course", course.course_id, course.title, "instructor:", course.instructor_uid, "lessons:", course._lessons?.length, "yt:", course._yt);
    if (!course._lessons || !course._yt) continue;
    // Kiem tra course da co lesson chua
    const { count: existing } = await supabaseAdmin
      .from("lessons")
      .select("lesson_id", { count: "exact", head: true })
      .eq("course_id", course.course_id);
    if (existing && existing > 0) {
      log("  - skip (has lessons):", course.title);
      continue;
    }
    for (let i = 0; i < course._lessons.length; i++) {
      const title = course._lessons[i];
      const video_id = course._yt;
      const { error } = await supabaseAdmin.from("lessons").insert({
        course_id: course.course_id,
        title,
        video_url: `https://www.youtube.com/watch?v=${video_id}`,
        video_id,
        video_duration: 600 + i * 120,
        order: i + 1,
        content: `Bai hoc ${i + 1}: ${title}`,
        creator_uid: course.instructor_uid,
      });
      if (error) {
        log("  ! insert lesson failed:", title, "->", error.message);
      } else {
        count++;
      }
    }
    log("  +", course._lessons.length, "lessons for", course.title);
  }
  log("Total lessons inserted:", count);
}

async function seedSampleQuizzes(courses) {
  log("Seeding sample quizzes (5 questions each for first 5 courses)...");
  for (const course of courses.slice(0, 5)) {
    const { data: existed } = await supabaseAdmin
      .from("quizzes")
      .select("quiz_id")
      .eq("course_id", course.course_id)
      .eq("title", "Quiz cuoi khoa")
      .maybeSingle();
    if (existed) {
      log("  - skip quiz (exists) for", course.title);
      continue;
    }
    const { data: quiz, error: qErr } = await supabaseAdmin
      .from("quizzes")
      .insert({
        course_id: course.course_id,
        title: "Quiz cuoi khoa",
        description: "Kiem tra kien thuc tong hop",
        type: "trac_nghiem",
        time_limit: 30,
        attempt_limit: 3,
        creator_uid: course.instructor_uid,
      })
      .select()
      .single();
    if (qErr) {
      log("  ! insert quiz failed:", qErr.message);
      continue;
    }
    const questions = [
      { q: "Cau hoi 1: Ban da hoc duoc gi trong khoa hoc nay?", opts: ["Rat nhieu", "Mot it", "Khong gi ca", "Khong ro"], correct: 0, kw: "nhieu,kien thuc" },
      { q: "Cau hoi 2: Muc do khoa hoc nay?", opts: ["De", "Trung binh", "Kho", "Rat kho"], correct: 1, kw: "trung binh" },
      { q: "Cau hoi 3: Ban co muon hoc them khong?", opts: ["Co", "Khong", "Co the", "Chua biet"], correct: 0, kw: "co" },
      { q: "Cau hoi 4: Thoi gian hoc trung binh/ngay?", opts: ["< 30p", "30-60p", "1-2h", "> 2h"], correct: 1, kw: "30-60p" },
      { q: "Cau hoi 5: Danh gia chat luong giang vien?", opts: ["Tot", "Kha", "Trung binh", "Yeu"], correct: 0, kw: "tot" },
    ];
    for (const q of questions) {
      const { error: qqErr } = await supabaseAdmin.from("quiz_questions").insert({
        quiz_id: quiz.quiz_id,
        question: q.q,
        options: q.opts,
        correct_index: q.correct,
        expected_keywords: q.kw,
      });
      if (qqErr) log("  ! insert question failed:", qqErr.message);
    }
    log("  + quiz + 5 questions for", course.title);
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  log("Start seeding...");
  log("Supabase URL:", process.env.SUPABASE_URL);

  try {
    const mentor = await ensureMentor();
    const categories = await seedCategories();
    const courses = await seedCourses(mentor, categories);
    await seedLessons(courses);
    await seedSampleQuizzes(courses);

    // Final stats
    const [{ count: cCount }, { count: coCount }, { count: lCount }] = await Promise.all([
      supabaseAdmin.from("course_categories").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("courses").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("lessons").select("*", { count: "exact", head: true }),
    ]);
    log("=== DONE ===");
    log("Categories:", cCount);
    log("Courses   :", coCount);
    log("Lessons   :", lCount);
    log("Mentor    : mentor.demo@onlinelearning.vn / Demo@12345");
    process.exit(0);
  } catch (err) {
    console.error("[seed] FAILED:", err);
    process.exit(1);
  }
}

main();
