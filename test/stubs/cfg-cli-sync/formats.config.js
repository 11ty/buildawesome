export default function ($config) {
  $config.addTemplate("index.njk", "{{ configTemplateFormats | join(',') }}", {
    configTemplateFormats: $config.templateFormats,
  });
}
