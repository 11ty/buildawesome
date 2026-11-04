class TestWithPage {
  get page() {
    return "this-is-my-page";
  }

  render(data) {
    data.assert.strictEqual(this.page, "this-is-my-page");
    data.assert.strictEqual(data.page.url, "/hi/");
  }
}

module.exports = TestWithPage;
