package vips

// #include "label.h"
import "C"
import "unsafe"

// Align represents VIPS_ALIGN
type Align int

// Direction enum
const (
	AlignLow    Align = C.VIPS_ALIGN_LOW
	AlignCenter Align = C.VIPS_ALIGN_CENTRE
	AlignHigh   Align = C.VIPS_ALIGN_HIGH
)

// DefaultFont is the default font to be used for label texts created by govips
const DefaultFont = "sans 10"

// LabelParams represents a text-based label
type LabelParams struct {
	Text      string
	Font      string
	Width     Scalar
	Height    Scalar
	OffsetX   Scalar
	OffsetY   Scalar
	Opacity   float32
	Color     Color
	Alignment Align
}

type vipsLabelOptions struct {
	Text      *C.char
	Font      *C.char
	Width     C.int
	Height    C.int
	OffsetX   C.int
	OffsetY   C.int
	Alignment C.VipsAlign
	DPI       C.int
	Margin    C.int
	Opacity   C.float
	Color     [3]C.double
}

func labelImage(in *C.VipsImage, params *LabelParams) (*C.VipsImage, error) {
	incOpCounter("label")
	var out *C.VipsImage

	text := C.CString(params.Text)
	defer freeCString(text)

	font := C.CString(params.Font)
	defer freeCString(font)

	// todo: release color?
	color := [3]C.double{C.double(params.Color.R), C.double(params.Color.G), C.double(params.Color.B)}

	w := params.Width.GetRounded(int(in.Xsize))
	h := params.Height.GetRounded(int(in.Ysize))
	offsetX := params.OffsetX.GetRounded(int(in.Xsize))
	offsetY := params.OffsetY.GetRounded(int(in.Ysize))

	opts := vipsLabelOptions{
		Text:      text,
		Font:      font,
		Width:     C.int(w),
		Height:    C.int(h),
		OffsetX:   C.int(offsetX),
		OffsetY:   C.int(offsetY),
		Alignment: C.VipsAlign(params.Alignment),
		Opacity:   C.float(params.Opacity),
		Color:     color,
	}

	// todo: release inline pointer?
	err := C.label(in, &out, (*C.LabelOptions)(unsafe.Pointer(&opts)))
	if err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}
