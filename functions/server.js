const express = require('express');
	const port = parseInt(process.argv[2], 10);
	const app = express()
	app.use('/hello', require('./api/hello.js'));
	app.listen(port, () => {
	  console.log('NodeJS functions listening...')
	})