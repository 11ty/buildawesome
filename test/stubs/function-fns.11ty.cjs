module.exports = function({ assert }) {
  assert.ok(this.url);
  assert.ok(this.slug);
  assert.ok(this.log);
  assert.ok(this.getPreviousCollectionItem);
  assert.ok(this.getNextCollectionItem);
  assert.ok(this.page);

  return "test";
};
