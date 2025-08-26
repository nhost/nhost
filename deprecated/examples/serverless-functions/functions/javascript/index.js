/*

- How to create a Serverless Function in JavaScript. However, we recommend using TypeScript for your Serverless Functions.

Test:

curl http://localhost:1337/v1/functions/javascript
*/

export default (req, res) => {
  res.status(200).send(`Hello from JavaScript`)
}
