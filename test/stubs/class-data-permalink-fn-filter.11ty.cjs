class Test {
  get data() {
    return {
      title: "My Super Cool Title",
      permalink: function({ title }) {
        return `/my-permalink/${this.slugify(title)}/`;
      }
    };
  }

  render({ name }) {
    return `<p>${name}</p>`;
  }
}

module.exports = Test;
