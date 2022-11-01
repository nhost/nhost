import * as Minio from 'minio'

var minioClient = new Minio.Client({
  endPoint: 'localhost',
  port: 9000,
  useSSL: false,
  accessKey: 'minioaccesskey123123',
  secretKey: 'minioaccesskey123123'
})

// File to upload
var file = 'files/nhost-nextjs.png'

// Uplaod file
minioClient.fPutObject(
  'nhost',
  '3d62252d-8db2-4b2b-ba63-f2ef64af4267',
  file,
  {},
  function (err, etag) {
    if (err) return console.log(err)
    console.log('File uploaded successfully.')
  }
)
