export default function($config) {
  $config.addPairedShortcode("sample", function(content, firstName) {
      return `${content} ${firstName}`
  });
};