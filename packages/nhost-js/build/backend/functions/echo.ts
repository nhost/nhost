import { Request, Response } from "express";
import zlib from "zlib";

export default (req: Request, res: Response) => {
  const acceptHeader = req.headers.accept || "";
  let content: string | Buffer;
  let contentType: string;

  let p = {
    body: req.body,
    headers: req.headers,
    method: req.method,
  };

  if (acceptHeader.includes("application/json")) {
    content = JSON.stringify(p);
    contentType = "application/json";
  } else if (acceptHeader.includes("application/octet-stream")) {
    content = new Buffer("beep-boop");
    contentType = "application/octet-stream";
  } else {
    // Default to plain text for all other cases
    content = `"method":${p.method}\n"headers":${JSON.stringify(p.headers)}\n"body":${JSON.stringify(p.body)}`;
    contentType = "text/plain";
  }

  // Check if client accepts gzip encoding
  const acceptEncoding = req.headers["accept-encoding"] || "";
  const useGzip = acceptEncoding.includes("gzip");

  // Set content type header
  res.setHeader("Content-Type", contentType);

  if (useGzip) {
    // Compress the content
    zlib.gzip(content, (err, compressedContent) => {
      if (err) {
        // In case of compression error, send uncompressed content
        res.status(200).send(content);
        return;
      }
      res.setHeader("Content-Encoding", "gzip");
      res.status(200).send(compressedContent);
    });
  } else {
    // Send uncompressed content
    res.status(200).send(content);
  }
};
