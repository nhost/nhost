# React-Apollo example

## See this example live

Visit our demo application on [react-apollo.example.nhost.io](https://react-apollo.example.nhost.io)

## Get started

1. Clone the repository

```sh
git clone https://github.com/nhost/nhost
cd nhost
```

2. Install dependencies

```sh
cd examples/react-apollo
pnpm install
```

3. Set the backend url to the local Nhost instance

```sh
echo "VITE_NHOST_URL=http://localhost:1337" > .env
```

4. Terminal 1: Start Nhost

```sh
nhost dev
```

5. Terminal 2: Start the React application

```sh
pnpm run dev
```
