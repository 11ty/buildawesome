---
title: Paged Test
pagination:
  data: collections.userCollection
  size: 1
  alias: item
permalink: /{{ item.data.title | slugify }}/hello/
---

# {{ title }}
