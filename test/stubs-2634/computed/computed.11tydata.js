export default {
  eleventyComputed: {
    permalink: function (data) {
      return `/computed/${this.slugify(data.title)}/`;
    },
  },
};
