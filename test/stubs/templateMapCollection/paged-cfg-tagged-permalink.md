---
title: Paged Test
tags:
  - haha
pagination:
  data: collections.userCollection
  size: 1
  alias: item
permalink: /{{ item.data.title | slugify }}/goodbye/
---

# {{ title }}
