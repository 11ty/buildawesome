import test from "node:test";
import TemplateConfig from "../src/TemplateConfig.js";
import { Watch } from "../src/Watch.js";

test("Default chokidar config has no ignores", (t) => {
  let watch = new Watch(new TemplateConfig());
  t.assert.deepStrictEqual(watch.getChokidarConfig().ignored, []);
});

test("User `ignored` is normalized to an array", (t) => {
  let config = new TemplateConfig();
  let ignoreFn = () => false;

  config.userConfig.setChokidarConfig({ ignored: "**/*.log" });
  t.assert.deepStrictEqual(new Watch(config).getChokidarConfig().ignored, ["**/*.log"]);

  config.userConfig.setChokidarConfig({ ignored: [/\.tmp$/, ignoreFn] });
  t.assert.deepStrictEqual(new Watch(config).getChokidarConfig().ignored, [/\.tmp$/, ignoreFn]);
});

test("watchTargets accepts a Set", (t) => {
  let watch = new Watch(new TemplateConfig());
  t.assert.doesNotThrow(() => watch.watchTargets(new Set(["./_site/**/*.css"])));
});
