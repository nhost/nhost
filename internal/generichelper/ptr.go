package generichelper

func DerefPtr[T any](p *T) T {
	if p == nil {
		return *new(T)
	}
	return *p
}

func Pointerify[T any](v T) *T {
	return &v
}
