# Build with the package root (packages/nhost-python-run) as the build context
# so nhost-run can be installed alongside the example:
#
#   docker build -f examples/webhook-receiver/Dockerfile -t webhook-receiver:dev .
#
# (run from packages/nhost-python-run)
FROM python:3.11-slim

WORKDIR /app

# Install nhost-run from the copied package source (brings in uvicorn).
COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install --no-cache-dir .

# Install the example's third-party deps and app.
COPY examples/webhook-receiver/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY examples/webhook-receiver/app.py ./app.py

EXPOSE 8080
CMD ["python", "app.py"]
