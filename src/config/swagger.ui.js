/**
 * Phần giao diện bổ sung cho Swagger UI: bảng đăng nhập nhanh và lớp phản hồi.
 *
 * Vì sao cần: luồng mặc định của Swagger UI bắt người dùng tự gọi
 * `POST /api/auth/login`, tự chép `access_token`, rồi tự dán vào hộp thoại
 * Authorize. Với người chỉ muốn thử nhanh một endpoint, ba bước đó là đủ để bỏ
 * cuộc — và cũng dễ nhầm giữa access token với refresh token.
 *
 * Ở đây thêm một bảng nhỏ ngay trên đầu trang: chọn tài khoản demo hoặc gõ
 * email/mật khẩu, bấm một nút là đăng nhập và gắn token luôn.
 *
 * Kèm theo, mọi kết quả gọi API đều được đọc và hiển thị thành một câu kết luận
 * rõ ràng (thành công hay lỗi, lỗi gì) thay vì chỉ một khối JSON.
 *
 * Script chạy SAU swagger-ui-init.js (xem thứ tự trong swagger-ui-express), nên
 * document đã có sẵn các phần tử của Swagger UI.
 */
const SWAGGER_UI_SCRIPT = `
(function () {
  "use strict";

  // ---------- Hằng số ----------
  var BASE = window.location.origin;
  // Đọc lại đường dẫn tài liệu để gọi API trên cùng máy chủ đang phục vụ trang
  // này (local hay production đều đúng).
  var API_BASE = BASE;

  // Mật khẩu chung của mọi tài khoản demo (xem scripts/data/demo-users.js).
  var DEMO_PASSWORD = "Demo@123456";
  var DEMO_ACCOUNTS = [
    { label: "Quản trị viên", email: "admin@demo.onlinelearning.vn" },
    { label: "Giảng viên", email: "mentor01@demo.onlinelearning.vn" },
    { label: "Học viên", email: "student01@demo.onlinelearning.vn" },
  ];

  // ---------- Tiện ích ----------
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "text") node.textContent = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  /** Đọc JSON an toàn; trả về đoạn văn bản nếu không phải JSON. */
  function parseJson(text) {
    try { return { ok: true, value: JSON.parse(text) }; }
    catch (e) { return { ok: false, value: text }; }
  }

  /** Rút ra câu thông báo lỗi mà API trả về, dùng được cho cả hai dạng. */
  function errorMessage(body) {
    if (!body || typeof body !== "object") return null;
    return body.error || body.message || null;
  }

  var status = el("div", { id: "dev-tools-status", style: "margin-top:10px;font-size:13px;" });

  function setStatus(kind, message) {
    // kind: "ok" | "err" | "wait"
    var colors = { ok: "#1b7f3b", err: "#c0392b", wait: "#8a6d3b" };
    status.style.color = colors[kind] || "#333";
    status.textContent = message;
  }

  // ---------- Đăng nhập nhanh ----------
  // Gọi thẳng API đăng nhập, không đi qua Swagger, để bảng này hoạt động độc lập.
  function login(email, password) {
    setStatus("wait", "Đang đăng nhập " + email + " …");

    return fetch(API_BASE + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password }),
    })
      .then(function (res) {
        return res.text().then(function (text) {
          return { status: res.status, body: parseJson(text) };
        });
      })
      .then(function (r) {
        if (r.status === 200 && r.body.ok && r.body.value.access_token) {
          applyToken(r.body.value.access_token);
          var role = (r.body.value.user && r.body.value.user.role) || "?";
          setStatus("ok", "✓ Đăng nhập thành công (" + role + "): " + email +
            " — token đã gắn, giờ gọi được mọi endpoint.");
          return;
        }

        var msg = r.body.ok ? errorMessage(r.body.value) : String(r.body.value).slice(0, 200);
        setStatus("err", "✗ Đăng nhập thất bại — HTTP " + r.status + ": " + (msg || "không rõ nguyên nhân"));
      })
      .catch(function (err) {
        setStatus("err", "✗ không gọi được API — " + err.message);
      });
  }

  /**
   * Đưa token vào hộp thoại Authorize của Swagger UI rồi tải lại trang.
   *
   * Swagger UI không có API công khai để đặt token từ bên ngoài. Cách làm được
   * hỗ trợ là ghi vào kho lưu trữ cục bộ mà Swagger UI đọc lại khi khởi tạo —
   * đúng cơ chế của tuỳ chọn persistAuthorization — rồi tải lại trang để nó
   * nạp lại token đã lưu.
   */
  function applyToken(token) {
    try {
      // Khối này cần khớp định dạng mà swagger-ui dùng khi persistAuthorization.
      var stored = {
        bearerAuth: { value: token, schema: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
      };
      window.localStorage.setItem("authorized", JSON.stringify(stored));
    } catch (e) {
      setStatus("err", "⚠ Không lưu được token vào trình duyệt: " + e.message);
      return;
    }
    // Tải lại để Swagger UI nạp token vừa lưu.
    window.setTimeout(function () { window.location.reload(); }, 700);
  }

  /** Đăng xuất: xoá token đã lưu. */
  function logout() {
    try { window.localStorage.removeItem("authorized"); } catch (e) {}
    setStatus("wait", "Đã xoá token. Đang tải lại…");
    window.setTimeout(function () { window.location.reload(); }, 500);
  }

  function buildPanel() {
    var panel = el("div", {
      id: "dev-tools",
      style:
        "margin:0 0 20px;padding:14px 16px;border:1px solid #d8dee4;border-radius:6px;" +
        "background:#f6f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;",
    });

    panel.appendChild(el("div", {
      style: "font-weight:600;font-size:15px;margin-bottom:4px;",
      text: "Đăng nhập nhanh",
    }));
    panel.appendChild(el("div", {
      style: "font-size:13px;color:#57606a;margin-bottom:10px;",
      html:
        "Chọn tài khoản demo (mật khẩu chung <code>" + DEMO_PASSWORD + "</code>) hoặc gõ tài khoản của bạn. " +
        "Bấm một nút là token được gắn tự động — không phải chép tay sang hộp thoại Authorize.",
    }));

    // Nút tài khoản demo
    var demoRow = el("div", { style: "display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;" });

    function demoButton(account) {
      var b = el("button", {
        type: "button",
        style:
          "padding:6px 12px;border:1px solid #1f6feb;border-radius:6px;background:#fff;" +
          "color:#1f6feb;cursor:pointer;font-size:13px;",
        text: account.label,
      });
      b.addEventListener("click", function () { login(account.email, DEMO_PASSWORD); });
      return b;
    }
    DEMO_ACCOUNTS.forEach(function (a) { demoRow.appendChild(demoButton(a)); });

    // Ô nhập tài khoản tuỳ ý
    var inputRow = el("div", { style: "display:flex;gap:8px;flex-wrap:wrap;align-items:center;" });

    var emailInput = el("input", {
      id: "dev-tools-email",
      type: "text",
      placeholder: "Email",
      value: DEMO_ACCOUNTS[0].email,
      style: "flex:1 1 220px;min-width:180px;padding:6px 8px;border:1px solid #d0d7de;border-radius:6px;font-size:13px;",
    });

    var passInput = el("input", {
      id: "dev-tools-password",
      type: "text",
      placeholder: "Mật khẩu",
      value: DEMO_PASSWORD,
      style: "flex:1 1 160px;min-width:140px;padding:6px 8px;border:1px solid #d0d7de;border-radius:6px;font-size:13px;",
    });

    var loginBtn = el("button", {
      type: "button",
      style:
        "padding:6px 16px;border:0;border-radius:6px;background:#1f6feb;color:#fff;" +
        "cursor:pointer;font-size:13px;font-weight:600;",
      text: "Đăng nhập",
    });
    loginBtn.addEventListener("click", function () {
      var email = (emailInput.value || "").trim();
      var password = passInput.value || "";
      if (!email || !password) {
        setStatus("err", "✗ cần nhập cả email và mật khẩu");
        return;
      }
      login(email, password);
    });

    // Cho phép bấm Enter trong ô nhập
    [emailInput, passInput].forEach(function (inp) {
      inp.addEventListener("keydown", function (e) {
        if (e.key === "Enter") loginBtn.click();
      });
    });

    var logoutBtn = el("button", {
      type: "button",
      style:
        "padding:6px 12px;border:1px solid #d0d7de;border-radius:6px;background:#fff;" +
        "color:#57606a;cursor:pointer;font-size:13px;",
      text: "Đăng xuất",
    });
    logoutBtn.addEventListener("click", logout);

    inputRow.appendChild(emailInput);
    inputRow.appendChild(passInput);
    inputRow.appendChild(loginBtn);
    inputRow.appendChild(logoutBtn);

    panel.appendChild(demoRow);
    panel.appendChild(inputRow);
    panel.appendChild(status);

    return panel;
  }

  // ---------- Lớp đọc kết quả ----------
  /**
   * Quan sát vùng kết quả của Swagger UI và in thêm một câu kết luận.
   *
   * Swagger UI hiển thị nguyên khối JSON; với người dùng cuối thì câu hỏi cần
   * trả lời là "việc này thành công hay không, nếu lỗi thì lỗi gì". Lớp này đọc
   * lại kết quả và viết rõ điều đó ngay trên khối JSON.
   */
  function annotateResponse(container) {
    if (container.dataset.annotated === "1") return;
    container.dataset.annotated = "1";

    var statusLine = container.querySelector(".response-col_status");
    var bodyEl = container.querySelector(".response-col_description .microlight, .response-col_description pre, .response-col_description");
    var text = bodyEl ? bodyEl.textContent : "";
    var code = statusLine ? parseInt((statusLine.textContent || "").trim(), 10) : NaN;

    var parsed = parseJson(text);
    var body = parsed.ok ? parsed.value : null;

    var kind, sentence;
    if (isNaN(code)) {
      return; // Chưa có thông tin, để lần sau đọc lại
    } else if (code >= 200 && code < 300) {
      kind = "ok";
      sentence = "✓ Thành công (HTTP " + code + ").";
      if (body && typeof body === "object") {
        var n = Array.isArray(body) ? body.length
          : body.data && Array.isArray(body.data) ? body.data.length
          : body.notifications && Array.isArray(body.notifications) ? body.notifications.length
          : null;
        if (n !== null) sentence += " Nhận được " + n + " bản ghi.";
      }
    } else {
      kind = "err";
      var msg = body ? errorMessage(body) : (text || "").slice(0, 200);
      sentence = "✗ Lỗi HTTP " + code + (msg ? ": " + msg : ".");
      if (code === 401) sentence += "  → token thiếu hoặc đã hết hạn; đăng nhập lại bằng bảng phía trên.";
      if (code === 403) sentence += "  → tài khoản đang dùng không đủ quyền cho thao tác này.";
    }

    var hint = el("div", {
      style:
        "margin:0 0 8px;padding:8px 10px;border-radius:6px;font-size:13px;font-weight:600;" +
        (kind === "ok"
          ? "background:#e6f4ea;color:#1b7f3b;border:1px solid #b7e1c5;"
          : "background:#fdecea;color:#c0392b;border:1px solid #f5c6c0;"),
      text: sentence,
    });

    container.insertBefore(hint, container.firstChild);
  }

  function watchResponses() {
    // Quan sát cả trang: các khối kết quả được Swagger UI chèn vào sau khi gọi
    // API, nên không thể gắn sẵn listener lúc tải trang.
    var observer = new MutationObserver(function () {
      document.querySelectorAll(".responses-inner > .response").forEach(annotateResponse);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // Chạy một lượt cho những khối đã có sẵn.
    document.querySelectorAll(".responses-inner > .response").forEach(annotateResponse);
  }

  // ---------- Khởi động ----------
  function mount() {
    if (document.getElementById("dev-tools")) return; // đã gắn rồi
    var anchor = document.querySelector(".information-container .info")
      || document.querySelector(".information-container")
      || document.querySelector(".swagger-ui");
    if (!anchor) return;

    var panel = buildPanel();
    if (anchor.classList && anchor.classList.contains("info")) {
      anchor.parentNode.insertBefore(panel, anchor.nextSibling);
    } else {
      anchor.parentNode.insertBefore(panel, anchor);
    }

    // Cho biết nếu đã có token lưu sẵn, để người dùng không phải đoán.
    var hasToken = false;
    try { hasToken = !!window.localStorage.getItem("authorized"); } catch (e) {}
    if (hasToken && !status.textContent) {
      setStatus("wait", "Đã có token lưu sẵn từ lần trước. Đăng nhập lại nếu gặp lỗi 401.");
    }

    watchResponses();
  }

  if (document.readyState === "complete") {
    window.setTimeout(mount, 0);
  } else {
    window.addEventListener("load", function () { window.setTimeout(mount, 0); });
  }
})();
`;

module.exports = { SWAGGER_UI_SCRIPT };
