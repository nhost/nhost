package vips

// #include "foreign.h"
import "C"
import (
	"bytes"
	"encoding/xml"
	"fmt"
	"image/png"
	"math"
	"runtime"
	"unsafe"

	"golang.org/x/image/bmp"
	"golang.org/x/net/html/charset"
)

// SubsampleMode correlates to a libvips subsample mode
type SubsampleMode int

// SubsampleMode enum correlating to libvips subsample modes
const (
	VipsForeignSubsampleAuto SubsampleMode = C.VIPS_FOREIGN_JPEG_SUBSAMPLE_AUTO
	VipsForeignSubsampleOn   SubsampleMode = C.VIPS_FOREIGN_JPEG_SUBSAMPLE_ON
	VipsForeignSubsampleOff  SubsampleMode = C.VIPS_FOREIGN_JPEG_SUBSAMPLE_OFF
	VipsForeignSubsampleLast SubsampleMode = C.VIPS_FOREIGN_JPEG_SUBSAMPLE_LAST
)

// ImageType represents an image type
type ImageType int

// ImageType enum
const (
	ImageTypeUnknown ImageType = C.UNKNOWN
	ImageTypeGIF     ImageType = C.GIF
	ImageTypeJPEG    ImageType = C.JPEG
	ImageTypeMagick  ImageType = C.MAGICK
	ImageTypePDF     ImageType = C.PDF
	ImageTypePNG     ImageType = C.PNG
	ImageTypeSVG     ImageType = C.SVG
	ImageTypeTIFF    ImageType = C.TIFF
	ImageTypeWEBP    ImageType = C.WEBP
	ImageTypeHEIF    ImageType = C.HEIF
	ImageTypeBMP     ImageType = C.BMP
	ImageTypeAVIF    ImageType = C.AVIF
	ImageTypeJP2K    ImageType = C.JP2K
	ImageTypeJXL     ImageType = C.JXL
)

var imageTypeExtensionMap = map[ImageType]string{
	ImageTypeGIF:    ".gif",
	ImageTypeJPEG:   ".jpeg",
	ImageTypeMagick: ".magick",
	ImageTypePDF:    ".pdf",
	ImageTypePNG:    ".png",
	ImageTypeSVG:    ".svg",
	ImageTypeTIFF:   ".tiff",
	ImageTypeWEBP:   ".webp",
	ImageTypeHEIF:   ".heic",
	ImageTypeBMP:    ".bmp",
	ImageTypeAVIF:   ".avif",
	ImageTypeJP2K:   ".jp2",
	ImageTypeJXL:    ".jxl",
}

// ImageTypes defines the various image types supported by govips
var ImageTypes = map[ImageType]string{
	ImageTypeGIF:    "gif",
	ImageTypeJPEG:   "jpeg",
	ImageTypeMagick: "magick",
	ImageTypePDF:    "pdf",
	ImageTypePNG:    "png",
	ImageTypeSVG:    "svg",
	ImageTypeTIFF:   "tiff",
	ImageTypeWEBP:   "webp",
	ImageTypeHEIF:   "heif",
	ImageTypeBMP:    "bmp",
	ImageTypeAVIF:   "heif",
	ImageTypeJP2K:   "jp2k",
	ImageTypeJXL:    "jxl",
}

// TiffCompression represents method for compressing a tiff at export
type TiffCompression int

// TiffCompression enum
const (
	TiffCompressionNone     TiffCompression = C.VIPS_FOREIGN_TIFF_COMPRESSION_NONE
	TiffCompressionJpeg     TiffCompression = C.VIPS_FOREIGN_TIFF_COMPRESSION_JPEG
	TiffCompressionDeflate  TiffCompression = C.VIPS_FOREIGN_TIFF_COMPRESSION_DEFLATE
	TiffCompressionPackbits TiffCompression = C.VIPS_FOREIGN_TIFF_COMPRESSION_PACKBITS
	TiffCompressionFax4     TiffCompression = C.VIPS_FOREIGN_TIFF_COMPRESSION_CCITTFAX4
	TiffCompressionLzw      TiffCompression = C.VIPS_FOREIGN_TIFF_COMPRESSION_LZW
	TiffCompressionWebp     TiffCompression = C.VIPS_FOREIGN_TIFF_COMPRESSION_WEBP
	TiffCompressionZstd     TiffCompression = C.VIPS_FOREIGN_TIFF_COMPRESSION_ZSTD
)

// TiffPredictor represents method for compressing a tiff at export
type TiffPredictor int

// TiffPredictor enum
const (
	TiffPredictorNone       TiffPredictor = C.VIPS_FOREIGN_TIFF_PREDICTOR_NONE
	TiffPredictorHorizontal TiffPredictor = C.VIPS_FOREIGN_TIFF_PREDICTOR_HORIZONTAL
	TiffPredictorFloat      TiffPredictor = C.VIPS_FOREIGN_TIFF_PREDICTOR_FLOAT
)

// PngFilter represents filter algorithms that can be applied before compression.
// See https://www.w3.org/TR/PNG-Filters.html
type PngFilter int

// PngFilter enum
const (
	PngFilterNone  PngFilter = C.VIPS_FOREIGN_PNG_FILTER_NONE
	PngFilterSub   PngFilter = C.VIPS_FOREIGN_PNG_FILTER_SUB
	PngFilterUo    PngFilter = C.VIPS_FOREIGN_PNG_FILTER_UP
	PngFilterAvg   PngFilter = C.VIPS_FOREIGN_PNG_FILTER_AVG
	PngFilterPaeth PngFilter = C.VIPS_FOREIGN_PNG_FILTER_PAETH
	PngFilterAll   PngFilter = C.VIPS_FOREIGN_PNG_FILTER_ALL
)

// FileExt returns the canonical extension for the ImageType
func (i ImageType) FileExt() string {
	if ext, ok := imageTypeExtensionMap[i]; ok {
		return ext
	}
	return ""
}

// IsTypeSupported checks whether given image type is supported by govips
func IsTypeSupported(imageType ImageType) bool {
	startupIfNeeded()

	return supportedImageTypes[imageType]
}

// DetermineImageType attempts to determine the image type of the given buffer
func DetermineImageType(buf []byte) ImageType {
	if len(buf) < 12 {
		return ImageTypeUnknown
	} else if isJPEG(buf) {
		return ImageTypeJPEG
	} else if isPNG(buf) {
		return ImageTypePNG
	} else if isGIF(buf) {
		return ImageTypeGIF
	} else if isTIFF(buf) {
		return ImageTypeTIFF
	} else if isWEBP(buf) {
		return ImageTypeWEBP
	} else if isAVIF(buf) {
		return ImageTypeAVIF
	} else if isHEIF(buf) {
		return ImageTypeHEIF
	} else if isSVG(buf) {
		return ImageTypeSVG
	} else if isPDF(buf) {
		return ImageTypePDF
	} else if isBMP(buf) {
		return ImageTypeBMP
	} else if isJP2K(buf) {
		return ImageTypeJP2K
	} else if isJXL(buf) {
		return ImageTypeJXL
	} else {
		return ImageTypeUnknown
	}
}

var jpeg = []byte("\xFF\xD8\xFF")

func isJPEG(buf []byte) bool {
	return bytes.HasPrefix(buf, jpeg)
}

var gifHeader = []byte("\x47\x49\x46")

func isGIF(buf []byte) bool {
	return bytes.HasPrefix(buf, gifHeader)
}

var pngHeader = []byte("\x89\x50\x4E\x47")

func isPNG(buf []byte) bool {
	return bytes.HasPrefix(buf, pngHeader)
}

var tifII = []byte("\x49\x49\x2A\x00")
var tifMM = []byte("\x4D\x4D\x00\x2A")

func isTIFF(buf []byte) bool {
	return bytes.HasPrefix(buf, tifII) || bytes.HasPrefix(buf, tifMM)
}

var webpHeader = []byte("\x57\x45\x42\x50")

func isWEBP(buf []byte) bool {
	return bytes.Equal(buf[8:12], webpHeader)
}

// https://github.com/strukturag/libheif/blob/master/libheif/heif.cc
var ftyp = []byte("ftyp")
var heic = []byte("heic")
var mif1 = []byte("mif1")
var msf1 = []byte("msf1")
var avif = []byte("avif")

func isHEIF(buf []byte) bool {
	return bytes.Equal(buf[4:8], ftyp) && (bytes.Equal(buf[8:12], heic) ||
		bytes.Equal(buf[8:12], mif1) ||
		bytes.Equal(buf[8:12], msf1)) ||
		isAVIF(buf)
}

func isAVIF(buf []byte) bool {
	return bytes.Equal(buf[4:8], ftyp) && bytes.Equal(buf[8:12], avif)
}

var svg = []byte("<svg")

func isSVG(buf []byte) bool {
	sub := buf[:int(math.Min(1024.0, float64(len(buf))))]
	if bytes.Contains(sub, svg) {
		data := &struct {
			XMLName xml.Name `xml:"svg"`
		}{}
		reader := bytes.NewReader(buf)
		decoder := xml.NewDecoder(reader)
		decoder.Strict = false
		decoder.CharsetReader = charset.NewReaderLabel

		err := decoder.Decode(data)

		return err == nil && data.XMLName.Local == "svg"
	}

	return false
}

var pdf = []byte("\x25\x50\x44\x46")

func isPDF(buf []byte) bool {
	return bytes.HasPrefix(buf, pdf)
}

var bmpHeader = []byte("BM")

func isBMP(buf []byte) bool {
	return bytes.HasPrefix(buf, bmpHeader)
}

// X'0000 000C 6A50 2020 0D0A 870A'
var jp2kHeader = []byte("\x00\x00\x00\x0C\x6A\x50\x20\x20\x0D\x0A\x87\x0A")

// https://datatracker.ietf.org/doc/html/rfc3745
func isJP2K(buf []byte) bool {
	return bytes.HasPrefix(buf, jp2kHeader)
}

var jxlHeader = []byte("\xff\x0a")

func isJXL(buf []byte) bool {
	return bytes.HasPrefix(buf, jxlHeader)
}

func vipsLoadFromBuffer(buf []byte, params *ImportParams) (*C.VipsImage, ImageType, ImageType, error) {
	src := buf
	// Reference src here so it's not garbage collected during image initialization.
	defer runtime.KeepAlive(src)

	var err error

	originalType := DetermineImageType(src)
	currentType := originalType

	if originalType == ImageTypeBMP {
		src, err = bmpToPNG(src)
		if err != nil {
			return nil, currentType, originalType, err
		}

		currentType = ImageTypePNG
	}

	if !IsTypeSupported(currentType) {
		govipsLog("govips", LogLevelInfo, fmt.Sprintf("failed to understand image format size=%d", len(src)))
		return nil, currentType, originalType, ErrUnsupportedImageFormat
	}

	importParams := createImportParams(currentType, params)

	if err := C.load_from_buffer(&importParams, unsafe.Pointer(&src[0]), C.size_t(len(src))); err != 0 {
		return nil, currentType, originalType, handleImageError(importParams.outputImage)
	}

	return importParams.outputImage, currentType, originalType, nil
}

func bmpToPNG(src []byte) ([]byte, error) {
	i, err := bmp.Decode(bytes.NewReader(src))
	if err != nil {
		return nil, err
	}

	var w bytes.Buffer
	pngEnc := png.Encoder{
		CompressionLevel: png.NoCompression,
	}
	err = pngEnc.Encode(&w, i)
	if err != nil {
		return nil, err
	}

	return w.Bytes(), nil
}

func maybeSetBoolParam(p BoolParameter, cp *C.Param) {
	if p.IsSet() {
		C.set_bool_param(cp, toGboolean(p.Get()))
	}
}

func maybeSetIntParam(p IntParameter, cp *C.Param) {
	if p.IsSet() {
		C.set_int_param(cp, C.int(p.Get()))
	}
}

func createImportParams(format ImageType, params *ImportParams) C.LoadParams {
	p := C.create_load_params(C.ImageType(format))

	maybeSetBoolParam(params.AutoRotate, &p.autorotate)
	maybeSetBoolParam(params.FailOnError, &p.fail)
	maybeSetIntParam(params.Page, &p.page)
	maybeSetIntParam(params.NumPages, &p.n)
	maybeSetIntParam(params.JpegShrinkFactor, &p.jpegShrink)
	maybeSetBoolParam(params.HeifThumbnail, &p.heifThumbnail)
	maybeSetBoolParam(params.SvgUnlimited, &p.svgUnlimited)

	if params.Density.IsSet() {
		C.set_double_param(&p.dpi, C.gdouble(params.Density.Get()))
	}
	return p
}

func vipsSaveJPEGToBuffer(in *C.VipsImage, params JpegExportParams) ([]byte, error) {
	incOpCounter("save_jpeg_buffer")

	p := C.create_save_params(C.JPEG)
	p.inputImage = in
	p.stripMetadata = C.int(boolToInt(params.StripMetadata))
	p.quality = C.int(params.Quality)
	p.interlace = C.int(boolToInt(params.Interlace))
	p.jpegOptimizeCoding = C.int(boolToInt(params.OptimizeCoding))
	p.jpegSubsample = C.VipsForeignJpegSubsample(params.SubsampleMode)
	p.jpegTrellisQuant = C.int(boolToInt(params.TrellisQuant))
	p.jpegOvershootDeringing = C.int(boolToInt(params.OvershootDeringing))
	p.jpegOptimizeScans = C.int(boolToInt(params.OptimizeScans))
	p.jpegQuantTable = C.int(params.QuantTable)

	return vipsSaveToBuffer(p)
}

func vipsSavePNGToBuffer(in *C.VipsImage, params PngExportParams) ([]byte, error) {
	incOpCounter("save_png_buffer")

	p := C.create_save_params(C.PNG)
	p.inputImage = in
	p.quality = C.int(params.Quality)
	p.stripMetadata = C.int(boolToInt(params.StripMetadata))
	p.interlace = C.int(boolToInt(params.Interlace))
	p.pngCompression = C.int(params.Compression)
	p.pngFilter = C.VipsForeignPngFilter(params.Filter)
	p.pngPalette = C.int(boolToInt(params.Palette))
	p.pngDither = C.double(params.Dither)
	p.pngBitdepth = C.int(params.Bitdepth)

	return vipsSaveToBuffer(p)
}

func vipsSaveWebPToBuffer(in *C.VipsImage, params WebpExportParams) ([]byte, error) {
	incOpCounter("save_webp_buffer")

	p := C.create_save_params(C.WEBP)
	p.inputImage = in
	p.stripMetadata = C.int(boolToInt(params.StripMetadata))
	p.quality = C.int(params.Quality)
	p.webpLossless = C.int(boolToInt(params.Lossless))
	p.webpNearLossless = C.int(boolToInt(params.NearLossless))
	p.webpReductionEffort = C.int(params.ReductionEffort)
	p.webpMinSize = C.int(boolToInt(params.MinSize))
	p.webpKMin = C.int(params.MinKeyFrames)
	p.webpKMax = C.int(params.MaxKeyFrames)

	if params.IccProfile != "" {
		p.webpIccProfile = C.CString(params.IccProfile)
		defer C.free(unsafe.Pointer(p.webpIccProfile))
	}

	return vipsSaveToBuffer(p)
}

func vipsSaveTIFFToBuffer(in *C.VipsImage, params TiffExportParams) ([]byte, error) {
	incOpCounter("save_tiff_buffer")

	p := C.create_save_params(C.TIFF)
	p.inputImage = in
	p.stripMetadata = C.int(boolToInt(params.StripMetadata))
	p.quality = C.int(params.Quality)
	p.tiffCompression = C.VipsForeignTiffCompression(params.Compression)

	return vipsSaveToBuffer(p)
}

func vipsSaveHEIFToBuffer(in *C.VipsImage, params HeifExportParams) ([]byte, error) {
	incOpCounter("save_heif_buffer")

	p := C.create_save_params(C.HEIF)
	p.inputImage = in
	p.outputFormat = C.HEIF
	p.quality = C.int(params.Quality)
	p.heifLossless = C.int(boolToInt(params.Lossless))
	p.heifBitdepth = C.int(params.Bitdepth)
	p.heifEffort = C.int(params.Effort)

	return vipsSaveToBuffer(p)
}

func vipsSaveAVIFToBuffer(in *C.VipsImage, params AvifExportParams) ([]byte, error) {
	incOpCounter("save_heif_buffer")

	// Speed was deprecated but we want to avoid breaking code that still uses it:
	effort := params.Effort
	if params.Speed != 0 {
		effort = params.Speed
	}

	p := C.create_save_params(C.AVIF)
	p.inputImage = in
	p.stripMetadata = C.int(boolToInt(params.StripMetadata))
	p.outputFormat = C.AVIF
	p.quality = C.int(params.Quality)
	p.heifLossless = C.int(boolToInt(params.Lossless))
	p.heifBitdepth = C.int(params.Bitdepth)
	p.heifEffort = C.int(effort)

	return vipsSaveToBuffer(p)
}

func vipsSaveJP2KToBuffer(in *C.VipsImage, params Jp2kExportParams) ([]byte, error) {
	incOpCounter("save_jp2k_buffer")

	p := C.create_save_params(C.JP2K)
	p.inputImage = in
	p.outputFormat = C.JP2K
	p.quality = C.int(params.Quality)
	p.jp2kLossless = C.int(boolToInt(params.Lossless))
	p.jp2kTileWidth = C.int(params.TileWidth)
	p.jp2kTileHeight = C.int(params.TileHeight)
	p.jpegSubsample = C.VipsForeignJpegSubsample(params.SubsampleMode)

	return vipsSaveToBuffer(p)
}

func vipsSaveGIFToBuffer(in *C.VipsImage, params GifExportParams) ([]byte, error) {
	incOpCounter("save_gif_buffer")

	p := C.create_save_params(C.GIF)
	p.inputImage = in
	p.quality = C.int(params.Quality)
	p.gifDither = C.double(params.Dither)
	p.gifEffort = C.int(params.Effort)
	p.gifBitdepth = C.int(params.Bitdepth)

	return vipsSaveToBuffer(p)
}

func vipsSaveJxlToBuffer(in *C.VipsImage, params JxlExportParams) ([]byte, error) {
	incOpCounter("save_jxl_buffer")

	p := C.create_save_params(C.JXL)
	p.inputImage = in
	p.outputFormat = C.JXL
	p.quality = C.int(params.Quality)
	p.jxlLossless = C.int(boolToInt(params.Lossless))
	p.jxlTier = C.int(params.Tier)
	p.jxlDistance = C.double(params.Distance)
	p.jxlEffort = C.int(params.Effort)

	return vipsSaveToBuffer(p)
}

func vipsSaveToBuffer(params C.struct_SaveParams) ([]byte, error) {
	if err := C.save_to_buffer(&params); err != 0 {
		return nil, handleSaveBufferError(params.outputBuffer)
	}

	buf := C.GoBytes(params.outputBuffer, C.int(params.outputLen))
	defer gFreePointer(params.outputBuffer)

	return buf, nil
}
