import path from 'path'

import chokidar, { FSWatcher } from 'chokidar'
import args from 'command-line-args'
import esbuild from 'esbuild'
import fs from 'fs-extra'

const { origin, destination, watch } = args([
  { name: 'origin', alias: 'o', type: String, defaultOption: true, defaultValue: 'tests' },
  { name: 'destination', alias: 'd', type: String, defaultValue: 'functions' },
  { name: 'watch', alias: 'w', type: Boolean, defaultValue: false }
])

fs.emptydirSync(destination)

fs.writeJsonSync(path.join(destination, 'package.json'), {
  name: '@nhost-dev/functions',
  version: '0.0.0'
})

fs.writeJsonSync(path.join(destination, 'tsconfig.json'), {
  compilerOptions: {
    allowJs: true,
    skipLibCheck: true,
    noEmit: true,
    esModuleInterop: true,
    resolveJsonModule: true,
    isolatedModules: true,
    strictNullChecks: false
  },
  include: ['**/*.js']
})

const targetPath = (filePath: string) => {
  const fileName = `${path.basename(filePath, path.extname(filePath))}.js`
  return path.join(destination, path.dirname(filePath), fileName)
}

const bundle = (filePath: string) => {
  const destinationPath = targetPath(filePath)
  console.log(`Bundling ${path.join(origin, filePath)} -> ${destinationPath}`)
  esbuild.buildSync({
    entryPoints: [path.join(origin, filePath)],
    platform: 'node',
    outfile: destinationPath,
    target: ['node16'],
    format: 'esm',
    bundle: true
  })
}

const remove = async (filePath: string) => {
  const destinationPath = targetPath(filePath)
  console.log(`Removing ${path.join(origin, filePath)} -> ${destinationPath}`)
  fs.unlinkSync(destinationPath)
}

const watcher: FSWatcher = chokidar
  .watch('**/*.{js,ts}', {
    cwd: path.join(__dirname, origin),
    ignored: ['**/_*/**', '**/*.spec.{js,ts}', '**/tests/**', '**/*.test.{js,ts}']
  })
  .on('add', bundle)
  .on('change', bundle)
  .on('unlink', remove)
  .on('ready', () => {
    if (!watch) {
      return watcher.close()
    }
    console.log(`Watching changes in: ${origin}...`)
  })
