$ErrorActionPreference = "Stop"

$baseUrl = $env:API_BASE_URL
if (-not $baseUrl) {
  $baseUrl = "http://localhost:3000"
}

$jwtSecret = $env:JWT_SECRET
if (-not $jwtSecret) {
  $jwtSecret = "local_docker_secret_change_me_min_32_chars"
}

# Ký token qua scripts/lib/signToken.cjs — middleware chốt cứng iss/aud/HS256 nên
# token ký thiếu các tham số này sẽ bị từ chối (401).
$token = node -e "const {signToken}=require('./scripts/lib/signToken.cjs'); console.log(signToken({uid:'demo-admin',email:'admin@example.com',role:'admin'},{secret:process.argv[1]}));" $jwtSecret
$headers = @{ Authorization = "Bearer $token" }

$checks = @(
  @{ Method = "GET"; Path = "/health"; Auth = $false },
  @{ Method = "GET"; Path = "/api/course-categories"; Auth = $true },
  @{ Method = "GET"; Path = "/api/courses"; Auth = $true },
  @{ Method = "GET"; Path = "/api/courses/1"; Auth = $true },
  @{ Method = "GET"; Path = "/api/courses/mentor/demo-mentor-1"; Auth = $true },
  @{ Method = "GET"; Path = "/api/lessons/courses/1/demo-user-1"; Auth = $true },
  @{ Method = "GET"; Path = "/api/enrollments/user/demo-user-1"; Auth = $true },
  @{ Method = "GET"; Path = "/api/enrollments/check/demo-user-1/1"; Auth = $true },
  @{ Method = "GET"; Path = "/api/enrollments/progress?userUid=demo-user-1&courseId=1"; Auth = $true },
  @{ Method = "GET"; Path = "/api/quizzes/getquizbycourse/1"; Auth = $true },
  @{ Method = "GET"; Path = "/api/questions/1"; Auth = $true },
  @{ Method = "GET"; Path = "/api/quiz-results/users/demo-user-1/results"; Auth = $true },
  @{ Method = "GET"; Path = "/api/reviews/course/1"; Auth = $true },
  @{ Method = "GET"; Path = "/api/bookmarks/demo-user-1"; Auth = $true },
  @{ Method = "POST"; Path = "/api/notifications"; Auth = $true; Body = @{ uid = "demo-user-1" } },
  @{ Method = "POST"; Path = "/api/app-stats"; Auth = $true; Body = @{ uid = "demo-admin" } },
  @{ Method = "GET"; Path = "/api/mentor-requests"; Auth = $true },
  @{ Method = "GET"; Path = "/api/users"; Auth = $true },
  @{ Method = "GET"; Path = "/api/users/listmentor"; Auth = $true },
  @{ Method = "GET"; Path = "/api/users/checkactive/demo-user-1"; Auth = $true },
  @{ Method = "GET"; Path = "/api/users/demo-user-1"; Auth = $true }
)

foreach ($check in $checks) {
  $uri = "$baseUrl$($check.Path)"
  $requestHeaders = @{}
  if ($check.Auth) {
    $requestHeaders = $headers
  }

  $params = @{
    Uri = $uri
    Method = $check.Method
    UseBasicParsing = $true
    Headers = $requestHeaders
  }

  if ($check.ContainsKey("Body")) {
    $params.ContentType = "application/json"
    $params.Body = ($check.Body | ConvertTo-Json -Compress)
  }

  try {
    $response = Invoke-WebRequest @params
    Write-Host ("OK {0} {1} -> {2}" -f $check.Method, $check.Path, $response.StatusCode)
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    Write-Host ("FAIL {0} {1} -> {2}" -f $check.Method, $check.Path, $status)
    if ($_.ErrorDetails.Message) {
      Write-Host $_.ErrorDetails.Message
    }
    exit 1
  }
}

Write-Host "API smoke checks passed."
