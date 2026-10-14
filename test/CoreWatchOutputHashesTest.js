import test from "ava";
import fs from "node:fs";
import path from "node:path";
import Eleventy from "../src/Core.js";

function createProject(name) {
  let dir = `test/stubs-output-hashes/${name}`;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, "_data"), { recursive: true });
  fs.writeFileSync(path.join(dir, "eleventy.config.js"), "export default function($config) {};");
  fs.writeFileSync(path.join(dir, "_data/site.json"), JSON.stringify({ title: "First" }));
  fs.writeFileSync(path.join(dir, "uses-data.njk"), "{{ site.title }}");
  fs.writeFileSync(path.join(dir, "static.njk"), "Static");
  return dir;
}

async function getWatchInstance(dir, options = {}) {
  let elev = new Eleventy(dir, `${dir}/_site`, {
    configPath: `${dir}/eleventy.config.js`,
    ...options,
  });
  elev.disableLogger();
  elev.setRunMode(options.runMode || "serve");
  await elev.init();

  // Initial build, without starting chokidar
  await elev.write();

  let events = [];
  elev.watcher = { watchTargets() {}, close() {} };
  elev.startWatch = async () => {};
  elev.eleventyServe.reload = async (event) => {
    events.push(event);
  };
  elev.eleventyServe.sendError = ({ error }) => {
    throw error;
  };

  return { elev, events };
}

function getUrls(event) {
  return event.build.templates.map((entry) => entry.url).sort();
}

test.after.always(() => {
  fs.rmSync("test/stubs-output-hashes", { recursive: true, force: true });
});

test("Data file edit only sends pages whose output changed", async (t) => {
  let dir = createProject("data-edit");
  let { elev, events } = await getWatchInstance(dir);

  fs.writeFileSync(path.join(dir, "_data/site.json"), JSON.stringify({ title: "Second" }));
  await elev.triggerWatchRunForPath(`./${dir}/_data/site.json`);

  t.is(events.length, 1);
  t.true(events[0].build.outputs);
  t.deepEqual(getUrls(events[0]), ["/uses-data/"]);
  t.is(events[0].build.templates[0].content, "Second");
  t.deepEqual(events[0].build.passthrough, []);
});

test("Unchanged rebuild sends no templates", async (t) => {
  let dir = createProject("unchanged");
  let { elev, events } = await getWatchInstance(dir);

  await elev.triggerWatchRunForPath(`./${dir}/static.njk`);

  t.is(events.length, 1);
  t.true(events[0].build.outputs);
  t.deepEqual(events[0].build.templates, []);
});

test("New page counts as changed", async (t) => {
  let dir = createProject("new-page");
  let { elev, events } = await getWatchInstance(dir);

  fs.writeFileSync(path.join(dir, "added.njk"), "Added");
  elev.fileSystemSearch.add(`./${dir}/added.njk`);
  await elev.triggerWatchRunForPath(`./${dir}/added.njk`);

  t.deepEqual(getUrls(events[0]), ["/added/"]);
});

test("Config reset clears output hashes", async (t) => {
  let dir = createProject("config-reset");
  let { elev, events } = await getWatchInstance(dir);

  t.true(elev.outputHashes.size > 0);

  await elev.triggerWatchRunForPath(`./${dir}/eleventy.config.js`);

  t.deepEqual(getUrls(events[0]), ["/static/", "/uses-data/"]);
});

test("Serve mode skips writing unchanged output", async (t) => {
  let dir = createProject("serve-skip");
  let { elev } = await getWatchInstance(dir, { runMode: "serve" });

  let outputPath = path.join(dir, "_site/static/index.html");
  fs.writeFileSync(outputPath, "Modified on disk");

  await elev.triggerWatchRunForPath(`./${dir}/static.njk`);

  t.is(fs.readFileSync(outputPath, "utf8"), "Modified on disk");
});

test("Serve mode writes unchanged output when opted out", async (t) => {
  let dir = createProject("serve-no-skip");
  let { elev } = await getWatchInstance(dir, {
    runMode: "serve",
    config($config) {
      $config.setSkipUnchangedWrites(false);
    },
  });

  let outputPath = path.join(dir, "_site/static/index.html");
  fs.writeFileSync(outputPath, "Modified on disk");

  await elev.triggerWatchRunForPath(`./${dir}/static.njk`);

  t.is(fs.readFileSync(outputPath, "utf8"), "Static");
});

test("Watch mode skips writing unchanged output", async (t) => {
  let dir = createProject("watch-skip");
  let { elev, events } = await getWatchInstance(dir, { runMode: "watch" });

  let outputPath = path.join(dir, "_site/static/index.html");
  fs.writeFileSync(outputPath, "Modified on disk");

  await elev.triggerWatchRunForPath(`./${dir}/static.njk`);

  t.is(fs.readFileSync(outputPath, "utf8"), "Modified on disk");
  t.true(events[0].build.outputs);
});

test("Changed non-CSS passthrough copy files are sent as passthrough URLs", async (t) => {
  let dir = createProject("passthrough");
  fs.writeFileSync(path.join(dir, "file.txt"), "One");
  fs.writeFileSync(path.join(dir, "style.css"), "body {}");

  let { elev, events } = await getWatchInstance(dir, {
    config($config) {
      $config.addPassthroughCopy(`${dir}/file.txt`);
      $config.addPassthroughCopy(`${dir}/style.css`);
    },
  });

  fs.writeFileSync(path.join(dir, "file.txt"), "Two");
  await elev.triggerWatchRunForPath(`./${dir}/file.txt`);

  t.deepEqual(events[0].build.passthrough, ["/file.txt"]);
  t.deepEqual(events[0].build.stylesheets, []);
  t.deepEqual(events[0].build.templates, []);
});

test("Changed files in emulated passthrough copy directories are sent as passthrough URLs", async (t) => {
  let dir = createProject("passthrough-emulated");
  fs.mkdirSync(path.join(dir, "img"));
  fs.writeFileSync(path.join(dir, "img/file.txt"), "One");

  let { elev, events } = await getWatchInstance(dir, {
    config($config) {
      $config.addPassthroughCopy(`${dir}/img`);
      $config.setServerPassthroughCopyBehavior("passthrough");
    },
  });

  fs.writeFileSync(path.join(dir, "img/file.txt"), "Two");
  await elev.triggerWatchRunForPath(`./${dir}/img/file.txt`);

  t.deepEqual(events[0].build.passthrough, ["/img/file.txt"]);
});

test("Watch target changes don’t filter by changed output", async (t) => {
  let dir = createProject("watch-target");
  fs.mkdirSync(path.join(dir, "js"));
  fs.writeFileSync(path.join(dir, "js/app.js"), "");

  let { elev, events } = await getWatchInstance(dir, {
    config($config) {
      $config.addWatchTarget(`${dir}/js/`);
    },
  });

  await elev.triggerWatchRunForPath(`./${dir}/js/app.js`);

  t.false(events[0].build.outputs);
  t.deepEqual(getUrls(events[0]), ["/static/", "/uses-data/"]);
});

test("Build mode doesn’t track output hashes", async (t) => {
  let dir = createProject("build-no-hashes");
  let elev = new Eleventy(dir, `${dir}/_site`, { configPath: `${dir}/eleventy.config.js` });
  elev.disableLogger();
  await elev.write();

  t.is(elev.outputHashes.size, 0);
});
