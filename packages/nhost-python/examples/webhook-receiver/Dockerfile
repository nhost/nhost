# Build with the SDK package root (packages/nhost-python) as the build context
# so the local SDK can be installed alongside the example:
#
#   docker build -f examples/webhook-receiver/Dockerfile -t webhook-receiver:dev .
#
# (run from packages/nhost-python)
FROM python:3.11-slim

WORKDIR /app

# Install the Nhost SDK from the copied package source.
COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install --no-cache-dir .

# Install the example's third-party deps and app.
COPY examples/webhook-receiver/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY examples/webhook-receiver/app.py ./app.py

# Drop privileges: the service receives untrusted external input, so it should
# not run as root. The copied files are world-readable, so uid 10001 can read them.
RUN useradd --create-home --uid 10001 app
USER app

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/healthz')" || exit 1
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
