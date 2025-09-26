#include "govips.h"

static void govips_logging_handler(const gchar *log_domain,
                                   GLogLevelFlags log_level,
                                   const gchar *message, gpointer user_data) {
  govipsLoggingHandler((char *)log_domain, (int)log_level, (char *)message);
}

static void null_logging_handler(const gchar *log_domain,
                                 GLogLevelFlags log_level, const gchar *message,
                                 gpointer user_data) {}

void vips_set_logging_handler(void) {
  g_log_set_default_handler(govips_logging_handler, NULL);
}

void vips_unset_logging_handler(void) {
  g_log_set_default_handler(null_logging_handler, NULL);
}

/* This function skips the Govips logging handler and logs
   directly to stdout. To be used only for testing and debugging.
   Needed for CI because of a Go macOS bug which doesn't clean cgo callbacks on
   exit. */
void vips_default_logging_handler(void) {
  g_log_set_default_handler(g_log_default_handler, NULL);
}