package nhost

import (
	"reflect"
	"testing"
)

func TestSearchRelease(t *testing.T) {

	//	Initialize list of releases
	var releases []Release

	type args struct {
		releases []Release
		version  string
	}
	tests := []struct {
		name    string
		args    args
		want    Release
		wantErr bool
	}{
		struct {
			name    string
			args    args
			want    Release
			wantErr bool
		}{
			name: "default latest public release",
			args: args{
				releases: releases,
				version:  "",
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := SearchRelease(tt.args.releases, tt.args.version)
			if (err != nil) != tt.wantErr {
				t.Errorf("SearchRelease() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("SearchRelease() = %v, want %v", got, tt.want)
			}
		})
	}
}
