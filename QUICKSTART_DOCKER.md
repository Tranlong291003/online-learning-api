# Quickstart Docker

## Chay lan dau tren Windows

1. Cai Docker Desktop.
2. Neu Docker bao thieu WSL2, mo PowerShell bang **Run as Administrator** va chay:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/windows-enable-wsl.ps1
```

3. Restart Windows.
4. Mo Docker Desktop, doi den khi Docker bao running.
5. Trong thu muc project, chay:

```powershell
npm run docker:doctor
npm run docker:up
```

API:

```text
http://localhost:3000/health
```

## Local API URL chuan

Docker Compose co gateway Nginx de dung URL ngan gon:

```text
http://lmsdemo/api
```

Them dong nay vao file hosts cua Windows bang Notepad/PowerShell chay Run as Administrator:

```text
127.0.0.1 lmsdemo
```

File hosts nam o:

```text
C:\Windows\System32\drivers\etc\hosts
```

Sau do co the goi:

```text
http://lmsdemo/health
http://lmsdemo/api/courses
http://lmsdemo/api/users/login
```

Neu chua them hosts thi van dung duoc:

```text
http://localhost:3000/api
```

## Database

Docker Compose tu dong chay schema PostgreSQL:

```bash
npm run db:init:pg
```

Data migrate tu SQL Server sang Postgres bang:

```powershell
npm run db:migrate:sqlserver-to-pg
```

## Check database

```powershell
docker exec -it online-learning-postgres psql -U postgres -d online_learning_db
```

Trong psql:

```sql
\dt
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM courses;
SELECT COUNT(*) FROM lessons;
SELECT COUNT(*) FROM enrollments;
SELECT COUNT(*) FROM quizzes;
SELECT COUNT(*) FROM quiz_questions;
SELECT COUNT(*) FROM quiz_results;
SELECT COUNT(*) FROM notifications;
SELECT COUNT(*) FROM lesson_progress;
SELECT COUNT(*) FROM course_reviews;
SELECT COUNT(*) FROM bookmarks;
SELECT COUNT(*) FROM upgrade_requests;
\q
```

Hoac dung script:

```powershell
docker exec -it online-learning-api npm run db:verify:pg
```

## Tat Docker

```powershell
npm run docker:down
```
