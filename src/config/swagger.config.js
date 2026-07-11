// config/swagger.config.js
// OpenAPI 3.0 spec sinh tu JSDoc trong cac route.
const swaggerJSDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "API Hệ thống Học trực tuyến",
      version: "1.0.0",
      description:
        "REST API toàn diện cho hệ thống e-learning: khóa học, bài học, " +
        "quiz, đánh giá, thanh toán, mentor và thông báo. " +
        "Xác thực bằng Supabase Auth JWT qua header Authorization: Bearer <token>.",
    },
    servers: [
      { url: "https://online-learning-api.vercel.app", description: "Production (Vercel)" },
      { url: "http://localhost:3000", description: "Local dev" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        Error: {
          type: "object",
          properties: { error: { type: "string", example: "Thông báo lỗi" } },
        },
        OkMessage: {
          type: "object",
          properties: { message: { type: "string", example: "Thao tác thành công" } },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Users", description: "Quản lý người dùng (admin, mentor, user)" },
      { name: "Courses", description: "Quản lý khóa học" },
      { name: "Lessons", description: "Bài học trong khóa học" },
      { name: "Enrollments", description: "Đăng ký khóa học và tiến độ học tập" },
      { name: "Quizzes", description: "Bài kiểm tra (trắc nghiệm + tự luận)" },
      { name: "Questions", description: "Câu hỏi trong quiz" },
      { name: "QuizResults", description: "Kết quả nộp bài quiz" },
      { name: "Reviews", description: "Đánh giá khóa học" },
      { name: "Bookmarks", description: "Đánh dấu khóa học yêu thích" },
      { name: "Notifications", description: "Thông báo cho user" },
      { name: "MentorRequests", description: "Yêu cầu nâng cấp lên Mentor" },
      { name: "CourseCategories", description: "Danh mục khóa học" },
      { name: "AppStats", description: "Thống kê dashboard (admin/mentor)" },
    ],
  },
  apis: ["./src/routes/*.js", "./src/controllers/**/*.js"],
};

module.exports = swaggerJSDoc(options);
