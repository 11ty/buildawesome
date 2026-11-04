export default {
  eleventyComputed: {
    permalink: function (data) {
      return data.permalink || `/fallback/${this.slugify(data.title)}/`;
    },
  },
};
