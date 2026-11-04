class Test {
  render({ assert }) {
    assert.ok(this.url);
    assert.ok(this.slug);
    assert.ok(this.log);
    assert.ok(this.getPreviousCollectionItem);
    assert.ok(this.getNextCollectionItem);
    assert.ok(this.page);
  }
}

module.exports = Test;
