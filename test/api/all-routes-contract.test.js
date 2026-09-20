const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createPoolMock,
  loadApp,
  signTestToken,
  withServer,
} = require("../helpers/apiTestUtils");

function authHeaders() {
  return {
    authorization: `Bearer ${signTestToken({ uid: "admin-1", role: "admin" })}`,
  };
}

function dbResponse(sql) {
  const normalized = String(sql).replace(/\s+/g, " ").toLowerCase();

  if (normalized.includes("select role from users")) {
    return { rows: [{ role: "admin" }] };
  }
  if (normalized.includes("select id, role from users")) {
    return { rows: [{ id: 1, role: "admin" }] };
  }
  if (normalized.includes("select is_active from users")) {
    return { rows: [{ is_active: true }] };
  }
  if (normalized.includes("select role, is_active, fcm_token from users")) {
    return { rows: [{ role: "admin", is_active: true, fcm_token: "fcm-token" }] };
  }
  if (normalized.includes("select fcm_token from users")) {
    return { rows: [{ fcm_token: "fcm-token" }] };
  }
  if (normalized.includes("select user_uid from upgrade_requests")) {
    return { rows: [{ user_uid: "user-1" }] };
  }
  if (normalized.includes("select type from quizzes")) {
    return { rows: [{ type: "trac_nghiem" }] };
  }
  if (normalized.includes("select * from quizzes")) {
    return {
      rows: [
        {
          quiz_id: 1,
          course_id: 1,
          title: "Quiz",
          type: "trac_nghiem",
        },
      ],
    };
  }
  if (normalized.includes("select * from quiz_results")) {
    return {
      rows: [
        {
          result_id: 1,
          user_uid: "user-1",
          quiz_id: 1,
          answers: "[]",
          score: 0,
        },
      ],
    };
  }
  if (normalized.includes("from bookmarks where bookmark_id")) {
    return { rows: [{ user_uid: "user-1" }] };
  }
  if (normalized.includes("returning bookmark_id")) {
    return { rows: [{ bookmark_id: 1 }] };
  }
  if (normalized.includes("returning noti_id")) {
    return { rows: [{ noti_id: 1 }] };
  }
  if (normalized.includes("returning uid")) {
    return { rows: [{ uid: "user-1" }] };
  }
  if (normalized.includes("returning category_id")) {
    return { rows: [{ category_id: 1 }] };
  }
  if (normalized.includes("returning course_id")) {
    return { rows: [{ course_id: 1 }] };
  }
  if (normalized.includes("returning lesson_id")) {
    return { rows: [{ lesson_id: 1 }] };
  }
  if (normalized.includes("returning enrollment_id")) {
    return { rows: [{ enrollment_id: 1 }] };
  }
  if (normalized.includes("returning quiz_id")) {
    return { rows: [{ quiz_id: 1 }] };
  }
  if (normalized.includes("returning question_id")) {
    return { rows: [{ question_id: 1 }] };
  }
  if (normalized.includes("returning result_id")) {
    return { rows: [{ result_id: 1 }] };
  }
  if (normalized.includes("returning review_id")) {
    return { rows: [{ review_id: 1 }] };
  }
  if (normalized.startsWith("update users") && normalized.includes("returning *")) {
    return {
      rows: [
        {
          uid: "user-1",
          name: "Updated User",
          phone: "0900000000",
          gender: "other",
          birthdate: "2000-01-01",
          fcm_token: "fcm-token",
        },
      ],
    };
  }
  if (normalized.startsWith("update")) {
    return { rows: [{ id: 1, noti_id: 1, uid: "user-1" }] };
  }
  if (normalized.startsWith("delete")) {
    return { rows: [{ id: 1, noti_id: 1, uid: "user-1", category_id: 1 }] };
  }
  if (normalized.includes("count(*)")) {
    return {
      rows: [
        {
          count: 0,
          total_courses: "0",
          total_users: "0",
          total_quizzes: "0",
          total_reviews: "0",
          course_count: "0",
        },
      ],
    };
  }

  return { rows: [] };
}

const endpoints = [
  ["POST", "/api/app-stats", { uid: "admin-1" }],
  ["GET", "/api/bookmarks/user-1"],
  ["POST", "/api/bookmarks/create", { courseId: 1, userUid: "user-1" }],
  ["DELETE", "/api/bookmarks/delete", { bookmarkId: 1, userUid: "user-1" }],
  ["GET", "/api/course-categories"],
  ["POST", "/api/course-categories/create", { name: "Category", uid: "admin-1" }],
  ["PUT", "/api/course-categories/update/1", { name: "Category", uid: "admin-1" }],
  ["DELETE", "/api/course-categories/delete/1", { uid: "admin-1" }],
  ["GET", "/api/courses"],
  ["GET", "/api/courses/mentor/admin-1"],
  ["GET", "/api/courses/1"],
  ["POST", "/api/courses/create", { title: "Course", instructor_uid: "admin-1", category_id: 1, level: "basic" }],
  ["PUT", "/api/courses/update/1", { title: "Course", uid: "admin-1" }],
  ["PATCH", "/api/courses/1/status", { uid: "admin-1", status: "approved" }],
  ["DELETE", "/api/courses/delete/1", { uid: "admin-1" }],
  ["POST", "/api/enrollments/register", { user_uid: "user-1", course_id: 1 }],
  ["GET", "/api/enrollments/user/user-1"],
  ["DELETE", "/api/enrollments/delete/1"],
  ["GET", "/api/enrollments/progress?user_uid=user-1&course_id=1"],
  ["GET", "/api/enrollments/check/user-1/1"],
  ["GET", "/api/lessons/courses/1/user-1"],
  ["POST", "/api/lessons/create", { uid: "admin-1", course_id: 1, title: "Lesson" }],
  ["PUT", "/api/lessons/update/1", { uid: "admin-1", title: "Lesson" }],
  ["DELETE", "/api/lessons/delete/1", { uid: "admin-1" }],
  ["POST", "/api/lessons/complete", { user_uid: "user-1", course_id: 1, lesson_id: 1 }],
  ["GET", "/api/lessons/detail/1"],
  ["GET", "/api/mentor-requests"],
  ["POST", "/api/mentor-requests", { user_uid: "user-1" }],
  ["PUT", "/api/mentor-requests/1/status", { status: "approved" }],
  ["POST", "/api/notifications", { uid: "user-1" }],
  ["POST", "/api/notifications/create", { uid: "user-1", title: "Title", content: "Body" }],
  ["POST", "/api/notifications/mark-read", { uid: "user-1", noti_id: 1 }],
  ["DELETE", "/api/notifications/delete/1", { uid: "user-1" }],
  ["GET", "/api/questions/1"],
  ["POST", "/api/questions/createbyuser", { uid: "admin-1", quiz_id: 1, question: "Q?", options: ["A", "B"], correct_index: 0 }],
  ["POST", "/api/questions/createbyai", { uid: "admin-1", quiz_id: 1, prompt: "Create one question" }],
  ["PUT", "/api/questions/update/1", { uid: "admin-1", quiz_id: 1, question: "Q?", options: ["A", "B"], correct_index: 0 }],
  ["DELETE", "/api/questions/delete/1", { uid: "admin-1" }],
  ["POST", "/api/quiz-results/submit", { user_uid: "user-1", quiz_id: 1, answers: [] }],
  ["GET", "/api/quiz-results/users/user-1/results"],
  ["GET", "/api/quiz-results/1"],
  ["PATCH", "/api/quiz-results/quiz-results/1/grade", { uid: "admin-1", score: 10, explanation: "OK" }],
  ["GET", "/api/quizzes/getquizbycourse/1"],
  ["GET", "/api/quizzes/getquizuser/user-1"],
  ["POST", "/api/quizzes/create", { uid: "admin-1", course_id: 1, title: "Quiz", type: "trac_nghiem" }],
  ["PUT", "/api/quizzes/update/1", { uid: "admin-1", title: "Quiz" }],
  ["DELETE", "/api/quizzes/delete/1", { uid: "admin-1" }],
  ["GET", "/api/reviews/course/1"],
  ["POST", "/api/reviews/create", { courseId: 1, userUid: "user-1", rating: 5, comment: "Good" }],
  ["PUT", "/api/reviews/update/1", { userUid: "user-1", rating: 4, comment: "Updated" }],
  ["DELETE", "/api/reviews/delete/1", { userUid: "user-1" }],
  ["POST", "/api/users/create", { email: "new@example.com", password: "123456", name: "New User" }],
  ["POST", "/api/users/login", { idToken: "firebase-token", fcmToken: "fcm-token" }],
  ["GET", "/api/users/listmentor"],
  ["GET", "/api/users"],
  ["GET", "/api/users/checkactive/user-1"],
  ["GET", "/api/users/user-1"],
  ["PATCH", "/api/users/user-1/status", { status: "active" }],
  ["DELETE", "/api/users/delete/user-1"],
  ["PUT", "/api/users/update/user-1", { name: "Updated User" }],
  ["PUT", "/api/users/updaterole", { uid: "user-1", role: "mentor" }],
];

test("all declared API endpoints are reachable through Express routing", async () => {
  const poolMock = createPoolMock(Array.from({ length: 500 }, () => dbResponse));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json, request }) => {
    for (const [method, url, body] of endpoints) {
      const headers = url.startsWith("/api/users/create") || url.startsWith("/api/users/login")
        ? {}
        : authHeaders();
      const response = body
        ? await json(url, { method, headers, body })
        : await request(url, { method, headers });
      const contentType = response.headers.get("content-type") || "";

      assert.notEqual(response.status, 401, `${method} ${url} was blocked by auth`);
      assert.match(
        contentType,
        /application\/json/,
        `${method} ${url} did not reach a JSON API handler. Status: ${response.status}`
      );
    }
  });
});
