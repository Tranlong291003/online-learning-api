const express = require("express");
const cors = require("cors");
const swaggerSpec = require("./config/swagger.config");
const app = express();
const path = require("path");

app.use(cors());
app.use(express.json());

// Swagger UI - custom HTML + CSS toi uu cho Vercel serverless
// (swagger-ui-express's static files khong hoat dong tren Vercel)
// Giao dien tieng Viet co dau, dark mode + glassmorphism
const swaggerHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tài liệu API - Hệ thống Học trực tuyến</title>
  <link rel="icon" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/favicon-32x32.png">
  <style>
    :root {
      --bg-primary: #0a0e27;
      --bg-secondary: #131938;
      --bg-card: rgba(30, 41, 82, 0.6);
      --border-card: rgba(99, 102, 241, 0.2);
      --accent: #6366f1;
      --accent-hover: #818cf8;
      --accent-2: #ec4899;
      --accent-3: #14b8a6;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --info: #3b82f6;
      --code-bg: #0f172a;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
    }
    body::before {
      content: "";
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background:
        radial-gradient(circle at 20% 30%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 80% 70%, rgba(236, 72, 153, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 50% 50%, rgba(20, 184, 166, 0.08) 0%, transparent 50%);
      pointer-events: none;
      z-index: -1;
    }
    .hero {
      max-width: 1280px;
      margin: 0 auto;
      padding: 80px 24px 60px;
      text-align: center;
    }
    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 999px;
      font-size: 13px;
      color: var(--accent-hover);
      backdrop-filter: blur(10px);
      margin-bottom: 24px;
    }
    .hero-badge .dot {
      width: 8px; height: 8px;
      background: var(--success);
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.3); }
    }
    .hero h1 {
      font-size: clamp(36px, 6vw, 64px);
      font-weight: 800;
      line-height: 1.1;
      margin-bottom: 20px;
      background: linear-gradient(135deg, #f1f5f9 0%, #818cf8 50%, #ec4899 100%);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero p {
      font-size: 18px;
      color: var(--text-secondary);
      max-width: 720px;
      margin: 0 auto 40px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      max-width: 960px;
      margin: 0 auto 60px;
    }
    .stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 16px;
      padding: 24px;
      backdrop-filter: blur(20px);
      transition: all 0.3s ease;
    }
    .stat-card:hover {
      transform: translateY(-4px);
      border-color: var(--accent);
    }
    .stat-value {
      font-size: 36px;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent-hover), var(--accent-2));
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .stat-label {
      font-size: 14px;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 24px 80px;
    }
    .section-title {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .section-title::before {
      content: "";
      width: 4px; height: 28px;
      background: linear-gradient(180deg, var(--accent), var(--accent-2));
      border-radius: 2px;
    }
    .endpoints-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }
    .endpoint-card {
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 14px;
      padding: 20px;
      transition: all 0.3s ease;
      cursor: pointer;
      backdrop-filter: blur(20px);
      position: relative;
      overflow: hidden;
    }
    .endpoint-card::before {
      content: "";
      position: absolute;
      top: 0; left: 0;
      width: 4px; height: 100%;
      background: var(--method-color, var(--accent));
      transition: width 0.3s ease;
    }
    .endpoint-card:hover {
      transform: translateY(-2px);
      border-color: var(--accent);
      box-shadow: 0 12px 40px rgba(99, 102, 241, 0.15);
    }
    .endpoint-card:hover::before { width: 6px; }
    .endpoint-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
    }
    .method-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #fff;
    }
    .method-GET    { background: linear-gradient(135deg, #10b981, #059669); --method-color: #10b981; }
    .method-POST   { background: linear-gradient(135deg, #3b82f6, #2563eb); --method-color: #3b82f6; }
    .method-PUT    { background: linear-gradient(135deg, #f59e0b, #d97706); --method-color: #f59e0b; }
    .method-PATCH  { background: linear-gradient(135deg, #f59e0b, #d97706); --method-color: #f59e0b; }
    .method-DELETE { background: linear-gradient(135deg, #ef4444, #dc2626); --method-color: #ef4444; }
    .endpoint-path {
      font-family: "SF Mono", Monaco, "Cascadia Code", monospace;
      font-size: 14px;
      color: var(--text-primary);
      word-break: break-all;
    }
    .endpoint-summary {
      font-size: 14px;
      color: var(--text-secondary);
      margin-top: 8px;
      line-height: 1.5;
    }
    .tag-group {
      margin-bottom: 48px;
    }
    .tag-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-card);
    }
    .tag-name {
      font-size: 20px;
      font-weight: 700;
      color: var(--accent-hover);
    }
    .tag-count {
      padding: 2px 10px;
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 999px;
      font-size: 12px;
      color: var(--text-muted);
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(10, 14, 39, 0.85);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border-card);
      padding: 16px 0;
      margin-bottom: 40px;
    }
    .toolbar-inner {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 24px;
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }
    .search-box {
      flex: 1;
      min-width: 240px;
      padding: 10px 16px;
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 10px;
      color: var(--text-primary);
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    .search-box:focus { border-color: var(--accent); }
    .search-box::placeholder { color: var(--text-muted); }
    .btn {
      padding: 10px 18px;
      background: var(--bg-card);
      border: 1px solid var(--border-card);
      border-radius: 10px;
      color: var(--text-primary);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn:hover { border-color: var(--accent); background: rgba(99, 102, 241, 0.1); }
    .btn-primary {
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      border: none;
      color: #fff;
    }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4); }
    .footer {
      text-align: center;
      padding: 40px 24px;
      color: var(--text-muted);
      font-size: 14px;
      border-top: 1px solid var(--border-card);
      margin-top: 60px;
    }
    .footer a { color: var(--accent-hover); text-decoration: none; }
    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 20px;
      backdrop-filter: blur(8px);
    }
    .modal-overlay.active { display: flex; }
    .modal {
      background: var(--bg-secondary);
      border: 1px solid var(--border-card);
      border-radius: 16px;
      max-width: 900px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      padding: 32px;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
    }
    .modal-title { font-size: 22px; font-weight: 700; }
    .modal-close {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 28px;
      cursor: pointer;
      line-height: 1;
    }
    .modal-close:hover { color: var(--text-primary); }
    .modal-section { margin-bottom: 20px; }
    .modal-section h4 {
      font-size: 14px;
      font-weight: 600;
      color: var(--accent-hover);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .param-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .param-table th, .param-table td {
      text-align: left;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border-card);
    }
    .param-table th { color: var(--text-muted); font-weight: 500; font-size: 12px; text-transform: uppercase; }
    .param-table code {
      background: var(--code-bg);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 13px;
      color: var(--accent-hover);
    }
    .try-it {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .try-it input, .try-it textarea {
      width: 100%;
      padding: 10px 12px;
      background: var(--code-bg);
      border: 1px solid var(--border-card);
      border-radius: 8px;
      color: var(--text-primary);
      font-family: "SF Mono", Monaco, monospace;
      font-size: 13px;
      outline: none;
    }
    .try-it input:focus, .try-it textarea:focus { border-color: var(--accent); }
    .response-box {
      background: var(--code-bg);
      border: 1px solid var(--border-card);
      border-radius: 8px;
      padding: 16px;
      max-height: 400px;
      overflow: auto;
      font-family: "SF Mono", Monaco, monospace;
      font-size: 12px;
      white-space: pre-wrap;
      color: var(--text-secondary);
    }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <!-- Hero -->
  <section class="hero">
    <div class="hero-badge">
      <span class="dot"></span>
      API đang hoạt động • v1.0.0
    </div>
    <h1>Tài liệu API<br>Hệ thống Học trực tuyến</h1>
    <p>REST API toàn diện cho hệ thống e-learning: khóa học, bài học, quiz, đánh giá, thanh toán, mentor và thông báo. Xác thực bằng Supabase Auth JWT.</p>
    <div class="stats" id="stats">
      <div class="stat-card">
        <div class="stat-value" id="stat-endpoints">–</div>
        <div class="stat-label">Tổng số Endpoint</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="stat-tags">–</div>
        <div class="stat-label">Nhóm chức năng</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="stat-methods">–</div>
        <div class="stat-label">Phương thức HTTP</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">JWT</div>
        <div class="stat-label">Xác thực Supabase</div>
      </div>
    </div>
  </section>

  <!-- Toolbar -->
  <div class="toolbar">
    <div class="toolbar-inner">
      <input type="text" class="search-box" id="search-box" placeholder="🔍  Tìm kiếm endpoint, tag hoặc mô tả..." />
      <button class="btn" onclick="filterByMethod('all')">Tất cả</button>
      <button class="btn" onclick="filterByMethod('GET')">GET</button>
      <button class="btn" onclick="filterByMethod('POST')">POST</button>
      <button class="btn" onclick="filterByMethod('PUT')">PUT</button>
      <button class="btn" onclick="filterByMethod('DELETE')">DELETE</button>
      <button class="btn btn-primary" onclick="openAuth()">🔓 Đăng nhập</button>
    </div>
  </div>

  <!-- Endpoints -->
  <div class="container" id="endpoints-container">
    <div style="text-align:center; padding:60px 0; color: var(--text-muted);">Đang tải tài liệu API...</div>
  </div>

  <footer class="footer">
    <p>📚 Hệ thống Học trực tuyến • Triển khai trên Vercel Serverless</p>
    <p style="margin-top:8px;">
      <a href="/api-docs.json">OpenAPI JSON</a> •
      <a href="/">Trang chủ</a> •
      <a href="https://github.com/Tranlong291003/online-learning-api" target="_blank">GitHub</a>
    </p>
  </footer>

  <!-- Modal -->
  <div class="modal-overlay" id="modal-overlay" onclick="if(event.target===this) closeModal()">
    <div class="modal" id="modal">
      <div class="modal-header">
        <div>
          <div class="modal-title" id="modal-title">Endpoint</div>
        </div>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div id="modal-body">Đang tải...</div>
    </div>
  </div>

  <!-- Auth Modal -->
  <div class="modal-overlay" id="auth-overlay" onclick="if(event.target===this) closeAuth()">
    <div class="modal" style="max-width:480px;">
      <div class="modal-header">
        <div class="modal-title">🔓 Đăng nhập để xác thực</div>
        <button class="modal-close" onclick="closeAuth()">&times;</button>
      </div>
      <div class="try-it">
        <label style="font-size:13px;color:var(--text-muted);">Email</label>
        <input type="email" id="auth-email" value="mentor.demo@onlinelearning.vn" />
        <label style="font-size:13px;color:var(--text-muted);">Mật khẩu</label>
        <input type="password" id="auth-password" value="Demo@12345" />
        <button class="btn btn-primary" onclick="doLogin()">Đăng nhập</button>
        <div id="auth-result" class="response-box" style="display:none;"></div>
      </div>
    </div>
  </div>

  <script>
    let allEndpoints = [];
    let allTags = {};
    let activeMethod = 'all';
    let authToken = localStorage.getItem('api_token') || '';

    const TAG_LABELS_VI = {
      'Users': 'Người dùng',
      'Courses': 'Khóa học',
      'Lessons': 'Bài học',
      'Enrollments': 'Đăng ký học',
      'Quizzes': 'Bài kiểm tra',
      'Questions': 'Câu hỏi',
      'QuizResults': 'Kết quả Quiz',
      'Reviews': 'Đánh giá',
      'Bookmarks': 'Đánh dấu yêu thích',
      'Notifications': 'Thông báo',
      'MentorRequests': 'Yêu cầu Mentor',
      'CourseCategories': 'Danh mục khóa học',
      'AppStats': 'Thống kê ứng dụng',
    };

    async function loadSpec() {
      try {
        const res = await fetch('/api-docs.json');
        const spec = await res.json();
        renderSpec(spec);
      } catch (e) {
        document.getElementById('endpoints-container').innerHTML =
          '<div style="text-align:center;color:var(--danger);padding:60px 0;">❌ Lỗi tải tài liệu: ' + e.message + '</div>';
      }
    }

    function renderSpec(spec) {
      const paths = spec.paths || {};
      allEndpoints = [];
      Object.entries(paths).forEach(([path, methods]) => {
        Object.entries(methods).forEach(([method, op]) => {
          if (['parameters','summary','description'].includes(method)) return;
          const tags = op.tags || ['Khác'];
          allEndpoints.push({
            path, method: method.toUpperCase(), op, tags,
            tag: tags[0],
            summary: op.summary || '',
            description: op.description || '',
          });
          tags.forEach(t => { if (!allTags[t]) allTags[t] = []; allTags[t].push(allEndpoints[allEndpoints.length-1]); });
        });
      });

      // Stats
      document.getElementById('stat-endpoints').textContent = allEndpoints.length;
      document.getElementById('stat-tags').textContent = Object.keys(allTags).length;
      const methods = new Set(allEndpoints.map(e => e.method));
      document.getElementById('stat-methods').textContent = methods.size;

      renderEndpoints();
    }

    function renderEndpoints() {
      const container = document.getElementById('endpoints-container');
      const search = document.getElementById('search-box').value.toLowerCase();
      const grouped = {};
      allEndpoints
        .filter(e => activeMethod === 'all' || e.method === activeMethod)
        .filter(e => !search || (e.path + ' ' + e.summary + ' ' + e.tag).toLowerCase().includes(search))
        .forEach(e => { if (!grouped[e.tag]) grouped[e.tag] = []; grouped[e.tag].push(e); });

      const tagOrder = Object.keys(TAG_LABELS_VI);
      const sortedTags = Object.keys(grouped).sort((a, b) => {
        const ia = tagOrder.indexOf(a); const ib = tagOrder.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });

      if (sortedTags.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:60px 0;color:var(--text-muted);">🔍 Không tìm thấy endpoint nào.</div>';
        return;
      }

      container.innerHTML = sortedTags.map(tag => {
        const items = grouped[tag];
        const viName = TAG_LABELS_VI[tag] || tag;
        return '<div class="tag-group">' +
          '<div class="tag-header"><div class="tag-name">' + viName + '</div><div class="tag-count">' + items.length + ' endpoint</div></div>' +
          '<div class="endpoints-grid">' +
            items.map((e, i) => renderCard(e, tag, i)).join('') +
          '</div></div>';
      }).join('');
    }

    function renderCard(e, tag, idx) {
      return '<div class="endpoint-card" onclick="openEndpoint(\\'' + tag + '\\',' + idx + ')">' +
        '<div class="endpoint-header">' +
          '<span class="method-badge method-' + e.method + '">' + e.method + '</span>' +
          '<span class="endpoint-path">' + e.path + '</span>' +
        '</div>' +
        (e.summary ? '<div class="endpoint-summary">' + escapeHtml(e.summary) + '</div>' : '') +
      '</div>';
    }

    function openEndpoint(tag, idx) {
      const items = allEndpoints.filter(e => e.tag === tag);
      const e = items[idx]; if (!e) return;
      const op = e.op;
      const params = op.parameters || [];
      const tagVi = TAG_LABELS_VI[tag] || tag;
      document.getElementById('modal-title').innerHTML =
        '<span class="method-badge method-' + e.method + '">' + e.method + '</span> ' +
        '<span style="font-family:monospace;">' + e.path + '</span>';

      let html = '<div class="modal-section"><h4>📋 Mô tả</h4><p>' + escapeHtml(op.description || op.summary || 'Không có mô tả') + '</p></div>';

      if (params.length) {
        html += '<div class="modal-section"><h4>📝 Tham số (' + params.length + ')</h4><table class="param-table"><thead><tr><th>Tên</th><th>Vị trí</th><th>Kiểu</th><th>Bắt buộc</th></tr></thead><tbody>';
        params.forEach(p => {
          html += '<tr><td><code>' + p.name + '</code></td><td>' + (p.in || '-') + '</td><td>' + (p.schema && p.schema.type ? p.schema.type : '-') + '</td><td>' + (p.required ? '✅ Có' : 'Không') + '</td></tr>';
        });
        html += '</tbody></table></div>';
      }

      // Request body
      if (op.requestBody) {
        const content = op.requestBody.content || {};
        const jsonCt = content['application/json'];
        if (jsonCt && jsonCt.schema) {
          html += '<div class="modal-section"><h4>📦 Request Body (JSON)</h4>';
          const ref = jsonCt.schema['$ref'];
          if (ref) {
            const refName = ref.split('/').pop();
            html += '<p style="font-size:13px;color:var(--text-muted);">Schema: <code>' + refName + '</code></p>';
          } else {
            html += '<pre class="response-box">' + escapeHtml(JSON.stringify(jsonCt.schema.example || jsonCt.schema, null, 2)) + '</pre>';
          }
          html += '</div>';
        }
      }

      // Responses
      const responses = op.responses || {};
      html += '<div class="modal-section"><h4>📤 Phản hồi (' + Object.keys(responses).length + ')</h4>';
      Object.entries(responses).forEach(([code, r]) => {
        const color = code.startsWith('2') ? 'var(--success)' : code.startsWith('4') || code.startsWith('5') ? 'var(--danger)' : 'var(--info)';
        html += '<div style="margin-bottom:8px;"><span style="color:' + color + ';font-weight:700;">● ' + code + '</span> <span style="color:var(--text-muted);">' + escapeHtml(r.description || '') + '</span></div>';
      });
      html += '</div>';

      // Try it
      html += '<div class="modal-section"><h4>🧪 Thử ngay</h4><div class="try-it">';
      params.filter(p => p.in === 'query' || p.in === 'path').forEach(p => {
        html += '<input type="text" placeholder="' + p.in + ': ' + p.name + (p.required ? ' *' : '') + '" id="param-' + p.name + '" />';
      });
      if (op.requestBody && op.requestBody.content && op.requestBody.content['application/json']) {
        html += '<textarea id="try-body" rows="4" placeholder=\\'Request body (JSON)\\'>' + escapeHtml(JSON.stringify(op.requestBody.content['application/json'].schema.example || {}, null, 2)) + '</textarea>';
      }
      html += '<button class="btn btn-primary" onclick="tryEndpoint(\\'' + e.method + '\\',\\'' + e.path + '\\',' + (params.length) + ')">▶ Gửi yêu cầu</button>';
      html += '<div id="try-result" class="response-box" style="display:none;"></div>';
      html += '</div></div>';

      document.getElementById('modal-body').innerHTML = html;
      document.getElementById('modal-overlay').classList.add('active');
    }

    function closeModal() { document.getElementById('modal-overlay').classList.remove('active'); }

    function tryEndpoint(method, pathTemplate, paramCount) {
      const result = document.getElementById('try-result');
      result.style.display = 'block';
      result.textContent = '⏳ Đang gửi yêu cầu...';
      let url = pathTemplate;
      const inputs = document.querySelectorAll('#modal-body input[id^="param-"]');
      inputs.forEach(inp => {
        const key = inp.id.replace('param-', '');
        const re = new RegExp('{' + key + '}', 'g');
        url = url.replace(re, encodeURIComponent(inp.value || ''));
      });
      const fullUrl = location.origin + url;
      const opts = { method, headers: {} };
      if (authToken) opts.headers['Authorization'] = 'Bearer ' + authToken;
      const bodyEl = document.getElementById('try-body');
      if (bodyEl && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = bodyEl.value || '{}';
      }
      fetch(fullUrl, opts)
        .then(async r => { let t = await r.text(); try { t = JSON.stringify(JSON.parse(t), null, 2); } catch {} return 'HTTP ' + r.status + '\\n\\n' + t; })
        .then(t => { result.textContent = t; })
        .catch(err => { result.textContent = '❌ Lỗi: ' + err.message; });
    }

    function openAuth() { document.getElementById('auth-overlay').classList.add('active'); }
    function closeAuth() { document.getElementById('auth-overlay').classList.remove('active'); }

    async function doLogin() {
      const email = document.getElementById('auth-email').value;
      const password = document.getElementById('auth-password').value;
      const result = document.getElementById('auth-result');
      result.style.display = 'block';
      result.textContent = '⏳ Đang đăng nhập...';
      try {
        const r = await fetch('/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const t = await r.text();
        let data; try { data = JSON.parse(t); } catch { data = t; }
        if (data && data.data && data.data.session && data.data.session.access_token) {
          authToken = data.data.session.access_token;
          localStorage.setItem('api_token', authToken);
          result.textContent = '✅ Đăng nhập thành công!\\n\\nToken: ' + authToken.substring(0, 40) + '...\\n\\nĐã lưu vào localStorage. Bạn có thể thử các endpoint ngay bây giờ.';
        } else {
          result.textContent = '❌ Đăng nhập thất bại:\\n\\n' + (typeof data === 'string' ? data : JSON.stringify(data, null, 2));
        }
      } catch (e) {
        result.textContent = '❌ Lỗi: ' + e.message;
      }
    }

    function filterByMethod(m) { activeMethod = m; renderEndpoints(); }

    function escapeHtml(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    document.getElementById('search-box').addEventListener('input', renderEndpoints);
    loadSpec();
  </script>
</body>
</html>`;

app.get("/api-docs", (req, res) => res.type("html").send(swaggerHtml));
app.get("/api-docs/", (req, res) => res.type("html").send(swaggerHtml));
app.get("/api-docs.json", (req, res) => res.json(swaggerSpec));

// Import các route
const courseCategoryRoutes = require("./routes/courseCategories.router");
const courseRoutes = require("./routes/courses.router");
const lessonRoutes = require("./routes/lessons.router");
const enrollmentRoutes = require("./routes/enrollments.router");
const quizzesRoutes = require("./routes/quizzes.router");
const questionsRoutes = require("./routes/questions.router");
const quizResultsRoutes = require("./routes/quizResults.router");
const usersRoutes = require("./routes/user.router");
const notificationsRouter = require("./routes/notifications.router"); // Import router thông báo
const reviewsRouter = require("./routes/reviews.router");
const bookmarksRouter = require("./routes/bookmarks.router"); // Import router bookmark
const mentorRequestRouter = require("./routes/mentorRequest.router");
const appStatsRouter = require("./routes/appStats.router");

app.use("/api/notifications", notificationsRouter);
app.use("/api/course-categories", courseCategoryRoutes); // API cho danh mục khóa học
app.use("/api/courses", courseRoutes); // API cho các khóa học
app.use("/api/lessons", lessonRoutes); // API cho bài học
app.use("/api/enrollments", enrollmentRoutes); // API cho việc đăng ký khóa học
app.use("/api/quizzes", quizzesRoutes); // API cho các bài quiz
app.use("/api/questions", questionsRoutes); // API cho các câu hỏi
app.use("/api/quiz-results", quizResultsRoutes); // API cho kết quả quiz
app.use("/api/users", usersRoutes); // API cho người dùng
app.use("/api/reviews", reviewsRouter);
app.use("/api/bookmarks", bookmarksRouter); // API cho bookmark
app.use("/api/mentor-requests", mentorRequestRouter);
app.use("/api/app-stats", appStatsRouter);

app.use("/uploads", express.static("src/public/uploads"));

module.exports = app;
