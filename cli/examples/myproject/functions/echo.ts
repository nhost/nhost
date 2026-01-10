import { Request, Response } from 'express'
import process from 'process'

export default (req: Request, res: Response) => {
    console.log(`Request context: ${JSON.stringify(req.context)}`)
    console.log(`Request context2: ${JSON.stringify(req.requestContext)}`)
    res.status(200).json(
        {
            headers: req.headers,
            query: req.query,
            node: process.version,
            arch: process.arch,
        },
    )
}
