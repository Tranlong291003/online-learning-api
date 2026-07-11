// config/swagger.config.js
// OpenAPI 3.0 spec sinh tu JSDoc trong cac route.
const swaggerJSDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Online Learning API",
      version: "1.0.0",
      description:
        "REST API cho he thong e-learning (khoa hoc, bai hoc, quiz, thanh toan, mentor, thong bao...). " +
        "Xac thuc bang Supabase Auth JWT dua tren header Authorization: Bearer <token>.",
    },
    servers: [{ url: "http://localhost:3000", description: "Local dev" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        Error: {
          type: "object",
          properties: { error: { type: "string" } },
        },
        OkMessage: {
          type: "object",
          properties: { message: { type: "string" } },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/routes/*.js", "./src/controllers/**/*.js"],
};

module.exports = swaggerJSDoc(options);
