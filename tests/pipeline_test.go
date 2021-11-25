package tests

import (
	"testing"
)

func Test_Pipeline(t *testing.T) {

	tests := tests{
		newLocalAppTest,
		firstRunDevTest,
	}

	run(tests, t)
}
