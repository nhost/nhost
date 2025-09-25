import { Request, Response } from 'express'

export default (_: Request, res: Response) => {
    try {
        throw new Error('This is an error')
    } catch (error) {
        console.log(error)
        res.status(500).json({
            error: error.message,
        })
    }
}

