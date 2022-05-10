#include <stdlib.h>

typedef enum types {
  UNKNOWN = 0,
  JPEG,
  WEBP,
  PNG,
} ImageType;

typedef struct Result {
  void *buf;
  size_t len;
} Result;

typedef struct Options {
  int width;
  int height;
  int crop;
  int size;
  int quality;
  double blur;
  ImageType format;
} Options;

int manipulate(void *buf, size_t len, Result *result, Options options);
