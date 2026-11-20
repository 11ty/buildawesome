#!/usr/bin/env node

import { checkNodeVersion, exec } from "@11ty/eleventy/cli";
import BuildAwesome from "./src/Core.js";

// Influences console and DEBUG log prefixes
process.env.BUILDAWESOME_PACKAGE = "@awesome.me/buildawesome";

checkNodeVersion(BuildAwesome.packageName);
exec(BuildAwesome);
