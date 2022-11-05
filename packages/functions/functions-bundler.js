const chokidar = require('chokidar')
const esbuild = require('esbuild')
const path = require('path')
const fs = require('fs-extra')

const origin = 'tests'
const destination = 'functions'

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

const targetFile = (file) => {
  const basename = path.basename(file, path.extname(file))
  return path.join(destination, path.dirname(file), basename + '.js')
}

const bundle = (file) => {
  const destinationFile = targetFile(file)
  console.log(`Bundling ${path.join(origin, file)} -> ${destinationFile}`)
  esbuild.buildSync({
    entryPoints: [path.join(origin, file)],
    platform: 'node',
    outfile: destinationFile,
    target: ['node16'],
    format: 'esm',
    bundle: true
  })
}

const remove = async (file) => {
  const outfile = targetFile(file)
  console.log(`Removing ${path.join(origin, file)} -> ${outfile}`)
  fs.unlinkSync(outfile)
}

const watcher = chokidar.watch('**/*.{js,ts}', {
  cwd: path.join(__dirname, origin),
  ignored: ['**/_*/**', '**/*.spec.{js,ts}', '**/tests/**', '**/*.test.{js,ts}']
})

watcher.on('add', bundle).on('change', bundle).on('unlink', remove)

watcher.on('ready', () => {
  if (!process.argv.includes('--watch')) {
    return watcher.close()
  }
  console.log('Watching for changes...')
})
