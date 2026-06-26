import fs from 'node:fs';
import path from 'node:path';

const platforms = ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64'];

const readPackage = (root, dir) =>
  JSON.parse(fs.readFileSync(path.join(root, dir, 'package.json'), 'utf8'));

const requireExecutable = (file, failures) => {
  try {
    fs.accessSync(file, fs.constants.X_OK);
  } catch {
    failures.push(`${file} is not executable`);
  }
};

export const validateStagedPackages = ({
  root = process.env.NPM_DIST_DIR ?? path.join('build', 'npm', 'dist'),
  version = process.env.VERSION,
} = {}) => {
  const failures = [];
  const fail = (message) => failures.push(message);

  if (!fs.existsSync(root)) {
    fail(`${root} does not exist`);
  }

  let main;
  const mainDir = path.join(root, 'main');
  if (!fs.existsSync(mainDir)) {
    fail(`${mainDir} does not exist`);
  } else {
    main = readPackage(root, 'main');
    version ??= main.version;
  }

  if (!version) {
    fail('VERSION is empty and main package version could not be read');
  }

  for (const platform of platforms) {
    const dir = path.join(root, platform);
    if (!fs.existsSync(dir)) {
      fail(`${dir} does not exist`);
      continue;
    }

    const pkg = readPackage(root, platform);
    const expectedName = `@nhost/cli-${platform}`;
    if (pkg.name !== expectedName) {
      fail(`${platform} package name is ${pkg.name}, expected ${expectedName}`);
    }
    if (!pkg.name?.startsWith('@nhost/cli-')) {
      fail(`${platform} package name must use the @nhost/cli- prefix`);
    }
    if (pkg.version !== version) {
      fail(`${pkg.name} version is ${pkg.version}, expected ${version}`);
    }
    requireExecutable(path.join(dir, 'nhost'), failures);
  }

  if (main) {
    const optionalDependencies = main.optionalDependencies ?? {};
    const expectedDependencies = Object.fromEntries(
      platforms.map((platform) => [`@nhost/cli-${platform}`, version]),
    );

    if (main.name !== '@nhost/cli') {
      fail(`main package name is ${main.name}, expected @nhost/cli`);
    }
    if (main.version !== version) {
      fail(`main package version is ${main.version}, expected ${version}`);
    }
    if (JSON.stringify(optionalDependencies) !== JSON.stringify(expectedDependencies)) {
      fail(
        `main optionalDependencies are ${JSON.stringify(optionalDependencies)}, expected ${JSON.stringify(expectedDependencies)}`,
      );
    }
    requireExecutable(path.join(mainDir, 'bin', 'nhost'), failures);
  }

  if (failures.length > 0) {
    throw new Error(`npm package validation failed:\n- ${failures.join('\n- ')}`);
  }

  return { root, version, platforms };
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = validateStagedPackages();
  console.log(`Validated @nhost/cli npm packages in ${result.root} for ${result.version}`);
}
