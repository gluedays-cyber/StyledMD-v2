package pkg

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"syscall"
	"unsafe"

	"github.com/jchv/go-webview2"
)

var (
	TargetFile    string
	BaseDir       string
	Wv            webview2.WebView
)

type DocData struct {
	Content  string `json:"content"`
	FileName string `json:"filename"`
}

func LoadHandler(w http.ResponseWriter, r *http.Request) {
	reqPath := r.URL.Query().Get("path")
	if reqPath == "" {
		reqPath = TargetFile
	} else {
		reqPath = filepath.Clean(reqPath)
	}

	if reqPath == "" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(DocData{
			Content:  "",
			FileName: "Untitled.md",
		})
		return
	}

	content, err := os.ReadFile(reqPath)
	if err != nil {
		http.Error(w, "파일을 읽을 수 없습니다", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(DocData{
		Content:  string(content),
		FileName: filepath.Base(reqPath),
	})
}

func SaveHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "잘못된 요청", http.StatusBadRequest)
		return
	}

	savePath := filepath.Clean(req.Path)
	if savePath == "" || savePath == "." || savePath == "/" || savePath == "\\" {
		w.WriteHeader(http.StatusOK)
		return
	}
	os.WriteFile(savePath, []byte(req.Content), 0644)
	w.WriteHeader(http.StatusOK)
}

type RECT struct {
	Left, Top, Right, Bottom int32
}

type MONITORINFO struct {
	CbSize    uint32
	RcMonitor RECT
	RcWork    RECT
	DwFlags   uint32
}

func resizeWindowOnScreen(width, height int) {
	hwnd := Wv.Window()
	if hwnd == nil {
		return
	}

	user32 := syscall.NewLazyDLL("user32.dll")
	getWindowRect := user32.NewProc("GetWindowRect")
	setWindowPos := user32.NewProc("SetWindowPos")
	monitorFromWindow := user32.NewProc("MonitorFromWindow")
	getMonitorInfoW := user32.NewProc("GetMonitorInfoW")

	var rect RECT
	getWindowRect.Call(uintptr(hwnd), uintptr(unsafe.Pointer(&rect)))

	// MONITOR_DEFAULTTONEAREST = 2
	hMonitor, _, _ := monitorFromWindow.Call(uintptr(hwnd), 2)

	var monitorInfo MONITORINFO
	monitorInfo.CbSize = uint32(unsafe.Sizeof(monitorInfo))
	getMonitorInfoW.Call(hMonitor, uintptr(unsafe.Pointer(&monitorInfo)))

	workArea := monitorInfo.RcWork
	newWidth := int32(width)
	newHeight := int32(height)

	newLeft := rect.Left
	newTop := rect.Top

	// 읽기 모드(가로 640)로 전환 시 화면 우측 상단 초기 위치로 정렬
	if newWidth == 640 {
		newLeft = workArea.Right - newWidth + 7
		newTop = workArea.Top
	} else {
		// 우측 화면 경계를 벗어날 경우 좌측으로 이동 (투명 그림자 테두리 7px 보정)
		if newLeft+newWidth > workArea.Right + 7 {
			newLeft = workArea.Right - newWidth + 7
		}
		if newLeft < workArea.Left {
			newLeft = workArea.Left
		}

		// 하단 화면 경계를 벗어날 경우 상단으로 이동
		if newTop+newHeight > workArea.Bottom {
			newTop = workArea.Bottom - newHeight
		}
		if newTop < workArea.Top {
			newTop = workArea.Top
		}
	}

	// SWP_NOZORDER = 0x0004, SWP_NOACTIVATE = 0x0010
	setWindowPos.Call(
		uintptr(hwnd),
		0,
		uintptr(newLeft),
		uintptr(newTop),
		uintptr(newWidth),
		uintptr(newHeight),
		0x0004|0x0010,
	)
}

func ResizeHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Width  int `json:"width"`
		Height int `json:"height"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "잘못된 요청", http.StatusBadRequest)
		return
	}

	if Wv != nil {
		Wv.Dispatch(func() {
			resizeWindowOnScreen(req.Width, req.Height)
		})
	}
	w.WriteHeader(http.StatusOK)
}
