import test from "node:test";
import Eleventy from "../src/Core.js";
import WebCPlugin from "@11ty/eleventy-plugin-webc";

test("#3818 WebC Permalink", async (t) => {
  let elev = new Eleventy("test/noop", false, {
    config($config) {
      $config.addPlugin(WebCPlugin);
      $config.addTemplate("index.webc", `---
eleventyComputed:
  permalink: "page/<f @raw=\\"1\\" webc:nokeep></f>/"
---`);
    }
  });


  let [result] = await elev.toJSON();
  t.assert.strictEqual(result.url, "/page/1/");
});

test("#3818 WebC Permalink Pagination JavaScript function", async (t) => {
  let elev = new Eleventy("test/noop", false, {
    config($config) {
      $config.addPlugin(WebCPlugin);
      $config.addTemplate("index.webc", `---js
const pagination = {
  data: "posts",
  size: 2,
};
function permalink(data) {
  return \`page/\${data.pagination.pageNumber + 1}/\`;
}
---
<a :href="$data.pagination.href.first"></a>
<a :href="$data.pagination.href.previous"></a>
<a :href="$data.pagination.href.next"></a>
<a :href="$data.pagination.href.last"></a>`, {
  posts: [
    "first",
    "second",
    "third",
    "fourth",
  ]
});
    }
  });

  let [page1, page2] = await elev.toJSON();
  t.assert.strictEqual(page1.url, "/page/1/");
  t.assert.strictEqual(page1.content, `<a href="/page/1/"></a>
<a></a>
<a href="/page/2/"></a>
<a href="/page/2/"></a>`)
  t.assert.strictEqual(page2.url, "/page/2/");
  t.assert.strictEqual(page2.content, `<a href="/page/1/"></a>
<a href="/page/1/"></a>
<a></a>
<a href="/page/2/"></a>`)
});

test("#3818 WebC Permalink Pagination, eleventyComputed.permalink String", async (t) => {
  let elev = new Eleventy("test/noop", false, {
    config($config) {
      $config.addPlugin(WebCPlugin);
      $config.addTemplate("index.webc", `---
pagination:
  data: posts
  size: 2
eleventyComputed:
  permalink: "\`page/$\{pagination.pageNumber + 1}/\`"
---
<a :href="$data.pagination.href.first"></a>
<a :href="$data.pagination.href.previous"></a>
<a :href="$data.pagination.href.next"></a>
<a :href="$data.pagination.href.last"></a>`, {
  posts: [
    "first",
    "second",
    "third",
    "fourth",
  ]
});
    }
  });

  let [page1, page2] = await elev.toJSON();
  t.assert.strictEqual(page1.url, "/page/1/");
  t.assert.strictEqual(page1.content, `<a href="/page/1/"></a>
<a></a>
<a href="/page/2/"></a>
<a href="/page/2/"></a>`)
  t.assert.strictEqual(page2.url, "/page/2/");
  t.assert.strictEqual(page2.content, `<a href="/page/1/"></a>
<a href="/page/1/"></a>
<a></a>
<a href="/page/2/"></a>`)
});

test("#3818 WebC Permalink Pagination, permalink String", async (t) => {
  let elev = new Eleventy("test/noop", false, {
    config($config) {
      $config.addPlugin(WebCPlugin);
      $config.addTemplate("index.webc", `---
pagination:
  data: posts
  size: 2
permalink: "\`page/$\{pagination.pageNumber + 1}/\`"
---
<a :href="$data.pagination.href.first"></a>
<a :href="$data.pagination.href.previous"></a>
<a :href="$data.pagination.href.next"></a>
<a :href="$data.pagination.href.last"></a>`, {
  posts: [
    "first",
    "second",
    "third",
    "fourth",
  ]
});
    }
  });

  let [page1, page2] = await elev.toJSON();
  t.assert.strictEqual(page1.url, "/page/1/");
  t.assert.strictEqual(page1.content, `<a href="/page/1/"></a>
<a></a>
<a href="/page/2/"></a>
<a href="/page/2/"></a>`)
  t.assert.strictEqual(page2.url, "/page/2/");
  t.assert.strictEqual(page2.content, `<a href="/page/1/"></a>
<a href="/page/1/"></a>
<a></a>
<a href="/page/2/"></a>`)
});
