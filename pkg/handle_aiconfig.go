package pkg

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
)



/* ===========================================================
   API Key 파일 읽어 들이기
   getAIConfigPath
   loadAIConfigFromFile
   getAIConfigHandler
   saveAIConfigHandler
   deleteAIConfigHandler
   jsonError
===========================================================*/
func getAIConfigPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	// Save to user folder/Documents/.apikeys.json
	return filepath.Join(home, "Documents", ".apikeys.json"), nil
}

type CustomModel struct {
	Name  string `json:"name"`
	Alias string `json:"alias"`
}

type APIProvider struct {
	APIKey string        `json:"apiKey"`
	Models []CustomModel `json:"models"`
}

type AIConfig struct {
	Google  APIProvider `json:"google"`
	Groq    APIProvider `json:"groq"`
}

func loadAIConfigFromFile() (AIConfig, error) {
	var config AIConfig
	configPath, err := getAIConfigPath()
	if err != nil {
		return config, err
	}
	if _, err := os.Stat(configPath); err == nil {
		data, err := os.ReadFile(configPath)
		if err == nil {
			json.Unmarshal(data, &config)
		}
	}
	return config, nil
}

func GetAIConfigHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")

	config, err := loadAIConfigFromFile()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Decrypt API keys before sending to UI setup fields
	if config.Google.APIKey != "" {
		if dec, err := Decrypt(config.Google.APIKey); err == nil {
			config.Google.APIKey = dec
		}
	}
	if config.Groq.APIKey != "" {
		if dec, err := Decrypt(config.Groq.APIKey); err == nil {
			config.Groq.APIKey = dec
		}
	}


	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

func SaveAIConfigHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var config AIConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	// Encrypt keys
	if config.Google.APIKey != "" {
		if enc, err := Encrypt(config.Google.APIKey); err == nil {
			config.Google.APIKey = enc
		}
	}
	if config.Groq.APIKey != "" {
		if enc, err := Encrypt(config.Groq.APIKey); err == nil {
			config.Groq.APIKey = enc
		}
	}


	configPath, err := getAIConfigPath()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Ensure Documents directory exists (in case it doesn't)
	dir := filepath.Dir(configPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := os.WriteFile(configPath, data, 0644); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func DeleteAIConfigHandler(w http.ResponseWriter, r *http.Request) {
	// Not used anymore as per request, return 405 Method Not Allowed
	http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"answer": msg})
}
