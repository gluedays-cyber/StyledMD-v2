package main

import (
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"styledmd/pkg"
	"syscall"
	"unsafe"

	"github.com/jchv/go-webview2"
)

// 전역 변수 선언
var baseDir string    // 애플리케이션의 기본 디렉토리를 저장한다.
var targetFile string // 사용자에게 선택된 파일 경로를 저장한다.
var wv webview2.WebView


// 초기화 함수
func init() {
	// 실행 파일의 경로를 가져온다.
	exePath, _ := os.Executable()
	// 실행 파일이 위치한 디렉토리를 baseDir로 설정한다.
	baseDir = filepath.Dir(exePath)
	pkg.BaseDir = baseDir

	// 명령줄 인수가 제공되었는지 확인한다.
	if len(os.Args) > 1 {
		// 두 번째 인수를 절대 경로로 변환하여 targetFile로 설정한다.
		absPath, err := filepath.Abs(os.Args[1])
		if err == nil {
			targetFile = absPath
		} else {
			targetFile = os.Args[1] // 오류 발생 시 인수를 그대로 사용한다.
		}
	} else {
		// 명령줄 인수가 없으면 빈 문자열로 설정하여 빈 페이지로 시작한다.
		targetFile = ""
	}
	pkg.TargetFile = targetFile
}

// 메인 함수
func main() {
	// HTTP 핸들러 설정: 웹 서버 기능을 구현한다.
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// 특정 경로(`/ .app/`)에 대한 요청 처리
		if strings.HasPrefix(r.URL.Path, "/.app/") {
			// `.app/` 경로의 요청에 대해 캐시를 비활성화하여 파일 직접 접근을 막는다.
			relPath := strings.TrimPrefix(r.URL.Path, "/.app/")
			w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
			w.Header().Set("Pragma", "no-cache")
			w.Header().Set("Expires", "0")
			// 실제 파일 내용을 서빙한다.
			http.ServeFile(w, r, filepath.Join(baseDir, "StyledMD", relPath))
			return
		}

		// `/local/` 경로에 대한 요청 처리 (로컬 파일 및 에셋 로드)
		if strings.HasPrefix(r.URL.Path, "/local/") {
			// `/local/` 경로의 나머지 부분을 추출한다.
			localPath := strings.TrimPrefix(r.URL.Path, "/local/")
			// URL 인코딩된 경로를 디코딩한다.
			decodedPath, err := url.PathUnescape(localPath)
			if err == nil {
				localPath = decodedPath
			}
			// 경로 구분자를 OS에 맞게 변환한다.
			physicalPath := filepath.FromSlash(localPath)

			// 경로가 비어있거나 .md 파일인 경우 index.html을 서빙
			if physicalPath == "" || (strings.HasSuffix(physicalPath, ".md") && strings.Contains(r.Header.Get("Accept"), "text/html")) {
				// 인덱스 파일을 서빙하여 에디터의 기본 HTML을 제공한다.
				w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
				w.Header().Set("Pragma", "no-cache")
				w.Header().Set("Expires", "0")
				http.ServeFile(w, r, filepath.Join(baseDir, "StyledMD", "index.html"))
				return
			}

			// md 파일이 아닌 일반 정적 에셋의 경우, 물리적 경로 그대로 서빙하여 상대 경로 로딩을 지원한다.
			if info, err := os.Stat(physicalPath); err == nil && !info.IsDir() {
				http.ServeFile(w, r, physicalPath)
				return
			}
			// 파일이 존재하지 않으면 404 에러를 반환한다.
			serve404(w, r)
			return
		}
		// 위 조건에 해당하지 않는 모든 요청은 404 에러를 반환한다.
		serve404(w, r)
	})

	// API 엔드포인트 핸들러 등록
	http.HandleFunc("/api/load", pkg.LoadHandler)
	http.HandleFunc("/api/save", pkg.SaveHandler)
	http.HandleFunc("/api/open-dialog", pkg.OpenFileDialogHandler)
	http.HandleFunc("/api/save-dialog", pkg.SaveFileDialogHandler)
	http.HandleFunc("/api/rename", pkg.RenameHandler)
	http.HandleFunc("/api/resize", pkg.ResizeHandler)

	http.HandleFunc("/api/ai-chat", pkg.AIChatHandler)
	http.HandleFunc("/api/chat", pkg.AIChatHandler)
	http.HandleFunc("/api/ai-prompt-status", pkg.AIPromptStatusHandler)

	http.HandleFunc("/api/ai-config", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			pkg.GetAIConfigHandler(w, r)
		case http.MethodPost:
			pkg.SaveAIConfigHandler(w, r)
		case http.MethodDelete:
			pkg.DeleteAIConfigHandler(w, r)
		default:
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		}
	})

	// HTTP 서버를 위한 리스너 설정 (포트 0을 사용하여 시스템이 사용 가능한 포트를 할당하게 한다.)
	listener, _ := net.Listen("tcp", "127.0.0.1:0")
	port := listener.Addr().(*net.TCPAddr).Port // 할당된 포트를 가져온다.
	baseURL := fmt.Sprintf("http://127.0.0.1:%d", port)

	// HTTP 서버를 백그라운드 고루틴에서 실행한다.
	go func() {
		fmt.Printf("SERVER_PORT: %d\n", port)
		_ = http.Serve(listener, nil)
	}()

	// Webview2 창을 초기화한다.
	// 로딩 단계에서 노출되는 덜컥거림을 원천 차단하기 위해 Hidden 속성을 true로 설정한다.
	w := webview2.NewWithOptions(webview2.WebViewOptions{
		Debug:     true,
		AutoFocus: true,
		WindowOptions: webview2.WindowOptions{
			Title:  "StyledMD - MD Editor & AIWriter",
			Width:  640,
			Height: 960,
			Hidden: true,
		},
	})
	wv = w
	pkg.Wv = w
	defer w.Destroy() // 함수 종료 시 창을 정리한다.

	hwnd := w.Window() // 창 핸들(HWND)을 가져온다.
	if hwnd != nil {
		user32 := syscall.NewLazyDLL("user32.dll")
		// 데스크탑 화면의 작업 영역(Work Area) 기준 우측 상단 정렬
		monitorFromWindow := user32.NewProc("MonitorFromWindow")
		getMonitorInfoW := user32.NewProc("GetMonitorInfoW")
		setWindowPos := user32.NewProc("SetWindowPos")

		// MONITOR_DEFAULTTOPRIMARY = 1
		hMonitor, _, _ := monitorFromWindow.Call(uintptr(hwnd), 1)

		var monitorInfo pkg.MONITORINFO
		monitorInfo.CbSize = uint32(unsafe.Sizeof(monitorInfo))
		getMonitorInfoW.Call(hMonitor, uintptr(unsafe.Pointer(&monitorInfo)))

		workArea := monitorInfo.RcWork
		width := int32(640)
		height := int32(960)

		// Windows 10/11의 투명 그림자 테두리(7px)를 보정하여 화면 우측 가장자리에 완전히 밀착시킨다.
		const borderOffset = 7
		newLeft := workArea.Right - width + borderOffset
		newTop := workArea.Top

		// 2. 보이지 않는 상태에서 크기와 위치를 정밀하게 설정한다. (SWP_NOZORDER = 0x0004)
		setWindowPos.Call(
			uintptr(hwnd),
			0,
			uintptr(newLeft),
			uintptr(newTop),
			uintptr(width),
			uintptr(height),
			0x0004,
		)

		// 3. 배치가 완전히 끝난 시점에 비로소 창과 브라우저 컴포넌트를 화면에 표시한다.
		w.Show()

		kernel32 := syscall.NewLazyDLL("kernel32.dll")
		getModuleHandle := kernel32.NewProc("GetModuleHandleW")
		hInst, _, _ := getModuleHandle.Call(0) // 현재 모듈 핸들을 가져온다.

		loadImage := user32.NewProc("LoadImageW")
		// 아이콘 리소스를 로드한다. (기본 아이콘 사용)
		hIcon, _, _ := loadImage.Call(
			hInst,
			uintptr(1),            // MAKEINTRESOURCE(1) - 아이콘 리소스 ID
			1,                     // IMAGE_ICON 플래그
			0,                     // cx
			0,                     // cy
			0x00008000|0x00000040, // LR_SHARED | LR_DEFAULTSIZE (공유 및 기본 크기)
		)
		if hIcon != 0 {
			// 창에 아이콘을 설정하는 메시지를 보낸다.
			sendMessage := user32.NewProc("SendMessageW")
			sendMessage.Call(uintptr(hwnd), 0x0080, 0, hIcon) // WM_SETICON, ICON_SMALL (작은 아이콘)
			sendMessage.Call(uintptr(hwnd), 0x0080, 1, hIcon) // WM_SETICON, ICON_BIG (큰 아이콘)
		}
	}

	// 웹뷰에 로드할 초기 URL을 설정한다.
	var startURL string
	if targetFile == "" {
		startURL = fmt.Sprintf("%s/local/", baseURL)
	} else {
		startURL = fmt.Sprintf("%s/local/%s", baseURL, filepath.ToSlash(targetFile))
	}
	w.Navigate(startURL) // 웹뷰를 해당 URL로 이동시킨다.
	w.Run()              // 웹뷰 이벤트 루프를 시작하여 프로그램을 실행 상태로 유지한다.
}

func serve404(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusNotFound)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>404 Not Found</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f8f5ed;
            color: #242424;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
        }
        h1 {
            font-size: 48px;
            margin-bottom: 8px;
            color: #d9383a;
        }
        p {
            font-size: 16px;
            margin-bottom: 24px;
            color: #666;
        }
        button {
            padding: 10px 20px;
            font-size: 14px;
            font-weight: bold;
            color: #fff;
            background-color: #0070c9;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        button:hover {
            background-color: #147bcd;
        }
    </style>
</head>
<body>
    <h1>404</h1>
    <p>요청하신 파일을 찾을 수 없습니다.</p>
    <button onclick="history.back()">뒤로 가기</button>
</body>
</html>`))
}
