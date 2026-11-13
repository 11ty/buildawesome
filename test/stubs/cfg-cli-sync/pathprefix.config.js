export default function ($config) {
  $config.addTemplate("index.njk", "{{ configPathPrefix }}", {
    configPathPrefix: $config.pathPrefix,
  });
}
