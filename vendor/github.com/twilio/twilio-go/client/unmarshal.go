package client

import (
	"fmt"
	"strconv"
)

func UnmarshalFloat32(input *interface{}) (*float32, error) {
	if input == nil {
		return nil, nil
	}

	switch value := (*input).(type) {
	case float32:
		return &value, nil
	case float64:
		value32 := float32(value)
		return &value32, nil
	case int:
		value32 := float32(value)
		return &value32, nil
	case string:
		parsed, err := strconv.ParseFloat(value, 32)
		if err != nil {
			return nil, err
		}
		value32 := float32(parsed)
		return &value32, nil
	default:
		return nil, fmt.Errorf("unhandled input type for float32: %T %#v", value, value)
	}
}
