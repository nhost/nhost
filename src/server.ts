import cors from 'cors'
import { errors } from './errors'
import express from 'express'
import fileUpload from 'express-fileupload'
import helmet from 'helmet'
import { json } from 'body-parser'
import morgan from 'morgan'
import { limiter } from './limiter'
import router from './routes'
import passport from 'passport'
import baseMiddleware from './middleware/base'
import logger from './logger'

const app = express()

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1)
  app.use(limiter)
}

app.use(
  morgan(
    ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length]',
    {
      stream: {
        write: (msg) => logger.verbose(msg.slice(0, -1) /* Removes morgan newline at end */)
      }
    }
  )
)
app.use((req, res, next) => {
  req.logger = logger
  return next()
})
app.use(helmet())
app.use(json())
app.use(cors({ credentials: true, origin: true }))
app.use(fileUpload())

app.use(passport.initialize())

app.use(baseMiddleware)
app.use(router)
app.use(errors)

export { app }
