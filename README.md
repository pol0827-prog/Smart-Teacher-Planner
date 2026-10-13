# 스마트 교무 다이어리 (웹 버전: Firebase + Vercel + Google AI Studio)

## 파일 (GitHub 저장소에 올릴 것)
| 파일 | 위치 | 역할 |
|---|---|---|
| index.html | 저장소 맨 위 | 화면 전체 (구글 로그인 + 저장·동기화 + AI 호출) |
| api/ai.js | **api 폴더 안** | Vercel 서버 함수. Google AI Studio(Gemini)를 호출 |
| package.json | 저장소 맨 위 | 프로젝트 정보 |
| firestore.rules | 저장소 맨 위 | 파이어베이스 보안 규칙(참고용, 콘솔에 붙여 넣어야 적용됨) |
| .gitignore, README.md | 저장소 맨 위 | 부가 파일 |

## GitHub에 올리는 방법 (폴더 업로드가 안 될 때)
1. 저장소 → Add file → **Upload files** → 파일 5개(index.html, package.json, firestore.rules, README.md, .gitignore)를 끌어다 놓고 Commit changes
2. `api/ai.js`는 **Add file → Create new file** → 이름 칸에 `api/ai.js` 입력(폴더가 자동으로 만들어짐) → 내용 붙여 넣기 → Commit changes
3. 이미 올라간 파일을 바꿀 때는 파일을 눌러 연필(편집) 아이콘 → 내용을 지우고 새 내용 붙여 넣기 → Commit changes

## Google AI Studio API 키 사용 (서버에만 보관)
1. aistudio.google.com → **Get API key** → 키 만들기
2. Vercel → 프로젝트 → Settings → Environment Variables
   - `GEMINI_API_KEY` = 만든 키 (이름은 전부 대문자)
   - `ALLOWED_EMAIL` = 로그인에 쓰는 본인 구글 이메일 (이 계정만 AI 사용)
   - (선택) `GEMINI_MODEL` = 쓸 모델 이름 (기본 gemini-2.5-flash, 오류 시 gemini-2.0-flash)
3. 환경 변수를 저장한 뒤 **새 배포**가 필요합니다: Deployments 탭 맨 위 배포의 … → Redeploy (또는 GitHub 파일을 하나 수정해 Commit)
4. 확인: `https://내주소.vercel.app/api/ai` → `{"ok":true,"keySet":true,...}`
   - `keySet:false` → 변수 이름 오타, 또는 저장 후 재배포를 안 한 것
   - `keyVar` 에는 서버가 찾은 변수 이름이 표시됩니다(값은 표시되지 않습니다)

## 파이어베이스 (프로젝트 smart-teacher-planner-fab6b)
1. Authentication → 로그인 방법 → Google 사용 설정
2. Firestore Database 만들기(서울) → 규칙 탭에 firestore.rules 내용 붙여 넣고 게시
3. 앱 체크의 Firestore·Authentication은 "시행 안 함"
4. Authentication → 설정 → 승인된 도메인에 Vercel 주소 추가

## 확인
- 사이트 접속 → 구글 로그인 → 기타 탭 맨 아래 "연결 점검" → 모든 항목 ✅ 확인

## 보안
- Gemini 키는 Vercel 환경 변수에만 넣고 코드·GitHub·채팅에는 쓰지 마세요. 노출되면 AI Studio에서 키를 삭제하고 새로 만드세요.
