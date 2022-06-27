import path from 'path'

import express from 'express'
import glob from 'glob'

const PORT = 3000

const main = async () => {
  const app = express()

  // * Same settings as in Watchtower
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.disable('x-powered-by')

  const functionsPath = path.join(process.cwd(), 'functions')
  const files = glob.sync('**/*.@(js|ts)', { cwd: functionsPath })

  for (const file of files) {
    const { default: handler } = await import(path.join(functionsPath, file))
    if (handler) {
      const route = `/${file}`
        .replace(/(\.ts|\.js)$/, '')
        .replace(/\/index$/, '/')
      app.all(route, handler)
      console.log(`Loaded route ${route} from ./functions/${file}`)
    } else {
      console.warn(`No default export in ./functions/${file}`)
    }
  }

  app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`)
  })
}

main()
