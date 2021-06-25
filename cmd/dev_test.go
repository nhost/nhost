/*
MIT License

Copyright (c) Nhost

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
package cmd

import (
	"testing"

	"github.com/spf13/cobra"
)

var (
	testCmd cobra.Command
	// testClient, _ = client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
)

func Benchmark_execute(b *testing.B) {
	type args struct {
		cmd  *cobra.Command
		args []string
	}
	tests := []struct {
		name string
		args args
	}{
		{
			name: "first",
			args: args{
				cmd:  &testCmd,
				args: []string{},
			},
		},
	}
	for _, tt := range tests {
		b.Run(tt.name, func(b *testing.B) {
			execute(tt.args.cmd, tt.args.args)
		})
	}
}

func Test_getContainerName(t *testing.T) {
	type args struct {
		name string
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		{
			name: "first",
			args: args{
				name: "api",
			},
			want: "test_api",
		},
		{
			name: "second",
			args: args{
				name: "hasura",
			},
			want: "test_hasura",
		},
		{
			name: "third",
			args: args{
				name: "minio",
			},
			want: "test_minio",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := getContainerName(tt.args.name); got != tt.want {
				t.Errorf("getContainerName() = %v, want %v", got, tt.want)
			}
		})
	}
}
