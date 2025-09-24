# TypeScript Configurations

This directory contains centralized TypeScript configurations that can be extended by projects in the monorepo. Using centralized configurations ensures consistency across projects and makes it easier to maintain and update TypeScript settings.

## Base Configurations

- `base.json`: Core TypeScript settings used by all projects
- `library.json`: Settings for libraries and SDK packages
- `frontend.json`: Settings for frontend applications (React, Next.js)
- `node.json`: Settings for Node.js applications and scripts
- `vite.json`: Settings for Vite configuration files

## Usage

In your project's `tsconfig.json` file, extend the appropriate base configuration:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../configs/tsconfig/frontend.json",
  "compilerOptions": {
    // Project-specific overrides here
  }
}
```

## Configuration Features

### Common Features

- Strict type checking
- Modern ES features
- Comprehensive linting rules
- Proper module resolution

### Library Configuration

- Declaration file generation
- Source maps
- Composite project support

### Frontend Configuration

- JSX support
- DOM typings
- Bundler module resolution
- Compatible with both React and Next.js
- Configurable for specific framework needs

## Creating New Projects

When creating a new project:

1. Identify the appropriate base configuration for your project type
2. Create a minimal `tsconfig.json` that extends the base configuration from the `configs/tsconfig` directory
3. Add only project-specific customizations to your `tsconfig.json`

This approach ensures all projects follow the same standards while allowing for project-specific needs.
