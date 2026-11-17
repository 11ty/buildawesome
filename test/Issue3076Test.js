import test from "node:test";
import Eleventy from "../src/Core.js";

const FRONT_MATTER = "---\ntitle: Title\ndescription: desc\n---\n\n";

function getMessages(error) {
  let messages = [];
  for (let e = error; e; e = e.cause ?? e.originalError) {
    messages.push(e.message);
  }
  return messages.join("\n");
}

async function getErrorMessages(templates) {
  let elev = new Eleventy("test/noop", false, {
    quietMode: true,
    config($config) {
      $config.setLayoutsDirectory("_layouts");
      for (let [path, content] of Object.entries(templates)) {
        $config.addTemplate(path, content);
      }
    },
  });
  elev.disableLogger();

  try {
    await elev.toJSON();
  } catch (e) {
    return getMessages(e);
  }
  throw new Error("Expected an error");
}

test("#3076 Liquid parse error line numbers include front matter", async (t) => {
  let messages = await getErrorMessages({ "file.md": FRONT_MATTER + "{% doesnotexist %}" });
  t.assert.match(messages, /line:6, col:1/);
});

test("#3076 Liquid filter error line numbers include front matter", async (t) => {
  let messages = await getErrorMessages({ "file.liquid": FRONT_MATTER + "hi\n{{ foo | nope }}" });
  t.assert.match(messages, /line:7, col:1/);
});

test("#3076 Liquid runtime error line numbers include front matter", async (t) => {
  let messages = await getErrorMessages({
    "file.liquid": FRONT_MATTER + "hi\n\n{% include 'missing.liquid' %}",
  });
  t.assert.match(messages, /line:8, col:1/);
});

test("#3076 Liquid line numbers without front matter are unchanged", async (t) => {
  let messages = await getErrorMessages({ "file.liquid": "hi\n{% doesnotexist %}" });
  t.assert.match(messages, /line:2, col:1/);
});

test("#3076 Nunjucks error line numbers include front matter", async (t) => {
  let messages = await getErrorMessages({ "file.njk": FRONT_MATTER + "hi\n{% doesnotexist %}" });
  t.assert.match(messages, /\[Line 7, Column 4\]/);
});

test("#3076 Liquid layout error line numbers include layout front matter", async (t) => {
  let messages = await getErrorMessages({
    "file.md": "---\nlayout: layout.liquid\n---\nhi",
    "_layouts/layout.liquid": FRONT_MATTER + "{{ content }}\n{% doesnotexist %}",
  });
  t.assert.match(messages, /line:7, col:1/);
});

test("#3076 Liquid layout runtime error line numbers include layout front matter", async (t) => {
  let messages = await getErrorMessages({
    "file.md": "---\nlayout: layout.liquid\n---\nhi",
    "_layouts/layout.liquid": FRONT_MATTER + "{{ content }}\n{% include 'missing.liquid' %}",
  });
  t.assert.match(messages, /line:7, col:1/);
});
