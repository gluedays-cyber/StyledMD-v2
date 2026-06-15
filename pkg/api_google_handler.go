package pkg

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"google.golang.org/genai"
)

// HandleGoogleChat: Google Gemini API 스트리밍 처리를 수행한다.
func HandleGoogleChat(w http.ResponseWriter, r *http.Request, flusher http.Flusher, config AIConfig, targetModel, sysPrompt, userPrompt string) {
	ctx := context.Background()

	apiKey, err := Decrypt(config.Google.APIKey)
	if err != nil || apiKey == "" {
		outData, _ := json.Marshal(map[string]interface{}{
			"response": "❌ Google API 키가 설정되지 않았습니다. Model관리를 통해 설정하라.",
			"done":     true,
		})
		fmt.Fprintf(w, "data: %s\n\n", outData)
		flusher.Flush()
		return
	}

	if targetModel == "" {
		targetModel = "gemini-2.5-flash-lite"
	}

	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  apiKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		fmt.Println("❌ Gemini 클라이언트 생성 실패:", err)
		outData, _ := json.Marshal(map[string]interface{}{
			"response": "❌ Gemini 클라이언트 초기화 실패: " + err.Error(),
			"done":     true,
		})
		fmt.Fprintf(w, "data: %s\n\n", outData)
		flusher.Flush()
		return
	}

	todayStr := time.Now().Format("2006년 01월 02일")
	dynamicSysPrompt := fmt.Sprintf("%s\n오늘 날짜는 %s입니다. 최신 정보는 구글 검색을 활용하세요.", sysPrompt, todayStr)

	genConfig := &genai.GenerateContentConfig{
		Temperature: genai.Ptr[float32](0.2),
		Tools: []*genai.Tool{
			{GoogleSearch: &genai.GoogleSearch{}},
		},
	}

	if strings.TrimSpace(dynamicSysPrompt) != "" {
		genConfig.SystemInstruction = &genai.Content{
			Parts: genai.Text(dynamicSysPrompt)[0].Parts,
			Role:  "system",
		}
	}

	iter := client.Models.GenerateContentStream(
		ctx,
		targetModel,
		genai.Text(userPrompt),
		genConfig,
	)

	for result, err := range iter {
		if err != nil {
			fmt.Println("❌ Gemini 스트림 오류:", err)
			outData, _ := json.Marshal(map[string]interface{}{
				"response": "❌ 스트리밍 오류: " + err.Error(),
				"done":     true,
			})
			fmt.Fprintf(w, "data: %s\n\n", outData)
			flusher.Flush()
			return
		}

		thinkingText := ""
		responseText := ""
		if result != nil && len(result.Candidates) > 0 {
			c := result.Candidates[0]
			if c.Content != nil {
				for _, part := range c.Content.Parts {
					if part.Thought {
						thinkingText += part.Text
					} else if part.Text != "" {
						responseText += part.Text
					}
				}
			}
		}

		outData, err2 := json.Marshal(map[string]interface{}{
			"thinking": thinkingText,
			"response": responseText,
			"done":     false,
			"search":   true,
		})
		if err2 != nil {
			break
		}
		fmt.Fprintf(w, "data: %s\n\n", outData)
		flusher.Flush()
	}

	doneData, _ := json.Marshal(map[string]interface{}{
		"thinking": "",
		"response": "",
		"done":     true,
	})
	fmt.Fprintf(w, "data: %s\n\n", doneData)
	flusher.Flush()
}
