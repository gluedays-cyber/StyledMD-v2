package pkg

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
)

// HandleGroqChat: Groq API 스트리밍 처리를 수행한다.
func HandleGroqChat(w http.ResponseWriter, r *http.Request, flusher http.Flusher, config AIConfig, provider, targetModel, sysPrompt, userPrompt string) {
	ctx := context.Background()

	var apiKey string
	var baseURL string
	if provider == "groq" {
		var err error
		apiKey, err = Decrypt(config.Groq.APIKey)
		if err != nil {
			apiKey = ""
		}
		baseURL = "https://api.groq.com/openai/v1"
		if targetModel == "" {
			targetModel = "groq/compound-mini"
		}
	}

	if apiKey == "" {
		outData, _ := json.Marshal(map[string]interface{}{
			"response": fmt.Sprintf("❌ %s API 키가 설정되지 않았습니다. Model관리를 통해 설정하라.", provider),
			"done":     true,
		})
		fmt.Fprintf(w, "data: %s\n\n", outData)
		flusher.Flush()
		return
	}

	client := openai.NewClient(
		option.WithAPIKey(apiKey),
		option.WithBaseURL(baseURL),
	)

	messages := []openai.ChatCompletionMessageParamUnion{}
	if sysPrompt != "" {
		messages = append(messages, openai.SystemMessage(sysPrompt))
	}
	messages = append(messages, openai.UserMessage(userPrompt))

	params := openai.ChatCompletionNewParams{
		Model:    openai.ChatModel(targetModel),
		Messages: messages,
	}

	stream := client.Chat.Completions.NewStreaming(ctx, params)
	defer stream.Close()

	for stream.Next() {
		evt := stream.Current()
		if len(evt.Choices) > 0 {
			chunk := evt.Choices[0].Delta.Content
			if chunk != "" {
				outData, err := json.Marshal(map[string]interface{}{
					"thinking": "",
					"response": chunk,
					"done":     false,
				})
				if err == nil {
					fmt.Fprintf(w, "data: %s\n\n", outData)
					flusher.Flush()
				}
			}
		}
	}

	if err := stream.Err(); err != nil {
		fmt.Printf("❌ %s stream error: %v\n", provider, err)
		outData, _ := json.Marshal(map[string]interface{}{
			"response": "❌ 스트리밍 오류: " + err.Error(),
			"done":     true,
		})
		fmt.Fprintf(w, "data: %s\n\n", outData)
		flusher.Flush()
		return
	}

	doneData, _ := json.Marshal(map[string]interface{}{
		"thinking": "",
		"response": "",
		"done":     true,
	})
	fmt.Fprintf(w, "data: %s\n\n", doneData)
	flusher.Flush()
}
