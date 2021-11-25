package tests

import (
	"testing"

	"github.com/spf13/cobra"
)

func Test_DevCmd(t *testing.T) {

	// Don't open browser windows
	devCmd.Flag("no-browser").Value.Set("true")

	tests := []struct {
		name string
		want *cobra.Command
	}{
		{
			name: "vanilla",
			want: devCmd,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			devCmd.Execute()

			/* 			if got := NewDevCmd(); !reflect.DeepEqual(got, tt.want) {
			   				t.Errorf("NewDevCmd() = %v, want %v", got, tt.want)
			   			}
			*/
		})
	}
}
