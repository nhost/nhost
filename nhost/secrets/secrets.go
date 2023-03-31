package secrets

import (
	"bufio"
	"bytes"
	"fmt"
	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/util"
	"os"
	"strings"
)

func ParseSecrets(path string) (model.Secrets, error) {
	secrets := model.Secrets{}

	if !util.PathExists(path) {
		return secrets, nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("can't read secrets file '%s' %v", path, err)
	}

	data = bytes.TrimSpace(data)
	if len(data) == 0 {
		return secrets, nil
	}

	scanner := bufio.NewScanner(bytes.NewReader(data))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid secret: %s", line)
		}

		secrets = append(secrets, &model.ConfigEnvironmentVariable{Name: strings.TrimSpace(parts[0]), Value: strings.TrimSpace(parts[1])})
	}

	return secrets, nil
}
