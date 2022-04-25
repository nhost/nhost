#include "label.h"

int text(VipsImage **out, const char *text, const char *font, int width,
         int height, VipsAlign align, int dpi) {
  return vips_text(out, text, "font", font, "width", width, "height", height,
                   "align", align, "dpi", dpi, NULL);
}

int label(VipsImage *in, VipsImage **out, LabelOptions *o) {
  double ones[3] = {1, 1, 1};
  VipsImage *base = vips_image_new();
  VipsImage **t = (VipsImage **)vips_object_local_array(VIPS_OBJECT(base), 9);
  if (vips_text(&t[0], o->Text, "font", o->Font, "width", o->Width, "height",
                o->Height, "align", o->Align, NULL) ||
      vips_linear1(t[0], &t[1], o->Opacity, 0.0, NULL) ||
      vips_cast(t[1], &t[2], VIPS_FORMAT_UCHAR, NULL) ||
      vips_embed(t[2], &t[3], o->OffsetX, o->OffsetY, t[2]->Xsize + o->OffsetX,
                 t[2]->Ysize + o->OffsetY, NULL)) {
    g_object_unref(base);
    return 1;
  }
  if (vips_black(&t[4], 1, 1, NULL) ||
      vips_linear(t[4], &t[5], ones, o->Color, 3, NULL) ||
      vips_cast(t[5], &t[6], VIPS_FORMAT_UCHAR, NULL) ||
      vips_copy(t[6], &t[7], "interpretation", in->Type, NULL) ||
      vips_embed(t[7], &t[8], 0, 0, in->Xsize, in->Ysize, "extend",
                 VIPS_EXTEND_COPY, NULL)) {
    g_object_unref(base);
    return 1;
  }
  if (vips_ifthenelse(t[3], t[8], in, out, "blend", TRUE, NULL)) {
    g_object_unref(base);
    return 1;
  }
  g_object_unref(base);
  return 0;
}
