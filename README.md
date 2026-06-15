# StyledMD (Editor & AIWriter)

StyledMD는 로컬 파일 시스템에서 작동하는 초경량 데스크톱 마크다운 에디터이자, AI 기반 문서 작성 비서다. Go언어의 WebView2 바인딩을 기반으로 구동되며, Google Gemini 및 Groq API를 연동하여 실시간 AI 문서 작성 및 편집을 지원한다.

---

## 📦 다운로드 및 설치

프로젝트의 전체 소스 코드, 프론트엔드 자산(Assets), 환경 설정 구조 및 의존성 라이브러리는 하나의 압축 파일로 제공된다.
- **배포 파일**: `The_Whole_Files_of_StyledMD.7z`
- **설치 방법**: 저장소에서 해당 압축 파일을 다운로드하여 로컬 경로에 압축을 해제한다.

---

## 🛠️ 프로젝트 디렉토리 구조

프로젝트의 핵심 구성 요소는 아래와 같다.

```text
StyledMD/
├── StyledMD/                  # 프론트엔드 리소스 디렉토리
│   ├── SVG/                   # 사용자 정의 벡터 아이콘 (Callouts 렌더링용)
│   ├── lib/                   # 외부 프론트엔드 라이브러리 (Monaco Editor 등)
│   ├── bottom.html            # 하단 제어 패널 HTML 템플릿
│   ├── index.html             # 메인 애플리케이션 사용자 인터페이스(UI) 레이아웃
│   ├── marked.min.js          # 마크다운 파서 라이브러리
│   ├── script.js              # 클라이언트 에디터 및 AI 연동 스크립트
│   └── style.css              # 애플리케이션 스타일시트
├── pkg/                       # Go 백엔드 패키지
│   ├── ai_handlers.go         # AI 질의 및 응답 처리 핸들러
│   ├── api_google_handler.go  # Google Gemini API 클라이언트 구현체
│   ├── api_groq_handler.go    # Groq API 클라이언트 구현체
│   ├── crypto.go              # Windows DPAPI 암호화 모듈
│   ├── handle_aiconfig.go     # AI 설정 및 API Key 저장/로드 핸들러
│   ├── handle_user_instruction.go # 사용자 정의 시스템 지침(System Prompt) 로더
│   ├── handlers.go            # 문서 입출력 및 일반 윈도우 핸들러
│   └── win_dialog.go          # Windows OS 파일 선택 대화상자 래퍼
├── build_instruction.ps1      # PowerShell 빌드 스크립트
├── go.mod                     # Go 모듈 의존성 설정 파일
├── go.sum                     # Go 모듈 체크섬 파일
├── main.go                    # 애플리케이션 진입점 및 로컬 웹 서버
├── rsrc_windows_amd64.syso    # 임베디드 리소스 바이너리 (아이콘, 매니페스트)
└── winres/                    # Windows 리소스 빌드 설정 파일
```

---

## 🔑 AI 설정 및 API Key 구성

우측 상단의 **🤖 AI도우미** 패널을 통해 API Key 및 사용 모델을 구성한다.

1. **설정 화면 진입**: AI도우미 패널 내부 모델 선택 드롭다운 하단의 `⚙️ Model관리` 버튼을 클릭한다.
2. **API Key 입력**:
   - **Google API**: Gemini API Key 및 사용 모델 식별자(예: `gemini-2.5-flash-lite`, `gemini-2.5-flash`)를 입력한다.
   - **Groq API**: Groq API Key 및 사용 모델 식별자(예: `llama3-8b-8192`, `llama3-70b-8192`)를 입력한다.
3. **설정 저장**: `저장` 버튼을 클릭하면 로컬 저장소에 암호화되어 기록되며 즉시 적용된다.

---

## 🔒 보안 및 데이터 암호화

사용자의 API Key는 안전하게 보호되어 저장된다.

- **저장 경로**: `C:\Users\<사용자계정>\Documents\.apikeys.json`
- **암호화 방식**:
  - `pkg/crypto.go`에서 암호화 프로세스를 전담한다.
  - API Key 문자열은 **AES-256-GCM** 알고리즘으로 1차 암호화된다.
  - 암호화된 데이터는 Windows **DPAPI (Data Protection API - CryptProtectData)**를 통해 2차 암호화되어 저장된다.
  - Windows 사용자 로그인 세션 자격 증명과 연동되므로, 다른 PC나 타 사용자 계정에서는 복호화가 원천 차단된다.

---

## 🏗️ 개발 및 빌드 환경

### 사전 요구 사항
애플리케이션을 직접 컴파일하기 위해 다음 도구들을 사전에 구성해야 한다.

1. **Go 컴파일러** (Go 1.26 이상):
   - 공식 웹사이트([go.dev/dl](https://go.dev/dl/))에서 설치 프로그램을 내려받아 설치한다.
2. **go-winres 라이브러리**:
   - 실행 파일 아이콘 및 매니페스트 설정을 위해 필요하다. 터미널에서 아래 명령을 실행하여 설치한다.
     ```bash
     go install github.com/tc-hib/go-winres@latest
     ```

### 빌드 프로세스
프로젝트 루트에서 제공되는 [build_instruction.ps1](file:///c:/Users/sezzi/programming/StyledMD%20v2/build_instruction.ps1) 스크립트를 사용하여 컴파일한다.

1. **리소스 컴파일 및 기존 객체 제거**:
   ```powershell
   Remove-Item *.syso -ErrorAction SilentlyContinue
   go-winres make --arch amd64 --in winres\winres.json
   ```
2. **최종 바이너리 빌드 (GUI 모드 적용)**:
   ```powershell
   go build -ldflags="-H windowsgui" -o StyledMD.exe
   ```

자동화 빌드 스크립트를 즉시 실행하려면 아래 명령을 사용한다.
```powershell
.\build_instruction.ps1
```

---

## 💡 주요 기능 및 사용법

| 기능 분류 | 세부 기능 및 작동 방식 |
| :--- | :--- |
| **하이브리드 편집 및 실시간 미리보기** | Monaco Editor 기반 편집창과 Marked.js 기반 뷰어 분할 화면 지원. 툴바 우측의 `✍️`/`📖` 버튼으로 읽기 전용/편집 모드 전환 가능. |
| **다중 문서 링크 및 이동** | 마크다운 링크(`[링크텍스트](파일명.md)`) 클릭 시 해당 파일이 자동으로 생성 및 로드됨. '뒤로 가기' 버튼을 통해 이전 문서로 복귀 가능. |
| **AI 비서 및 컨텍스트 제공** | AI 프롬프트 입력창을 통해 요약, 번역, 문장 생성 수행. `UserInstructions.md` 파일을 통해 사용자 정의 시스템 프롬프트(System Prompt) 지정 지원. |
| **AI 결과 제어** | `📤 위로 복사해 넣기`로 에디터 커서 위치에 AI 출력 삽입. `📥 왼쪽으로 복사`로 AI 버퍼 내용을 임시 편집창으로 전송. |
| **마크다운 구문 확장** | 인라인 스타일 지정(`[텍스트]{color:색상 bg:배경색}`) 지원. Obsidian 스타일 콜아웃(`> [!NOTE]`, `> [!TIP]` 등) 및 고유 아이콘 렌더링 지원. |
| **데스크톱 UX 최적화** | 뷰 모드 전환 시 Win32 API를 사용해 창 너비를 자동 조절(640px / 1280px). 뷰어 스크롤 위치에 맞춰 에디터가 동기화되는 Scroll Sync 기능 탑재. 파일 이름 수정 시 즉각적인 로컬 디스크 파일명 변경 처리. |
| **AI 영단어 사전 (F1)** | 에디터 또는 뷰어에서 단어 선택 후 `F1` 키를 누르면 AI가 정의, 발음, 예문을 팝업 창으로 즉시 표시. |

---

## 📄 라이선스

### 본 프로젝트 라이선스
이 프로젝트는 **MIT License**에 따라 배포된다.

```text
Copyright (c) 2026 StyledMD Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### 오픈소스 고지 및 크레딧
이 애플리케이션은 아래의 외부 라이브러리를 포함하고 있다.

| 라이브러리 및 자산명 | 라이선스 | 목적 |
| :--- | :--- | :--- |
| **[Monaco Editor](https://github.com/microsoft/monaco-editor)** | MIT | 브라우저 기반 고기능 코드 에디터 엔진 |
| **[Marked.js](https://github.com/markedjs/marked)** | MIT | 마크다운 파서 및 HTML 컴파일러 |
| **[go-webview2](https://github.com/jchv/go-webview2)** | MIT | WebView2 구동을 위한 Go 언어 바인딩 |
| **[go-winloader](https://github.com/jchv/go-winloader)** | MIT | 웹뷰 로더 및 종속성 관리 모듈 |
| **[google-genai Go SDK](https://github.com/google/generative-ai-go)** | Apache 2.0 | Google Gemini API 클라이언트 연동 라이브러리 |
| **[openai-go](https://github.com/openai/openai-go)** | Apache 2.0 | Groq API 연동을 위한 OpenAI 호환 클라이언트 |
