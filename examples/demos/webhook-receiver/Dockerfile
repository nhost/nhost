# Build with the repository root as the build context, so both the example and
# the local SDK it depends on are available:
#
#   docker build -f examples/demos/webhook-receiver/Dockerfile -t webhook-receiver:dev .
#
# (run from the repository root)
FROM python:3.11-slim

# The repo layout is mirrored inside the image so the relative path in the
# runtime-only requirements.txt (-e ../../../packages/nhost-python) resolves
# exactly as it does in a checkout. Development tools stay out of this image.
WORKDIR /app/examples/demos/webhook-receiver

COPY packages/nhost-python /app/packages/nhost-python
COPY examples/demos/webhook-receiver/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY examples/demos/webhook-receiver/app.py ./app.py

# Drop privileges: the service receives untrusted external input, so it should
# not run as root. The copied files are world-readable, so uid 10001 can read them.
RUN useradd --create-home --uid 10001 app
USER app

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/healthz')" || exit 1
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--limit-concurrency", "64", "--timeout-keep-alive", "10"]
