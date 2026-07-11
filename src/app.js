const express = require("express");
const cors = require("cors");
const swaggerSpec = require("./config/swagger.config");
const app = express();
const path = require("path");

app.use(cors());
app.use(express.json());

// Swagger UI - custom HTML/CSS cho Vercel serverless
// Theme: Slate + Indigo (chuyen nghiep, sang trong), ho tro Light + Dark mode
const swaggerHtml = `<!DOCTYPE html>
<html lang="vi" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tài liệu API - Hệ thống Học trực tuyến</title>
  <link rel="icon" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/favicon-32x32.png">
  <style>
    /* ============ THEME VARIABLES ============ */
    html[data-theme="light"] {
      --bg: #f8fafc;
      --bg-elevated: #ffffff;
      --bg-subtle: #f1f5f9;
      --border: #e2e8f0;
      --border-strong: #cbd5e1;
      --text: #0f172a;
      --text-secondary: #475569;
      --text-muted: #94a3b8;
      --accent: #4f46e5;
      --accent-hover: #4338ca;
      --accent-light: #eef2ff;
      --accent-text: #4338ca;
      --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.06);
      --shadow: 0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04);
      --shadow-lg: 0 10px 30px -10px rgba(15, 23, 42, 0.15), 0 4px 8px -4px rgba(15, 23, 42, 0.08);
      --code-bg: #0f172a;
      --code-text: #e2e8f0;
    }
    html[data-theme="dark"] {
      --bg: #0b1120;
      --bg-elevated: #111827;
      --bg-subtle: #1f2937;
      --border: #1e293b;
      --border-strong: #334155;
      --text: #f1f5f9;
      --text-secondary: #cbd5e1;
      --text-muted: #64748b;
      --accent: #818cf8;
      --accent-hover: #a5b4fc;
      --accent-light: rgba(129, 140, 248, 0.12);
      --accent-text: #a5b4fc;
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
      --shadow: 0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.2);
      --shadow-lg: 0 10px 30px -10px rgba(0, 0, 0, 0.5), 0 4px 8px -4px rgba(0, 0, 0, 0.3);
      --code-bg: #020617;
      --code-text: #e2e8f0;
    }
    /* ============ METHOD COLORS ============ */
    :root {
      --get: #10b981;       --get-bg: #d1fae5;     --get-bg-dark: rgba(16, 185, 129, 0.15);
      --post: #3b82f6;      --post-bg: #dbeafe;    --post-bg-dark: rgba(59, 130, 246, 0.15);
      --put: #f59e0b;       --put-bg: #fef3c7;     --put-bg-dark: rgba(245, 158, 11, 0.15);
      --patch: #f97316;     --patch-bg: #ffedd5;   --patch-bg-dark: rgba(249, 115, 22, 0.15);
      --delete: #ef4444;    --delete-bg: #fee2e2;  --delete-bg-dark: rgba(239, 68, 68, 0.15);
    }
    html[data-theme="dark"] {
      --get-bg: rgba(16, 185, 129, 0.15);
      --post-bg: rgba(59, 130, 246, 0.15);
      --put-bg: rgba(245, 158, 11, 0.15);
      --patch-bg: rgba(249, 115, 22, 0.15);
      --delete-bg: rgba(239, 68, 68, 0.15);
    }
    /* ============ RESET ============ */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      min-height: 100vh;
      transition: background 0.2s ease, color 0.2s ease;
    }
    code { font-family: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", monospace; }
    /* ============ TOP BAR ============ */
    .topbar {
      position: sticky;
      top: 0;
      z-index: 50;
      background: var(--bg-elevated);
      border-bottom: 1px solid var(--border);
      backdrop-filter: blur(12px);
    }
    .topbar-inner {
      max-width: 1280px;
      margin: 0 auto;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      font-size: 16px;
      color: var(--text);
      text-decoration: none;
    }
    .brand-logo {
      width: 32px; height: 32px;
      background: linear-gradient(135deg, var(--accent), #ec4899);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 16px;
      font-weight: 800;
    }
    .topbar-spacer { flex: 1; }
    .topbar-actions { display: flex; gap: 8px; align-items: center; }
    .icon-btn {
      width: 36px; height: 36px;
      border: 1px solid var(--border);
      background: var(--bg-elevated);
      border-radius: 8px;
      color: var(--text-secondary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      transition: all 0.15s;
    }
    .icon-btn:hover { border-color: var(--accent); color: var(--accent); }
    .btn {
      padding: 8px 14px;
      border: 1px solid var(--border);
      background: var(--bg-elevated);
      border-radius: 8px;
      color: var(--text);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn:hover { border-color: var(--accent); color: var(--accent); }
    .btn-primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    .btn-primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); color: #fff; }
    /* ============ HERO ============ */
    .hero {
      max-width: 1280px;
      margin: 0 auto;
      padding: 56px 24px 40px;
    }
    .hero-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 5px 12px;
      background: var(--accent-light);
      color: var(--accent-text);
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .hero-eyebrow .dot {
      width: 6px; height: 6px;
      background: var(--get);
      border-radius: 50%;
      box-shadow: 0 0 0 3px var(--get-bg);
    }
    .hero h1 {
      font-size: 40px;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.15;
      margin-bottom: 12px;
      color: var(--text);
    }
    .hero p {
      font-size: 16px;
      color: var(--text-secondary);
      max-width: 720px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 24px 40px;
    }
    .stat-card {
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px 20px;
    }
    .stat-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .stat-value {
      font-size: 28px;
      font-weight: 800;
      color: var(--text);
      margin-top: 4px;
      letter-spacing: -0.02em;
    }
    .stat-value.accent { color: var(--accent); }
    /* ============ SEARCH + FILTERS ============ */
    .toolbar {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 24px 24px;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
    }
    .search-box {
      flex: 1;
      min-width: 280px;
      padding: 10px 14px 10px 40px;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 10px;
      color: var(--text);
      font-size: 14px;
      outline: none;
      transition: all 0.15s;
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='11' cy='11' r='8'/><line x1='21' y1='21' x2='16.65' y2='16.65'/></svg>");
      background-repeat: no-repeat;
      background-position: 14px center;
    }
    .search-box:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }
    .search-box::placeholder { color: var(--text-muted); }
    .filter-group {
      display: flex;
      gap: 6px;
      padding: 4px;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 10px;
    }
    .filter-chip {
      padding: 6px 12px;
      background: transparent;
      border: none;
      border-radius: 6px;
      color: var(--text-secondary);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }
    .filter-chip:hover { background: var(--bg-subtle); color: var(--text); }
    .filter-chip.active { background: var(--accent); color: #fff; }
    /* ============ ENDPOINTS ============ */
    .container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 24px 80px;
    }
    .tag-group { margin-bottom: 36px; }
    .tag-header {
      display: flex;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }
    .tag-name {
      font-size: 18px;
      font-weight: 700;
      color: var(--text);
      letter-spacing: -0.01em;
    }
    .tag-count {
      font-size: 12px;
      color: var(--text-muted);
      font-weight: 500;
    }
    .endpoints-list { display: flex; flex-direction: column; gap: 6px; }
    .endpoint-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.15s;
      text-align: left;
      width: 100%;
      font-family: inherit;
      color: inherit;
    }
    .endpoint-card:hover {
      border-color: var(--accent);
      box-shadow: var(--shadow);
      transform: translateY(-1px);
    }
    .method-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 64px;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #fff;
      flex-shrink: 0;
    }
    .method-GET    { background: var(--get); }
    .method-POST   { background: var(--post); }
    .method-PUT    { background: var(--put); }
    .method-PATCH  { background: var(--patch); }
    .method-DELETE { background: var(--delete); }
    .endpoint-body { flex: 1; min-width: 0; }
    .endpoint-path {
      font-family: "SF Mono", Monaco, monospace;
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
      word-break: break-all;
    }
    .endpoint-summary {
      font-size: 13px;
      color: var(--text-secondary);
      margin-top: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .endpoint-arrow {
      color: var(--text-muted);
      font-size: 18px;
      flex-shrink: 0;
      transition: transform 0.15s, color 0.15s;
    }
    .endpoint-card:hover .endpoint-arrow { color: var(--accent); transform: translateX(2px); }
    /* ============ MODAL ============ */
    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      z-index: 100;
      align-items: flex-start;
      justify-content: center;
      padding: 40px 20px;
      overflow-y: auto;
    }
    .modal-overlay.active { display: flex; }
    .modal {
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 14px;
      width: 100%;
      max-width: 900px;
      box-shadow: var(--shadow-lg);
      overflow: hidden;
    }
    .modal-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .modal-title-wrap { flex: 1; min-width: 0; }
    .modal-endpoint {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .modal-path {
      font-family: "SF Mono", Monaco, monospace;
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
      word-break: break-all;
    }
    .modal-close {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 24px;
      line-height: 1;
      width: 32px; height: 32px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .modal-close:hover { background: var(--bg-subtle); color: var(--text); }
    .modal-body { padding: 24px; }
    .modal-section { margin-bottom: 24px; }
    .modal-section:last-child { margin-bottom: 0; }
    .modal-section h4 {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 10px;
    }
    .modal-desc {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.6;
    }
    .param-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .param-table th, .param-table td {
      text-align: left;
      padding: 8px 10px;
      border-bottom: 1px solid var(--border);
    }
    .param-table th {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .param-table code {
      background: var(--bg-subtle);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      color: var(--accent-text);
    }
    .response-list { display: flex; flex-direction: column; gap: 6px; }
    .response-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background: var(--bg-subtle);
      border-radius: 8px;
      font-size: 13px;
    }
    .response-code {
      font-weight: 700;
      font-family: "SF Mono", Monaco, monospace;
      min-width: 36px;
    }
    .response-code.success { color: var(--get); }
    .response-code.client { color: var(--put); }
    .response-code.error { color: var(--delete); }
    .response-desc { color: var(--text-secondary); }
    .try-it { display: flex; flex-direction: column; gap: 10px; }
    .try-it label { font-size: 12px; font-weight: 600; color: var(--text-muted); }
    .try-it input, .try-it textarea {
      width: 100%;
      padding: 8px 12px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-family: "SF Mono", Monaco, monospace;
      font-size: 13px;
      outline: none;
      transition: border-color 0.15s;
      resize: vertical;
    }
    .try-it input:focus, .try-it textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }
    .response-box {
      background: var(--code-bg);
      color: var(--code-text);
      border-radius: 8px;
      padding: 14px;
      max-height: 400px;
      overflow: auto;
      font-family: "SF Mono", Monaco, monospace;
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }
    /* ============ FOOTER ============ */
    .footer {
      text-align: center;
      padding: 32px 24px;
      color: var(--text-muted);
      font-size: 13px;
      border-top: 1px solid var(--border);
    }
    .footer a { color: var(--accent); text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--text-muted);
    }
    .empty-state-icon { font-size: 40px; margin-bottom: 12px; }
    @media (max-width: 640px) {
      .hero h1 { font-size: 28px; }
      .hero { padding: 32px 20px 24px; }
      .stats, .toolbar, .container { padding-left: 16px; padding-right: 16px; }
      .modal-overlay { padding: 0; }
      .modal { border-radius: 0; max-height: 100vh; }
      .topbar-inner { padding: 12px 16px; }
    }
  </style>
</head>
<body>
  <!-- Top Bar -->
  <header class="topbar">
    <div class="topbar-inner">
      <a href="/api-docs" class="brand">
        <div class="brand-logo">E</div>
        <span>Edu API</span>
      </a>
      <div class="topbar-spacer"></div>
      <div class="topbar-actions">
        <button class="icon-btn" id="theme-toggle" title="Chuyển theme" onclick="toggleTheme()">
          <span id="theme-icon">🌙</span>
        </button>
        <a class="btn" href="/api-docs.json" target="_blank">JSON</a>
        <button class="btn btn-primary" onclick="openAuth()">🔓 Đăng nhập</button>
      </div>
    </div>
  </header>

  <!-- Hero -->
  <section class="hero">
    <div class="hero-eyebrow">
      <span class="dot"></span>
      <span>API đang hoạt động • v1.0.0</span>
    </div>
    <h1>Tài liệu API<br>Hệ thống Học trực tuyến</h1>
    <p>REST API toàn diện cho hệ thống e-learning: khóa học, bài học, quiz, đánh giá, thanh toán, mentor và thông báo. Xác thực bằng Supabase Auth JWT.</p>
  </section>

  <!-- Stats -->
  <div class="stats" id="stats">
    <div class="stat-card">
      <div class="stat-label">Tổng endpoint</div>
      <div class="stat-value accent" id="stat-endpoints">–</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Nhóm chức năng</div>
      <div class="stat-value" id="stat-tags">–</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Phương thức HTTP</div>
      <div class="stat-value" id="stat-methods">–</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Xác thực</div>
      <div class="stat-value accent" style="font-size:18px;line-height:36px;">Supabase JWT</div>
    </div>
  </div>

  <!-- Toolbar -->
  <div class="toolbar">
    <input type="text" class="search-box" id="search-box" placeholder="Tìm kiếm endpoint, tag, mô tả..." />
    <div class="filter-group">
      <button class="filter-chip active" data-method="all">Tất cả</button>
      <button class="filter-chip" data-method="GET">GET</button>
      <button class="filter-chip" data-method="POST">POST</button>
      <button class="filter-chip" data-method="PUT">PUT</button>
      <button class="filter-chip" data-method="PATCH">PATCH</button>
      <button class="filter-chip" data-method="DELETE">DELETE</button>
    </div>
  </div>

  <!-- Endpoints -->
  <div class="container" id="endpoints-container">
    <div class="empty-state">
      <div class="empty-state-icon">⏳</div>
      <div>Đang tải tài liệu API...</div>
    </div>
  </div>

  <footer class="footer">
    <p>📚 Hệ thống Học trực tuyến • Triển khai trên Vercel Serverless</p>
    <p style="margin-top:6px;">
      <a href="/api-docs.json">OpenAPI JSON</a> • <a href="/">Trang chủ</a> • <a href="https://github.com/Tranlong291003/online-learning-api" target="_blank">GitHub</a>
    </p>
  </footer>

  <!-- Modal: Endpoint -->
  <div class="modal-overlay" id="modal-overlay" onclick="if(event.target===this) closeModal()">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title-wrap">
          <div class="modal-endpoint">
            <span class="method-badge" id="modal-method">GET</span>
            <span class="modal-path" id="modal-path">/api/...</span>
          </div>
        </div>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body" id="modal-body">Đang tải...</div>
    </div>
  </div>

  <!-- Modal: Auth -->
  <div class="modal-overlay" id="auth-overlay" onclick="if(event.target===this) closeAuth()">
    <div class="modal" style="max-width:480px;">
      <div class="modal-header">
        <div class="modal-title-wrap">
          <div class="modal-endpoint">
            <span class="modal-path" style="font-size:15px;">🔓 Đăng nhập để xác thực</span>
          </div>
        </div>
        <button class="modal-close" onclick="closeAuth()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="try-it">
          <label>Email</label>
          <input type="email" id="auth-email" value="mentor.demo@onlinelearning.vn" />
          <label>Mật khẩu</label>
          <input type="password" id="auth-password" value="Demo@12345" />
          <button class="btn btn-primary" onclick="doLogin()" style="margin-top:6px;">Đăng nhập</button>
          <div id="auth-result" class="response-box" style="display:none;"></div>
        </div>
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
      'Bookmarks': 'Yêu thích',
      'Notifications': 'Thông báo',
      'MentorRequests': 'Yêu cầu Mentor',
      'CourseCategories': 'Danh mục khóa học',
      'AppStats': 'Thống kê ứng dụng',
    };

    // Theme
    function toggleTheme() {
      const html = document.documentElement;
      const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      html.setAttribute('data-theme', next);
      document.getElementById('theme-icon').textContent = next === 'light' ? '🌙' : '☀️';
      localStorage.setItem('api_theme', next);
    }
    (function initTheme() {
      const saved = localStorage.getItem('api_theme');
      if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
        document.getElementById('theme-icon').textContent = saved === 'light' ? '🌙' : '☀️';
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('theme-icon').textContent = '☀️';
      }
    })();

    async function loadSpec() {
      try {
        const res = await fetch('/api-docs.json');
        const spec = await res.json();
        renderSpec(spec);
      } catch (e) {
        document.getElementById('endpoints-container').innerHTML =
          '<div class="empty-state"><div class="empty-state-icon">❌</div><div>Lỗi tải tài liệu: ' + escapeHtml(e.message) + '</div></div>';
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
          });
          tags.forEach(t => { if (!allTags[t]) allTags[t] = []; allTags[t].push(allEndpoints[allEndpoints.length-1]); });
        });
      });
      document.getElementById('stat-endpoints').textContent = allEndpoints.length;
      document.getElementById('stat-tags').textContent = Object.keys(allTags).length;
      document.getElementById('stat-methods').textContent = new Set(allEndpoints.map(e => e.method)).size;
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
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><div>Không tìm thấy endpoint nào.</div></div>';
        return;
      }

      container.innerHTML = sortedTags.map(tag => {
        const items = grouped[tag];
        const viName = TAG_LABELS_VI[tag] || tag;
        return '<section class="tag-group">' +
          '<div class="tag-header"><div class="tag-name">' + escapeHtml(viName) + '</div><div class="tag-count">' + items.length + ' endpoint</div></div>' +
          '<div class="endpoints-list">' +
            items.map((e, i) => renderCard(e, tag, i)).join('') +
          '</div></section>';
      }).join('');
    }

    function renderCard(e, tag, idx) {
      return '<button class="endpoint-card" onclick="openEndpoint(\\'' + escapeAttr(tag) + '\\',' + idx + ')">' +
        '<span class="method-badge method-' + e.method + '">' + e.method + '</span>' +
        '<div class="endpoint-body">' +
          '<div class="endpoint-path">' + escapeHtml(e.path) + '</div>' +
          (e.summary ? '<div class="endpoint-summary">' + escapeHtml(e.summary) + '</div>' : '') +
        '</div>' +
        '<span class="endpoint-arrow">›</span>' +
      '</button>';
    }

    function openEndpoint(tag, idx) {
      const items = allEndpoints.filter(e => e.tag === tag);
      const e = items[idx]; if (!e) return;
      const op = e.op;
      const params = op.parameters || [];

      document.getElementById('modal-method').className = 'method-badge method-' + e.method;
      document.getElementById('modal-method').textContent = e.method;
      document.getElementById('modal-path').textContent = e.path;

      let html = '<div class="modal-section"><h4>📋 Mô tả</h4><div class="modal-desc">' + escapeHtml(op.description || op.summary || 'Không có mô tả') + '</div></div>';

      if (params.length) {
        html += '<div class="modal-section"><h4>📝 Tham số (' + params.length + ')</h4><table class="param-table"><thead><tr><th>Tên</th><th>Vị trí</th><th>Kiểu</th><th>Bắt buộc</th></tr></thead><tbody>';
        params.forEach(p => {
          html += '<tr><td><code>' + escapeHtml(p.name) + '</code></td><td>' + escapeHtml(p.in || '-') + '</td><td>' + (p.schema && p.schema.type ? escapeHtml(p.schema.type) : '-') + '</td><td>' + (p.required ? '✅ Có' : '—') + '</td></tr>';
        });
        html += '</tbody></table></div>';
      }

      if (op.requestBody) {
        const content = op.requestBody.content || {};
        const jsonCt = content['application/json'];
        if (jsonCt) {
          html += '<div class="modal-section"><h4>📦 Request Body</h4>';
          const ref = jsonCt.schema && jsonCt.schema['$ref'];
          if (ref) html += '<div class="modal-desc">Schema: <code>' + escapeHtml(ref.split('/').pop()) + '</code></div>';
          else html += '<pre class="response-box">' + escapeHtml(JSON.stringify(jsonCt.schema && jsonCt.schema.example || jsonCt.schema || {}, null, 2)) + '</pre>';
          html += '</div>';
        }
      }

      const responses = op.responses || {};
      html += '<div class="modal-section"><h4>📤 Phản hồi (' + Object.keys(responses).length + ')</h4><div class="response-list">';
      Object.entries(responses).forEach(([code, r]) => {
        const cls = code.startsWith('2') ? 'success' : (code.startsWith('4') || code.startsWith('5')) ? 'error' : 'client';
        html += '<div class="response-item"><span class="response-code ' + cls + '">' + code + '</span><span class="response-desc">' + escapeHtml(r.description || '') + '</span></div>';
      });
      html += '</div></div>';

      html += '<div class="modal-section"><h4>🧪 Thử ngay</h4><div class="try-it">';
      const queryParams = params.filter(p => p.in === 'query' || p.in === 'path');
      queryParams.forEach(p => {
        html += '<label>' + escapeHtml(p.in + ': ' + p.name) + (p.required ? ' *' : '') + '</label><input type="text" id="param-' + escapeAttr(p.name) + '" />';
      });
      let bodyJson = '';
      if (op.requestBody && op.requestBody.content && op.requestBody.content['application/json']) {
        bodyJson = JSON.stringify(op.requestBody.content['application/json'].schema && op.requestBody.content['application/json'].schema.example || {}, null, 2);
        html += '<label>Request body (JSON)</label><textarea id="try-body" rows="4">' + escapeHtml(bodyJson) + '</textarea>';
      }
      html += '<button class="btn btn-primary" onclick="tryEndpoint(\\'' + e.method + '\\',\\'' + escapeAttr(e.path) + '\\',' + queryParams.length + ')" style="margin-top:6px;">▶ Gửi yêu cầu</button>';
      html += '<div id="try-result" class="response-box" style="display:none;"></div>';
      html += '</div></div>';

      document.getElementById('modal-body').innerHTML = html;
      document.getElementById('modal-overlay').classList.add('active');
    }

    function closeModal() { document.getElementById('modal-overlay').classList.remove('active'); }
    function openAuth() { document.getElementById('auth-overlay').classList.add('active'); }
    function closeAuth() { document.getElementById('auth-overlay').classList.remove('active'); }

    function tryEndpoint(method, pathTemplate, paramCount) {
      const result = document.getElementById('try-result');
      result.style.display = 'block';
      result.textContent = '⏳ Đang gửi yêu cầu...';
      let url = pathTemplate;
      const inputs = document.querySelectorAll('#modal-body input[id^="param-"]');
      inputs.forEach(inp => {
        const key = inp.id.replace('param-', '');
        url = url.replace(new RegExp('{' + key + '}', 'g'), encodeURIComponent(inp.value || ''));
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

    function filterByMethod(m) { activeMethod = m; renderEndpoints(); updateChips(); }
    function updateChips() {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('active', c.dataset.method === activeMethod));
    }

    function escapeHtml(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
    function escapeAttr(s) { return String(s == null ? '' : s).replace(/'/g, '\\\\\\'').replace(/"/g, '&quot;'); }

    document.getElementById('search-box').addEventListener('input', renderEndpoints);
    document.querySelectorAll('.filter-chip').forEach(c => c.addEventListener('click', () => filterByMethod(c.dataset.method)));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeModal(); closeAuth(); }
    });
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
