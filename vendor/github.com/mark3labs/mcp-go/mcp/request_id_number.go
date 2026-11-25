package mcp

import (
	"encoding/json"
	"strconv"
	"strings"
)

// canonicalRequestNumber normalizes without expanding powers of ten.
func canonicalRequestNumber(value string) (string, string) {
	exponent := "0"
	if index := strings.IndexAny(value, "eE"); index >= 0 {
		exponent = normalizeDecimalInteger(value[index+1:])
		value = value[:index]
	}
	negative := strings.HasPrefix(value, "-")
	value = strings.TrimPrefix(value, "-")
	if index := strings.IndexByte(value, '.'); index >= 0 {
		exponent = addDecimalInteger(exponent, -int64(len(value)-index-1))
		value = value[:index] + value[index+1:]
	}
	value = strings.TrimLeft(value, "0")
	if value == "" {
		return "0", "0"
	}
	trimmed := strings.TrimRight(value, "0")
	exponent = addDecimalInteger(exponent, int64(len(value)-len(trimmed)))
	if negative {
		trimmed = "-" + trimmed
	}
	return trimmed, exponent
}

// normalizeDecimalInteger removes a sign and leading zeroes from a decimal integer.
func normalizeDecimalInteger(value string) string {
	negative := strings.HasPrefix(value, "-")
	value = strings.TrimLeft(strings.TrimPrefix(strings.TrimPrefix(value, "-"), "+"), "0")
	if value == "" {
		return "0"
	}
	if negative {
		return "-" + value
	}
	return value
}

// addDecimalInteger adds a small signed offset to an arbitrarily large decimal integer.
func addDecimalInteger(value string, offset int64) string {
	if offset == 0 {
		return value
	}
	valueNegative := strings.HasPrefix(value, "-")
	valueDigits := strings.TrimPrefix(value, "-")
	offsetNegative := offset < 0
	offsetDigits := strconv.FormatInt(offset, 10)
	offsetDigits = strings.TrimPrefix(offsetDigits, "-")

	var result string
	if valueNegative == offsetNegative {
		result = addDecimalMagnitudes(valueDigits, offsetDigits)
		if valueNegative {
			return "-" + result
		}
		return result
	}

	comparison := compareDecimalMagnitudes(valueDigits, offsetDigits)
	switch {
	case comparison == 0:
		return "0"
	case comparison > 0:
		result = subtractDecimalMagnitudes(valueDigits, offsetDigits)
		if valueNegative {
			return "-" + result
		}
		return result
	default:
		result = subtractDecimalMagnitudes(offsetDigits, valueDigits)
		if offsetNegative {
			return "-" + result
		}
		return result
	}
}

func compareDecimalMagnitudes(left, right string) int {
	if len(left) < len(right) {
		return -1
	}
	if len(left) > len(right) {
		return 1
	}
	return strings.Compare(left, right)
}

func addDecimalMagnitudes(left, right string) string {
	if len(left) < len(right) {
		left, right = right, left
	}
	result := []byte(left)
	carry := byte(0)
	for i := 0; i < len(left); i++ {
		sum := result[len(result)-1-i] - '0' + carry
		if i < len(right) {
			sum += right[len(right)-1-i] - '0'
		}
		result[len(result)-1-i] = '0' + sum%10
		carry = sum / 10
	}
	if carry != 0 {
		return string(append([]byte{'1'}, result...))
	}
	return string(result)
}

// subtractDecimalMagnitudes subtracts right from left, where left >= right.
func subtractDecimalMagnitudes(left, right string) string {
	result := []byte(left)
	borrow := byte(0)
	for i := 0; i < len(left); i++ {
		digit := result[len(result)-1-i] - '0'
		subtrahend := borrow
		if i < len(right) {
			subtrahend += right[len(right)-1-i] - '0'
		}
		if digit < subtrahend {
			digit += 10
			borrow = 1
		} else {
			borrow = 0
		}
		result[len(result)-1-i] = '0' + digit - subtrahend
	}
	return strings.TrimLeft(string(result), "0")
}

func integerRequestNumber(number json.Number) (any, bool) {
	coefficient, exponent := canonicalRequestNumber(number.String())
	if strings.HasPrefix(exponent, "-") {
		return nil, false
	}
	if value, err := strconv.ParseInt(exponent, 10, 64); err == nil && value <= 19 && int64(len(coefficient))+value <= 20 {
		integer, err := strconv.ParseInt(coefficient+strings.Repeat("0", int(value)), 10, 64)
		if err == nil {
			return integer, true
		}
	}
	return number, true
}

func requestNumberKey(number json.Number) string {
	if value, integer := integerRequestNumber(number); integer {
		if value, ok := value.(int64); ok {
			return "int64:" + strconv.FormatInt(value, 10)
		}
	}
	coefficient, exponent := canonicalRequestNumber(number.String())
	return "number:" + coefficient + "e" + exponent
}
