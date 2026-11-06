import test from "node:test";
import ProjectTemplateFormats from "../src/Util/ProjectTemplateFormats.js";

function getTestInstance() {
  let tf = new ProjectTemplateFormats();
  return tf;
}

test("Empty formats", t => {
  let tf = new ProjectTemplateFormats();
  t.assert.deepStrictEqual(tf.getTemplateFormats(), []);
});

test("Return all eligible on no config or CLI", t => {
  let tf = getTestInstance();

  t.assert.deepStrictEqual(tf.getTemplateFormats(), []);
});


// CLI
test("CLI", t => {
  let tf = getTestInstance();
  tf.setViaCommandLine("md,html");

  t.assert.deepStrictEqual(tf.getTemplateFormats(), ["md", "html"]);
});

test("CLI empty", t => {
  let tf = getTestInstance();
  tf.setViaCommandLine("");

  t.assert.deepStrictEqual(tf.getTemplateFormats(), []);
});

test("CLI *", t => {
  let tf = getTestInstance();
  tf.setViaCommandLine("*");

  t.assert.deepStrictEqual(tf.getTemplateFormats(), []);
});


// Config Set
test("Config", t => {
  let tf = getTestInstance();
  tf.setViaConfig("md,html");

  t.assert.deepStrictEqual(tf.getTemplateFormats(), ["md", "html"]);
});

test("Config empty", t => {
  let tf = getTestInstance();
  tf.setViaConfig("");

  t.assert.deepStrictEqual(tf.getTemplateFormats(), []);
});

test("Config *", t => {
  let tf = getTestInstance();
  tf.setViaConfig("*");

  t.assert.deepStrictEqual(tf.getTemplateFormats(), []);
});


// Config Add
test("Config Add", t => {
  let tf = getTestInstance();
  // add without set unions all with new
  tf.addViaConfig("md,html");

  t.assert.deepStrictEqual(tf.getTemplateFormats(), ["md", "html"]);
});

test("Config Add (not yet known)", t => {
  let tf = getTestInstance();
  // add without set unions all with new
  tf.addViaConfig("vue");

  t.assert.deepStrictEqual(tf.getTemplateFormats(), ["vue"]);
});

test("Config Add empty", t => {
  let tf = getTestInstance();
  tf.addViaConfig("");

  t.assert.deepStrictEqual(tf.getTemplateFormats(), []);
});

test("Config Add *", t => {
  let tf = getTestInstance();
  t.assert.throws(() => {
    tf.addViaConfig("*");
  }, {
    message: '`addTemplateFormats("*")` is not supported for project template syntaxes.'
  });
});

test("Config Add Multiple", t => {
  let tf = getTestInstance();
// While this does support multiple addTemplateFormat calls from config, they are collected and addViaConfig is only called once.
  // add without set unions all with new
  tf.addViaConfig("vue");
  tf.addViaConfig("pug");
  tf.addViaConfig("zbbbbb");

  t.assert.deepStrictEqual(tf.getTemplateFormats(), ["zbbbbb"]);
});


// CLI and Config (CLI wins every time)
test("CLI + Config", t => {
  let tf = getTestInstance();
  tf.setViaCommandLine("md,html");
  tf.setViaConfig("liquid");
  tf.addViaConfig("vue");

  t.assert.deepStrictEqual(tf.getTemplateFormats(), ["md", "html"]);
});

test("CLI + Config empty", t => {
  let tf = getTestInstance();
  tf.setViaCommandLine("");
  tf.setViaConfig("liquid");
  tf.addViaConfig("vue");

  t.assert.deepStrictEqual(tf.getTemplateFormats(), []);
});

test("CLI + Config *", t => {
  let tf = getTestInstance();
  tf.setViaCommandLine("*");
  tf.setViaConfig("liquid");
  tf.addViaConfig("vue");

  t.assert.deepStrictEqual(tf.getTemplateFormats(), ["liquid", "vue"]);
});


// Config set and add
test("Config set/add", t => {
  let tf = getTestInstance();
  tf.setViaConfig("liquid");
  tf.addViaConfig("vue");

  t.assert.deepStrictEqual(tf.getTemplateFormats(), ["liquid", "vue"]);
});

test("Config set/add set undefined", t => {
  let tf = getTestInstance();
  tf.setViaConfig(undefined);
  tf.addViaConfig("vue");

  t.assert.deepStrictEqual(tf.getTemplateFormats(), ["vue"]);
});

test("Config set/add add undefined", t => {
  let tf = getTestInstance();
  tf.setViaConfig("vue");
  tf.addViaConfig(undefined);

  t.assert.deepStrictEqual(tf.getTemplateFormats(), ["vue"]);
});

test("Config set/add set empty", t => {
  let tf = getTestInstance();
  tf.setViaConfig("");
  tf.addViaConfig("vue");

  t.assert.deepStrictEqual(tf.getTemplateFormats(), ["vue"]);
});

test("Config set/add add empty", t => {
  let tf = getTestInstance();
  tf.setViaConfig("vue");
  tf.addViaConfig("");

  t.assert.deepStrictEqual(tf.getTemplateFormats(), ["vue"]);
});

test("Config set/add both empty", t => {
  let tf = getTestInstance();
  tf.setViaConfig("");
  tf.addViaConfig("");

  t.assert.deepStrictEqual(tf.getTemplateFormats(), []);
});

test("Config set *, add", t => {
  let tf = getTestInstance();
  tf.setViaConfig("*");
  tf.addViaConfig("vue");

  t.assert.deepStrictEqual(tf.getTemplateFormats(), ["vue"]);
});
