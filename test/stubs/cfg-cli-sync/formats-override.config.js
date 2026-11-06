export default function ($config) {
  $config.setTemplateFormats("njk,liquid");
  $config.addTemplate("index.njk", "Hi");
}
