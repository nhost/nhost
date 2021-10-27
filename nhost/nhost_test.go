package nhost

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"reflect"
	"testing"
)

func TestSearchRelease(t *testing.T) {

	//	Initialize list of releases
	releases, _ := GetReleases()

	//	Load the dump.json to retrieve the release we want
	var want Release
	data, _ := ioutil.ReadFile("dump.json")
	json.Unmarshal(data, &want)

	fmt.Println("Release we want", want.TagName)

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
		{
			name: "default latest public release",
			args: args{
				releases: releases,
				version:  "",
			},
			want:    want,
			wantErr: false,
		},
		{
			name: "backdated public release",
			args: args{
				releases: releases,
				version:  "v0.5.4",
			},
			wantErr: false,
		},
		{
			name: "faulty release input",
			args: args{
				releases: releases,
				version:  "056",
			},
			wantErr: true,
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
