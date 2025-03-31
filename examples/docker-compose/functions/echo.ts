import { Request, Response } from 'express'
import process from 'process'

export default (req: Request, res: Response) => {
    res.status(200).json(
        {
            headers: req.headers,
            query: req.query,
            node: process.version,
            arch: process.arch,
        },
    )
}
