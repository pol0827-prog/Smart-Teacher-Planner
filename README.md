# 스마트 교무 다이어리 (웹 버전: Firebase + Vercel + Gemini)

어느 브라우저, 어느 기기에서나 구글 계정으로 로그인하면 같은 데이터를 보는 버전입니다.
(클로드 안에서 쓰는 버전과는 데이터가 따로입니다.)

## 폴더 구성
- `index.html` : 화면 전체 (구글 로그인 + 파이어베이스 저장·동기화)
- `api/ai.js` : Vercel 서버 함수. Gemini 키는 여기(서버)에서만 사용합니다.
- `firestore.rules` : 파이어베이스 보안 규칙 (본인 데이터만 읽고 쓰기)
- `package.json`, `.gitignore`

## 진행 순서

### 1. 파이어베이스 (콘솔 firebase.google.com → 프로젝트 smart-teacher-planner-fab6b)
1. Authentication → 로그인 방법 → **Google** 사용 설정(지원 이메일은 본인 이메일 선택)
2. Firestore Database가 없으면 만들기(위치: 서울 asia-northeast3)
3. Firestore → 규칙 탭에 `firestore.rules` 내용을 붙여 넣고 **게시**
4. 앱 체크(App Check)에서 Firestore·Authentication이 "시행됨"이면 **시행 안 함**으로 두기 (이 앱은 앱 체크를 쓰지 않습니다)

### 2. Gemini 키 (Google AI Studio)
1. aistudio.google.com → API 키 만들기 (키는 채팅·파일에 붙여 넣지 마세요)
2. 만든 키를 메모장에 잠깐 복사해 두기 → 4단계에서 Vercel에만 입력

### 3. GitHub
1. github.com 에서 새 저장소 만들기(비공개 권장)
2. "uploading an existing file"로 이 폴더의 파일을 올리기 (폴더 구조 유지: `api/ai.js`)

※ GitHub를 쓰기 어렵다면 Vercel 명령 도구로도 올릴 수 있습니다 (아래 "GitHub 없이" 참고).

### 4. Vercel (vercel.com, GitHub 계정으로 로그인)
1. Add New → Project → 방금 만든 저장소 선택 → Framework Preset은 **Other**
2. Environment Variables 추가
   - `GEMINI_API_KEY` = 2단계에서 만든 키
   - `ALLOWED_EMAIL` = 로그인에 쓰는 본인 구글 이메일 (이 계정만 AI 사용 가능)
   - (선택) `GEMINI_MODEL` = 쓸 모델 이름. 기본은 gemini-2.5-flash, 없으면 gemini-2.0-flash로 대체
3. Deploy → 주소(`○○.vercel.app`)가 생깁니다.

### 5. 파이어베이스에 주소 등록
Authentication → 설정 → **승인된 도메인**에 Vercel 주소(https:// 뺀 부분)를 추가

### 6. 확인
- `https://내주소.vercel.app/api/ai` 를 열면 `{"ok":true,"keySet":true,...}` 가 보여야 합니다.
- 주소를 열고 구글 로그인 → 메모를 저장하고 다른 기기에서 열어 보기 → 문구 만들기로 AI 확인

## GitHub 없이 올리기 (Vercel CLI)
1. Node.js 설치 → 이 폴더에서 터미널 열기
2. `npm install -g vercel` → `vercel login` → `vercel` (질문은 기본값으로 엔터)
3. `vercel env add GEMINI_API_KEY` , `vercel env add ALLOWED_EMAIL` 로 값 입력
4. `vercel --prod` 로 배포

## 클로드 버전 데이터 옮기기
클로드 버전 기타 탭 → 백업 "내려받기" → 웹 버전 기타 탭 → 백업 "가져오기"

## 문제 해결
| 증상 | 확인할 것 |
|---|---|
| 로그인 창이 안 뜸/멈춤 | 승인된 도메인에 주소 추가, Google 로그인 사용 설정, 팝업 허용 |
| "서버 함수가 배포되지 않았습니다" | `api/ai.js`가 저장소에 올라갔는지, Vercel에서 다시 배포 |
| "Gemini 키 없음" | Vercel 환경 변수 `GEMINI_API_KEY` 입력 후 **다시 배포(Redeploy)** |
| "허용되지 않은 계정" | `ALLOWED_EMAIL`이 로그인한 이메일과 같은지 |
| 저장 실패 / permission-denied | Firestore 규칙 게시, 앱 체크 시행 해제 |
| 검색 연결 기능에서 한도 오류 | 무료 한도입니다. 잠시 뒤 다시 시도하세요 |
| AI가 오래 걸리다 실패 | Vercel 무료 플랜 함수 시간 제한일 수 있음 |
