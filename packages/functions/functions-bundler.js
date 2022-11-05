const chokidar = require('chokidar')
const esbuild = require('esbuild')
const path = require('path')
const fs = require('fs-extra')

const origin = 'dev'
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

const changeExtension = (file, extension) => {
  const basename = path.basename(file, path.extname(file))
  return path.join(path.dirname(file), basename + extension)
}

const targetFile = (file) => {
  let result = path.join(destination, file)
  if (path.extname(file) === '.ts' || path.extname(file) === '.ts') {
    result = changeExtension(result, '.js')
  }
  return result
}

const buildOrCopy = (file) => {
  const destinationFile = targetFile(file)
  if (path.extname(file) === '.ts' || path.extname(file) === '.ts') {
    console.log(`Bundling ${path.join(origin, file)} -> ${destinationFile}`)

    esbuild.buildSync({
      entryPoints: [path.join(origin, file)],
      platform: 'node',
      outfile: destinationFile,
      target: ['node16'],
      format: 'esm',
      bundle: true
    })
  } else {
    console.log(`Copying ${path.join(origin, file)} -> ${destinationFile}`)
    fs.copySync(path.join(origin, file), destinationFile, { overwrite: true })
  }
}
const remove = async (file) => {
  const outfile = targetFile(file)
  console.log(`Removing ${path.join(origin, file)} -> ${outfile}`)
  fs.unlinkSync(outfile)
}

const watcher = chokidar.watch('**/*', { cwd: path.join(__dirname, origin) })

watcher.on('add', buildOrCopy).on('change', buildOrCopy).on('unlink', remove)

watcher.on('ready', () => {
  if (!process.argv.includes('--watch')) {
    return watcher.close()
  }
  console.log('Watching for changes...')
})
