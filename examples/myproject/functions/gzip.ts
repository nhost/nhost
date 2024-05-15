import zlib from 'zlib';
import { Request, Response } from 'express';
import process from 'process ```javascript
import { Request, Response } from 'express';
import process from 'process';
import zlib from 'zlib';

export default (req: Request, res: Response) => {
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Content-Type', 'application/json');

    const rawResponse = JSON.stringify({
        headers: req.headers,
        query: req.query,
        node: process.version,
        arch: process.arch,
    });

    zlib.gzip(rawResponse, (err, buffer) => {
        if (err) {
            res.status(500).send('Internal Server Error');
        } else {
            res.status(200).send(buffer);
        }
    });
}


