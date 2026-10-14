---
title: Paged Test
tags:
  - haha
pagination:
  data: collections.userCollection
  size: 1
  alias: item
  addAllPagesToCollections: true
permalink: /{{ item.data.title | slugify }}/goodbye/
---

# {{ title }}
