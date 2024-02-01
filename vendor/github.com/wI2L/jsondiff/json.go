package jsondiff

// findKey finds and return the object value that match key.
// It assumes to be on an opening curly bracket.
// The function expects a compact JSON input.
func findKey(json string, key string) string {
	for i := 1; i < len(json); {
		ki := i
		i = squashString(json, i)
		k := json[ki+1 : i-1]
		i++ // skip semicolon
		vi := i
		i = squashValue(json, i)
		if key == k {
			return json[vi:i]
		}
		i++ // skip comma
	}
	return ""
}

// findIndex finds and return the array value at the given index.
// It assumes to be on opening square bracket.
// The function expects a compact JSON input.
func findIndex(json string, idx int) string {
	for i, j := 1, 0; i < len(json); {
		vi := i
		i = squashValue(json, i)
		if j == idx {
			return json[vi:i]
		}
		i++ // skip comma
		j++ // next elem index
	}
	return ""
}

func squashValue(json string, i int) int {
	switch json[i] {
	case 't', 'n': // true, null
		i += 4
	case 'f': // false
		i += 5
	case '"': // string
		i = squashString(json, i)
	case '-', '+', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9': // number
		i = squashNumber(json, i)
	case '[', '{': // array, object
		i = squashObjectOrArray(json, i)
	}
	return i
}

// squashNumber reads b until it encounter a character
// than can follow a properly formatted number.
func squashNumber(json string, i int) int {
	i++
	for ; i < len(json); i++ {
		if json[i] <= ' ' || json[i] == ',' || json[i] == ']' || json[i] == '}' {
			break
		}
	}
	return i
}

// squashString reads b until it encounter a non-escaped
// double quote, which indicate the sep of the string.
func squashString(json string, i int) int {
	i++ // assume to be on opening quote
	for ; i < len(json); i++ {
		if json[i] == '"' && json[i-1] != '\\' {
			break
		}
	}
	i++ // move to closing quote
	return i
}

// note: taken from https://github.com/tidwall/gjson
func squashObjectOrArray(json string, i int) int {
	depth := 1
	i++
L:
	for ; i < len(json); i++ {
		if json[i] >= '"' && json[i] <= '}' {
			switch json[i] {
			case '"':
				i++
				s2 := i
				for ; i < len(json); i++ {
					if json[i] > '\\' {
						continue
					}
					if json[i] == '"' {
						if json[i-1] == '\\' {
							n := 0
							for j := i - 2; j > s2-1; j-- {
								if json[j] != '\\' {
									break
								}
								n++
							}
							if n%2 == 0 {
								continue
							}
						}
						break
					}
				}
			case '{', '[':
				depth++
			case '}', ']':
				depth--
				if depth == 0 {
					i++
					break L
				}
			}
		}
	}
	return i
}

// compact removes insignificant space characters from the
// input JSON byte slice and returns the compacted result.
func compact(json []byte) []byte {
	b := make([]byte, 0, len(json))
	return _compact(json, b)
}

// compactInPlace is similar to compact, but it reuses the input
// JSON buffer to avoid allocations.
func compactInPlace(json []byte) []byte {
	return _compact(json, json)
}

func _compact(src, dst []byte) []byte {
	dst = dst[:0]
	for i := 0; i < len(src); i++ {
		if src[i] > ' ' {
			dst = append(dst, src[i])
			if src[i] == '"' {
				i++
				for ; i < len(src); i++ {
					dst = append(dst, src[i])
					if src[i] == '"' {
						j := i - 1
						for ; ; j-- {
							if src[j] != '\\' {
								break
							}
						}
						if (j-i)%2 != 0 {
							break
						}
					}
				}
			}
		}
	}
	return dst
}
