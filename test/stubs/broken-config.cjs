const missingModule = require("this-is-a-module-that-does-not-exist");

module.exports = function($config) {
  $config.addFilter("cssmin", function(code) {
    return missingModule(code);
  });

  return {};
};
