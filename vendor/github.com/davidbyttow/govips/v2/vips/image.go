package vips

// #include "image.h"
import "C"

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	"io"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"unsafe"
)

const GaussBlurDefaultMinAMpl = 0.2

// PreMultiplicationState stores the pre-multiplication band format of the image
type PreMultiplicationState struct {
	bandFormat BandFormat
}

// ImageRef contains a libvips image and manages its lifecycle.
type ImageRef struct {
	// NOTE: We keep a reference to this so that the input buffer is
	// never garbage collected during processing. Some image loaders use random
	// access transcoding and therefore need the original buffer to be in memory.
	buf                 []byte
	image               *C.VipsImage
	format              ImageType
	originalFormat      ImageType
	lock                sync.Mutex
	preMultiplication   *PreMultiplicationState
	optimizedIccProfile string
}

// ImageMetadata is a data structure holding the width, height, orientation and other metadata of the picture.
type ImageMetadata struct {
	Format      ImageType
	Width       int
	Height      int
	Colorspace  Interpretation
	Orientation int
	Pages       int
}

type Parameter struct {
	value interface{}
	isSet bool
}

func (p *Parameter) IsSet() bool {
	return p.isSet
}

func (p *Parameter) set(v interface{}) {
	p.value = v
	p.isSet = true
}

type BoolParameter struct {
	Parameter
}

func (p *BoolParameter) Set(v bool) {
	p.set(v)
}

func (p *BoolParameter) Get() bool {
	return p.value.(bool)
}

type IntParameter struct {
	Parameter
}

func (p *IntParameter) Set(v int) {
	p.set(v)
}

func (p *IntParameter) Get() int {
	return p.value.(int)
}

type Float64Parameter struct {
	Parameter
}

func (p *Float64Parameter) Set(v float64) {
	p.set(v)
}

func (p *Float64Parameter) Get() float64 {
	return p.value.(float64)
}

// ImportParams are options for loading an image. Some are type-specific.
// For default loading, use NewImportParams() or specify nil
type ImportParams struct {
	AutoRotate  BoolParameter
	FailOnError BoolParameter
	Page        IntParameter
	NumPages    IntParameter
	Density     IntParameter

	JpegShrinkFactor IntParameter
	HeifThumbnail    BoolParameter
	SvgUnlimited     BoolParameter
}

// NewImportParams creates default ImportParams
func NewImportParams() *ImportParams {
	p := &ImportParams{}
	p.FailOnError.Set(true)
	return p
}

// OptionString convert import params to option_string
func (i *ImportParams) OptionString() string {
	var values []string
	if v := i.NumPages; v.IsSet() {
		values = append(values, "n="+strconv.Itoa(v.Get()))
	}
	if v := i.Page; v.IsSet() {
		values = append(values, "page="+strconv.Itoa(v.Get()))
	}
	if v := i.Density; v.IsSet() {
		values = append(values, "dpi="+strconv.Itoa(v.Get()))
	}
	if v := i.FailOnError; v.IsSet() {
		values = append(values, "fail="+boolToStr(v.Get()))
	}
	if v := i.JpegShrinkFactor; v.IsSet() {
		values = append(values, "shrink="+strconv.Itoa(v.Get()))
	}
	if v := i.AutoRotate; v.IsSet() {
		values = append(values, "autorotate="+boolToStr(v.Get()))
	}
	if v := i.SvgUnlimited; v.IsSet() {
		values = append(values, "unlimited="+boolToStr(v.Get()))
	}
	if v := i.HeifThumbnail; v.IsSet() {
		values = append(values, "thumbnail="+boolToStr(v.Get()))
	}
	return strings.Join(values, ",")
}

func boolToStr(v bool) string {
	if v {
		return "TRUE"
	}
	return "FALSE"
}

// ExportParams are options when exporting an image to file or buffer.
// Deprecated: Use format-specific params
type ExportParams struct {
	Format             ImageType
	Quality            int
	Compression        int
	Interlaced         bool
	Lossless           bool
	Effort             int
	StripMetadata      bool
	OptimizeCoding     bool          // jpeg param
	SubsampleMode      SubsampleMode // jpeg param
	TrellisQuant       bool          // jpeg param
	OvershootDeringing bool          // jpeg param
	OptimizeScans      bool          // jpeg param
	QuantTable         int           // jpeg param
	Speed              int           // avif param
}

// NewDefaultExportParams creates default values for an export when image type is not JPEG, PNG or WEBP.
// By default, govips creates interlaced, lossy images with a quality of 80/100 and compression of 6/10.
// As these are default values for a wide variety of image formats, their application varies.
// Some formats use the quality parameters, some compression, etc.
// Deprecated: Use format-specific params
func NewDefaultExportParams() *ExportParams {
	return &ExportParams{
		Format:      ImageTypeUnknown, // defaults to the starting encoder
		Quality:     80,
		Compression: 6,
		Interlaced:  true,
		Lossless:    false,
		Effort:      4,
	}
}

// NewDefaultJPEGExportParams creates default values for an export of a JPEG image.
// By default, govips creates interlaced JPEGs with a quality of 80/100.
// Deprecated: Use NewJpegExportParams
func NewDefaultJPEGExportParams() *ExportParams {
	return &ExportParams{
		Format:     ImageTypeJPEG,
		Quality:    80,
		Interlaced: true,
	}
}

// NewDefaultPNGExportParams creates default values for an export of a PNG image.
// By default, govips creates non-interlaced PNGs with a compression of 6/10.
// Deprecated: Use NewPngExportParams
func NewDefaultPNGExportParams() *ExportParams {
	return &ExportParams{
		Format:      ImageTypePNG,
		Compression: 6,
		Interlaced:  false,
	}
}

// NewDefaultWEBPExportParams creates default values for an export of a WEBP image.
// By default, govips creates lossy images with a quality of 75/100.
// Deprecated: Use NewWebpExportParams
func NewDefaultWEBPExportParams() *ExportParams {
	return &ExportParams{
		Format:   ImageTypeWEBP,
		Quality:  75,
		Lossless: false,
		Effort:   4,
	}
}

// JpegExportParams are options when exporting a JPEG to file or buffer
type JpegExportParams struct {
	StripMetadata      bool
	Quality            int
	Interlace          bool
	OptimizeCoding     bool
	SubsampleMode      SubsampleMode
	TrellisQuant       bool
	OvershootDeringing bool
	OptimizeScans      bool
	QuantTable         int
}

// NewJpegExportParams creates default values for an export of a JPEG image.
// By default, govips creates interlaced JPEGs with a quality of 80/100.
func NewJpegExportParams() *JpegExportParams {
	return &JpegExportParams{
		Quality:   80,
		Interlace: true,
	}
}

// PngExportParams are options when exporting a PNG to file or buffer
type PngExportParams struct {
	StripMetadata bool
	Compression   int
	Filter        PngFilter
	Interlace     bool
	Quality       int
	Palette       bool
	Dither        float64
	Bitdepth      int
	Profile       string // TODO: Use this param during save
}

// NewPngExportParams creates default values for an export of a PNG image.
// By default, govips creates non-interlaced PNGs with a compression of 6/10.
func NewPngExportParams() *PngExportParams {
	return &PngExportParams{
		Compression: 6,
		Filter:      PngFilterNone,
		Interlace:   false,
		Palette:     false,
	}
}

// WebpExportParams are options when exporting a WEBP to file or buffer
// see https://www.libvips.org/API/current/VipsForeignSave.html#vips-webpsave
// for details on each parameter
type WebpExportParams struct {
	StripMetadata   bool
	Quality         int
	Lossless        bool
	NearLossless    bool
	ReductionEffort int
	IccProfile      string
	MinSize         bool
	MinKeyFrames    int
	MaxKeyFrames    int
}

// NewWebpExportParams creates default values for an export of a WEBP image.
// By default, govips creates lossy images with a quality of 75/100.
func NewWebpExportParams() *WebpExportParams {
	return &WebpExportParams{
		Quality:         75,
		Lossless:        false,
		NearLossless:    false,
		ReductionEffort: 4,
	}
}

// TiffExportParams are options when exporting a TIFF to file or buffer
type TiffExportParams struct {
	StripMetadata bool
	Quality       int
	Compression   TiffCompression
	Predictor     TiffPredictor
}

// NewTiffExportParams creates default values for an export of a TIFF image.
func NewTiffExportParams() *TiffExportParams {
	return &TiffExportParams{
		Quality:     80,
		Compression: TiffCompressionLzw,
		Predictor:   TiffPredictorHorizontal,
	}
}

// GifExportParams are options when exporting a GIF to file or buffer
// Please note that if vips version is above 8.12, then `vips_gifsave_buffer` is used, and only `Dither`, `Effort`, `Bitdepth` is used.
// If vips version is below 8.12, then `vips_magicksave_buffer` is used, and only `Bitdepth`, `Quality` is used.
// StripMetadata does nothing to Gif images.
type GifExportParams struct {
	StripMetadata bool
	Quality       int
	Dither        float64
	Effort        int
	Bitdepth      int
}

// NewGifExportParams creates default values for an export of a GIF image.
func NewGifExportParams() *GifExportParams {
	return &GifExportParams{
		Quality:  75,
		Effort:   7,
		Bitdepth: 8,
	}
}

// HeifExportParams are options when exporting a HEIF to file or buffer
type HeifExportParams struct {
	Quality  int
	Bitdepth int
	Effort   int
	Lossless bool
}

// NewHeifExportParams creates default values for an export of a HEIF image.
func NewHeifExportParams() *HeifExportParams {
	return &HeifExportParams{
		Quality:  80,
		Bitdepth: 8,
		Effort:   5,
		Lossless: false,
	}
}

// AvifExportParams are options when exporting an AVIF to file or buffer.
type AvifExportParams struct {
	StripMetadata bool
	Quality       int
	Bitdepth      int
	Effort        int
	Lossless      bool

	// DEPRECATED - Use Effort instead.
	Speed int
}

// NewAvifExportParams creates default values for an export of an AVIF image.
func NewAvifExportParams() *AvifExportParams {
	return &AvifExportParams{
		Quality:  80,
		Bitdepth: 8,
		Effort:   5,
		Lossless: false,
	}
}

// Jp2kExportParams are options when exporting an JPEG2000 to file or buffer.
type Jp2kExportParams struct {
	Quality       int
	Lossless      bool
	TileWidth     int
	TileHeight    int
	SubsampleMode SubsampleMode
}

// NewJp2kExportParams creates default values for an export of an JPEG2000 image.
func NewJp2kExportParams() *Jp2kExportParams {
	return &Jp2kExportParams{
		Quality:    80,
		Lossless:   false,
		TileWidth:  512,
		TileHeight: 512,
	}
}

// JxlExportParams are options when exporting an JXL to file or buffer.
type JxlExportParams struct {
	Quality  int
	Lossless bool
	Tier     int
	Distance float64
	Effort   int
}

// NewJxlExportParams creates default values for an export of an JXL image.
func NewJxlExportParams() *JxlExportParams {
	return &JxlExportParams{
		Quality:  75,
		Lossless: false,
		Effort:   7,
		Distance: 1.0,
	}
}

// NewImageFromReader loads an ImageRef from the given reader
func NewImageFromReader(r io.Reader) (*ImageRef, error) {
	buf, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}

	return NewImageFromBuffer(buf)
}

// NewImageFromFile loads an image from file and creates a new ImageRef
func NewImageFromFile(file string) (*ImageRef, error) {
	return LoadImageFromFile(file, nil)
}

// LoadImageFromFile loads an image from file and creates a new ImageRef
func LoadImageFromFile(file string, params *ImportParams) (*ImageRef, error) {
	buf, err := os.ReadFile(file)
	if err != nil {
		return nil, err
	}

	govipsLog("govips", LogLevelDebug, fmt.Sprintf("creating imageRef from file %s", file))
	return LoadImageFromBuffer(buf, params)
}

// NewImageFromBuffer loads an image buffer and creates a new Image
func NewImageFromBuffer(buf []byte) (*ImageRef, error) {
	return LoadImageFromBuffer(buf, nil)
}

// LoadImageFromBuffer loads an image buffer and creates a new Image
func LoadImageFromBuffer(buf []byte, params *ImportParams) (*ImageRef, error) {
	startupIfNeeded()

	if params == nil {
		params = NewImportParams()
	}

	vipsImage, currentFormat, originalFormat, err := vipsLoadFromBuffer(buf, params)
	if err != nil {
		return nil, err
	}

	ref := newImageRef(vipsImage, currentFormat, originalFormat, buf)

	govipsLog("govips", LogLevelDebug, fmt.Sprintf("created imageRef %p", ref))
	return ref, nil
}

// NewThumbnailFromFile loads an image from file and creates a new ImageRef with thumbnail crop
func NewThumbnailFromFile(file string, width, height int, crop Interesting) (*ImageRef, error) {
	return LoadThumbnailFromFile(file, width, height, crop, SizeBoth, nil)
}

// NewThumbnailFromBuffer loads an image buffer and creates a new Image with thumbnail crop
func NewThumbnailFromBuffer(buf []byte, width, height int, crop Interesting) (*ImageRef, error) {
	return LoadThumbnailFromBuffer(buf, width, height, crop, SizeBoth, nil)
}

// NewThumbnailWithSizeFromFile loads an image from file and creates a new ImageRef with thumbnail crop and size
func NewThumbnailWithSizeFromFile(file string, width, height int, crop Interesting, size Size) (*ImageRef, error) {
	return LoadThumbnailFromFile(file, width, height, crop, size, nil)
}

// LoadThumbnailFromFile loads an image from file and creates a new ImageRef with thumbnail crop and size
func LoadThumbnailFromFile(file string, width, height int, crop Interesting, size Size, params *ImportParams) (*ImageRef, error) {
	startupIfNeeded()

	vipsImage, format, err := vipsThumbnailFromFile(file, width, height, crop, size, params)
	if err != nil {
		return nil, err
	}

	ref := newImageRef(vipsImage, format, format, nil)

	govipsLog("govips", LogLevelDebug, fmt.Sprintf("created imageref %p", ref))
	return ref, nil
}

// NewThumbnailWithSizeFromBuffer loads an image buffer and creates a new Image with thumbnail crop and size
func NewThumbnailWithSizeFromBuffer(buf []byte, width, height int, crop Interesting, size Size) (*ImageRef, error) {
	return LoadThumbnailFromBuffer(buf, width, height, crop, size, nil)
}

// LoadThumbnailFromBuffer loads an image buffer and creates a new Image with thumbnail crop and size
func LoadThumbnailFromBuffer(buf []byte, width, height int, crop Interesting, size Size, params *ImportParams) (*ImageRef, error) {
	startupIfNeeded()

	vipsImage, format, err := vipsThumbnailFromBuffer(buf, width, height, crop, size, params)
	if err != nil {
		return nil, err
	}

	ref := newImageRef(vipsImage, format, format, buf)

	govipsLog("govips", LogLevelDebug, fmt.Sprintf("created imageref %p", ref))
	return ref, nil
}

// Metadata returns the metadata (ImageMetadata struct) of the associated ImageRef
func (r *ImageRef) Metadata() *ImageMetadata {
	return &ImageMetadata{
		Format:      r.Format(),
		Width:       r.Width(),
		Height:      r.Height(),
		Orientation: r.Orientation(),
		Colorspace:  r.ColorSpace(),
		Pages:       r.Pages(),
	}
}

// Copy creates a new copy of the given image.
func (r *ImageRef) Copy() (*ImageRef, error) {
	out, err := vipsCopyImage(r.image)
	if err != nil {
		return nil, err
	}

	return newImageRef(out, r.format, r.originalFormat, r.buf), nil
}

// Copy creates a new copy of the given image with the new X and Y resolution (PPI).
func (r *ImageRef) CopyChangingResolution(xres, yres float64) (*ImageRef, error) {
	out, err := vipsCopyImageChangingResolution(r.image, xres, yres)
	if err != nil {
		return nil, err
	}

	return newImageRef(out, r.format, r.originalFormat, r.buf), nil
}

// Copy creates a new copy of the given image with the interpretation.
func (r *ImageRef) CopyChangingInterpretation(interpretation Interpretation) (*ImageRef, error) {
	out, err := vipsCopyImageChangingInterpretation(r.image, interpretation)
	if err != nil {
		return nil, err
	}

	return newImageRef(out, r.format, r.originalFormat, r.buf), nil
}

// XYZ creates a two-band uint32 image where the elements in the first band have the value of their x coordinate
// and elements in the second band have their y coordinate.
func XYZ(width, height int) (*ImageRef, error) {
	vipsImage, err := vipsXYZ(width, height)
	return newImageRef(vipsImage, ImageTypeUnknown, ImageTypeUnknown, nil), err
}

// Identity creates an identity lookup table, which will leave an image unchanged when applied with Maplut.
// Each entry in the table has a value equal to its position.
func Identity(ushort bool) (*ImageRef, error) {
	img, err := vipsIdentity(ushort)
	return newImageRef(img, ImageTypeUnknown, ImageTypeUnknown, nil), err
}

// Black creates a new black image of the specified size
func Black(width, height int) (*ImageRef, error) {
	vipsImage, err := vipsBlack(width, height)
	imageRef := &ImageRef{
		image: vipsImage,
	}
	runtime.SetFinalizer(imageRef, finalizeImage)
	return imageRef, err
}

func newImageRef(vipsImage *C.VipsImage, currentFormat ImageType, originalFormat ImageType, buf []byte) *ImageRef {
	imageRef := &ImageRef{
		image:          vipsImage,
		format:         currentFormat,
		originalFormat: originalFormat,
		buf:            buf,
	}
	runtime.SetFinalizer(imageRef, finalizeImage)

	return imageRef
}

func finalizeImage(ref *ImageRef) {
	govipsLog("govips", LogLevelDebug, fmt.Sprintf("closing image %p", ref))
	ref.Close()
}

// Close manually closes the image and frees the memory. Calling Close() is optional.
// Images are automatically closed by GC. However, in high volume applications the GC
// can't keep up with the amount of memory, so you might want to manually close the images.
func (r *ImageRef) Close() {
	r.lock.Lock()

	if r.image != nil {
		clearImage(r.image)
		r.image = nil
	}

	r.buf = nil

	r.lock.Unlock()
}

// Format returns the current format of the vips image.
func (r *ImageRef) Format() ImageType {
	return r.format
}

// OriginalFormat returns the original format of the image when loaded.
// In some cases the loaded image is converted on load, for example, a BMP is automatically converted to PNG
// This method returns the format of the original buffer, as opposed to Format() with will return the format of the
// currently held buffer content.
func (r *ImageRef) OriginalFormat() ImageType {
	return r.originalFormat
}

// Width returns the width of this image.
func (r *ImageRef) Width() int {
	return int(r.image.Xsize)
}

// Height returns the height of this image.
func (r *ImageRef) Height() int {
	return int(r.image.Ysize)
}

// Bands returns the number of bands for this image.
func (r *ImageRef) Bands() int {
	return int(r.image.Bands)
}

// HasProfile returns if the image has an ICC profile embedded.
func (r *ImageRef) HasProfile() bool {
	return vipsHasICCProfile(r.image)
}

// HasICCProfile checks whether the image has an ICC profile embedded. Alias to HasProfile
func (r *ImageRef) HasICCProfile() bool {
	return r.HasProfile()
}

// HasIPTC returns a boolean whether the image in question has IPTC data associated with it.
func (r *ImageRef) HasIPTC() bool {
	return vipsHasIPTC(r.image)
}

// HasAlpha returns if the image has an alpha layer.
func (r *ImageRef) HasAlpha() bool {
	return vipsHasAlpha(r.image)
}

// Orientation returns the orientation number as it appears in the EXIF, if present
func (r *ImageRef) Orientation() int {
	return vipsGetMetaOrientation(r.image)
}

// Deprecated: use Orientation() instead
func (r *ImageRef) GetOrientation() int {
	return r.Orientation()
}

// SetOrientation sets the orientation in the EXIF header of the associated image.
func (r *ImageRef) SetOrientation(orientation int) error {
	out, err := vipsCopyImage(r.image)
	if err != nil {
		return err
	}

	vipsSetMetaOrientation(out, orientation)

	r.setImage(out)
	return nil
}

// RemoveOrientation removes the EXIF orientation information of the image.
func (r *ImageRef) RemoveOrientation() error {
	out, err := vipsCopyImage(r.image)
	if err != nil {
		return err
	}

	vipsRemoveMetaOrientation(out)

	r.setImage(out)
	return nil
}

// ResX returns the X resolution
func (r *ImageRef) ResX() float64 {
	return float64(r.image.Xres)
}

// ResY returns the Y resolution
func (r *ImageRef) ResY() float64 {
	return float64(r.image.Yres)
}

// OffsetX returns the X offset
func (r *ImageRef) OffsetX() int {
	return int(r.image.Xoffset)
}

// OffsetY returns the Y offset
func (r *ImageRef) OffsetY() int {
	return int(r.image.Yoffset)
}

// BandFormat returns the current band format
func (r *ImageRef) BandFormat() BandFormat {
	return BandFormat(int(r.image.BandFmt))
}

// Coding returns the image coding
func (r *ImageRef) Coding() Coding {
	return Coding(int(r.image.Coding))
}

// Interpretation returns the current interpretation of the color space of the image.
func (r *ImageRef) Interpretation() Interpretation {
	return Interpretation(int(r.image.Type))
}

// ColorSpace returns the interpretation of the current color space. Alias to Interpretation().
func (r *ImageRef) ColorSpace() Interpretation {
	return r.Interpretation()
}

// IsColorSpaceSupported returns a boolean whether the image's color space is supported by libvips.
func (r *ImageRef) IsColorSpaceSupported() bool {
	return vipsIsColorSpaceSupported(r.image)
}

// Pages returns the number of pages in the Image
// For animated images this corresponds to the number of frames
func (r *ImageRef) Pages() int {
	// libvips uses the same attribute (n_pages) to represent the number of pyramid layers in JP2K
	// as we interpret the attribute as frames and JP2K does not support animation we override this with 1
	if r.format == ImageTypeJP2K {
		return 1
	}

	return vipsGetImageNPages(r.image)
}

// Deprecated: use Pages() instead
func (r *ImageRef) GetPages() int {
	return r.Pages()
}

// SetPages sets the number of pages in the Image
// For animated images this corresponds to the number of frames
func (r *ImageRef) SetPages(pages int) error {
	out, err := vipsCopyImage(r.image)
	if err != nil {
		return err
	}

	vipsSetImageNPages(out, pages)

	r.setImage(out)
	return nil
}

// PageHeight return the height of a single page
func (r *ImageRef) PageHeight() int {
	return vipsGetPageHeight(r.image)
}

// GetPageHeight return the height of a single page
// Deprecated use PageHeight() instead
func (r *ImageRef) GetPageHeight() int {
	return vipsGetPageHeight(r.image)
}

// SetPageHeight set the height of a page
// For animated images this is used when "unrolling" back to frames
func (r *ImageRef) SetPageHeight(height int) error {
	out, err := vipsCopyImage(r.image)
	if err != nil {
		return err
	}

	vipsSetPageHeight(out, height)

	r.setImage(out)
	return nil
}

// PageDelay get the page delay array for animation
func (r *ImageRef) PageDelay() ([]int, error) {
	n := vipsGetImageNPages(r.image)
	if n <= 1 {
		// should not call if not multi page
		return nil, nil
	}
	return vipsImageGetDelay(r.image, n)
}

// SetPageDelay set the page delay array for animation
func (r *ImageRef) SetPageDelay(delay []int) error {
	var data []C.int
	for _, d := range delay {
		data = append(data, C.int(d))
	}
	return vipsImageSetDelay(r.image, data)
}

// Export creates a byte array of the image for use.
// The function returns a byte array that can be written to a file e.g. via os.WriteFile().
// N.B. govips does not currently have built-in support for directly exporting to a file.
// The function also returns a copy of the image metadata as well as an error.
// Deprecated: Use ExportNative or format-specific Export methods
func (r *ImageRef) Export(params *ExportParams) ([]byte, *ImageMetadata, error) {
	if params == nil || params.Format == ImageTypeUnknown {
		return r.ExportNative()
	}

	format := params.Format

	if !IsTypeSupported(format) {
		return nil, r.newMetadata(ImageTypeUnknown), fmt.Errorf("cannot save to %#v", ImageTypes[format])
	}

	switch format {
	case ImageTypeGIF:
		return r.ExportGIF(&GifExportParams{
			Quality: params.Quality,
		})
	case ImageTypeWEBP:
		return r.ExportWebp(&WebpExportParams{
			StripMetadata:   params.StripMetadata,
			Quality:         params.Quality,
			Lossless:        params.Lossless,
			ReductionEffort: params.Effort,
		})
	case ImageTypePNG:
		return r.ExportPng(&PngExportParams{
			StripMetadata: params.StripMetadata,
			Compression:   params.Compression,
			Interlace:     params.Interlaced,
		})
	case ImageTypeTIFF:
		compression := TiffCompressionLzw
		if params.Lossless {
			compression = TiffCompressionNone
		}
		return r.ExportTiff(&TiffExportParams{
			StripMetadata: params.StripMetadata,
			Quality:       params.Quality,
			Compression:   compression,
		})
	case ImageTypeHEIF:
		return r.ExportHeif(&HeifExportParams{
			Quality:  params.Quality,
			Lossless: params.Lossless,
		})
	case ImageTypeAVIF:
		return r.ExportAvif(&AvifExportParams{
			StripMetadata: params.StripMetadata,
			Quality:       params.Quality,
			Lossless:      params.Lossless,
			Speed:         params.Speed,
		})
	case ImageTypeJXL:
		return r.ExportJxl(&JxlExportParams{
			Quality:  params.Quality,
			Lossless: params.Lossless,
			Effort:   params.Effort,
		})
	default:
		format = ImageTypeJPEG
		return r.ExportJpeg(&JpegExportParams{
			Quality:            params.Quality,
			StripMetadata:      params.StripMetadata,
			Interlace:          params.Interlaced,
			OptimizeCoding:     params.OptimizeCoding,
			SubsampleMode:      params.SubsampleMode,
			TrellisQuant:       params.TrellisQuant,
			OvershootDeringing: params.OvershootDeringing,
			OptimizeScans:      params.OptimizeScans,
			QuantTable:         params.QuantTable,
		})
	}
}

// ExportNative exports the image to a buffer based on its native format with default parameters.
func (r *ImageRef) ExportNative() ([]byte, *ImageMetadata, error) {
	switch r.format {
	case ImageTypeJPEG:
		return r.ExportJpeg(NewJpegExportParams())
	case ImageTypePNG:
		return r.ExportPng(NewPngExportParams())
	case ImageTypeWEBP:
		return r.ExportWebp(NewWebpExportParams())
	case ImageTypeHEIF:
		return r.ExportHeif(NewHeifExportParams())
	case ImageTypeTIFF:
		return r.ExportTiff(NewTiffExportParams())
	case ImageTypeAVIF:
		return r.ExportAvif(NewAvifExportParams())
	case ImageTypeJP2K:
		return r.ExportJp2k(NewJp2kExportParams())
	case ImageTypeGIF:
		return r.ExportGIF(NewGifExportParams())
	case ImageTypeJXL:
		return r.ExportJxl(NewJxlExportParams())
	default:
		return r.ExportJpeg(NewJpegExportParams())
	}
}

// ExportJpeg exports the image as JPEG to a buffer.
func (r *ImageRef) ExportJpeg(params *JpegExportParams) ([]byte, *ImageMetadata, error) {
	if params == nil {
		params = NewJpegExportParams()
	}

	buf, err := vipsSaveJPEGToBuffer(r.image, *params)
	if err != nil {
		return nil, nil, err
	}

	return buf, r.newMetadata(ImageTypeJPEG), nil
}

// ExportPng exports the image as PNG to a buffer.
func (r *ImageRef) ExportPng(params *PngExportParams) ([]byte, *ImageMetadata, error) {
	if params == nil {
		params = NewPngExportParams()
	}

	buf, err := vipsSavePNGToBuffer(r.image, *params)
	if err != nil {
		return nil, nil, err
	}

	return buf, r.newMetadata(ImageTypePNG), nil
}

// ExportWebp exports the image as WEBP to a buffer.
func (r *ImageRef) ExportWebp(params *WebpExportParams) ([]byte, *ImageMetadata, error) {
	if params == nil {
		params = NewWebpExportParams()
	}

	paramsWithIccProfile := *params
	paramsWithIccProfile.IccProfile = r.optimizedIccProfile

	buf, err := vipsSaveWebPToBuffer(r.image, paramsWithIccProfile)
	if err != nil {
		return nil, nil, err
	}

	return buf, r.newMetadata(ImageTypeWEBP), nil
}

// ExportHeif exports the image as HEIF to a buffer.
func (r *ImageRef) ExportHeif(params *HeifExportParams) ([]byte, *ImageMetadata, error) {
	if params == nil {
		params = NewHeifExportParams()
	}

	buf, err := vipsSaveHEIFToBuffer(r.image, *params)
	if err != nil {
		return nil, nil, err
	}

	return buf, r.newMetadata(ImageTypeHEIF), nil
}

// ExportTiff exports the image as TIFF to a buffer.
func (r *ImageRef) ExportTiff(params *TiffExportParams) ([]byte, *ImageMetadata, error) {
	if params == nil {
		params = NewTiffExportParams()
	}

	buf, err := vipsSaveTIFFToBuffer(r.image, *params)
	if err != nil {
		return nil, nil, err
	}

	return buf, r.newMetadata(ImageTypeTIFF), nil
}

// ExportGIF exports the image as GIF to a buffer.
func (r *ImageRef) ExportGIF(params *GifExportParams) ([]byte, *ImageMetadata, error) {
	if params == nil {
		params = NewGifExportParams()
	}

	buf, err := vipsSaveGIFToBuffer(r.image, *params)
	if err != nil {
		return nil, nil, err
	}

	return buf, r.newMetadata(ImageTypeGIF), nil
}

// ExportAvif exports the image as AVIF to a buffer.
func (r *ImageRef) ExportAvif(params *AvifExportParams) ([]byte, *ImageMetadata, error) {
	if params == nil {
		params = NewAvifExportParams()
	}

	buf, err := vipsSaveAVIFToBuffer(r.image, *params)
	if err != nil {
		return nil, nil, err
	}

	return buf, r.newMetadata(ImageTypeAVIF), nil
}

// ExportJp2k exports the image as JPEG2000 to a buffer.
func (r *ImageRef) ExportJp2k(params *Jp2kExportParams) ([]byte, *ImageMetadata, error) {
	if params == nil {
		params = NewJp2kExportParams()
	}

	buf, err := vipsSaveJP2KToBuffer(r.image, *params)
	if err != nil {
		return nil, nil, err
	}

	return buf, r.newMetadata(ImageTypeJP2K), nil
}

// ExportJxl exports the image as JPEG XL to a buffer.
func (r *ImageRef) ExportJxl(params *JxlExportParams) ([]byte, *ImageMetadata, error) {
	if params == nil {
		params = NewJxlExportParams()
	}

	buf, err := vipsSaveJxlToBuffer(r.image, *params)
	if err != nil {
		return nil, nil, err
	}

	return buf, r.newMetadata(ImageTypeJXL), nil
}

// CompositeMulti composites the given overlay image on top of the associated image with provided blending mode.
func (r *ImageRef) CompositeMulti(ins []*ImageComposite) error {
	out, err := vipsComposite(toVipsCompositeStructs(r, ins))
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// Composite composites the given overlay image on top of the associated image with provided blending mode.
func (r *ImageRef) Composite(overlay *ImageRef, mode BlendMode, x, y int) error {
	out, err := vipsComposite2(r.image, overlay.image, mode, x, y)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// Insert draws the image on top of the associated image at the given coordinates.
func (r *ImageRef) Insert(sub *ImageRef, x, y int, expand bool, background *ColorRGBA) error {
	out, err := vipsInsert(r.image, sub.image, x, y, expand, background)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// Join joins this image with another in the direction specified
func (r *ImageRef) Join(in *ImageRef, dir Direction) error {
	out, err := vipsJoin(r.image, in.image, dir)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// ArrayJoin joins an array of images together wrapping at each n images
func (r *ImageRef) ArrayJoin(images []*ImageRef, across int) error {
	allImages := append([]*ImageRef{r}, images...)
	inputs := make([]*C.VipsImage, len(allImages))
	for i := range inputs {
		inputs[i] = allImages[i].image
	}
	out, err := vipsArrayJoin(inputs, across)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// Mapim resamples an image using index to look up pixels
func (r *ImageRef) Mapim(index *ImageRef) error {
	out, err := vipsMapim(r.image, index.image)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// Maplut maps an image through another image acting as a LUT (Look Up Table)
func (r *ImageRef) Maplut(lut *ImageRef) error {
	out, err := vipsMaplut(r.image, lut.image)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// ExtractBand extracts one or more bands out of the image (replacing the associated ImageRef)
func (r *ImageRef) ExtractBand(band int, num int) error {
	out, err := vipsExtractBand(r.image, band, num)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// ExtractBandToImage extracts one or more bands out of the image to a new image
func (r *ImageRef) ExtractBandToImage(band int, num int) (*ImageRef, error) {
	out, err := vipsExtractBand(r.image, band, num)
	if err != nil {
		return nil, err
	}
	return newImageRef(out, ImageTypeUnknown, ImageTypeUnknown, nil), nil
}

// BandJoin joins a set of images together, bandwise.
func (r *ImageRef) BandJoin(images ...*ImageRef) error {
	vipsImages := []*C.VipsImage{r.image}
	for _, vipsImage := range images {
		vipsImages = append(vipsImages, vipsImage.image)
	}

	out, err := vipsBandJoin(vipsImages)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// BandSplit split an n-band image into n separate images..
func (r *ImageRef) BandSplit() ([]*ImageRef, error) {
	var out []*ImageRef
	for i := 0; i < r.Bands(); i++ {
		img, err := vipsExtractBand(r.image, i, 1)
		if err != nil {
			return out, err
		}
		out = append(out, &ImageRef{image: img})
	}
	return out, nil
}

// BandJoinConst appends a set of constant bands to an image.
func (r *ImageRef) BandJoinConst(constants []float64) error {
	out, err := vipsBandJoinConst(r.image, constants)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// AddAlpha adds an alpha channel to the associated image.
func (r *ImageRef) AddAlpha() error {
	if vipsHasAlpha(r.image) {
		return nil
	}

	out, err := vipsAddAlpha(r.image)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// PremultiplyAlpha premultiplies the alpha channel.
// See https://libvips.github.io/libvips/API/current/libvips-conversion.html#vips-premultiply
func (r *ImageRef) PremultiplyAlpha() error {
	if r.preMultiplication != nil || !vipsHasAlpha(r.image) {
		return nil
	}

	band := r.BandFormat()

	out, err := vipsPremultiplyAlpha(r.image)
	if err != nil {
		return err
	}
	r.preMultiplication = &PreMultiplicationState{
		bandFormat: band,
	}
	r.setImage(out)
	return nil
}

// UnpremultiplyAlpha unpremultiplies any alpha channel.
// See https://libvips.github.io/libvips/API/current/libvips-conversion.html#vips-unpremultiply
func (r *ImageRef) UnpremultiplyAlpha() error {
	if r.preMultiplication == nil {
		return nil
	}

	unpremultiplied, err := vipsUnpremultiplyAlpha(r.image)
	if err != nil {
		return err
	}
	defer clearImage(unpremultiplied)

	out, err := vipsCast(unpremultiplied, r.preMultiplication.bandFormat)
	if err != nil {
		return err
	}

	r.preMultiplication = nil
	r.setImage(out)
	return nil
}

// Cast converts the image to a target band format
func (r *ImageRef) Cast(format BandFormat) error {
	out, err := vipsCast(r.image, format)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// Add calculates a sum of the image + addend and stores it back in the image
func (r *ImageRef) Add(addend *ImageRef) error {
	out, err := vipsAdd(r.image, addend.image)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// Multiply calculates the product of the image * multiplier and stores it back in the image
func (r *ImageRef) Multiply(multiplier *ImageRef) error {
	out, err := vipsMultiply(r.image, multiplier.image)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// Divide calculates the product of the image / denominator and stores it back in the image
func (r *ImageRef) Divide(denominator *ImageRef) error {
	out, err := vipsDivide(r.image, denominator.image)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// Linear passes an image through a linear transformation (i.e. output = input * a + b).
// See https://libvips.github.io/libvips/API/current/libvips-arithmetic.html#vips-linear
func (r *ImageRef) Linear(a, b []float64) error {
	if len(a) != len(b) {
		return errors.New("a and b must be of same length")
	}

	out, err := vipsLinear(r.image, a, b, len(a))
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// Linear1 runs Linear() with a single constant.
// See https://libvips.github.io/libvips/API/current/libvips-arithmetic.html#vips-linear1
func (r *ImageRef) Linear1(a, b float64) error {
	out, err := vipsLinear1(r.image, a, b)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// Adjusts the image's gamma value.
// See https://www.libvips.org/API/current/libvips-conversion.html#vips-gamma
func (r *ImageRef) Gamma(gamma float64) error {
	out, err := vipsGamma(r.image, gamma)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// GetRotationAngleFromExif returns the angle which the image is currently rotated in.
// First returned value is the angle and second is a boolean indicating whether image is flipped.
// This is based on the EXIF orientation tag standard.
// If no proper orientation number is provided, the picture will be assumed to be upright.
func GetRotationAngleFromExif(orientation int) (Angle, bool) {
	switch orientation {
	case 0, 1, 2:
		return Angle0, orientation == 2
	case 3, 4:
		return Angle180, orientation == 4
	case 5, 8:
		return Angle90, orientation == 5
	case 6, 7:
		return Angle270, orientation == 7
	}

	return Angle0, false
}

// AutoRotate rotates the image upright based on the EXIF Orientation tag.
// It also resets the orientation information in the EXIF tag to be 1 (i.e. upright).
// N.B. libvips does not flip images currently (i.e. no support for orientations 2, 4, 5 and 7).
// N.B. due to the HEIF image standard, HEIF images are always autorotated by default on load.
// Thus, calling AutoRotate for HEIF images is not needed.
// todo: use https://www.libvips.org/API/current/libvips-conversion.html#vips-autorot-remove-angle
func (r *ImageRef) AutoRotate() error {
	out, err := vipsAutoRotate(r.image)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// ExtractArea crops the image to a specified area
func (r *ImageRef) ExtractArea(left, top, width, height int) error {
	if r.Height() > r.PageHeight() {
		// use animated extract area if more than 1 pages loaded
		out, err := vipsExtractAreaMultiPage(r.image, left, top, width, height)
		if err != nil {
			return err
		}
		r.setImage(out)
	} else {
		out, err := vipsExtractArea(r.image, left, top, width, height)
		if err != nil {
			return err
		}
		r.setImage(out)
	}
	return nil
}

// GetICCProfile retrieves the ICC profile data (if any) from the image.
func (r *ImageRef) GetICCProfile() []byte {
	bytes, _ := vipsGetICCProfile(r.image)
	return bytes
}

// RemoveICCProfile removes the ICC Profile information from the image.
// Typically, browsers and other software assume images without profile to be in the sRGB color space.
func (r *ImageRef) RemoveICCProfile() error {
	out, err := vipsCopyImage(r.image)
	if err != nil {
		return err
	}

	vipsRemoveICCProfile(out)

	r.setImage(out)
	return nil
}

// TransformICCProfileWithFallback transforms from the embedded ICC profile of the image to the ICC profile at the given path.
// The fallback ICC profile is used if the image does not have an embedded ICC profile.
func (r *ImageRef) TransformICCProfileWithFallback(targetProfilePath, fallbackProfilePath string) error {
	depth := 16
	if r.BandFormat() == BandFormatUchar || r.BandFormat() == BandFormatChar || r.BandFormat() == BandFormatNotSet {
		depth = 8
	}

	out, err := vipsICCTransform(r.image, targetProfilePath, fallbackProfilePath, IntentPerceptual, depth, true)
	if err != nil {
		govipsLog("govips", LogLevelError, fmt.Sprintf("failed to do icc transform: %v", err.Error()))
		return err
	}

	r.setImage(out)
	return nil
}

// TransformICCProfile transforms from the embedded ICC profile of the image to the icc profile at the given path.
func (r *ImageRef) TransformICCProfile(outputProfilePath string) error {
	return r.TransformICCProfileWithFallback(outputProfilePath, SRGBIEC6196621ICCProfilePath)
}

// OptimizeICCProfile optimizes the ICC color profile of the image.
// For two color channel images, it sets a grayscale profile.
// For color images, it sets a CMYK or non-CMYK profile based on the image metadata.
func (r *ImageRef) OptimizeICCProfile() error {
	inputProfile := r.determineInputICCProfile()
	if !r.HasICCProfile() && (inputProfile == "") {
		// No embedded ICC profile in the input image and no input profile determined, nothing to do.
		return nil
	}

	r.optimizedIccProfile = SRGBV2MicroICCProfilePath
	if r.Bands() <= 2 {
		r.optimizedIccProfile = SGrayV2MicroICCProfilePath
	}

	embedded := r.HasICCProfile() && (inputProfile == "")

	depth := 16
	if r.BandFormat() == BandFormatUchar || r.BandFormat() == BandFormatChar || r.BandFormat() == BandFormatNotSet {
		depth = 8
	}

	out, err := vipsICCTransform(r.image, r.optimizedIccProfile, inputProfile, IntentPerceptual, depth, embedded)
	if err != nil {
		govipsLog("govips", LogLevelError, fmt.Sprintf("failed to do icc transform: %v", err.Error()))
		return err
	}

	r.setImage(out)
	return nil
}

// RemoveMetadata removes the EXIF metadata from the image.
// N.B. this function won't remove the ICC profile, orientation and pages metadata
// because govips needs it to correctly display the image.
func (r *ImageRef) RemoveMetadata(keep ...string) error {
	out, err := vipsCopyImage(r.image)
	if err != nil {
		return err
	}

	vipsRemoveMetadata(out, keep...)

	r.setImage(out)

	return nil
}

func (r *ImageRef) ImageFields() []string {
	return r.GetFields()
}

func (r *ImageRef) GetFields() []string {
	return vipsImageGetFields(r.image)
}

func (r *ImageRef) SetBlob(name string, data []byte) {
	vipsImageSetBlob(r.image, name, data)
}

func (r *ImageRef) GetBlob(name string) []byte {
	return vipsImageGetBlob(r.image, name)
}

func (r *ImageRef) SetDouble(name string, f float64) {
	vipsImageSetDouble(r.image, name, f)
}

func (r *ImageRef) GetDouble(name string) float64 {
	return vipsImageGetDouble(r.image, name)
}

func (r *ImageRef) SetInt(name string, i int) {
	vipsImageSetInt(r.image, name, i)
}

func (r *ImageRef) GetInt(name string) int {
	return vipsImageGetInt(r.image, name)
}

func (r *ImageRef) SetString(name string, str string) {
	vipsImageSetString(r.image, name, str)
}

func (r *ImageRef) GetString(name string) string {
	return vipsImageGetString(r.image, name)
}

func (r *ImageRef) GetAsString(name string) string {
	return vipsImageGetAsString(r.image, name)
}

func (r *ImageRef) HasExif() bool {
	for _, field := range r.ImageFields() {
		if strings.HasPrefix(field, "exif-") {
			return true
		}
	}

	return false
}

func (r *ImageRef) GetExif() map[string]string {
	return vipsImageGetExifData(r.image)
}

// ToColorSpace changes the color space of the image to the interpretation supplied as the parameter.
func (r *ImageRef) ToColorSpace(interpretation Interpretation) error {
	out, err := vipsToColorSpace(r.image, interpretation)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// Flatten removes the alpha channel from the image and replaces it with the background color
func (r *ImageRef) Flatten(backgroundColor *Color) error {
	out, err := vipsFlatten(r.image, backgroundColor)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// GaussianBlur blurs the image
// add support minAmpl
func (r *ImageRef) GaussianBlur(sigmas ...float64) error {
	var (
		sigma   = sigmas[0]
		minAmpl = GaussBlurDefaultMinAMpl
	)
	if len(sigmas) >= 2 {
		minAmpl = sigmas[1]
	}
	out, err := vipsGaussianBlur(r.image, sigma, minAmpl)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// Sharpen sharpens the image
// sigma: sigma of the gaussian
// x1: flat/jaggy threshold
// m2: slope for jaggy areas
func (r *ImageRef) Sharpen(sigma float64, x1 float64, m2 float64) error {
	out, err := vipsSharpen(r.image, sigma, x1, m2)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// Apply Sobel edge detector to the image.
func (r *ImageRef) Sobel() error {
	out, err := vipsSobel(r.image)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// Modulate the colors
func (r *ImageRef) Modulate(brightness, saturation, hue float64) error {
	var err error
	var multiplications []float64
	var additions []float64

	colorspace := r.ColorSpace()
	if colorspace == InterpretationRGB {
		colorspace = InterpretationSRGB
	}

	multiplications = []float64{brightness, saturation, 1}
	additions = []float64{0, 0, hue}

	if r.HasAlpha() {
		multiplications = append(multiplications, 1)
		additions = append(additions, 0)
	}

	err = r.ToColorSpace(InterpretationLCH)
	if err != nil {
		return err
	}

	err = r.Linear(multiplications, additions)
	if err != nil {
		return err
	}

	err = r.ToColorSpace(colorspace)
	if err != nil {
		return err
	}

	return nil
}

// ModulateHSV modulates the image HSV values based on the supplier parameters.
func (r *ImageRef) ModulateHSV(brightness, saturation float64, hue int) error {
	var err error
	var multiplications []float64
	var additions []float64

	colorspace := r.ColorSpace()
	if colorspace == InterpretationRGB {
		colorspace = InterpretationSRGB
	}

	if r.HasAlpha() {
		multiplications = []float64{1, saturation, brightness, 1}
		additions = []float64{float64(hue), 0, 0, 0}
	} else {
		multiplications = []float64{1, saturation, brightness}
		additions = []float64{float64(hue), 0, 0}
	}

	err = r.ToColorSpace(InterpretationHSV)
	if err != nil {
		return err
	}

	err = r.Linear(multiplications, additions)
	if err != nil {
		return err
	}

	err = r.ToColorSpace(colorspace)
	if err != nil {
		return err
	}

	return nil
}

// Invert inverts the image
func (r *ImageRef) Invert() error {
	out, err := vipsInvert(r.image)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// Average finds the average value in an image
func (r *ImageRef) Average() (float64, error) {
	out, err := vipsAverage(r.image)
	if err != nil {
		return 0, err
	}
	return out, nil
}

// FindTrim returns the bounding box of the non-border part of the image
// Returned values are left, top, width, height
func (r *ImageRef) FindTrim(threshold float64, backgroundColor *Color) (int, int, int, int, error) {
	return vipsFindTrim(r.image, threshold, backgroundColor)
}

// GetPoint reads a single pixel on an image.
// The pixel values are returned in a slice of length n.
func (r *ImageRef) GetPoint(x int, y int) ([]float64, error) {
	n := 3
	if vipsHasAlpha(r.image) {
		n = 4
	}
	return vipsGetPoint(r.image, n, x, y)
}

// Stats find many image statistics in a single pass through the data. Image is changed into a one-band
// `BandFormatDouble` image of at least 10 columns by n + 1 (where n is number of bands in image in)
// rows. Columns are statistics, and are, in order: minimum, maximum, sum, sum of squares, mean,
// standard deviation, x coordinate of minimum, y coordinate of minimum, x coordinate of maximum,
// y coordinate of maximum.
//
// Row 0 has statistics for all bands together, row 1 has stats for band 1, and so on.
//
// If there is more than one maxima or minima, one of them will be chosen at random.
func (r *ImageRef) Stats() error {
	out, err := vipsStats(r.image)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// HistogramFind find the histogram the image.
// Find the histogram for all bands (producing a one-band histogram).
// char and uchar images are cast to uchar before histogramming, all other image types are cast to ushort.
func (r *ImageRef) HistogramFind() error {
	out, err := vipsHistFind(r.image)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// HistogramCumulative form cumulative histogram.
func (r *ImageRef) HistogramCumulative() error {
	out, err := vipsHistCum(r.image)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// HistogramNormalise
// The maximum of each band becomes equal to the maximum index, so for example the max for a uchar
// image becomes 255. Normalise each band separately.
func (r *ImageRef) HistogramNormalise() error {
	out, err := vipsHistNorm(r.image)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// HistogramEntropy estimate image entropy from a histogram. Entropy is calculated as:
// `-sum(p * log2(p))`
// where p is histogram-value / sum-of-histogram-values.
func (r *ImageRef) HistogramEntropy() (float64, error) {
	return vipsHistEntropy(r.image)
}

// DrawRect draws an (optionally filled) rectangle with a single colour
func (r *ImageRef) DrawRect(ink ColorRGBA, left int, top int, width int, height int, fill bool) error {
	err := vipsDrawRect(r.image, ink, left, top, width, height, fill)
	if err != nil {
		return err
	}
	return nil
}

// Rank does rank filtering on an image. A window of size width by height is passed over the image.
// At each position, the pixels inside the window are sorted into ascending order and the pixel at position
// index is output. index numbers from 0.
func (r *ImageRef) Rank(width int, height int, index int) error {
	out, err := vipsRank(r.image, width, height, index)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// Resize resizes the image based on the scale, maintaining aspect ratio
func (r *ImageRef) Resize(scale float64, kernel Kernel) error {
	return r.ResizeWithVScale(scale, -1, kernel)
}

// ResizeWithVScale resizes the image with both horizontal and vertical scaling.
// The parameters are the scaling factors.
func (r *ImageRef) ResizeWithVScale(hScale, vScale float64, kernel Kernel) error {
	if err := r.PremultiplyAlpha(); err != nil {
		return err
	}

	pages := r.Pages()
	pageHeight := r.GetPageHeight()

	out, err := vipsResizeWithVScale(r.image, hScale, vScale, kernel)
	if err != nil {
		return err
	}
	r.setImage(out)

	if pages > 1 {
		scale := hScale
		if vScale != -1 {
			scale = vScale
		}
		newPageHeight := int(float64(pageHeight)*scale + 0.5)
		if err := r.SetPageHeight(newPageHeight); err != nil {
			return err
		}
	}

	return r.UnpremultiplyAlpha()
}

// Thumbnail resizes the image to the given width and height.
// crop decides algorithm vips uses to shrink and crop to fill target,
func (r *ImageRef) Thumbnail(width, height int, crop Interesting) error {
	out, err := vipsThumbnail(r.image, width, height, crop, SizeBoth)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// ThumbnailWithSize resizes the image to the given width and height.
// crop decides algorithm vips uses to shrink and crop to fill target,
// size controls upsize, downsize, both or force
func (r *ImageRef) ThumbnailWithSize(width, height int, crop Interesting, size Size) error {
	out, err := vipsThumbnail(r.image, width, height, crop, size)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// Embed embeds the given picture in a new one, i.e. the opposite of ExtractArea
func (r *ImageRef) Embed(left, top, width, height int, extend ExtendStrategy) error {
	if r.Height() > r.PageHeight() {
		out, err := vipsEmbedMultiPage(r.image, left, top, width, height, extend)
		if err != nil {
			return err
		}
		r.setImage(out)
	} else {
		out, err := vipsEmbed(r.image, left, top, width, height, extend)
		if err != nil {
			return err
		}
		r.setImage(out)
	}
	return nil
}

// EmbedBackground embeds the given picture with a background color
func (r *ImageRef) EmbedBackground(left, top, width, height int, backgroundColor *Color) error {
	c := &ColorRGBA{
		R: backgroundColor.R,
		G: backgroundColor.G,
		B: backgroundColor.B,
		A: 255,
	}
	if r.Height() > r.PageHeight() {
		out, err := vipsEmbedMultiPageBackground(r.image, left, top, width, height, c)
		if err != nil {
			return err
		}
		r.setImage(out)
	} else {
		out, err := vipsEmbedBackground(r.image, left, top, width, height, c)
		if err != nil {
			return err
		}
		r.setImage(out)
	}
	return nil
}

// EmbedBackgroundRGBA embeds the given picture with a background rgba color
func (r *ImageRef) EmbedBackgroundRGBA(left, top, width, height int, backgroundColor *ColorRGBA) error {
	if r.Height() > r.PageHeight() {
		out, err := vipsEmbedMultiPageBackground(r.image, left, top, width, height, backgroundColor)
		if err != nil {
			return err
		}
		r.setImage(out)
	} else {
		out, err := vipsEmbedBackground(r.image, left, top, width, height, backgroundColor)
		if err != nil {
			return err
		}
		r.setImage(out)
	}
	return nil
}

// Zoom zooms the image by repeating pixels (fast nearest-neighbour)
func (r *ImageRef) Zoom(xFactor int, yFactor int) error {
	out, err := vipsZoom(r.image, xFactor, yFactor)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// Flip flips the image either horizontally or vertically based on the parameter
func (r *ImageRef) Flip(direction Direction) error {
	out, err := vipsFlip(r.image, direction)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// Recomb recombines the image bands using the matrix provided
func (r *ImageRef) Recomb(matrix [][]float64) error {
	numBands := r.Bands()
	// Ensure the provided matrix is 3x3
	if len(matrix) != 3 || len(matrix[0]) != 3 || len(matrix[1]) != 3 || len(matrix[2]) != 3 {
		return errors.New("Invalid recombination matrix")
	}
	// If the image is RGBA, expand the matrix to 4x4
	if numBands == 4 {
		matrix = append(matrix, []float64{0, 0, 0, 1})
		for i := 0; i < 3; i++ {
			matrix[i] = append(matrix[i], 0)
		}
	} else if numBands != 3 {
		return errors.New("Unsupported number of bands")
	}

	// Flatten the matrix
	var matrixValues []float64
	for _, row := range matrix {
		for _, value := range row {
			matrixValues = append(matrixValues, value)
		}
	}

	// Convert the Go slice to a C array and get its size
	matrixPtr := unsafe.Pointer(&matrixValues[0])
	matrixSize := C.size_t(len(matrixValues) * 8) // 8 bytes for each float64

	// Create a VipsImage from the matrix in memory
	matrixImage := C.vips_image_new_from_memory(matrixPtr, matrixSize, C.int(numBands), C.int(numBands), 1, C.VIPS_FORMAT_DOUBLE)

	// Check for any Vips errors
	errMsg := C.GoString(C.vips_error_buffer())
	if errMsg != "" {
		C.vips_error_clear()
		return errors.New("Vips error: " + errMsg)
	}

	// Recombine the image using the matrix
	out, err := vipsRecomb(r.image, matrixImage)
	if err != nil {
		return err
	}

	r.setImage(out)
	return nil
}

// Rotate rotates the image by multiples of 90 degrees. To rotate by arbitrary angles use Similarity.
func (r *ImageRef) Rotate(angle Angle) error {
	width := r.Width()

	if r.Pages() > 1 && (angle == Angle90 || angle == Angle270) {
		if angle == Angle270 {
			if err := r.Flip(DirectionHorizontal); err != nil {
				return err
			}
		}

		if err := r.Grid(r.GetPageHeight(), r.Pages(), 1); err != nil {
			return err
		}

		if angle == Angle270 {
			if err := r.Flip(DirectionHorizontal); err != nil {
				return err
			}
		}

	}

	out, err := vipsRotate(r.image, angle)
	if err != nil {
		return err
	}
	r.setImage(out)

	if r.Pages() > 1 && (angle == Angle90 || angle == Angle270) {
		if err := r.SetPageHeight(width); err != nil {
			return err
		}
	}
	return nil
}

// Similarity lets you scale, offset and rotate images by arbitrary angles in a single operation while defining the
// color of new background pixels. If the input image has no alpha channel, the alpha on `backgroundColor` will be
// ignored. You can add an alpha channel to an image with `BandJoinConst` (e.g. `img.BandJoinConst([]float64{255})`) or
// AddAlpha.
func (r *ImageRef) Similarity(scale float64, angle float64, backgroundColor *ColorRGBA,
	idx float64, idy float64, odx float64, ody float64) error {
	out, err := vipsSimilarity(r.image, scale, angle, backgroundColor, idx, idy, odx, ody)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// Grid tiles the image pages into a matrix across*down
func (r *ImageRef) Grid(tileHeight, across, down int) error {
	out, err := vipsGrid(r.image, tileHeight, across, down)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// SmartCrop will crop the image based on interesting factor
func (r *ImageRef) SmartCrop(width int, height int, interesting Interesting) error {
	out, err := vipsSmartCrop(r.image, width, height, interesting)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// Crop will crop the image based on coordinate and box size
func (r *ImageRef) Crop(left int, top int, width int, height int) error {
	out, err := vipsCrop(r.image, left, top, width, height)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// Label overlays a label on top of the image
func (r *ImageRef) Label(labelParams *LabelParams) error {
	out, err := labelImage(r.image, labelParams)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// Replicate repeats an image many times across and down
func (r *ImageRef) Replicate(across int, down int) error {
	out, err := vipsReplicate(r.image, across, down)
	if err != nil {
		return err
	}
	r.setImage(out)
	return nil
}

// ToBytes writes the image to memory in VIPs format and returns the raw bytes, useful for storage.
func (r *ImageRef) ToBytes() ([]byte, error) {
	var cSize C.size_t
	cData := C.vips_image_write_to_memory(r.image, &cSize)
	if cData == nil {
		return nil, errors.New("failed to write image to memory")
	}
	defer C.free(cData)

	data := C.GoBytes(unsafe.Pointer(cData), C.int(cSize))
	return data, nil
}

func (r *ImageRef) determineInputICCProfile() (inputProfile string) {
	if r.Interpretation() == InterpretationCMYK {
		inputProfile = "cmyk"
	}
	return
}

// ToImage converts a VIPs image to a golang image.Image object, useful for interoperability with other golang libraries
func (r *ImageRef) ToImage(params *ExportParams) (image.Image, error) {
	imageBytes, _, err := r.Export(params)
	if err != nil {
		return nil, err
	}

	reader := bytes.NewReader(imageBytes)
	img, _, err := image.Decode(reader)
	if err != nil {
		return nil, err
	}

	return img, nil
}

// setImage resets the image for this image and frees the previous one
func (r *ImageRef) setImage(image *C.VipsImage) {
	r.lock.Lock()
	defer r.lock.Unlock()

	if r.image == image {
		return
	}

	if r.image != nil {
		clearImage(r.image)
	}

	r.image = image
}

func vipsHasAlpha(in *C.VipsImage) bool {
	return int(C.has_alpha_channel(in)) > 0
}

func clearImage(ref *C.VipsImage) {
	C.clear_image(&ref)
}

// Coding represents VIPS_CODING type
type Coding int

// Coding enum
//
//goland:noinspection GoUnusedConst
const (
	CodingError Coding = C.VIPS_CODING_ERROR
	CodingNone  Coding = C.VIPS_CODING_NONE
	CodingLABQ  Coding = C.VIPS_CODING_LABQ
	CodingRAD   Coding = C.VIPS_CODING_RAD
)

func (r *ImageRef) newMetadata(format ImageType) *ImageMetadata {
	return &ImageMetadata{
		Format:      format,
		Width:       r.Width(),
		Height:      r.Height(),
		Colorspace:  r.ColorSpace(),
		Orientation: r.Orientation(),
		Pages:       r.Pages(),
	}
}

// Pixelate applies a simple pixelate filter to the image
func Pixelate(imageRef *ImageRef, factor float64) (err error) {
	if factor < 1 {
		return errors.New("factor must be greater then 1")
	}

	width := imageRef.Width()
	height := imageRef.Height()

	if err = imageRef.Resize(1/factor, KernelAuto); err != nil {
		return
	}

	hScale := float64(width) / float64(imageRef.Width())
	vScale := float64(height) / float64(imageRef.Height())
	if err = imageRef.ResizeWithVScale(hScale, vScale, KernelNearest); err != nil {
		return
	}

	return
}
