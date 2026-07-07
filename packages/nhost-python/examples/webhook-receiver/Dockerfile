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

EXPOSE 8080
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
