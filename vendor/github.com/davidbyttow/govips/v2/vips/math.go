package vips

import "math"

// Scalar is the basic scalar measurement of an image's height, width or offset coordinate.
type Scalar struct {
	Value    float64
	Relative bool
}

// ValueOf takes a floating point value and returns a corresponding Scalar struct
func ValueOf(value float64) Scalar {
	return Scalar{value, false}
}

// IsZero checkes whether the associated Scalar's value is zero.
func (s *Scalar) IsZero() bool {
	return s.Value == 0 && !s.Relative
}

// SetInt sets an integer value for the associated Scalar.
func (s *Scalar) SetInt(value int) {
	s.Set(float64(value))
}

// Set sets a float value for the associated Scalar.
func (s *Scalar) Set(value float64) {
	s.Value = value
	s.Relative = false
}

// SetScale sets a float value for the associated Scalar and makes it relative.
func (s *Scalar) SetScale(f float64) {
	s.Value = f
	s.Relative = true
}

// Get returns the value of the scalar. Either absolute, or if relative, multiplied by the base given as parameter.
func (s *Scalar) Get(base int) float64 {
	if s.Relative {
		return s.Value * float64(base)
	}
	return s.Value
}

// GetRounded returns the value of the associated Scalar, rounded to the nearest integer, if absolute.
// If the Scalar is relative, it will be multiplied by the supplied base parameter.
func (s *Scalar) GetRounded(base int) int {
	return roundFloat(s.Get(base))
}

func roundFloat(f float64) int {
	if f < 0 {
		return int(math.Ceil(f - 0.5))
	}
	return int(math.Floor(f + 0.5))
}
