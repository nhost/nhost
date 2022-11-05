const chokidar = require('chokidar')
const esbuild = require('esbuild')
const path = require('path')
const fs = require('fs-extra')

const from = process.argv.find((arg) => arg.startsWith('--from'))?.replace('--from', '') || 'tests'
const to = process.argv.find((arg) => arg.startsWith('--to'))?.replace('--to', '') || 'functions'

fs.emptydirSync(to)

fs.writeJsonSync(path.join(to, 'package.json'), {
  name: '@nhost-dev/functions',
  version: '0.0.0'
})

fs.writeJsonSync(path.join(to, 'tsconfig.json'), {
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

const targetPath = (filePath) => {
  const fileName = `${path.basename(filePath, path.extname(filePath))}.js`
  return path.join(to, path.dirname(filePath), fileName)
}

const bundle = (filePath) => {
  const destinationPath = targetPath(filePath)
  console.log(`Bundling ${path.join(from, filePath)} -> ${destinationPath}`)
  esbuild.buildSync({
    entryPoints: [path.join(from, filePath)],
    platform: 'node',
    outfile: destinationPath,
    target: ['node16'],
    format: 'esm',
    bundle: true
  })
}

const remove = async (filePath) => {
  const destinationPath = targetPath(filePath)
  console.log(`Removing ${path.join(from, filePath)} -> ${destinationPath}`)
  fs.unlinkSync(destinationPath)
}

const watcher = chokidar
  .watch('**/*.{js,ts}', {
    cwd: path.join(__dirname, from),
    ignored: ['**/_*/**', '**/*.spec.{js,ts}', '**/tests/**', '**/*.test.{js,ts}']
  })
  .on('add', bundle)
  .on('change', bundle)
  .on('unlink', remove)
  .on('ready', () => {
    if (!process.argv.includes('--watch')) {
      return watcher.close()
    }
    console.log('Watching for changes...')
  })
