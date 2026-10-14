#!/usr/bin/env node

// Influences console and DEBUG log prefixes
process.env.BUILDAWESOME_PACKAGE = "@awesome.me/buildawesome";

import "@11ty/eleventy/cli";
