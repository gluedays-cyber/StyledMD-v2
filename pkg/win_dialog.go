package pkg

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

func OpenFileDialogHandler(w http.ResponseWriter, r *http.Request) {
	currentPath := r.URL.Query().Get("currentPath")
	initialDirCmd := ""
	if currentPath != "" {
		dir := filepath.Dir(filepath.Clean(currentPath))
		escapedDir := strings.ReplaceAll(dir, "'", "''")
		initialDirCmd = fmt.Sprintf(`$f.InitialDirectory = '%s'; `, escapedDir)
	}

	psCommand := fmt.Sprintf(
		`[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; %s$f.Filter = 'Markdown Files (*.md)|*.md|All Files (*.*)|*.*'; if($f.ShowDialog() -eq 'OK'){Write-Host -NoNewline $f.FileName}`,
		initialDirCmd,
	)

	cmd := exec.Command("powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", psCommand)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	output, err := cmd.Output()
	if err != nil {
		http.Error(w, "파일 열기 창을 실행할 수 없습니다", http.StatusInternalServerError)
		return
	}

	filePath := string(output)
	if filePath == "" {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"path": filePath})
}

func RenameHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		OldPath string `json:"oldPath"`
		NewName string `json:"newName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "잘못된 요청", http.StatusBadRequest)
		return
	}

	oldPath := filepath.Clean(req.OldPath)
	dir := filepath.Dir(oldPath)

	newName := req.NewName
	if !strings.HasSuffix(strings.ToLower(newName), ".md") {
		newName += ".md"
	}
	newPath := filepath.Join(dir, newName)

	if _, err := os.Stat(oldPath); os.IsNotExist(err) {
		http.Error(w, "원본 파일이 존재하지 않습니다", http.StatusNotFound)
		return
	}

	if err := os.Rename(oldPath, newPath); err != nil {
		http.Error(w, "파일명 변경 실패: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"newPath": newPath})
}

func SaveFileDialogHandler(w http.ResponseWriter, r *http.Request) {
	currentPath := r.URL.Query().Get("currentPath")
	initialDirCmd := ""
	if currentPath != "" {
		dir := filepath.Dir(filepath.Clean(currentPath))
		escapedDir := strings.ReplaceAll(dir, "'", "''")
		initialDirCmd = fmt.Sprintf(`$f.InitialDirectory = '%s'; `, escapedDir)
	}

	psCommand := fmt.Sprintf(
		`[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.SaveFileDialog; %s$f.Filter = 'Markdown Files (*.md)|*.md'; $f.DefaultExt = 'md'; $f.AddExtension = $true; if($f.ShowDialog() -eq 'OK'){Write-Host -NoNewline $f.FileName}`,
		initialDirCmd,
	)

	cmd := exec.Command("powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", psCommand)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	output, err := cmd.Output()
	if err != nil {
		http.Error(w, "파일 저장 창을 실행할 수 없습니다", http.StatusInternalServerError)
		return
	}

	filePath := string(output)
	if filePath == "" {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	// 파일이 존재하지 않는 경우에만 빈 파일 생성
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		if err := os.WriteFile(filePath, []byte(""), 0644); err != nil {
			http.Error(w, "파일을 생성할 수 없습니다", http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"path": filePath})
}

