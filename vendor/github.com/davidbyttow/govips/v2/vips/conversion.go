package vips

// #cgo CFLAGS: -std=c99
// #include "conversion.h"
import "C"

// BandFormat represents VIPS_FORMAT type
type BandFormat int

// BandFormat enum
const (
	BandFormatNotSet    BandFormat = C.VIPS_FORMAT_NOTSET
	BandFormatUchar     BandFormat = C.VIPS_FORMAT_UCHAR
	BandFormatChar      BandFormat = C.VIPS_FORMAT_CHAR
	BandFormatUshort    BandFormat = C.VIPS_FORMAT_USHORT
	BandFormatShort     BandFormat = C.VIPS_FORMAT_SHORT
	BandFormatUint      BandFormat = C.VIPS_FORMAT_UINT
	BandFormatInt       BandFormat = C.VIPS_FORMAT_INT
	BandFormatFloat     BandFormat = C.VIPS_FORMAT_FLOAT
	BandFormatComplex   BandFormat = C.VIPS_FORMAT_COMPLEX
	BandFormatDouble    BandFormat = C.VIPS_FORMAT_DOUBLE
	BandFormatDpComplex BandFormat = C.VIPS_FORMAT_DPCOMPLEX
)

// BlendMode gives the various Porter-Duff and PDF blend modes.
// See https://libvips.github.io/libvips/API/current/libvips-conversion.html#VipsBlendMode
type BlendMode int

// Constants define the various Porter-Duff and PDF blend modes.
// See https://libvips.github.io/libvips/API/current/libvips-conversion.html#VipsBlendMode
const (
	BlendModeClear      BlendMode = C.VIPS_BLEND_MODE_CLEAR
	BlendModeSource     BlendMode = C.VIPS_BLEND_MODE_SOURCE
	BlendModeOver       BlendMode = C.VIPS_BLEND_MODE_OVER
	BlendModeIn         BlendMode = C.VIPS_BLEND_MODE_IN
	BlendModeOut        BlendMode = C.VIPS_BLEND_MODE_OUT
	BlendModeAtop       BlendMode = C.VIPS_BLEND_MODE_ATOP
	BlendModeDest       BlendMode = C.VIPS_BLEND_MODE_DEST
	BlendModeDestOver   BlendMode = C.VIPS_BLEND_MODE_DEST_OVER
	BlendModeDestIn     BlendMode = C.VIPS_BLEND_MODE_DEST_IN
	BlendModeDestOut    BlendMode = C.VIPS_BLEND_MODE_DEST_OUT
	BlendModeDestAtop   BlendMode = C.VIPS_BLEND_MODE_DEST_ATOP
	BlendModeXOR        BlendMode = C.VIPS_BLEND_MODE_XOR
	BlendModeAdd        BlendMode = C.VIPS_BLEND_MODE_ADD
	BlendModeSaturate   BlendMode = C.VIPS_BLEND_MODE_SATURATE
	BlendModeMultiply   BlendMode = C.VIPS_BLEND_MODE_MULTIPLY
	BlendModeScreen     BlendMode = C.VIPS_BLEND_MODE_SCREEN
	BlendModeOverlay    BlendMode = C.VIPS_BLEND_MODE_OVERLAY
	BlendModeDarken     BlendMode = C.VIPS_BLEND_MODE_DARKEN
	BlendModeLighten    BlendMode = C.VIPS_BLEND_MODE_LIGHTEN
	BlendModeColorDodge BlendMode = C.VIPS_BLEND_MODE_COLOUR_DODGE
	BlendModeColorBurn  BlendMode = C.VIPS_BLEND_MODE_COLOUR_BURN
	BlendModeHardLight  BlendMode = C.VIPS_BLEND_MODE_HARD_LIGHT
	BlendModeSoftLight  BlendMode = C.VIPS_BLEND_MODE_SOFT_LIGHT
	BlendModeDifference BlendMode = C.VIPS_BLEND_MODE_DIFFERENCE
	BlendModeExclusion  BlendMode = C.VIPS_BLEND_MODE_EXCLUSION
)

// Direction represents VIPS_DIRECTION type
type Direction int

// Direction enum
const (
	DirectionHorizontal Direction = C.VIPS_DIRECTION_HORIZONTAL
	DirectionVertical   Direction = C.VIPS_DIRECTION_VERTICAL
)

// Angle represents VIPS_ANGLE type
type Angle int

// Angle enum
const (
	Angle0   Angle = C.VIPS_ANGLE_D0
	Angle90  Angle = C.VIPS_ANGLE_D90
	Angle180 Angle = C.VIPS_ANGLE_D180
	Angle270 Angle = C.VIPS_ANGLE_D270
)

// Angle45 represents VIPS_ANGLE45 type
type Angle45 int

// Angle45 enum
const (
	Angle45_0   Angle45 = C.VIPS_ANGLE45_D0
	Angle45_45  Angle45 = C.VIPS_ANGLE45_D45
	Angle45_90  Angle45 = C.VIPS_ANGLE45_D90
	Angle45_135 Angle45 = C.VIPS_ANGLE45_D135
	Angle45_180 Angle45 = C.VIPS_ANGLE45_D180
	Angle45_225 Angle45 = C.VIPS_ANGLE45_D225
	Angle45_270 Angle45 = C.VIPS_ANGLE45_D270
	Angle45_315 Angle45 = C.VIPS_ANGLE45_D315
)

// ExtendStrategy represents VIPS_EXTEND type
type ExtendStrategy int

// ExtendStrategy enum
const (
	ExtendBlack      ExtendStrategy = C.VIPS_EXTEND_BLACK
	ExtendCopy       ExtendStrategy = C.VIPS_EXTEND_COPY
	ExtendRepeat     ExtendStrategy = C.VIPS_EXTEND_REPEAT
	ExtendMirror     ExtendStrategy = C.VIPS_EXTEND_MIRROR
	ExtendWhite      ExtendStrategy = C.VIPS_EXTEND_WHITE
	ExtendBackground ExtendStrategy = C.VIPS_EXTEND_BACKGROUND
)

// Interesting represents VIPS_INTERESTING type
// https://libvips.github.io/libvips/API/current/libvips-conversion.html#VipsInteresting
type Interesting int

// Interesting constants represent areas of interest which smart cropping will crop based on.
const (
	InterestingNone      Interesting = C.VIPS_INTERESTING_NONE
	InterestingCentre    Interesting = C.VIPS_INTERESTING_CENTRE
	InterestingEntropy   Interesting = C.VIPS_INTERESTING_ENTROPY
	InterestingAttention Interesting = C.VIPS_INTERESTING_ATTENTION
	InterestingLow       Interesting = C.VIPS_INTERESTING_LOW
	InterestingHigh      Interesting = C.VIPS_INTERESTING_HIGH
	InterestingAll       Interesting = C.VIPS_INTERESTING_ALL
	InterestingLast      Interesting = C.VIPS_INTERESTING_LAST
)

func vipsCopyImageChangingInterpretation(in *C.VipsImage, interpretation Interpretation) (*C.VipsImage, error) {
	var out *C.VipsImage

	if err := C.copy_image_changing_interpretation(in, &out, C.VipsInterpretation(interpretation)); int(err) != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

func vipsCopyImageChangingResolution(in *C.VipsImage, xres float64, yres float64) (*C.VipsImage, error) {
	var out *C.VipsImage

	if err := C.copy_image_changing_resolution(in, &out, C.double(xres), C.double(yres)); int(err) != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-conversion.html#vips-copy
func vipsCopyImage(in *C.VipsImage) (*C.VipsImage, error) {
	var out *C.VipsImage

	if err := C.copy_image(in, &out); int(err) != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-conversion.html#vips-embed
func vipsEmbed(in *C.VipsImage, left, top, width, height int, extend ExtendStrategy) (*C.VipsImage, error) {
	incOpCounter("embed")
	var out *C.VipsImage

	if err := C.embed_image(in, &out, C.int(left), C.int(top), C.int(width), C.int(height), C.int(extend)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-conversion.html#vips-embed
func vipsEmbedBackground(in *C.VipsImage, left, top, width, height int, backgroundColor *ColorRGBA) (*C.VipsImage, error) {
	incOpCounter("embed")
	var out *C.VipsImage

	if err := C.embed_image_background(in, &out, C.int(left), C.int(top), C.int(width),
		C.int(height), C.double(backgroundColor.R),
		C.double(backgroundColor.G), C.double(backgroundColor.B), C.double(backgroundColor.A)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

func vipsEmbedMultiPage(in *C.VipsImage, left, top, width, height int, extend ExtendStrategy) (*C.VipsImage, error) {
	incOpCounter("embedMultiPage")
	var out *C.VipsImage

	if err := C.embed_multi_page_image(in, &out, C.int(left), C.int(top), C.int(width), C.int(height), C.int(extend)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

func vipsEmbedMultiPageBackground(in *C.VipsImage, left, top, width, height int, backgroundColor *ColorRGBA) (*C.VipsImage, error) {
	incOpCounter("embedMultiPageBackground")
	var out *C.VipsImage

	if err := C.embed_multi_page_image_background(in, &out, C.int(left), C.int(top), C.int(width),
		C.int(height), C.double(backgroundColor.R),
		C.double(backgroundColor.G), C.double(backgroundColor.B), C.double(backgroundColor.A)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-conversion.html#vips-flip
func vipsFlip(in *C.VipsImage, direction Direction) (*C.VipsImage, error) {
	incOpCounter("flip")
	var out *C.VipsImage

	if err := C.flip_image(in, &out, C.int(direction)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-conversion.html#vips-recomb
func vipsRecomb(in *C.VipsImage, m *C.VipsImage) (*C.VipsImage, error) {
	incOpCounter("recomb")
	var out *C.VipsImage

	if err := C.recomb_image(in, &out, m); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-conversion.html#vips-extract-area
func vipsExtractArea(in *C.VipsImage, left, top, width, height int) (*C.VipsImage, error) {
	incOpCounter("extractArea")
	var out *C.VipsImage

	if err := C.extract_image_area(in, &out, C.int(left), C.int(top), C.int(width), C.int(height)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

func vipsExtractAreaMultiPage(in *C.VipsImage, left, top, width, height int) (*C.VipsImage, error) {
	incOpCounter("extractAreaMultiPage")
	var out *C.VipsImage

	if err := C.extract_area_multi_page(in, &out, C.int(left), C.int(top), C.int(width), C.int(height)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-conversion.html#vips-extract-band
func vipsExtractBand(in *C.VipsImage, band, num int) (*C.VipsImage, error) {
	incOpCounter("extractBand")
	var out *C.VipsImage

	if err := C.extract_band(in, &out, C.int(band), C.int(num)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// http://libvips.github.io/libvips/API/current/libvips-resample.html#vips-similarity
func vipsSimilarity(in *C.VipsImage, scale float64, angle float64, color *ColorRGBA,
	idx float64, idy float64, odx float64, ody float64) (*C.VipsImage, error) {
	incOpCounter("similarity")
	var out *C.VipsImage

	if err := C.similarity(in, &out, C.double(scale), C.double(angle),
		C.double(color.R), C.double(color.G), C.double(color.B), C.double(color.A),
		C.double(idx), C.double(idy), C.double(odx), C.double(ody)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// http://libvips.github.io/libvips/API/current/libvips-conversion.html#vips-smartcrop
func vipsSmartCrop(in *C.VipsImage, width int, height int, interesting Interesting) (*C.VipsImage, error) {
	incOpCounter("smartcrop")
	var out *C.VipsImage

	if err := C.smartcrop(in, &out, C.int(width), C.int(height), C.int(interesting)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// http://libvips.github.io/libvips/API/current/libvips-conversion.html#vips-crop
func vipsCrop(in *C.VipsImage, left int, top int, width int, height int) (*C.VipsImage, error) {
	incOpCounter("crop")
	var out *C.VipsImage

	if err := C.crop(in, &out, C.int(left), C.int(top), C.int(width), C.int(height)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-conversion.html#vips-rot
func vipsRotate(in *C.VipsImage, angle Angle) (*C.VipsImage, error) {
	incOpCounter("rot")
	var out *C.VipsImage

	if err := C.rot_image(in, &out, C.VipsAngle(angle)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-conversion.html#vips-autorot
func vipsAutoRotate(in *C.VipsImage) (*C.VipsImage, error) {
	incOpCounter("autorot")
	var out *C.VipsImage

	if err := C.autorot_image(in, &out); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-conversion.html#vips-zoom
func vipsZoom(in *C.VipsImage, xFactor, yFactor int) (*C.VipsImage, error) {
	incOpCounter("zoom")
	var out *C.VipsImage

	if err := C.zoom_image(in, &out, C.int(xFactor), C.int(yFactor)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-conversion.html#vips-bandjoin
func vipsBandJoin(ins []*C.VipsImage) (*C.VipsImage, error) {
	incOpCounter("bandjoin")
	var out *C.VipsImage

	if err := C.bandjoin(&ins[0], &out, C.int(len(ins))); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// http://libvips.github.io/libvips/API/current/libvips-conversion.html#vips-bandjoin-const
func vipsBandJoinConst(in *C.VipsImage, constants []float64) (*C.VipsImage, error) {
	incOpCounter("bandjoin_const")
	var out *C.VipsImage

	if err := C.bandjoin_const(in, &out, (*C.double)(&constants[0]), C.int(len(constants))); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-conversion.html#vips-flatten
func vipsFlatten(in *C.VipsImage, color *Color) (*C.VipsImage, error) {
	incOpCounter("flatten")
	var out *C.VipsImage

	err := C.flatten_image(in, &out, C.double(color.R), C.double(color.G), C.double(color.B))
	if int(err) != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

func vipsAddAlpha(in *C.VipsImage) (*C.VipsImage, error) {
	incOpCounter("addAlpha")
	var out *C.VipsImage

	if err := C.add_alpha(in, &out); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-conversion.html#vips-premultiply
func vipsPremultiplyAlpha(in *C.VipsImage) (*C.VipsImage, error) {
	incOpCounter("premultiplyAlpha")
	var out *C.VipsImage

	if err := C.premultiply_alpha(in, &out); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-conversion.html#vips-unpremultiply
func vipsUnpremultiplyAlpha(in *C.VipsImage) (*C.VipsImage, error) {
	incOpCounter("unpremultiplyAlpha")
	var out *C.VipsImage

	if err := C.unpremultiply_alpha(in, &out); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

func vipsCast(in *C.VipsImage, bandFormat BandFormat) (*C.VipsImage, error) {
	incOpCounter("cast")
	var out *C.VipsImage

	if err := C.cast(in, &out, C.int(bandFormat)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-conversion.html#vips-composite
func vipsComposite(ins []*C.VipsImage, modes []C.int, xs, ys []C.int) (*C.VipsImage, error) {
	incOpCounter("composite_multi")
	var out *C.VipsImage

	if err := C.composite_image(&ins[0], &out, C.int(len(ins)), &modes[0], &xs[0], &ys[0]); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-conversion.html#vips-composite2
func vipsComposite2(base *C.VipsImage, overlay *C.VipsImage, mode BlendMode, x, y int) (*C.VipsImage, error) {
	incOpCounter("composite")
	var out *C.VipsImage

	if err := C.composite2_image(base, overlay, &out, C.int(mode), C.gint(x), C.gint(y)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

func vipsInsert(main *C.VipsImage, sub *C.VipsImage, x, y int, expand bool, background *ColorRGBA) (*C.VipsImage, error) {
	incOpCounter("insert")
	var out *C.VipsImage

	if background == nil {
		background = &ColorRGBA{R: 0.0, G: 0.0, B: 0.0, A: 255.0}
	}

	expandInt := 0
	if expand {
		expandInt = 1
	}

	if err := C.insert_image(main, sub, &out, C.int(x), C.int(y), C.int(expandInt), C.double(background.R), C.double(background.G), C.double(background.B), C.double(background.A)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-conversion.html#vips-join
func vipsJoin(input1 *C.VipsImage, input2 *C.VipsImage, dir Direction) (*C.VipsImage, error) {
	incOpCounter("join")
	var out *C.VipsImage

	defer C.g_object_unref(C.gpointer(input1))
	defer C.g_object_unref(C.gpointer(input2))
	if err := C.join(input1, input2, &out, C.int(dir)); err != 0 {
		return nil, handleVipsError()
	}
	return out, nil
}

// https://libvips.github.io/libvips/API/current/libvips-conversion.html#vips-arrayjoin
func vipsArrayJoin(inputs []*C.VipsImage, across int) (*C.VipsImage, error) {
	incOpCounter("arrayjoin")
	var out *C.VipsImage

	if err := C.arrayjoin(&inputs[0], &out, C.int(len(inputs)), C.int(across)); err != 0 {
		return nil, handleVipsError()
	}
	return out, nil
}

// https://www.libvips.org/API/current/libvips-conversion.html#vips-replicate
func vipsReplicate(in *C.VipsImage, across int, down int) (*C.VipsImage, error) {
	incOpCounter("replicate")
	var out *C.VipsImage

	if err := C.replicate(in, &out, C.int(across), C.int(down)); err != 0 {
		return nil, handleImageError(out)
	}
	return out, nil
}

// https://www.libvips.org/API/current/libvips-conversion.html#vips-grid
func vipsGrid(in *C.VipsImage, tileHeight, across, down int) (*C.VipsImage, error) {
	incOpCounter("grid")
	var out *C.VipsImage

	if err := C.grid(in, &out, C.int(tileHeight), C.int(across), C.int(down)); err != 0 {
		return nil, handleImageError(out)
	}
	return out, nil
}

func vipsGamma(image *C.VipsImage, gamma float64) (*C.VipsImage, error) {
	incOpCounter("gamma")
	var out *C.VipsImage

	if err := C.adjust_gamma(image, &out, C.double(gamma)); err != 0 {
		return nil, handleImageError(out)
	}

	return out, nil
}
