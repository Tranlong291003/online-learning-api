const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp, withServer } = require("../helpers/apiTestUtils");

const protectedEndpoints = [
  ["GET", "/api/bookmarks/user-1"],
  ["POST", "/api/bookmarks/create"],
  ["DELETE", "/api/bookmarks/delete"],
  ["GET", "/api/course-categories"],
  ["POST", "/api/course-categories/create"],
  ["PUT", "/api/course-categories/update/1"],
  ["DELETE", "/api/course-categories/delete/1"],
  ["GET", "/api/courses"],
  ["GET", "/api/courses/mentor/mentor-1"],
  ["GET", "/api/courses/1"],
  ["POST", "/api/courses/create"],
  ["PUT", "/api/courses/update/1"],
  ["PATCH", "/api/courses/1/status"],
  ["DELETE", "/api/courses/delete/1"],
  ["POST", "/api/enrollments/register"],
  ["GET", "/api/enrollments/user/user-1"],
  ["DELETE", "/api/enrollments/delete/1"],
  ["GET", "/api/enrollments/progress"],
  ["GET", "/api/enrollments/check/user-1/1"],
  ["GET", "/api/lessons/courses/1/user-1"],
  ["POST", "/api/lessons/create"],
  ["PUT", "/api/lessons/update/1"],
  ["DELETE", "/api/lessons/delete/1"],
  ["POST", "/api/lessons/complete"],
  ["GET", "/api/lessons/detail/1"],
  ["GET", "/api/mentor-requests"],
  ["POST", "/api/mentor-requests"],
  ["PUT", "/api/mentor-requests/1/status"],
  ["POST", "/api/notifications"],
  ["POST", "/api/notifications/create"],
  ["POST", "/api/notifications/mark-read"],
  ["DELETE", "/api/notifications/delete/1"],
  ["GET", "/api/questions/1"],
  ["POST", "/api/questions/createbyuser"],
  ["POST", "/api/questions/createbyai"],
  ["PUT", "/api/questions/update/1"],
  ["DELETE", "/api/questions/delete/1"],
  ["POST", "/api/quiz-results/submit"],
  ["GET", "/api/quiz-results/users/user-1/results"],
  ["GET", "/api/quiz-results/1"],
  ["PATCH", "/api/quiz-results/quiz-results/1/grade"],
  ["GET", "/api/quizzes/getquizbycoures/1"],
  ["GET", "/api/quizzes/getquizuser/user-1"],
  ["POST", "/api/quizzes/create"],
  ["PUT", "/api/quizzes/update/1"],
  ["DELETE", "/api/quizzes/delete/1"],
  ["GET", "/api/reviews/course/1"],
  ["POST", "/api/reviews/create"],
  ["PUT", "/api/reviews/update/1"],
  ["DELETE", "/api/reviews/delete/1"],
  ["GET", "/api/users"],
  ["GET", "/api/users/listmentor"],
  ["GET", "/api/users/checkactive/user-1"],
  ["GET", "/api/users/user-1"],
  ["PATCH", "/api/users/user-1/status"],
  ["DELETE", "/api/users/delete/user-1"],
  ["PUT", "/api/users/update/user-1"],
  ["PUT", "/api/users/updaterole"],
];

test("protected API routes reject requests without Bearer token", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ request }) => {
    for (const [method, url] of protectedEndpoints) {
      const response = await request(url, { method });
      const body = await response.json();

      assert.equal(response.status, 401, `${method} ${url}`);
      assert.equal(body.error, "Token không hợp lệ", `${method} ${url}`);
    }
  });
});
