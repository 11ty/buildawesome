module.exports = async function() {
  return new Promise(resolve => {
    setTimeout(function() {
      resolve({
        localdatakeyfromcjs: "common-js-howdydoody"
      });
    }, 1);
  });
};
