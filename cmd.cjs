#!/usr/bin/env node
"use strict";

const { checkNodeVersion, exec } = require("./cli.cjs");

checkNodeVersion(require("./package.json").name.split("/").pop());
exec();
