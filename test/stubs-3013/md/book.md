---
layout: base
pagination:
  data: books
  size: 1
  alias: book
permalink: /{{ book.shortname }}/
eleventyComputed:
  title: "{{ book.name }}"
---

{{ title }}
