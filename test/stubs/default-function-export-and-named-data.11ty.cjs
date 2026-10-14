// render
module.exports = (data) => `<h1>${data.name} World</h1>`;
module.exports.data = function() {
  return { name: "Hello" }
};
