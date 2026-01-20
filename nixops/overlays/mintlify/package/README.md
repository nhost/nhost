<div align="center">
  <a href="https://mintlify.com">
    <img
      src="https://res.cloudinary.com/mintlify/image/upload/v1665385627/logo-rounded_zuk7q1.svg"
      alt="Mintlify Logo"
      height="64"
    />
  </a>
  <br />
  <p>
    <h3>
      <b>
        Mintlify CLI
      </b>
    </h3>
  </p>
  <p>
    The Mintlify CLI is the easiest way to build Mintlify apps from the command line.
  </p>
  <p>

[![Website](https://img.shields.io/website?url=https%3A%2F%2Fmintlify.com&logo=mintlify)](https://mintlify.com) [![Tweet](https://img.shields.io/twitter/url?url=https%3A%2F%2Fmintlify.com%2F)](https://twitter.com/intent/tweet?url=&text=Check%20out%20%40mintlify)

  </p>
  <p>
    <sub>
      Built with ❤︎ by
      <a href="https://mintlify.com">
        Mintlify
      </a>
    </sub>
  </p>
</div>

### Installation

Download the Mintlify CLI using the following command

```
npm i -g mintlify
```

### Development

#### `mintlify dev`

Run this command at the root of your Mintlify project to preview changes locally.

Notes

- `mintlify dev` requires Node v19 or higher.

#### Custom Ports

Mintlify uses port 3000 by default. You can use the `--port` flag to customize the port Mintlify runs on. For example, use this command to run in port 3333:

```
mintlify dev --port 3333
```

You will see an error like this if you try to run Mintlify in a port that's already taken:

```
Error: listen EADDRINUSE: address already in use :::3000
```

#### Troubleshooting

Steps you can take if the dev CLI is not working (After each step try to run `mintlify dev` again):

- Make sure you are running in a folder with a `docs.json` file.
- Run `mintlify update` to ensure you have the most recent version of the CLI.
- Make sure you are using Node v19 or higher.
- Navigate to the `.mintlify` folder in your home directory and delete its contents.

### Additional Commands

#### `mintlify broken-links`

Check for broken internal links in your Mintlify project.

#### `mintlify rename <from> <to>`

Rename a file in a Mintlify project and update all internal link references.

#### `mintlify openapi-check <openapiFilenameOrUrl>`

Check your OpenAPI file for errors. You can pass in a filename (e.g. `./openapi.yaml`) or a URL (e.g. `https://petstore3.swagger.io/api/v3/openapi.json`).

#### `mintlify update`

Updates to the most recent version of the Mintlify CLI.

#### `mintlify upgrade`

Upgrade from `mint.json` to `docs.json`. This command creates a `docs.json` from your existing `mint.json`.

### Get Started

[Create an account](https://mintlify.com/start) to start using Mintlify for your documentation.
