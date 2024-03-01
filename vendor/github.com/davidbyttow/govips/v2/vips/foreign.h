// https://libvips.github.io/libvips/API/current/VipsForeignSave.html

// clang-format off
// include order matters
#include <stdlib.h>

#include <vips/vips.h>
#include <vips/foreign.h>
// clang-format n

#ifndef BOOL
#define BOOL int
#endif

typedef enum types {
  UNKNOWN = 0,
  JPEG,
  WEBP,
  PNG,
  TIFF,
  GIF,
  PDF,
  SVG,
  MAGICK,
  HEIF,
  BMP,
  AVIF,
  JP2K,
  JXL
} ImageType;

typedef enum ParamType {
  PARAM_TYPE_NULL,
  PARAM_TYPE_BOOL,
  PARAM_TYPE_INT,
  PARAM_TYPE_DOUBLE,
} ParamType;

typedef struct Param {
  ParamType type;

  union Value {
    gboolean b;
    gint i;
    gdouble d;
  } value;

  gboolean is_set;

} Param;

void set_bool_param(Param *p, gboolean b);
void set_int_param(Param *p, gint i);
void set_double_param(Param *p, gdouble d);

typedef struct LoadParams {
  ImageType inputFormat;
  VipsBlob *inputBlob;
  VipsImage *outputImage;

  Param autorotate;
  Param fail;
  Param page;
  Param n;
  Param dpi;
  Param jpegShrink;
  Param heifThumbnail;
  Param svgUnlimited;

} LoadParams;

LoadParams create_load_params(ImageType inputFormat);
int load_from_buffer(LoadParams *params, void *buf, size_t len);

typedef struct SaveParams {
  VipsImage *inputImage;
  void *outputBuffer;
  ImageType outputFormat;
  size_t outputLen;

  BOOL stripMetadata;
  int quality;
  BOOL interlace;

  // JPEG
  BOOL jpegOptimizeCoding;
  VipsForeignJpegSubsample jpegSubsample;
  BOOL jpegTrellisQuant;
  BOOL jpegOvershootDeringing;
  BOOL jpegOptimizeScans;
  int jpegQuantTable;

  // PNG
  int pngCompression;
  VipsForeignPngFilter pngFilter;
  BOOL pngPalette;
  double pngDither;
  int pngBitdepth;

  // GIF (with CGIF)
  double gifDither;
  int gifEffort;
  int gifBitdepth;

  // WEBP
  BOOL webpLossless;
  BOOL webpNearLossless;
  int webpReductionEffort;
  char *webpIccProfile;
  BOOL webpMinSize;
  int webpKMin;
  int webpKMax;

  // HEIF - https://github.com/libvips/libvips/blob/master/libvips/foreign/heifsave.c#L71
  int heifBitdepth; // Bitdepth to save at for >8 bit images
  BOOL heifLossless; // Lossless compression
  int heifEffort; // CPU effort (0 - 9)

  // TIFF
  VipsForeignTiffCompression tiffCompression;
  VipsForeignTiffPredictor tiffPredictor;
  BOOL tiffPyramid;
  BOOL tiffTile;
  int tiffTileHeight;
  int tiffTileWidth;

  // JPEG2000
  BOOL jp2kLossless;
  int jp2kTileWidth;
  int	jp2kTileHeight;

  // JXL
  int jxlTier;
  double jxlDistance;
  int jxlEffort;
  BOOL jxlLossless;
} SaveParams;

SaveParams create_save_params(ImageType outputFormat);
int save_to_buffer(SaveParams *params);

