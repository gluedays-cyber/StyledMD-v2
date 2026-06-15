package pkg

import (
	"os"
	"path/filepath"
)

/* ===========================================================
   사용자 지침 파일 읽어 들이기
   getUserInstructionsPath
===========================================================*/

func getUserInstructionsPath() string {
	const filename = "UserInstructions.md"

	if exePath, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exePath)
		path := filepath.Join(exeDir, filename)
		if _, err := os.Stat(path); err == nil {
			return path
		}
		path = filepath.Join(exeDir, "StyledMD", filename)
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}

	if wd, err := os.Getwd(); err == nil {
		path := filepath.Join(wd, filename)
		if _, err := os.Stat(path); err == nil {
			return path
		}
		path = filepath.Join(wd, "StyledMD", filename)
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}

	if exePath, err := os.Executable(); err == nil {
		return filepath.Join(filepath.Dir(exePath), filename)
	}
	return filename
}
