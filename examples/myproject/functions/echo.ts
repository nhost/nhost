import { Request, Response } from 'express'

export default (req: Request, res: Response) => {
    res.status(539).json(
        {
            headers: req.headers,
            query: req.query,
        },
    )
}
