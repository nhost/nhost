# Nhost CLI GitHub Action

## Usage

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install the Nhost CLI
        uses: ./.github/actions/nhost-cli
```

### Install the CLI and start the app

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Nhost CLI and start the application
        uses: ./.github/actions/nhost-cli
        with:
          start: true
```

### Set another working directory

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Nhost CLI
        uses: ./.github/actions/nhost-cli
        with:
          path: examples/react-apollo
          start: true
```

### Don't wait for the app to be ready

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Nhost CLI and start app
        uses: ./.github/actions/nhost-cli
        with:
          start: true
          wait: false
```

### Stop the app

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Start app
        uses: ./.github/actions/nhost-cli
        with:
          start: true
      - name: Do something
        cmd: echo "do something"
      - name: Stop
        uses: ./.github/actions/nhost-cli
        with:
          stop: true
```

### Install a given value of the CLI

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Nhost CLI
        uses: ./.github/actions/nhost-cli
        with:
          version: v0.8.10
```

### Inject values into nhost/config.yaml

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Nhost CLI
        uses: ./.github/actions/nhost-cli
        with:
          config: |
            services:
              auth:
                image: nhost/hasura-auth:0.16.1
```
