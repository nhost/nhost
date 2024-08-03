// https://libvips.github.io/libvips/API/current/libvips-conversion.html

#include <stdlib.h>
#include <vips/vips.h>

int copy_image_changing_interpretation(VipsImage *in, VipsImage **out,
                                       VipsInterpretation interpretation);
int copy_image_changing_resolution(VipsImage *in, VipsImage **out, double xres,
                                   double yres);
int copy_image(VipsImage *in, VipsImage **out);

int embed_image(VipsImage *in, VipsImage **out, int left, int top, int width,
                int height, int extend);
int embed_image_background(VipsImage *in, VipsImage **out, int left, int top, int width,
                int height, double r, double g, double b, double a);
int embed_multi_page_image(VipsImage *in, VipsImage **out, int left, int top, int width,
                int height, int extend);
int embed_multi_page_image_background(VipsImage *in, VipsImage **out, int left, int top,
                int width, int height, double r, double g, double b, double a);

int flip_image(VipsImage *in, VipsImage **out, int direction);

int recomb_image(VipsImage *in, VipsImage **out, VipsImage *m);

int extract_image_area(VipsImage *in, VipsImage **out, int left, int top,
                       int width, int height);
int extract_area_multi_page(VipsImage *in, VipsImage **out, int left, int top,
                       int width, int height);

int extract_band(VipsImage *in, VipsImage **out, int band, int num);

int rot_image(VipsImage *in, VipsImage **out, VipsAngle angle);
int autorot_image(VipsImage *in, VipsImage **out);

int zoom_image(VipsImage *in, VipsImage **out, int xfac, int yfac);
int smartcrop(VipsImage *in, VipsImage **out, int width, int height,
              int interesting);
int crop(VipsImage *in, VipsImage **out, int left, int top,
              int width, int height);

int bandjoin(VipsImage **in, VipsImage **out, int n);
int bandjoin_const(VipsImage *in, VipsImage **out, double constants[], int n);
int similarity(VipsImage *in, VipsImage **out, double scale, double angle,
               double r, double g, double b, double a, double idx, double idy,
               double odx, double ody);
int flatten_image(VipsImage *in, VipsImage **out, double r, double g, double b);
int add_alpha(VipsImage *in, VipsImage **out);
int premultiply_alpha(VipsImage *in, VipsImage **out);
int unpremultiply_alpha(VipsImage *in, VipsImage **out);
int cast(VipsImage *in, VipsImage **out, int bandFormat);
double max_alpha(VipsImage *in);

int composite_image(VipsImage **in, VipsImage **out, int n, int *mode, int *x,
                    int *y);
int composite2_image(VipsImage *base, VipsImage *overlay, VipsImage **out,
                     int mode, gint x, gint y);

int insert_image(VipsImage *main, VipsImage *sub, VipsImage **out, int x, int y,
                 int expand, double r, double g, double b, double a);

int join(VipsImage *in1, VipsImage *in2, VipsImage **out, int direction);
int arrayjoin(VipsImage **in, VipsImage **out, int n, int across);

int is_16bit(VipsInterpretation interpretation);

int replicate(VipsImage *in, VipsImage **out, int across, int down);

int grid(VipsImage *in, VipsImage **out, int tileHeight, int across, int down);

int adjust_gamma(VipsImage *in, VipsImage **out, double g);
