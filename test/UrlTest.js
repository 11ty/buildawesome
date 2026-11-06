import test from "node:test";
import TemplateConfig from "../src/TemplateConfig.js";
import url from "../src/Filters/Url.js";

test("Test url filter passing in pathPrefix from config", async (t) => {
  let eleventyConfig = new TemplateConfig();
  await eleventyConfig.init();

  let pp = eleventyConfig.getConfig().pathPrefix;
  t.assert.strictEqual(pp, "/");

  t.assert.strictEqual(url("test", pp), "test");
  t.assert.strictEqual(url("/test", pp), "/test");
});

test("Test url filter without passing in pathPrefix", async (t) => {
  let eleventyConfig = new TemplateConfig();
  await eleventyConfig.init();

  let urlFilter = eleventyConfig.userConfig.getFilter("url");

  t.assert.strictEqual(urlFilter("test"), "test");
  t.assert.strictEqual(urlFilter("/test"), "/test");
});

test("Test url filter with passthrough urls", (t) => {
  // via https://gist.github.com/mxpv/034933deeebb26b62f14
  t.assert.strictEqual(url("http://foo.com/blah_blah", ""), "http://foo.com/blah_blah");
  t.assert.strictEqual(url("http://foo.com/blah_blah/", ""), "http://foo.com/blah_blah/");
  t.assert.strictEqual(url("http://foo.com/blah_blah_(wikipedia)", ""), "http://foo.com/blah_blah_(wikipedia)");
  t.assert.strictEqual(
    url("http://foo.com/blah_blah_(wikipedia)_(again)", ""),
    "http://foo.com/blah_blah_(wikipedia)_(again)"
  );
  t.assert.strictEqual(url("http://www.example.com/wpstyle/?p=364", ""), "http://www.example.com/wpstyle/?p=364");
  t.assert.strictEqual(
    url("https://www.example.com/foo/?bar=baz&inga=42&quux", ""),
    "https://www.example.com/foo/?bar=baz&inga=42&quux"
  );
  t.assert.strictEqual(
    url("http://userid:password@example.com:8080", ""),
    "http://userid:password@example.com:8080"
  );
  t.assert.strictEqual(
    url("http://userid:password@example.com:8080/", ""),
    "http://userid:password@example.com:8080/"
  );
  t.assert.strictEqual(url("http://userid@example.com", ""), "http://userid@example.com");
  t.assert.strictEqual(url("http://userid@example.com/", ""), "http://userid@example.com/");
  t.assert.strictEqual(url("http://userid@example.com:8080", ""), "http://userid@example.com:8080");
  t.assert.strictEqual(url("http://userid@example.com:8080/", ""), "http://userid@example.com:8080/");
  t.assert.strictEqual(url("http://userid:password@example.com", ""), "http://userid:password@example.com");
  t.assert.strictEqual(url("http://userid:password@example.com/", ""), "http://userid:password@example.com/");
  t.assert.strictEqual(url("http://142.42.1.1/", ""), "http://142.42.1.1/");
  t.assert.strictEqual(url("http://142.42.1.1:8080/", ""), "http://142.42.1.1:8080/");
  t.assert.strictEqual(url("http://foo.com/blah_(wikipedia)#cite-1", ""), "http://foo.com/blah_(wikipedia)#cite-1");
  t.assert.strictEqual(
    url("http://foo.com/blah_(wikipedia)_blah#cite-1", ""),
    "http://foo.com/blah_(wikipedia)_blah#cite-1"
  );
  t.assert.strictEqual(
    url("http://foo.com/(something)?after=parens", ""),
    "http://foo.com/(something)?after=parens"
  );
  t.assert.strictEqual(
    url("http://code.google.com/events/#&product=browser", ""),
    "http://code.google.com/events/#&product=browser"
  );
  t.assert.strictEqual(url("http://j.mp", ""), "http://j.mp");
  t.assert.strictEqual(url("ftp://foo.bar/baz", ""), "ftp://foo.bar/baz");
  t.assert.strictEqual(
    url("http://foo.bar/?q=Test%20URL-encoded%20stuff", ""),
    "http://foo.bar/?q=Test%20URL-encoded%20stuff"
  );
  t.assert.strictEqual(
    url("http://-.~_!$&'()*+,;=:%40:80%2f::::::@example.com", ""),
    "http://-.~_!$&'()*+,;=:%40:80%2f::::::@example.com"
  );
  t.assert.strictEqual(url("http://1337.net", ""), "http://1337.net");
  t.assert.strictEqual(url("http://a.b-c.de", ""), "http://a.b-c.de");
  t.assert.strictEqual(url("http://223.255.255.254", ""), "http://223.255.255.254");

  t.assert.strictEqual(url("http://✪df.ws/123", ""), "http://✪df.ws/123");
  t.assert.strictEqual(url("http://➡.ws/䨹", ""), "http://➡.ws/䨹");
  t.assert.strictEqual(url("http://⌘.ws", ""), "http://⌘.ws");
  t.assert.strictEqual(url("http://⌘.ws/", ""), "http://⌘.ws/");
  t.assert.strictEqual(url("http://foo.com/unicode_(✪)_in_parens", ""), "http://foo.com/unicode_(✪)_in_parens");
  t.assert.strictEqual(url("http://☺.damowmow.com/", ""), "http://☺.damowmow.com/");
  t.assert.strictEqual(url("http://مثال.إختبار", ""), "http://مثال.إختبار");
  t.assert.strictEqual(url("http://例子.测试", ""), "http://例子.测试");
  t.assert.strictEqual(url("http://उदाहरण.परीक्षा", ""), "http://उदाहरण.परीक्षा");
});

test("Test url filter", (t) => {
  t.assert.strictEqual(url("/", "/"), "/");
  t.assert.strictEqual(url("//", "/"), "/");
  t.assert.strictEqual(url(undefined, "/"), ".");
  t.assert.strictEqual(url("", "/"), ".");

  // leave . and .. alone
  t.assert.strictEqual(url(".", "/"), ".");
  t.assert.strictEqual(url("./", "/"), "./");
  t.assert.strictEqual(url("..", "/"), "..");
  t.assert.strictEqual(url("../", "/"), "../");

  t.assert.strictEqual(url("test", "/"), "test");
  t.assert.strictEqual(url("/test", "/"), "/test");
  t.assert.strictEqual(url("//test", "/"), "//test");
  t.assert.strictEqual(url("./test", "/"), "test");
  t.assert.strictEqual(url("../test", "/"), "../test");

  t.assert.strictEqual(url("test/", "/"), "test/");
  t.assert.strictEqual(url("/test/", "/"), "/test/");
  t.assert.strictEqual(url("//test/", "/"), "//test/");
  t.assert.strictEqual(url("./test/", "/"), "test/");
  t.assert.strictEqual(url("../test/", "/"), "../test/");
});

test("Test url filter with custom pathPrefix (empty, gets overwritten by root config `/`)", (t) => {
  t.assert.strictEqual(url("/", ""), "/");
  t.assert.strictEqual(url("//", ""), "/");
  t.assert.strictEqual(url(undefined, ""), ".");
  t.assert.strictEqual(url("", ""), ".");

  // leave . and .. alone
  t.assert.strictEqual(url(".", ""), ".");
  t.assert.strictEqual(url("./", ""), "./");
  t.assert.strictEqual(url("..", ""), "..");
  t.assert.strictEqual(url("../", ""), "../");

  t.assert.strictEqual(url("test", ""), "test");
  t.assert.strictEqual(url("/test", ""), "/test");
  t.assert.strictEqual(url("//test", ""), "//test");
  t.assert.strictEqual(url("./test", ""), "test");
  t.assert.strictEqual(url("../test", ""), "../test");

  t.assert.strictEqual(url("test/", ""), "test/");
  t.assert.strictEqual(url("/test/", ""), "/test/");
  t.assert.strictEqual(url("//test/", ""), "//test/");
  t.assert.strictEqual(url("./test/", ""), "test/");
  t.assert.strictEqual(url("../test/", ""), "../test/");
});

test("Test url filter with custom pathPrefix (leading slash)", (t) => {
  t.assert.strictEqual(url("/", "/testdir"), "/testdir/");
  t.assert.strictEqual(url("//", "/testdir"), "/testdir/");
  t.assert.strictEqual(url(undefined, "/testdir"), ".");
  t.assert.strictEqual(url("", "/testdir"), ".");

  // leave . and .. alone
  t.assert.strictEqual(url(".", "/testdir"), ".");
  t.assert.strictEqual(url("./", "/testdir"), "./");
  t.assert.strictEqual(url("..", "/testdir"), "..");
  t.assert.strictEqual(url("../", "/testdir"), "../");

  t.assert.strictEqual(url("test", "/testdir"), "test");
  t.assert.strictEqual(url("/test", "/testdir"), "/testdir/test");
  t.assert.strictEqual(url("//test", "/testdir"), "//test");
  t.assert.strictEqual(url("./test", "/testdir"), "test");
  t.assert.strictEqual(url("../test", "/testdir"), "../test");

  t.assert.strictEqual(url("test/", "/testdir"), "test/");
  t.assert.strictEqual(url("/test/", "/testdir"), "/testdir/test/");
  t.assert.strictEqual(url("//test/", "/testdir"), "//test/");
  t.assert.strictEqual(url("./test/", "/testdir"), "test/");
  t.assert.strictEqual(url("../test/", "/testdir"), "../test/");
});

test("Test url filter with custom pathPrefix (double slash)", (t) => {
  t.assert.strictEqual(url("/", "/testdir/"), "/testdir/");
  t.assert.strictEqual(url("//", "/testdir/"), "/testdir/");
  t.assert.strictEqual(url(undefined, "/testdir/"), ".");
  t.assert.strictEqual(url("", "/testdir/"), ".");

  // leave . and .. alone
  t.assert.strictEqual(url(".", "/testdir/"), ".");
  t.assert.strictEqual(url("./", "/testdir/"), "./");
  t.assert.strictEqual(url("..", "/testdir/"), "..");
  t.assert.strictEqual(url("../", "/testdir/"), "../");

  t.assert.strictEqual(url("test", "/testdir/"), "test");
  t.assert.strictEqual(url("/test", "/testdir/"), "/testdir/test");
  t.assert.strictEqual(url("//test", "/testdir/"), "//test");
  t.assert.strictEqual(url("./test", "/testdir/"), "test");
  t.assert.strictEqual(url("../test", "/testdir/"), "../test");

  t.assert.strictEqual(url("test/", "/testdir/"), "test/");
  t.assert.strictEqual(url("/test/", "/testdir/"), "/testdir/test/");
  t.assert.strictEqual(url("//test/", "/testdir/"), "//test/");
  t.assert.strictEqual(url("./test/", "/testdir/"), "test/");
  t.assert.strictEqual(url("../test/", "/testdir/"), "../test/");
});

test("Test url filter with custom pathPrefix (trailing slash)", (t) => {
  t.assert.strictEqual(url("/", "testdir/"), "/testdir/");
  t.assert.strictEqual(url("//", "testdir/"), "/testdir/");
  t.assert.strictEqual(url(undefined, "testdir/"), ".");
  t.assert.strictEqual(url("", "testdir/"), ".");

  // leave . and .. alone
  t.assert.strictEqual(url(".", "testdir/"), ".");
  t.assert.strictEqual(url("./", "testdir/"), "./");
  t.assert.strictEqual(url("..", "testdir/"), "..");
  t.assert.strictEqual(url("../", "testdir/"), "../");

  t.assert.strictEqual(url("test", "testdir/"), "test");
  t.assert.strictEqual(url("/test", "testdir/"), "/testdir/test");
  t.assert.strictEqual(url("//test", "testdir/"), "//test");
  t.assert.strictEqual(url("./test", "testdir/"), "test");
  t.assert.strictEqual(url("../test", "testdir/"), "../test");

  t.assert.strictEqual(url("test/", "testdir/"), "test/");
  t.assert.strictEqual(url("/test/", "testdir/"), "/testdir/test/");
  t.assert.strictEqual(url("//test/", "testdir/"), "//test/");
  t.assert.strictEqual(url("./test/", "testdir/"), "test/");
  t.assert.strictEqual(url("../test/", "testdir/"), "../test/");
});

test("Test url filter with custom pathPrefix (no slash)", (t) => {
  t.assert.strictEqual(url("/", "testdir"), "/testdir/");
  t.assert.strictEqual(url("//", "testdir"), "/testdir/");
  t.assert.strictEqual(url(undefined, "testdir"), ".");
  t.assert.strictEqual(url("", "testdir"), ".");

  // leave . and .. alone
  t.assert.strictEqual(url(".", "testdir"), ".");
  t.assert.strictEqual(url("./", "testdir"), "./");
  t.assert.strictEqual(url("..", "testdir"), "..");
  t.assert.strictEqual(url("../", "testdir"), "../");

  t.assert.strictEqual(url("test", "testdir"), "test");
  t.assert.strictEqual(url("/test", "testdir"), "/testdir/test");
  t.assert.strictEqual(url("//test", "testdir"), "//test");
  t.assert.strictEqual(url("//foo.com", "testdir"), "//foo.com");
  t.assert.strictEqual(url("./test", "testdir"), "test");
  t.assert.strictEqual(url("../test", "testdir"), "../test");

  t.assert.strictEqual(url("test/", "testdir"), "test/");
  t.assert.strictEqual(url("/test/", "testdir"), "/testdir/test/");
  t.assert.strictEqual(url("//test/", "testdir"), "//test/");
  t.assert.strictEqual(url("./test/", "testdir"), "test/");
  t.assert.strictEqual(url("../test/", "testdir"), "../test/");
});
