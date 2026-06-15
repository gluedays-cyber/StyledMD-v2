package pkg

import (
	"encoding/json"
	"net/http"
	"os"

	"fmt"

	"strings"
)

func AIChatHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Prompt          string `json:"prompt"`
		FullContent     string `json:"fullContent"`
		SelectedContent string `json:"selectedContent"`
		CurrentAnswer   string `json:"currentAnswer"`
		Model           string `json:"model"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "❌ JSON 디코딩 실패", http.StatusBadRequest)
		return
	}

	var sysPrompt string
	fixedPromptPath := getUserInstructionsPath()
	content, err := os.ReadFile(fixedPromptPath)
	if err == nil {
		sysPrompt = string(content)
	} else {
		sysPrompt = "답변 말투는 '이다. 한다.'로 한다. 질문에 답변만 하고, 사용자에게 질문을 하지 않는다."
	}

	var userPrompt string
	if req.SelectedContent != "" {
		userPrompt = fmt.Sprintf(`
		선택된 텍스트: "%s"
		이전 답변 내용: "%s"
		사용자 요청사항: "%s"

		[필수 형식 규격]
		- 어떠한 부연 설명이나 소개말, 혹은 마크다운 백틱 및 문장 부호(마침표 등)도 붙이지 않는다.
		- 사용자 요청사항을 반영하여 "선택된 텍스트"를 직접 치환할 수 있는 최종 결과물(단어 또는 수정된 최소 구절)만을 반환한다.
		`, req.SelectedContent, req.CurrentAnswer, req.Prompt)
	} else {
		userPrompt = fmt.Sprintf("Below is the user request, the content of the text editor, and the current state of the response.\n\n<user_request>\n%s\n</user_request>\n\n<editor_content>\n%s\n</editor_content>\n\n<current_response>\n%s\n</current_response>", req.Prompt, req.FullContent, req.CurrentAnswer)
	}

	// ================================================================================
	// Parse model option: "provider|model_name"
	// ================================================================================
	parts := strings.SplitN(req.Model, "|", 2)
	provider := "google"
	targetModel := req.Model
	if len(parts) == 2 {
		provider = parts[0]
		targetModel = parts[1]
	}





	config, err := loadAIConfigFromFile()
	if err != nil {
		jsonError(w, "❌ 설정을 로드할 수 없습니다.", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		fmt.Println("❌ 스트리밍을 지원하지 않는 클라이언트")
		return
	}

	// ================================================================================
	// 1. Google API Handler
	// ================================================================================
	if provider == "google" {
		HandleGoogleChat(w, r, flusher, config, targetModel, sysPrompt, userPrompt)
		return
	}



	// ================================================================================
	// 3. Groq API Handler (OpenAI-compatible)
	// ================================================================================
	HandleGroqChat(w, r, flusher, config, provider, targetModel, sysPrompt, userPrompt)
}

func AIPromptStatusHandler(w http.ResponseWriter, r *http.Request) {
	fixedPromptPath := getUserInstructionsPath()
	_, err := os.Stat(fixedPromptPath)
	missing := os.IsNotExist(err)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"missing": missing})
}


