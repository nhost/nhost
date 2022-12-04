# Nhost CLI GitHub Action

## Usage

```yaml
job:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Nhost CLI and start app
        uses: ./.github/actions/nhost-cli
```

### Set another working directory

```yaml
job:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Install Nhost CLI
        uses: ./.github/actions/nhost-cli
        with:
          path: examples/react-apollo
```

### Install the CLI without starting the app

```yaml
job:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Install Nhost CLI
        uses: ./.github/actions/nhost-cli
        with:
          start: false
```

### Don't wait for the app to be ready

```yaml
job:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Install Nhost CLI and start app
        uses: ./.github/actions/nhost-cli
        with:
          wait: false
```

### Stop the app

```yaml
job:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Start app
        uses: ./.github/actions/nhost-cli
      - name: Do something
        cmd: echo "do something"
      - name: Stop
        uses: ./.github/actions/nhost-cli
        with:
          start: false
          stop: true
```

### Inject values in nhost/config.yaml

```yaml
job:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Install Nhost CLI
        uses: ./.github/actions/nhost-cli
        with:
          config: |
            services.auth.image: nhost/hasura-auth:0.16.1
```
