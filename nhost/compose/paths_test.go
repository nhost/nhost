package compose

import (
	"github.com/stretchr/testify/assert"
	"testing"
)

func Test_dataDirGitBranchScopedPath(t *testing.T) {
	type args struct {
		gitBranch string
		path      string
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		{
			name: "test",
			args: args{
				gitBranch: "feat/foo",
				path:      "bar",
			},
			want: "data/feat/foo/bar",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equalf(t, tt.want, dataDirGitBranchScopedPath(tt.args.gitBranch, tt.args.path), "dataDirGitBranchScopedPath(%v, %v)", tt.args.gitBranch, tt.args.path)
		})
	}
}

func TestMinioDataDirGitBranchScopedPath(t *testing.T) {
	type args struct {
		gitBranch string
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		{
			name: "test",
			args: args{
				gitBranch: "feat/foo",
			},
			want: "data/feat/foo/minio",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equalf(t, tt.want, MinioDataDirGitBranchScopedPath(tt.args.gitBranch), "MinioDataDirGitBranchScopedPath(%v)", tt.args.gitBranch)
		})
	}
}

func TestMailHogDataDirGiBranchScopedPath(t *testing.T) {
	type args struct {
		gitBranch string
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		{
			name: "test",
			args: args{
				gitBranch: "feat/foo",
			},
			want: "data/feat/foo/mailhog",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equalf(t, tt.want, MailHogDataDirGiBranchScopedPath(tt.args.gitBranch), "MailHogDataDirGiBranchScopedPath(%v)", tt.args.gitBranch)
		})
	}
}

func TestDbDataDirGitBranchScopedPath(t *testing.T) {
	type args struct {
		gitBranch string
		path      string
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		{
			name: "test",
			args: args{
				gitBranch: "feat/foo",
				path:      "bar",
			},
			want: "data/feat/foo/db/bar",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equalf(t, tt.want, DbDataDirGitBranchScopedPath(tt.args.gitBranch, tt.args.path), "DbDataDirGitBranchScopedPath(%v, %v)", tt.args.gitBranch, tt.args.path)
		})
	}
}
