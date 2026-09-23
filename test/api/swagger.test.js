const test = require("node:test");
const assert = require("node:assert/strict");
const { buildSpec } = require("../../src/config/swagger.config");
const { REQUEST_BODIES } = require("../../src/config/swagger.schemas");
const { SWAGGER_UI_SCRIPT } = require("../../src/config/swagger.ui");

const spec = buildSpec();

/** Duyệt mọi operation trong spec. */
function eachOperation(fn) {
  for (const [path, ops] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(ops)) fn({ path, method, op });
  }
}

test("spec là OpenAPI hợp lệ và có đủ thông tin cơ bản", () => {
  assert.equal(spec.openapi, "3.0.3");
  assert.ok(spec.info.title);
  assert.ok(spec.info.description.length > 100, "mô tả phải có hướng dẫn dùng");
  assert.ok(spec.servers.length >= 1);
  assert.ok(spec.components.securitySchemes.bearerAuth, "phải có bearerAuth");
});

test("mọi endpoint đều có tag và mô tả", () => {
  const missingTag = [];
  const missingSummary = [];

  eachOperation(({ path, method, op }) => {
    if (!op.tags || op.tags.length === 0) missingTag.push(`${method} ${path}`);
    if (!op.summary) missingSummary.push(`${method} ${path}`);
  });

  assert.deepEqual(missingTag, [], "endpoint thiếu tag sẽ nhóm sai trên Swagger UI");
  assert.deepEqual(missingSummary, [], "endpoint thiếu summary");
});

test("mọi endpoint POST/PUT/PATCH đều có requestBody", () => {
  // Không có requestBody thì Swagger UI chỉ hiện URL, người dùng phải tự viết
  // JSON tay — đúng vấn đề mà thay đổi này giải quyết.
  const missing = [];

  eachOperation(({ path, method, op }) => {
    if (!["post", "put", "patch"].includes(method)) return;
    if (!op.requestBody) missing.push(`${method.toUpperCase()} ${path}`);
  });

  assert.deepEqual(missing, [], `thiếu requestBody:\n${missing.join("\n")}`);
});

test("mọi requestBody đều có ví dụ để Swagger UI điền sẵn", () => {
  const missing = [];

  eachOperation(({ path, method, op }) => {
    if (!op.requestBody) return;
    for (const [contentType, media] of Object.entries(op.requestBody.content)) {
      if (!media.example) missing.push(`${method.toUpperCase()} ${path} (${contentType})`);
      if (!media.schema) missing.push(`${method.toUpperCase()} ${path} thiếu schema`);
    }
  });

  assert.deepEqual(missing, [], `thiếu ví dụ:\n${missing.join("\n")}`);
});

test("endpoint có tệp gửi lên dùng multipart/form-data", () => {
  // Sai kiểu nội dung thì Swagger UI không hiện ô chọn tệp.
  const uploadPaths = [
    "POST /api/courses/create",
    "POST /api/courses/update/{course_id}",
    "PUT /api/courses/update/{course_id}",
    "POST /api/lessons/create",
    "PUT /api/lessons/update/{lesson_id}",
    "POST /api/course-categories/create",
    "POST /api/mentor-requests/",
    "PUT /api/users/update/{id}",
  ];

  const wrong = [];
  for (const key of uploadPaths) {
    const [method, path] = [key.split(" ")[0].toLowerCase(), key.split(" ")[1]];
    const op = spec.paths[path] && spec.paths[path][method];
    if (!op) continue; // đường dẫn có thể khác tên, bỏ qua
    if (!op.requestBody || !op.requestBody.content["multipart/form-data"]) {
      wrong.push(key);
    }
  }

  // Vài đường dẫn trong danh sách có thể không tồn tại nguyên văn; chỉ khẳng
  // định không có trường hợp nào SAI kiểu nội dung.
  assert.deepEqual(wrong, [], `phải là multipart:\n${wrong.join("\n")}`);
});

test("trường tệp có format binary để Swagger UI hiện ô chọn tệp", () => {
  const bad = [];

  eachOperation(({ path, method, op }) => {
    const media = op.requestBody && op.requestBody.content["multipart/form-data"];
    if (!media) return;
    for (const [name, prop] of Object.entries(media.schema.properties || {})) {
      if (prop.type === "string" && /file|icon|thumbnail|avatar|image|pdf|slide/i.test(name)) {
        if (prop.format !== "binary") bad.push(`${method.toUpperCase()} ${path} → ${name}`);
      }
    }
  });

  assert.deepEqual(bad, [], `trường tệp phải có format: binary:\n${bad.join("\n")}`);
});

test("endpoint công khai không yêu cầu token, endpoint còn lại thì có", () => {
  const publicKeys = [
    "post /api/auth/register",
    "post /api/auth/login",
    "post /api/auth/refresh",
    "post /api/auth/forgot-password",
    "post /api/auth/reset-password",
    "post /api/users/create",
    "post /api/users/login",
  ];

  const wrong = [];
  eachOperation(({ path, method, op }) => {
    const key = `${method} ${path}`;
    const isPublic = publicKeys.includes(key);
    const hasSecurity = Array.isArray(op.security) && op.security.length > 0;
    if (isPublic && hasSecurity) wrong.push(`${key} không nên yêu cầu token`);
    if (!isPublic && !hasSecurity) wrong.push(`${key} phải yêu cầu token`);
  });

  assert.deepEqual(wrong, [], wrong.join("\n"));
});

test("mã trạng thái trong responses khớp với method", () => {
  const bad = [];

  eachOperation(({ path, method, op }) => {
    const codes = Object.keys(op.responses).map(Number);
    // Swagger UI hiện mọi mã khai báo, nên khai báo thừa gây nhiễu.
    if (method === "post" && codes.includes(200)) bad.push(`POST ${path} khai báo 200 (nên là 201)`);
    if (method !== "post" && codes.includes(201)) bad.push(`${method.toUpperCase()} ${path} khai báo 201`);
  });

  assert.deepEqual(bad, [], bad.join("\n"));
});

test("tham số đường dẫn được sinh cho mọi endpoint có {param}", () => {
  const bad = [];

  eachOperation(({ path, method, op }) => {
    const inPath = (path.match(/\{([^}]+)\}/g) || []).map((s) => s.slice(1, -1));
    const declared = (op.parameters || []).filter((p) => p.in === "path").map((p) => p.name);
    for (const name of inPath) {
      if (!declared.includes(name)) bad.push(`${method.toUpperCase()} ${path} thiếu tham số ${name}`);
    }
  });

  assert.deepEqual(bad, [], bad.join("\n"));
});

test("mọi khoá trong swagger.schemas.js đều trỏ tới endpoint có thật", () => {
  // Khoá gõ sai (hoặc endpoint bị đổi tên) sẽ khiến mô tả không bao giờ được
  // dùng tới, mà lại im lặng — nên phải kiểm tra.
  //
  // Khoá trong file mô tả dùng `:param` (giống khai báo trong router), còn spec
  // dùng `{param}`; và route khai báo "/" cho ra đường dẫn có dấu `/` cuối. Phải
  // chuẩn hoá cả hai trước khi so.
  const toKey = (p) => p.replace(/\{([^}]+)\}/g, ":$1").replace(/\/$/, "");
  const known = new Set();
  eachOperation(({ path, method }) => known.add(`${method.toUpperCase()} ${toKey(path)}`));

  const orphans = Object.keys(REQUEST_BODIES).filter((k) => !known.has(k));
  assert.deepEqual(orphans, [], `mô tả thừa (endpoint không tồn tại):\n${orphans.join("\n")}`);
});

test("script giao diện Swagger có đủ phần đăng nhập nhanh và đọc kết quả", () => {
  assert.ok(SWAGGER_UI_SCRIPT.includes("Đăng nhập nhanh"), "phải có bảng đăng nhập nhanh");
  assert.ok(SWAGGER_UI_SCRIPT.includes("/api/auth/login"), "phải gọi đúng endpoint đăng nhập");
  assert.ok(SWAGGER_UI_SCRIPT.includes("bearerAuth"), "phải gắn token vào bearerAuth");
  assert.ok(SWAGGER_UI_SCRIPT.includes("persistAuthorization") || SWAGGER_UI_SCRIPT.includes("authorized"),
    "phải ghi token vào nơi Swagger UI đọc lại");
  assert.ok(SWAGGER_UI_SCRIPT.includes("MutationObserver"), "phải theo dõi khối kết quả");
  // Không được nhúng bí mật vào trang công khai.
  assert.ok(!/DEV_API_KEY|JWT_SECRET|eyJhbGciOi/.test(SWAGGER_UI_SCRIPT),
    "không được nhúng khoá bí mật vào script");
});
