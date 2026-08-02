$ErrorActionPreference = "Stop"

$baseUrl = $env:API_BASE_URL
if (-not $baseUrl) {
  $baseUrl = "http://localhost:3000"
}

$jwtSecret = $env:JWT_SECRET
if (-not $jwtSecret) {
  $jwtSecret = "local_docker_secret_change_me_min_32_chars"
}

$adminUid = if ($env:ADMIN_UID) { $env:ADMIN_UID } else { "demo-admin" }
$adminEmail = if ($env:ADMIN_EMAIL) { $env:ADMIN_EMAIL } else { "admin@example.com" }
$mentorUid = if ($env:MENTOR_UID) { $env:MENTOR_UID } else { "demo-mentor-1" }
$mentorEmail = if ($env:MENTOR_EMAIL) { $env:MENTOR_EMAIL } else { "mentor1@example.com" }
$userUid = if ($env:USER_UID) { $env:USER_UID } else { "demo-user-1" }
$userEmail = if ($env:USER_EMAIL) { $env:USER_EMAIL } else { "student1@example.com" }
$secondaryUserUid = if ($env:SECONDARY_USER_UID) { $env:SECONDARY_USER_UID } else { $userUid }
$readCourseId = if ($env:READ_COURSE_ID) { [int]$env:READ_COURSE_ID } else { 1 }
$readLessonId = if ($env:READ_LESSON_ID) { [int]$env:READ_LESSON_ID } else { 1 }
$readQuizId = if ($env:READ_QUIZ_ID) { [int]$env:READ_QUIZ_ID } else { 1 }
$readQuizResultId = if ($env:READ_QUIZ_RESULT_ID) { [int]$env:READ_QUIZ_RESULT_ID } else { 1 }

function New-TestToken($uid, $role, $email) {
  return node -e "const jwt=require('jsonwebtoken'); console.log(jwt.sign({uid:process.argv[2],email:process.argv[4],role:process.argv[3]}, process.argv[1], {expiresIn:'1h'}));" $jwtSecret $uid $role $email
}

$adminToken = New-TestToken $adminUid "admin" $adminEmail
$mentorToken = New-TestToken $mentorUid "mentor" $mentorEmail
$userToken = New-TestToken $userUid "user" $userEmail

function Invoke-Api {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body = $null,
    [string]$Token = $adminToken,
    [int[]]$Expected = @(200)
  )

  $headers = @{}
  if ($Token) {
    $headers.Authorization = "Bearer $Token"
  }

  $params = @{
    Uri = "$baseUrl$Path"
    Method = $Method
    UseBasicParsing = $true
    Headers = $headers
  }

  if ($null -ne $Body) {
    $params.ContentType = "application/json"
    $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
  }

  try {
    $response = Invoke-WebRequest @params
    if ($Expected -notcontains [int]$response.StatusCode) {
      throw "Expected $($Expected -join ',') but got $($response.StatusCode)"
    }
    Write-Host ("OK   {0,-6} {1,-55} -> {2}" -f $Method, $Path, $response.StatusCode)
    if ($response.Content) {
      return $response.Content | ConvertFrom-Json
    }
    return $null
  } catch {
    $status = $null
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
    }
    Write-Host ("FAIL {0,-6} {1,-55} -> {2}" -f $Method, $Path, $status)
    if ($_.ErrorDetails.Message) {
      Write-Host $_.ErrorDetails.Message
    } else {
      Write-Host $_.Exception.Message
    }
    exit 1
  }
}

Write-Host "Running live API tests against $baseUrl"

# Public / dashboard
Invoke-Api "GET" "/health" -Token $null | Out-Null
Invoke-Api "POST" "/api/app-stats" -Token $null -Body @{ uid = $adminUid } | Out-Null
Invoke-Api "POST" "/api/app-stats" -Token $null -Body @{ uid = $mentorUid } | Out-Null

# Read endpoints backed by seeded data
Invoke-Api "GET" "/api/course-categories" | Out-Null
Invoke-Api "GET" "/api/courses" | Out-Null
Invoke-Api "GET" "/api/courses/$readCourseId" | Out-Null
Invoke-Api "GET" "/api/courses/mentor/$mentorUid" | Out-Null
Invoke-Api "GET" "/api/lessons/courses/$readCourseId/$userUid" | Out-Null
Invoke-Api "GET" "/api/lessons/detail/$readLessonId" | Out-Null
Invoke-Api "GET" "/api/enrollments/user/$userUid" | Out-Null
Invoke-Api "GET" "/api/enrollments/check/$userUid/$readCourseId" | Out-Null
Invoke-Api "GET" "/api/enrollments/progress?userUid=$userUid&courseId=$readCourseId" | Out-Null
Invoke-Api "GET" "/api/quizzes/getquizbycoures/$readCourseId" | Out-Null
Invoke-Api "GET" "/api/quizzes/getquizuser/$userUid" | Out-Null
Invoke-Api "GET" "/api/questions/$readQuizId" | Out-Null
Invoke-Api "GET" "/api/quiz-results/users/$userUid/results" | Out-Null
Invoke-Api "GET" "/api/quiz-results/$readQuizResultId" | Out-Null
Invoke-Api "GET" "/api/reviews/course/$readCourseId" | Out-Null
Invoke-Api "GET" "/api/bookmarks/$userUid" | Out-Null
Invoke-Api "POST" "/api/notifications" -Body @{ uid = $userUid } | Out-Null
Invoke-Api "GET" "/api/mentor-requests" | Out-Null
Invoke-Api "GET" "/api/users" | Out-Null
Invoke-Api "GET" "/api/users/listmentor" | Out-Null
Invoke-Api "GET" "/api/users/checkactive/$userUid" | Out-Null
Invoke-Api "GET" "/api/users/$userUid" | Out-Null

# Write endpoints with isolated test rows
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$categoryName = "Live Test Category $suffix"
$categoryCreate = Invoke-Api "POST" "/api/course-categories/create" -Body @{ name = $categoryName; description = "Created by live API test"; uid = $adminUid } -Expected @(201)
$categories = Invoke-Api "GET" "/api/course-categories"
$createdCategory = $categories.data | Where-Object { $_.name -eq $categoryName } | Select-Object -First 1
if (-not $createdCategory) {
  throw "Created category was not found in GET /api/course-categories"
}
$categoryId = $createdCategory.category_id
Invoke-Api "PUT" "/api/course-categories/update/$categoryId" -Body @{ name = "$categoryName Updated"; description = "Updated by live API test"; uid = $adminUid } | Out-Null

$courseTitle = "Live Test Course $suffix"
$course = Invoke-Api "POST" "/api/courses/create" -Body @{
  title = $courseTitle
  description = "Course created by live API test"
  uid = $mentorUid
  category_id = $categoryId
  level = "beginner"
  price = 100000
  discount_price = 50000
  language = "vi"
  tags = "live,test"
} -Token $mentorToken -Expected @(201)
$courseId = $course.course.course_id
Invoke-Api "GET" "/api/courses/$courseId" | Out-Null
Invoke-Api "PATCH" "/api/courses/$courseId/status" -Body @{ uid = $adminUid; status = "approved" } | Out-Null
Invoke-Api "PUT" "/api/courses/update/$courseId" -Body @{ uid = $mentorUid; title = "$courseTitle Updated"; description = "Updated live test course"; level = "intermediate"; category_id = $categoryId } -Token $mentorToken | Out-Null

$lesson = Invoke-Api "POST" "/api/lessons/create" -Body @{
  uid = $mentorUid
  course_id = $courseId
  title = "Live Test Lesson"
  content = "Lesson created by live API test"
  order = 1
} -Token $mentorToken -Expected @(201)
$lessonId = $lesson.data.lesson_id
Invoke-Api "GET" "/api/lessons/detail/$lessonId" | Out-Null
Invoke-Api "PUT" "/api/lessons/update/$lessonId" -Body @{ uid = $mentorUid; title = "Live Test Lesson Updated"; content = "Updated content"; order = 1 } -Token $mentorToken | Out-Null

$quiz = Invoke-Api "POST" "/api/quizzes/create" -Body @{
  uid = $mentorUid
  course_id = $courseId
  title = "Live Test Quiz"
  description = "Quiz created by live API test"
  type = "trac_nghiem"
  time_limit = 10
  attempt_limit = 2
} -Token $mentorToken -Expected @(201)
$quizId = $quiz.data.quiz_id

$question = Invoke-Api "POST" "/api/questions/createbyuser" -Body @{
  uid = $mentorUid
  quiz_id = $quizId
  question = "Live test question?"
  options = @("A", "B", "C", "D")
  correct_index = 0
} -Token $mentorToken -Expected @(201)
$questionId = $question.data.question_id
Invoke-Api "PUT" "/api/questions/update/$questionId" -Body @{
  uid = $mentorUid
  quiz_id = $quizId
  question = "Live test question updated?"
  options = @("A", "B", "C", "D")
  correct_index = 1
} -Token $mentorToken | Out-Null

$enrollment = Invoke-Api "POST" "/api/enrollments/register" -Body @{ userUid = $secondaryUserUid; courseId = $courseId } -Token $userToken -Expected @(201)
$enrollmentId = $enrollment.enrollment_id
Invoke-Api "POST" "/api/lessons/complete" -Body @{ userUid = $secondaryUserUid; courseId = [int]$courseId; lessonId = [int]$lessonId } -Token $userToken | Out-Null

$review = Invoke-Api "POST" "/api/reviews/create" -Body @{ course_id = $courseId; user_uid = $secondaryUserUid; rating = 5; comment = "Live test review" } -Token $userToken -Expected @(201)
$reviewId = $review.data.review_id
Invoke-Api "PUT" "/api/reviews/update/$reviewId" -Body @{ user_uid = $secondaryUserUid; rating = 4; comment = "Live test review updated" } -Token $userToken | Out-Null

$bookmark = Invoke-Api "POST" "/api/bookmarks/create" -Body @{ courseId = $courseId; userUid = $secondaryUserUid } -Token $userToken -Expected @(201)
$bookmarkId = $bookmark.data.bookmark_id

$notification = Invoke-Api "POST" "/api/notifications/create" -Body @{ uid = $secondaryUserUid; title = "Live Test"; content = "Notification from live API test"; icon = "test"; color = "#000000" } -Expected @(201)
$notiId = $notification.noti_id
Invoke-Api "POST" "/api/notifications/mark-read" -Body @{ uid = $secondaryUserUid; noti_id = $notiId } | Out-Null

Invoke-Api "PATCH" "/api/users/$secondaryUserUid/status" -Body @{ status = "active" } | Out-Null
Invoke-Api "PUT" "/api/users/update/$secondaryUserUid" -Body @{ name = "Student Live"; bio = "Updated by live API test"; phone = "0900999999"; gender = "male"; birthdate = "2002-05-05" } | Out-Null
Invoke-Api "PUT" "/api/users/updaterole" -Body @{ uid = $secondaryUserUid; role = "user" } | Out-Null

# Cleanup isolated rows in FK-safe order.
Invoke-Api "DELETE" "/api/bookmarks/delete" -Body @{ bookmarkId = $bookmarkId; userUid = $secondaryUserUid } -Token $userToken | Out-Null
Invoke-Api "DELETE" "/api/reviews/delete/$reviewId" -Body @{ user_uid = $secondaryUserUid } -Token $userToken | Out-Null
Invoke-Api "DELETE" "/api/notifications/delete/$notiId" -Body @{ uid = $secondaryUserUid } | Out-Null
if ($enrollmentId) {
  Invoke-Api "DELETE" "/api/enrollments/delete/$enrollmentId" -Token $userToken | Out-Null
}
Invoke-Api "DELETE" "/api/questions/delete/$questionId" -Body @{ uid = $mentorUid } -Token $mentorToken | Out-Null
Invoke-Api "DELETE" "/api/quizzes/delete/$quizId" -Body @{ uid = $mentorUid } -Token $mentorToken | Out-Null
Invoke-Api "DELETE" "/api/lessons/delete/$lessonId" -Body @{ uid = $mentorUid } -Token $mentorToken | Out-Null
Invoke-Api "DELETE" "/api/courses/delete/$courseId" -Body @{ uid = $adminUid } | Out-Null
Invoke-Api "DELETE" "/api/course-categories/delete/$categoryId" -Body @{ uid = $adminUid } | Out-Null

Write-Host "Live API full tests passed."
