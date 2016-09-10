const yaml = require('js-yaml');
const fs = require('fs');
var matrixSDK = require("matrix-js-sdk");

try {
  var config = yaml.safeLoad(fs.readFileSync('config.yaml', 'utf8'));
  console.log(config);
  run(config);
} catch (e) {
  console.log(e);
}

function run (config) {
	var client = new MatrixClient(config.client);

	var matrixClient = matrixSDK.createClient(config.client);
}