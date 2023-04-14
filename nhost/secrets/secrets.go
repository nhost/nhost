package secrets

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/cli/util"
)

func ParseFile(path string) (model.Secrets, error) {
	if !util.PathExists(path) {
		return model.Secrets{}, nil
	}

	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("can't read secrets file '%s' %v", path, err)
	}
	defer f.Close()

	return Parse(f)
}

func Parse(r io.Reader) (model.Secrets, error) {
	secrets := model.Secrets{}

	scanner := bufio.NewScanner(r)
	scanner.Split(bufio.ScanLines)

	i := 1
	for scanner.Scan() {
		line := scanner.Text()
		line = strings.Split(line, "#")[0]
		line = strings.TrimSpace(line)

		if line == "" {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid secret on line %d: %s", i, line)
		}

		secrets = append(
			secrets,
			&model.ConfigEnvironmentVariable{
				Name:  strings.TrimSpace(parts[0]),
				Value: strings.TrimSpace(parts[1]),
			},
		)
		i++
	}

	return secrets, nil
}
