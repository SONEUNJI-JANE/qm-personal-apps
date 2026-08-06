# QM팀 개인앱 아카이브 설계

## 배경

QM팀원이 개인적으로 만든 도구(exe, zip 등 실행파일/스크립트 묶음)를 서로 공유할 곳이 없음. hero page(`qm-hero`)는 정적 사이트라 파일 업로드/다운로드를 직접 처리할 수 없음 — 별도 앱으로 만들고 hero page 트리에 링크만 추가한다.

## 범위

- QM팀원 누구나 로그인 후 파일 업로드/다운로드/삭제 가능
- 파일당 대략 50MB 이하 기준 (현재 실사용 사례: 약 11MB짜리 exe 배포용 zip)
- 카테고리(자유텍스트)로 분류 — TD/QA/패턴툴/메일툴 등 업로더가 직접 입력
- hero page(`data.js`)에 새 링크 항목 하나 추가 (별도 배포)

## 아키텍처

DCS AI **embedded-app** 표준 패턴(프론트+백엔드, K8s 배포)을 따른다.

- **프론트엔드**: 업로드 폼(파일선택 + 이름 + 설명 + 카테고리) + 목록(카드/테이블 — 이름, 설명, 카테고리 태그, 올린사람, 업로드일시, 다운로드 버튼, 삭제 버튼). 카테고리 태그 클릭 시 해당 카테고리로 목록 필터링.
- **백엔드(Express)**: 파일 바이트는 S3(Presigned URL API 경유 — `svc-fnf-ax-platform-pub-s3`, `AWS SDK 직접 사용 금지`, `dcs-ai-common:embedded-app` `structure/s3.md` 패턴 그대로 사용). 메타데이터는 Postgres.
- **인증**: DCS AI 플랫폼 로그인 세션에서 사용자 이메일을 가져와 업로더로 자동 기록 (업로더가 이름을 직접 입력하지 않음).
- **삭제 권한**: 팀 인원 이동(퇴사 등) 감안해 업로더 본인 제한 없이 QM팀원 누구나 삭제 가능.

## 데이터 모델 (Postgres)

```sql
CREATE TABLE personal_apps (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  category      TEXT,
  s3_key        TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size     INTEGER NOT NULL,
  uploader_email TEXT NOT NULL,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## API

| Method | Path | 용도 |
|--------|------|------|
| GET | `/api/apps` | 목록 조회 (선택: `?category=` 필터) |
| POST | `/api/apps` | 업로드 — multipart(file) + name/description/category, 서버가 S3 업로드 후 DB insert |
| GET | `/api/apps/:id/download` | 다운로드 — DB에서 s3_key 조회 → presigned GET → 스트리밍 |
| DELETE | `/api/apps/:id` | 삭제 — DB row 삭제 + S3 object 삭제 |

## 플로우

1. **업로드**: 사용자가 파일+이름+설명+카테고리 입력 → 서버가 S3에 저장(presigned PUT, key: `qm-personal-apps/prd/uploads/{timestamp}-{원본파일명}`) → DB에 메타데이터 insert
2. **목록**: DB에서 `uploaded_at DESC` 정렬 조회, 카테고리별 필터는 프론트에서 쿼리 파라미터로 백엔드에 전달
3. **다운로드**: `/api/apps/:id/download` 호출 → DB에서 s3_key 조회 → presigned GET URL 발급 → 서버가 S3에서 받아 그대로 스트리밍 응답
4. **삭제**: `/api/apps/:id` DELETE → DB row 삭제 + S3 object 삭제 (S3 삭제 실패해도 DB는 지워지도록 순서: DB 삭제 성공 후 S3 삭제 시도, S3 실패는 로그만 남기고 무시 — 고아 파일보다 목록에 죽은 항목 남는 게 더 나쁨)

## 에러 처리

- 업로드 시 파일 없음/이름 없음 → 400
- 다운로드/삭제 대상 id 없음 → 404
- S3 API 실패 → 502, 사용자에게 "잠시 후 다시 시도해주세요" 노출

## 배포

`dcs-ai-common:embedded-app` `deployment/prep.md` → `deployment/deploy.md` 순서로 첫 배포 진행. 배포 성공 후 발급된 URL을 `hero_section/data.js`에 새 항목으로 추가 (그룹 위치는 추후 결정).

## 테스트

- 업로드 → 목록에 즉시 노출 → 다운로드 시 원본과 동일한 파일 확인 → 삭제 후 목록/S3에서 사라짐 확인 (수동 E2E, 백엔드 API 유닛 테스트는 구현 계획 단계에서 구체화)
