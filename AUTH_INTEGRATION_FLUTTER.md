# Tích hợp xác thực & phân quyền — dành cho app Flutter (`lms_app_flutter`)

> Tài liệu này mô tả API xác thực **mới** và các việc cần sửa ở phía Flutter.
> Backend đã bỏ Firebase Auth; app **phải** sửa theo, nếu không sẽ không đăng nhập được.

---

## 1. Thay đổi lớn nhất: API tự quản lý tài khoản

**Trước đây:**

```
Flutter → Firebase Auth (signInWithEmailAndPassword) → idToken
        → POST /api/users/login { idToken } → JWT của hệ thống
```

**Bây giờ:**

```
Flutter → POST /api/auth/login { email, password } → access_token + refresh_token
```

- Không còn `firebase_auth` trong luồng đăng nhập. Có thể **gỡ hẳn** package này
  (hoặc chỉ giữ `firebase_messaging`+`firebase_core` nếu vẫn dùng push notification).
- Mật khẩu do backend hash bằng bcrypt; app **không** giữ mật khẩu ở đâu.
- Đăng ký trả về token luôn → **không cần** đăng nhập lại sau khi đăng ký.

### Hai loại token

| Token | Thời hạn | Lưu ở đâu | Vai trò |
|---|---|---|---|
| `access_token` | 15 phút | Bộ nhớ + SharedPreferences | Gắn vào header `Authorization` mọi request |
| `refresh_token` | 30 ngày (90 ngày nếu `remember: true`) | SharedPreferences | Đổi lấy access token mới khi hết hạn |

Access token là JWT **không thu hồi được**, nên thời hạn chỉ 15 phút. Refresh token
lưu trong DB nên thu hồi được (đăng xuất, đổi mật khẩu, bị khoá tài khoản).

> ⚠️ **Refresh token chỉ dùng được một lần.** Mỗi lần gọi `/api/auth/refresh`,
> server trả về refresh token **mới** và vô hiệu hoá token cũ. App **phải** lưu
> token mới, nếu không lần refresh sau sẽ thất bại. Nếu token cũ bị dùng lại,
> server coi là bị đánh cắp và **đá ra khỏi mọi thiết bị** của phiên đó.

---

## 2. Danh sách endpoint

### Công khai (không cần token)

| Method | Endpoint | Body | Trả về |
|---|---|---|---|
| POST | `/api/auth/register` | `{ email, password, name, phone?, avatar_url?, bio?, fcmToken? }` | `201 { access_token, refresh_token, token, user }` |
| POST | `/api/auth/login` | `{ email, password, fcmToken?, remember? }` | `200 { access_token, refresh_token, token, user }` |
| POST | `/api/auth/refresh` | `{ refresh_token }` | `200 { access_token, refresh_token, token }` |
| POST | `/api/auth/forgot-password` | `{ email }` | `200 { message }` |
| POST | `/api/auth/reset-password` | `{ token, new_password }` | `200 { message }` |

### Cần access token

| Method | Endpoint | Body | Trả về |
|---|---|---|---|
| GET | `/api/auth/me` | — | `200 { user, role }` |
| POST | `/api/auth/change-password` | `{ current_password, new_password }` | `200 { message }` |
| POST | `/api/auth/logout` | `{ refresh_token }` hoặc `{ all_devices: true }` | `200 { message }` |

> `token` trong response là **bản sao của `access_token`**, giữ lại để app hiện
> tại không vỡ. Code mới nên đọc `access_token`.

### Hai endpoint cũ vẫn hoạt động (alias)

`POST /api/users/create` và `POST /api/users/login` vẫn chạy và trỏ về đúng logic
trên, nên app có thể chuyển dần. **Khuyến nghị chuyển sang `/api/auth/*`.**

---

## 3. Sửa gì ở Flutter

### 3.1. `lib/apps/config/api_config.dart` — thêm endpoint

```dart
// Auth
static String get authLogin => "$baseUrl/api/auth/login";
static String get authRegister => "$baseUrl/api/auth/register";
static String get authRefresh => "$baseUrl/api/auth/refresh";
static String get authMe => "$baseUrl/api/auth/me";
static String get authLogout => "$baseUrl/api/auth/logout";
static String get authChangePassword => "$baseUrl/api/auth/change-password";
static String get authForgotPassword => "$baseUrl/api/auth/forgot-password";
static String get authResetPassword => "$baseUrl/api/auth/reset-password";
```

### 3.2. `lib/services/auth_service.dart` — viết lại login/signup

Bỏ toàn bộ phần Firebase Auth:

```dart
Future<Map<String, dynamic>> login({
  required String email,
  required String password,
  bool remember = false,
}) async {
  final fcmToken = await _firebaseMessaging.getToken().catchError((_) => null);

  final response = await post(
    ApiConfig.authLogin,
    data: {'email': email, 'password': password, 'fcmToken': fcmToken, 'remember': remember},
  );

  final data = response.data as Map<String, dynamic>;
  await setToken(data['access_token'] as String);
  await _saveRefreshToken(data['refresh_token'] as String);
  return data;
}

Future<Map<String, dynamic>> signUp({
  required String name,
  required String email,
  required String password,
}) async {
  final response = await post(
    ApiConfig.authRegister,
    data: {'email': email, 'password': password, 'name': name},
  );

  final data = response.data as Map<String, dynamic>;
  // Đăng ký giờ trả token luôn -> vào thẳng app, không cần đăng nhập lại.
  await setToken(data['access_token'] as String);
  await _saveRefreshToken(data['refresh_token'] as String);
  return data;
}
```

Lưu thêm refresh token:

```dart
static const String _refreshTokenKey = 'auth_refresh_token';

Future<void> _saveRefreshToken(String token) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(_refreshTokenKey, token);
}

Future<String?> getRefreshToken() async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getString(_refreshTokenKey);
}
```

`getUserInfo()` đổi sang `/api/auth/me` (response là `{ user, role }`):

```dart
Future<Map<String, dynamic>> getUserInfo() async {
  final response = await get(ApiConfig.authMe);
  return (response.data as Map<String, dynamic>)['user'] as Map<String, dynamic>;
}
```

`logout()` phải thu hồi refresh token ở server trước khi xoá local:

```dart
Future<void> logout() async {
  try {
    final refreshToken = await getRefreshToken();
    if (refreshToken != null) {
      await post(ApiConfig.authLogout, data: {'refresh_token': refreshToken});
    }
  } catch (_) {
    // Mất mạng vẫn phải đăng xuất được ở phía app.
  } finally {
    await clearToken();
    await clearRefreshToken();
  }
}
```

### 3.3. `lib/services/base_service.dart` — tự động refresh khi 401

Đây là thay đổi **quan trọng nhất**. Access token sống 15 phút, nên app sẽ gặp 401
thường xuyên hơn trước rất nhiều. Nếu không tự refresh, người dùng bị đá về màn
đăng nhập mỗi 15 phút.

Sửa `onError` trong interceptor:

```dart
onError: (DioException e, handler) async {
  final path = e.requestOptions.path;
  final isAuthEndpoint = _authEndpoints.any(path.contains);
  final isRefreshCall = path.contains('/api/auth/refresh');

  if (e.response?.statusCode == 401 && !isAuthEndpoint && !_isHandlingTokenError) {
    // Thử làm mới access token một lần rồi phát lại request cũ.
    if (!isRefreshCall && await _tryRefreshToken()) {
      try {
        final retried = await _dio.fetch(e.requestOptions);
        return handler.resolve(retried);
      } catch (_) {
        // Rơi xuống xử lý đăng xuất bên dưới.
      }
    }
    await handleTokenError();
    return handler.reject(e);
  }
  return handler.next(e);
},
```

```dart
Future<bool> _tryRefreshToken() async {
  final refreshToken = await getRefreshToken();
  if (refreshToken == null) return false;

  try {
    // Dùng Dio riêng để không đi qua interceptor này (tránh đệ quy).
    final response = await Dio(BaseOptions(baseUrl: ApiConfig.baseUrl))
        .post(ApiConfig.authRefresh, data: {'refresh_token': refreshToken});

    final data = response.data as Map<String, dynamic>;
    await setToken(data['access_token'] as String);
    // BẮT BUỘC: refresh token đã bị rotate, phải lưu bản mới.
    await _saveRefreshToken(data['refresh_token'] as String);
    return true;
  } catch (_) {
    return false;
  }
}
```

Cần đặt `_isHandlingTokenError = true` khi đang refresh để nhiều request 401 cùng
lúc không gọi refresh song song (mỗi lần refresh làm rotate token, gọi song song sẽ
khiến các lần sau bị coi là token bị đánh cắp). Dùng một `Future` dùng chung:

```dart
static Future<bool>? _refreshInFlight;

static Future<bool> _tryRefreshToken() {
  // Nhiều request cùng nhận 401 thì chỉ refresh MỘT lần, các request khác chờ chung.
  return _refreshInFlight ??= _doRefresh().whenComplete(() => _refreshInFlight = null);
}
```

### 3.4. Bỏ `checkUserStatus` khỏi luồng khởi động

`GET /api/users/checkactive/:uid` giờ **chỉ chính chủ hoặc admin** gọi được (trước
đây ai cũng gọi được, kể cả để dò trạng thái của người khác). Và `/api/auth/me` đã
trả cả `is_active` lẫn `role` trong một request, nên hãy dùng `/me` để khôi phục
phiên và bỏ hẳn lời gọi `checkactive` lúc khởi động.

### 3.5. Đổi mật khẩu / quên mật khẩu

```dart
Future<void> changePassword({
  required String currentPassword,
  required String newPassword,
}) async {
  await post(ApiConfig.authChangePassword, data: {
    'current_password': currentPassword,
    'new_password': newPassword,
  });
  // Server đã thu hồi mọi phiên -> phải đăng xuất ở phía app.
  await clearToken();
  await clearRefreshToken();
}

Future<void> forgotPassword(String email) async {
  await post(ApiConfig.authForgotPassword, data: {'email': email});
}

Future<void> resetPassword({required String token, required String newPassword}) async {
  await post(ApiConfig.authResetPassword, data: {
    'token': token,
    'new_password': newPassword,
  });
}
```

---

## 4. Sửa gì để phân quyền (role) đúng

Đây là phần vá các lỗ hổng đang tồn tại trong app.

### 4.1. Vấn đề hiện tại

1. **Không có route guard.** `AppEntryGate` (`lib/screens/login/app_entry_gate.dart:22`)
   chỉ kiểm tra `FirebaseAuth.instance.currentUser != null`. Ai đăng nhập cũng vào
   được `/admin/*` bằng cách gõ tay.
2. **`AuthCubit.checkAuthStatus()` bị mồ côi.** Hàm có sẵn
   (`lib/screens/login/cubit/auth_cubit.dart:79`) nhưng không được gọi ở đâu →
   mở lại app không khôi phục được phiên và role.
3. **Hai nguồn role song song.** `AuthCubit.role` (lưu vào prefs `auth_role`
   nhưng không ai đọc) và `UserBloc → User.role` (thực tế dùng để điều hướng ở
   `lib/apps/utils/bottomNavigationBar.dart:30`).

### 4.2. Sửa `AppEntryGate` — khôi phục phiên khi mở app

```dart
class AppEntryGate extends StatefulWidget {
  const AppEntryGate({super.key});
  @override
  State<AppEntryGate> createState() => _AppEntryGateState();
}

class _AppEntryGateState extends State<AppEntryGate> {
  @override
  void initState() {
    super.initState();
    // Khôi phục phiên từ token đã lưu: gọi /api/auth/me.
    // 200 -> vào app với đúng role hiện tại; 401 -> về màn đăng nhập.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AuthCubit>().checkAuthStatus();
    });
  }

  @override
  Widget build(BuildContext context) {
    final status = context.watch<AuthCubit>().state.status;

    return FutureBuilder<bool>(
      future: _hasSeenIntro(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const SplashScreen();
        if (!snapshot.data!) return const IntroScreen();

        switch (status) {
          case AuthStatus.initial:
          case AuthStatus.loading:
            return const SplashScreen();
          case AuthStatus.authenticated:
            return const BottomNavigationBarExample();
          case AuthStatus.unauthenticated:
          case AuthStatus.error:
            return const LoginScreen();
        }
      },
    );
  }

  Future<bool> _hasSeenIntro() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('isIntroViewed') ?? false;
  }
}
```

> Lưu ý: `AppEntryGate` phải nằm **trong** `BlocProvider<AuthCubit>` để `context.read`
> hoạt động. Kiểm tra lại `lib/main.dart:137` xem `AuthCubit` đã được provide ở
> cấp trên `MyApp` chưa.

### 4.3. Thêm route guard cho `/admin/*` và `/mentor/courses`

Trong `lib/apps/config/app_router.dart`, `generateRoute` hiện trả thẳng widget. Thêm
bọc theo role:

```dart
static const Map<String, List<String>> _routeRoles = {
  AppRouter.adminDashboard: ['admin'],
  AppRouter.adminUsers: ['admin'],
  AppRouter.adminUserDetail: ['admin'],
  AppRouter.adminCourses: ['admin'],
  AppRouter.adminCategories: ['admin'],
  AppRouter.mentorCourseManagement: ['admin', 'mentor'],
};

static Route<dynamic> generateRoute(RouteSettings settings) {
  final allowedRoles = _routeRoles[settings.name];
  if (allowedRoles != null) {
    return _buildAnimatedRoute(
      _RoleGuard(allowedRoles: allowedRoles, child: _buildPage(settings)),
      settings,
    );
  }
  return _buildAnimatedRoute(_buildPage(settings), settings);
}
```

```dart
class _RoleGuard extends StatelessWidget {
  final List<String> allowedRoles;
  final Widget child;
  const _RoleGuard({required this.allowedRoles, required this.child});

  @override
  Widget build(BuildContext context) {
    final role = context.watch<AuthCubit>().state.role;

    if (role == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (!allowedRoles.contains(role)) {
      // Không đủ quyền -> về trang chủ, không hiện màn hình trắng.
      return Scaffold(
        appBar: AppBar(title: const Text('Không có quyền truy cập')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.lock_outline, size: 64, color: Colors.grey),
              const SizedBox(height: 16),
              const Text('Bạn không có quyền truy cập trang này'),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => Navigator.pushNamedAndRemoveUntil(
                  context, AppRouter.home, (r) => false,
                ),
                child: const Text('Về trang chủ'),
              ),
            ],
          ),
        ),
      );
    }
    return child;
  }
}
```

### 4.4. Gom role về MỘT nguồn duy nhất

Chuyển `bottomNavigationBar.dart` sang đọc từ `AuthCubit` thay vì `UserBloc`:

```dart
// Trước:
final userRole = context.select<UserBloc, String>(
  (bloc) => (bloc.state is UserLoaded) ? (bloc.state as UserLoaded).user.role : '',
);

// Sau:
final userRole = context.select<AuthCubit, String?>((c) => c.state.role) ?? '';
```

Và bỏ dòng đọc `FirebaseAuth.instance.currentUser?.uid` trong
`lib/screens/home/home_screen.dart:98` — dùng `AuthCubit.state.userId`.

> **Vì sao gom về `AuthCubit`:** role trong `UserBloc` lấy từ `GET /api/users/:uid`
> (xem `lib/screens/home/home_screen.dart:98`), tức là một request phụ thuộc mạng
> và có thể thất bại — khi đó role rỗng và bottom nav mất tab Dashboard. `/api/auth/me`
> là nguồn đúng, luôn trả hồ sơ của chính người đang đăng nhập, và gọi một lần lúc
> khởi động là đủ.
>
> **`GET /api/users/:uid` vẫn dùng được cho màn chi tiết mentor** — endpoint này là
> hồ sơ công khai, ai đã đăng nhập cũng xem được (không cần sửa `mentor_service.dart`).
> Nó chỉ không trả `is_active`. Nếu cần biết tài khoản mình còn hoạt động không thì
> đọc từ `/api/auth/me`.

---

## 5. Xử lý lỗi cần biết

| Status | `error` / `code` | App nên làm gì |
|---|---|---|
| `401` | `code: "TOKEN_EXPIRED"` | Gọi `/api/auth/refresh` rồi phát lại request |
| `401` | `code: "REFRESH_TOKEN_EXPIRED"` | Xoá token, về màn đăng nhập |
| `401` | `code: "SESSION_REVOKED"` | Phiên bị thu hồi (bị đánh cắp/mật khẩu đổi) → về màn đăng nhập |
| `401` | `"Email hoặc mật khẩu không đúng"` | Hiện lỗi tại màn đăng nhập. **Không** phân biệt email sai hay mật khẩu sai |
| `403` | `"Tài khoản đã bị khoá"` | Hiện thông báo khoá tài khoản, không cho vào app |
| `429` | `code: "ACCOUNT_LOCKED"` | Tài khoản tạm khoá do sai quá nhiều lần — hiện thời gian còn lại |
| `400` | `"Email này đã được đăng ký"` | Hiện tại màn đăng ký |
| `400` | `"Mật khẩu phải có ít nhất 6 ký tự"` | Validate hiển thị lỗi |

`extractApiError()` trong `base_service.dart` đã đọc cả `error` lẫn `message` nên
không cần sửa để hiển thị thông điệp.

---

## 6. Bảng phân quyền sau khi đổi

Quyền được khai báo ngay tại router (`src/middleware/authorize.middleware.js`), không
còn rải rác trong controller. Bảng dưới là hợp đồng giữa API và app.

| Nhóm endpoint | user | mentor | admin |
|---|---|---|---|
| `GET /api/courses`, `/lessons`, `/quizzes`, `/questions`, `/course-categories` | ✅ | ✅ | ✅ |
| `GET /api/users/:id` (hồ sơ công khai) | ✅ | ✅ | ✅ |
| `GET /api/users/listmentor` | ✅ | ✅ | ✅ |
| `GET /api/users/checkactive/:uid` | chỉ chính mình | chỉ chính mình | ✅ |
| `PUT /api/users/update/:id` | chỉ chính mình | chỉ chính mình | ✅ |
| Đăng ký học, bài học, bookmark, review, thông báo | chỉ tài nguyên của mình | chỉ của mình | ✅ |
| `POST/PUT/DELETE` courses, lessons, quizzes, questions, categories | ❌ | ✅ | ✅ |
| `PATCH /api/courses/:id/status` (duyệt khóa học) | ❌ | gửi lại chờ duyệt | ✅ duyệt/từ chối |
| `PATCH /api/quiz-results/quiz-results/:id/grade` | ❌ | ✅ | ✅ |
| `GET /api/users` (danh sách toàn bộ) | ❌ | ❌ | ✅ |
| `PUT /api/users/updaterole` | ❌ | ❌ | ✅ |
| `PATCH /api/users/:id/status`, `DELETE /api/users/delete/:id` | ❌ | ❌ | ✅ |
| `GET /api/mentor-requests`, `PUT /api/mentor-requests/:id/status` | ❌ | ❌ | ✅ |
| `POST /api/mentor-requests` (xin nâng cấp mentor) | ✅ | ✅ | ✅ |
| `POST /api/app-stats` | ❌ | ✅ (số liệu của mình) | ✅ (toàn hệ thống) |

Ở tầng controller còn có kiểm tra **sở hữu** mà bảng trên không thể hiện: mentor chỉ
sửa/xoá được khóa học, bài học, quiz, câu hỏi **do chính mình tạo**; user chỉ sửa/xoá
được review, bookmark, enrollment của chính mình.

**Hệ quả cho UI:** các tab/nút dành cho admin hoặc mentor phải ẩn theo role, vì
`RoleGuard` chỉ chặn được điều hướng chứ không chặn nút bấm. Dùng
`context.watch<AuthCubit>().state.role` để quyết định hiển thị.

---

## 7. Checklist việc cần làm ở Flutter

- [ ] Thêm các endpoint `/api/auth/*` vào `api_config.dart`
- [ ] Viết lại `login()` / `signUp()` trong `auth_service.dart` (bỏ Firebase Auth)
- [ ] Lưu `refresh_token` cạnh `access_token`
- [ ] Thêm logic tự refresh + phát lại request khi gặp 401 (`base_service.dart`)
- [ ] Chống gọi refresh song song (dùng chung một `Future`)
- [ ] `getUserInfo()` chuyển sang `/api/auth/me`
- [ ] `logout()` gọi `/api/auth/logout` trước khi xoá token local
- [ ] Gọi `AuthCubit.checkAuthStatus()` trong `AppEntryGate`
- [ ] Thêm `_RoleGuard` cho các route `/admin/*` và `/mentor/*`
- [ ] Gom nguồn role về `AuthCubit`, bỏ đọc role từ `UserBloc`
- [ ] Bỏ `FirebaseAuth.instance.currentUser` ở `home_screen.dart`
- [ ] Gỡ package `firebase_auth` khỏi `pubspec.yaml` (giữ `firebase_messaging` nếu còn push)
- [ ] Đổi mật khẩu: sau khi thành công thì đăng xuất ở phía app

---

## 8. Chạy migration trên DB đã tồn tại

⚠️ **Không dùng `npm run db:init:pg`** cho DB đang chạy. File `database_postgres.sql` dùng
`CREATE TABLE IF NOT EXISTS`, nên với bảng `users` đã có sẵn thì câu đó là no-op và các CỘT
mới (`password_hash`, `id`, `failed_login_attempts`, `locked_until`) sẽ **không được thêm** —
chạy xong vẫn phải sửa tiếp.

Dùng migration riêng (idempotent, an toàn với dữ liệu đang có):

```bash
npm run db:migrate:auth
```

Script sẽ kiểm tra lại sau khi chạy và báo lỗi rõ nếu còn thiếu cột/bảng. Nó cũng in ra số
tài khoản chưa có mật khẩu (tạo trước khi API tự quản lý đăng nhập) — những tài khoản đó
cần đặt lại mật khẩu qua `/api/auth/forgot-password` mới đăng nhập được.

## 9. Ghi chú khi chạy thử

Tài khoản demo sau khi chạy `npm run db:seed:pg` (mật khẩu đặt qua `SEED_DEMO_PASSWORD`,
mặc định `Demo@123456`):

| Email | Role |
|---|---|
| `admin@example.com` | admin |
| `mentor1@example.com` | mentor |
| `mentor2@example.com` | mentor |
| `student1@example.com` | user |
| `student2@example.com` | user |

Test nhanh bằng curl:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Demo@123456"}'
```

Lấy `access_token` trong response rồi gọi:

```bash
curl http://localhost:3000/api/auth/me -H "Authorization: Bearer <access_token>"
```
