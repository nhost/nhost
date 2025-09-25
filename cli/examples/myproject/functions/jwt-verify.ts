import { Request, Response } from 'express'
import process from 'process'
import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'

// Initialize the JWKS client
const client = jwksClient({
  jwksUri: 'https://local.auth.local.nhost.run/v1/.well-known/jwks.json',
  cache: true,
  cacheMaxAge: 86400000, // 24 hours cache
});

export default (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: missing header' });
    }

    const token = authHeader.split(' ')[1];

    // Promisify the key fetching and verification process
    const verifyToken = new Promise((resolve, reject) => {
        const verifyOptions = {
            algorithms: ['RS256', 'RS384', 'RS512'],
        };

        jwt.verify(token, (header, callback) => {
            client.getSigningKey(header.kid, (err, key) => {
                if (err) return callback(err);
                callback(null, key.getPublicKey());
            });
        }, verifyOptions, (err, decoded) => {
            if (err) reject(err);
            else resolve(decoded);
        });
    });

    // Execute the verification
    verifyToken
        .then((decoded) => {
            res.status(200).json({
                headers: req.headers,
                query: req.query,
                node: process.version,
                arch: process.arch,
                token: decoded,
            });
        })
        .catch((err) => {
            res.status(401).json({ error: `Unauthorized: ${err}` });
        });
}
