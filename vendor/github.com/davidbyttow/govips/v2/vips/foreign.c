#include "foreign.h"

#include "lang.h"

void set_bool_param(Param *p, gboolean b) {
  p->type = PARAM_TYPE_BOOL;
  p->value.b = b;
  p->is_set = TRUE;
}

void set_int_param(Param *p, gint i) {
  p->type = PARAM_TYPE_INT;
  p->value.i = i;
  p->is_set = TRUE;
}

void set_double_param(Param *p, gdouble d) {
  p->type = PARAM_TYPE_DOUBLE;
  p->value.d = d;
  p->is_set = TRUE;
}

int load_image_buffer(LoadParams *params, void *buf, size_t len,
                      VipsImage **out) {
  int code = 1;
  ImageType imageType = params->inputFormat;

  if (imageType == JPEG) {
    // shrink: int, fail: bool, autorotate: bool
    code = vips_jpegload_buffer(buf, len, out, "fail", params->fail,
                                "autorotate", params->autorotate, "shrink",
                                params->jpegShrink, NULL);
  } else if (imageType == PNG) {
    code = vips_pngload_buffer(buf, len, out, NULL);
  } else if (imageType == WEBP) {
    // page: int, n: int, scale: double
    code = vips_webpload_buffer(buf, len, out, "page", params->page, "n",
                                params->n, NULL);
  } else if (imageType == TIFF) {
    // page: int, n: int, autorotate: bool, subifd: int
    code =
        vips_tiffload_buffer(buf, len, out, "page", params->page, "n",
                             params->n, "autorotate", params->autorotate, NULL);
  } else if (imageType == GIF) {
    // page: int, n: int, scale: double
    code = vips_gifload_buffer(buf, len, out, "page", params->page, "n",
                               params->n, NULL);
  } else if (imageType == PDF) {
    // page: int, n: int, dpi: double, scale: double, background: color
    code = vips_pdfload_buffer(buf, len, out, "page", params->page, "n",
                               params->n, "dpi", params->dpi, NULL);
  } else if (imageType == SVG) {
    // dpi: double, scale: double, unlimited: bool
    code = vips_svgload_buffer(buf, len, out, "dpi", params->dpi, "unlimited",
                               params->svgUnlimited, NULL);
  } else if (imageType == HEIF) {
    // added autorotate on load as currently it addresses orientation issues
    // https://github.com/libvips/libvips/pull/1680
    // page: int, n: int, thumbnail: bool
    code = vips_heifload_buffer(buf, len, out, "page", params->page, "n",
                                params->n, "thumbnail", params->heifThumbnail,
                                "autorotate", TRUE, NULL);
  } else if (imageType == MAGICK) {
    // page: int, n: int, density: string
    code = vips_magickload_buffer(buf, len, out, "page", params->page, "n",
                                  params->n, NULL);
  } else if (imageType == AVIF) {
    code = vips_heifload_buffer(buf, len, out, "page", params->page, "n",
                                params->n, "thumbnail", params->heifThumbnail,
                                "autorotate", params->autorotate, NULL);

  }
  #if (VIPS_MAJOR_VERSION >= 8) && (VIPS_MINOR_VERSION >= 11)
  else if (imageType == JP2K) {
       code = vips_jp2kload_buffer(buf, len, out, "page", params->page, NULL);
  }
  #endif

  return code;
}

#define MAYBE_SET_BOOL(OP, PARAM, NAME)                          \
  if (PARAM.is_set) {                                            \
    vips_object_set(VIPS_OBJECT(OP), NAME, PARAM.value.b, NULL); \
  }

#define MAYBE_SET_INT(OP, PARAM, NAME)                           \
  if (PARAM.is_set) {                                            \
    vips_object_set(VIPS_OBJECT(OP), NAME, PARAM.value.i, NULL); \
  }

#define MAYBE_SET_DOUBLE(OP, PARAM, NAME)                        \
  if (PARAM.is_set) {                                            \
    vips_object_set(VIPS_OBJECT(OP), NAME, PARAM.value.d, NULL); \
  }

typedef int (*SetLoadOptionsFn)(VipsOperation *operation, LoadParams *params);

int set_jpegload_options(VipsOperation *operation, LoadParams *params) {
  MAYBE_SET_BOOL(operation, params->autorotate, "autorotate");
  MAYBE_SET_BOOL(operation, params->fail, "fail");
  MAYBE_SET_INT(operation, params->jpegShrink, "shrink");
  return 0;
}

int set_pngload_options(VipsOperation *operation, LoadParams *params) {
  MAYBE_SET_BOOL(operation, params->fail, "fail");
  return 0;
}

int set_webpload_options(VipsOperation *operation, LoadParams *params) {
  MAYBE_SET_INT(operation, params->page, "page");
  MAYBE_SET_INT(operation, params->n, "n");
  return 0;
}

int set_tiffload_options(VipsOperation *operation, LoadParams *params) {
  MAYBE_SET_BOOL(operation, params->autorotate, "autorotate");
  MAYBE_SET_INT(operation, params->page, "page");
  MAYBE_SET_INT(operation, params->n, "n");
  return 0;
}

int set_gifload_options(VipsOperation *operation, LoadParams *params) {
  MAYBE_SET_INT(operation, params->page, "page");
  MAYBE_SET_INT(operation, params->n, "n");
  return 0;
}

int set_pdfload_options(VipsOperation *operation, LoadParams *params) {
  MAYBE_SET_INT(operation, params->page, "page");
  MAYBE_SET_INT(operation, params->n, "n");
  MAYBE_SET_DOUBLE(operation, params->dpi, "dpi");
  return 0;
}

int set_svgload_options(VipsOperation *operation, LoadParams *params) {
  MAYBE_SET_BOOL(operation, params->svgUnlimited, "unlimited");
  MAYBE_SET_DOUBLE(operation, params->dpi, "dpi");
  return 0;
}

int set_heifload_options(VipsOperation *operation, LoadParams *params) {
  MAYBE_SET_BOOL(operation, params->autorotate, "autorotate");
  MAYBE_SET_BOOL(operation, params->heifThumbnail, "thumbnail");
  MAYBE_SET_INT(operation, params->page, "page");
  MAYBE_SET_INT(operation, params->n, "n");
  return 0;
}

int set_jp2kload_options(VipsOperation *operation, LoadParams *params) {
  MAYBE_SET_INT(operation, params->page, "page");
  return 0;
}

int set_jxlload_options(VipsOperation *operation, LoadParams *params) {
  // nothing need to do
  return 0;
}

int set_magickload_options(VipsOperation *operation, LoadParams *params) {
  MAYBE_SET_INT(operation, params->page, "page");
  MAYBE_SET_INT(operation, params->n, "n");
  return 0;
}

int load_buffer(const char *operationName, void *buf, size_t len,
                LoadParams *params, SetLoadOptionsFn setLoadOptions) {
  VipsBlob *blob = vips_blob_new(NULL, buf, len);

  VipsOperation *operation = vips_operation_new(operationName);
  if (!operation) {
    return 1;
  }

  if (vips_object_set(VIPS_OBJECT(operation), "buffer", blob, NULL)) {
    vips_area_unref(VIPS_AREA(blob));
    return 1;
  }

  vips_area_unref(VIPS_AREA(blob));

  if (setLoadOptions(operation, params)) {
    vips_object_unref_outputs(VIPS_OBJECT(operation));
    g_object_unref(operation);
    return 1;
  }

  if (vips_cache_operation_buildp(&operation)) {
    vips_object_unref_outputs(VIPS_OBJECT(operation));
    g_object_unref(operation);
    return 1;
  }

  g_object_get(VIPS_OBJECT(operation), "out", &params->outputImage, NULL);

  vips_object_unref_outputs(VIPS_OBJECT(operation));
  g_object_unref(operation);

  return 0;
}

typedef int (*SetSaveOptionsFn)(VipsOperation *operation, SaveParams *params);

int save_buffer(const char *operationName, SaveParams *params,
                SetSaveOptionsFn setSaveOptions) {
  VipsBlob *blob;
  VipsOperation *operation = vips_operation_new(operationName);
  if (!operation) {
    return 1;
  }

  if (vips_object_set(VIPS_OBJECT(operation), "in", params->inputImage, NULL)) {
    return 1;
  }

  if (setSaveOptions(operation, params)) {
    g_object_unref(operation);
    return 1;
  }

  if (vips_cache_operation_buildp(&operation)) {
    vips_object_unref_outputs(VIPS_OBJECT(operation));
    g_object_unref(operation);
    return 1;
  }

  g_object_get(VIPS_OBJECT(operation), "buffer", &blob, NULL);
  g_object_unref(operation);

  VipsArea *area = VIPS_AREA(blob);

  params->outputBuffer = (char *)(area->data);
  params->outputLen = area->length;
  area->free_fn = NULL;
  vips_area_unref(area);

  return 0;
}

// https://libvips.github.io/libvips/API/current/VipsForeignSave.html#vips-jpegsave-buffer
int set_jpegsave_options(VipsOperation *operation, SaveParams *params) {
  int ret = vips_object_set(
      VIPS_OBJECT(operation), "strip", params->stripMetadata, "optimize_coding",
      params->jpegOptimizeCoding, "interlace", params->interlace,
      "subsample_mode", params->jpegSubsample, "trellis_quant",
      params->jpegTrellisQuant, "overshoot_deringing",
      params->jpegOvershootDeringing, "optimize_scans",
      params->jpegOptimizeScans, "quant_table", params->jpegQuantTable, NULL);

  if (!ret && params->quality) {
    ret = vips_object_set(VIPS_OBJECT(operation), "Q", params->quality, NULL);
  }

  return ret;
}

// https://libvips.github.io/libvips/API/current/VipsForeignSave.html#vips-pngsave-buffer
int set_pngsave_options(VipsOperation *operation, SaveParams *params) {
  int ret =
      vips_object_set(VIPS_OBJECT(operation), "strip", params->stripMetadata,
                      "compression", params->pngCompression, "interlace",
                      params->interlace, "filter", params->pngFilter, "palette",
                      params->pngPalette, NULL);

  if (!ret && params->quality) {
    ret = vips_object_set(VIPS_OBJECT(operation), "Q", params->quality, NULL);
  }

  if (!ret && params->pngDither) {
    ret = vips_object_set(VIPS_OBJECT(operation), "dither", params->pngDither, NULL);
  }

  if (!ret && params->pngBitdepth) {
    ret = vips_object_set(VIPS_OBJECT(operation), "bitdepth", params->pngBitdepth, NULL);
  }

  // TODO: Handle `profile` param.

  return ret;
}

// https://github.com/libvips/libvips/blob/master/libvips/foreign/webpsave.c#L524
// https://libvips.github.io/libvips/API/current/VipsForeignSave.html#vips-webpsave-buffer
int set_webpsave_options(VipsOperation *operation, SaveParams *params) {
  int ret =
      vips_object_set(VIPS_OBJECT(operation),
                      "strip", params->stripMetadata,
                      "lossless", params->webpLossless,
                      "near_lossless", params->webpNearLossless,
                      "reduction_effort", params->webpReductionEffort,
                      "profile", params->webpIccProfile ? params->webpIccProfile : "none",
                      "min_size", params->webpMinSize,
                      "kmin", params->webpKMin,
                      "kmax", params->webpKMax,
                      NULL);

  if (!ret && params->quality) {
    ret = vips_object_set(VIPS_OBJECT(operation), "Q", params->quality, NULL);
  }

  return ret;
}

// https://libvips.github.io/libvips/API/current/VipsForeignSave.html#vips-tiffsave-buffer
int set_tiffsave_options(VipsOperation *operation, SaveParams *params) {
  int ret = vips_object_set(
      VIPS_OBJECT(operation), "strip", params->stripMetadata, "compression",
      params->tiffCompression, "predictor", params->tiffPredictor, "pyramid",
      params->tiffPyramid, "tile_height", params->tiffTileHeight, "tile_width",
      params->tiffTileWidth, "tile", params->tiffTile, NULL);

  if (!ret && params->quality) {
    ret = vips_object_set(VIPS_OBJECT(operation), "Q", params->quality, NULL);
  }

  return ret;
}

// https://libvips.github.io/libvips/API/current/VipsForeignSave.html#vips-magicksave-buffer
int set_magicksave_options(VipsOperation *operation, SaveParams *params) {
  int ret = vips_object_set(VIPS_OBJECT(operation), "format", "GIF", "bitdepth", params->gifBitdepth, NULL);

  if (!ret && params->quality) {
    ret = vips_object_set(VIPS_OBJECT(operation), "quality", params->quality,
                          NULL);
  }
  return ret;
}

// https://libvips.github.io/libvips/API/current/VipsForeignSave.html#vips-gifsave-buffer
int set_gifsave_options(VipsOperation *operation, SaveParams *params) {
  int ret = 0;
  // See for argument values: https://www.libvips.org/API/current/VipsForeignSave.html#vips-gifsave
  if (params->gifDither > 0.0 && params->gifDither <= 10) {
    ret = vips_object_set(VIPS_OBJECT(operation), "dither", params->gifDither, NULL);
  }
  if (params->gifEffort >= 1 && params->gifEffort <= 10) {
    ret = vips_object_set(VIPS_OBJECT(operation), "effort", params->gifEffort, NULL);
  }
  if (params->gifBitdepth >= 1 && params->gifBitdepth <= 8) {
      ret = vips_object_set(VIPS_OBJECT(operation), "bitdepth", params->gifBitdepth, NULL);
  }
  return ret;
}

// https://github.com/libvips/libvips/blob/master/libvips/foreign/heifsave.c#L653
int set_heifsave_options(VipsOperation *operation, SaveParams *params) {
  int ret = vips_object_set(VIPS_OBJECT(operation), "lossless",
                            params->heifLossless, NULL);

#if (VIPS_MAJOR_VERSION >= 8) && (VIPS_MINOR_VERSION >= 13)
  if (!ret && params->heifBitdepth && params->heifEffort) {
    ret = vips_object_set(VIPS_OBJECT(operation), "bitdepth",
                          params->heifBitdepth, "effort", params->heifEffort,
                          NULL);
  }
#else
  if (!ret && params->heifEffort) {
    ret = vips_object_set(VIPS_OBJECT(operation), "speed", params->heifEffort,
                          NULL);
  }
#endif

  if (!ret && params->quality) {
    ret = vips_object_set(VIPS_OBJECT(operation), "Q", params->quality, NULL);
  }

  return ret;
}

// https://github.com/libvips/libvips/blob/master/libvips/foreign/heifsave.c#L653
int set_avifsave_options(VipsOperation *operation, SaveParams *params) {
  int ret = vips_object_set(VIPS_OBJECT(operation), "strip", params->stripMetadata, "compression",
                            VIPS_FOREIGN_HEIF_COMPRESSION_AV1, "lossless",
                            params->heifLossless, NULL);

#if (VIPS_MAJOR_VERSION >= 8) && (VIPS_MINOR_VERSION >= 13)
  if (!ret && params->heifBitdepth && params->heifEffort) {
    ret = vips_object_set(VIPS_OBJECT(operation), "bitdepth",
                          params->heifBitdepth, "effort", params->heifEffort,
                          NULL);
  }
#else
  if (!ret && params->heifEffort) {
    ret = vips_object_set(VIPS_OBJECT(operation), "speed", params->heifEffort,
                          NULL);
  }
#endif

  if (!ret && params->quality) {
    ret = vips_object_set(VIPS_OBJECT(operation), "Q", params->quality, NULL);
  }

  return ret;
}

int set_jp2ksave_options(VipsOperation *operation, SaveParams *params) {
  int ret = vips_object_set(
      VIPS_OBJECT(operation), "subsample_mode", params->jpegSubsample,
      "tile_height", params->jp2kTileHeight, "tile_width", params->jp2kTileWidth,
      "lossless", params->jp2kLossless, NULL);

  if (!ret && params->quality) {
    ret = vips_object_set(VIPS_OBJECT(operation), "Q", params->quality, NULL);
  }

  return ret;
}

int set_jxlsave_options(VipsOperation *operation, SaveParams *params) {
  int ret = vips_object_set(
      VIPS_OBJECT(operation), "tier", params->jxlTier,
      "distance", params->jxlDistance, "effort", params->jxlEffort,
      "lossless", params->jxlLossless, NULL);

  if (!ret && params->quality) {
    ret = vips_object_set(VIPS_OBJECT(operation), "Q", params->quality, NULL);
  }

  return ret;
}

int load_from_buffer(LoadParams *params, void *buf, size_t len) {
  switch (params->inputFormat) {
    case JPEG:
      return load_buffer("jpegload_buffer", buf, len, params,
                         set_jpegload_options);
    case PNG:
      return load_buffer("pngload_buffer", buf, len, params,
                         set_pngload_options);
    case WEBP:
      return load_buffer("webpload_buffer", buf, len, params,
                         set_webpload_options);
    case HEIF:
      return load_buffer("heifload_buffer", buf, len, params,
                         set_heifload_options);
    case TIFF:
      return load_buffer("tiffload_buffer", buf, len, params,
                         set_tiffload_options);
    case SVG:
      return load_buffer("svgload_buffer", buf, len, params,
                         set_svgload_options);
    case GIF:
      return load_buffer("gifload_buffer", buf, len, params,
                         set_gifload_options);
    case PDF:
      return load_buffer("pdfload_buffer", buf, len, params,
                         set_pdfload_options);
    case MAGICK:
      return load_buffer("magickload_buffer", buf, len, params,
                         set_magickload_options);
    case AVIF:
      return load_buffer("heifload_buffer", buf, len, params,
                         set_heifload_options);
    case JP2K:
      return load_buffer("jp2kload_buffer", buf, len, params,
                          set_jp2kload_options);
    case JXL:
      return load_buffer("jxlload_buffer", buf, len, params,
                          set_jxlload_options);
    default:
      g_warning("Unsupported input type given: %d", params->inputFormat);
  }
  return 1;
}

int save_to_buffer(SaveParams *params) {
  switch (params->outputFormat) {
    case JPEG:
      return save_buffer("jpegsave_buffer", params, set_jpegsave_options);
    case PNG:
      return save_buffer("pngsave_buffer", params, set_pngsave_options);
    case WEBP:
      return save_buffer("webpsave_buffer", params, set_webpsave_options);
    case HEIF:
      return save_buffer("heifsave_buffer", params, set_heifsave_options);
    case TIFF:
      return save_buffer("tiffsave_buffer", params, set_tiffsave_options);
    case GIF:
#if (VIPS_MAJOR_VERSION >= 8) && (VIPS_MINOR_VERSION >= 12)
      return save_buffer("gifsave_buffer", params, set_gifsave_options);
#else
      return save_buffer("magicksave_buffer", params, set_magicksave_options);
#endif
    case AVIF:
      return save_buffer("heifsave_buffer", params, set_avifsave_options);
    case JP2K:
      return save_buffer("jp2ksave_buffer", params, set_jp2ksave_options);
    case JXL:
      return save_buffer("jxlsave_buffer", params, set_jxlsave_options);
    default:
      g_warning("Unsupported output type given: %d", params->outputFormat);
  }
  return 1;
}

LoadParams create_load_params(ImageType inputFormat) {
  Param defaultParam = {};
  LoadParams p = {
      .inputFormat = inputFormat,
      .inputBlob = NULL,
      .outputImage = NULL,
      .autorotate = defaultParam,
      .fail = defaultParam,
      .page = defaultParam,
      .n = defaultParam,
      .dpi = defaultParam,
      .jpegShrink = defaultParam,
      .heifThumbnail = defaultParam,
      .svgUnlimited = defaultParam,
  };
  return p;
}

// TODO: Change to same pattern as ImportParams

static SaveParams defaultSaveParams = {
    .inputImage = NULL,
    .outputBuffer = NULL,
    .outputFormat = JPEG,
    .outputLen = 0,

    .interlace = FALSE,
    .quality = 0,
    .stripMetadata = FALSE,

    .jpegOptimizeCoding = FALSE,
    .jpegSubsample = VIPS_FOREIGN_JPEG_SUBSAMPLE_ON,
    .jpegTrellisQuant = FALSE,
    .jpegOvershootDeringing = FALSE,
    .jpegOptimizeScans = FALSE,
    .jpegQuantTable = 0,

    .pngCompression = 6,
    .pngPalette = FALSE,
    .pngBitdepth = 0,
    .pngDither = 0,
    .pngFilter = VIPS_FOREIGN_PNG_FILTER_NONE,

    .gifDither = 0.0,
    .gifEffort = 0,
    .gifBitdepth = 0,

    .webpLossless = FALSE,
    .webpNearLossless = FALSE,
    .webpReductionEffort = 4,
    .webpIccProfile = NULL,
    .webpKMax = 0,
    .webpKMin = 0,
    .webpMinSize = FALSE,

    .heifBitdepth = 8,
    .heifLossless = FALSE,
    .heifEffort = 5,

    .tiffCompression = VIPS_FOREIGN_TIFF_COMPRESSION_LZW,
    .tiffPredictor = VIPS_FOREIGN_TIFF_PREDICTOR_HORIZONTAL,
    .tiffPyramid = FALSE,
    .tiffTile = FALSE,
    .tiffTileHeight = 256,
    .tiffTileWidth = 256,

    .jp2kLossless = FALSE,
    .jp2kTileHeight = 512,
    .jp2kTileWidth = 512,

    .jxlTier = 0,
    .jxlDistance = 1.0,
    .jxlEffort = 7,
    .jxlLossless = FALSE,
    };

SaveParams create_save_params(ImageType outputFormat) {
  SaveParams params = defaultSaveParams;
  params.outputFormat = outputFormat;
  return params;
}
