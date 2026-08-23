# Dependency notes

- (dev dep only) `@iarna/toml` has a 3.0 that we have never been on but it was released the same day as the last 2.x https://github.com/BinaryMuse/toml-node/commits/master (needs more investigation)

# Release Procedure

1. (Optional) Update minor dependencies in package.json
   - `npx npm-check-updates --target minor -u --dep prod`
   - or `npm outdated` + `npm update --save`
1. Stable release only: make sure there aren’t any `file:` dependencies or `@11ty/*` dependencies on pre-release versions alpha/beta/canary
1. If the minimum Node version changed, make sure you update `package.json` engines property.
   - Make sure the error message works correctly for Node versions less than 10.
     - 0.12.x+ requires Node 10+
     - 1.x+ requires Node 12+
     - 2.x+ requires Node 14+
     - 3.x+ requires Node 18+
     - 4.x+ requires Node 22+
1. `npm install`
1. `npm audit --omit=dev`
1. Make sure `npm run check` (eslint) runs okay
1. Make sure `npm run test` (ava) runs okay
1. Update version in `package.json`
   - (Alpha) Use `-alpha.1` suffix
   - (Beta) Use `-beta.1` suffix
1. Run `npm run coverage`
1. Check it all in and commit
1. Tag new version
1. Wait for GitHub Actions to complete to know that the build did not fail.
1. Publish a release on GitHub at https://github.com/11ty/buildawesome/releases pointing to the tag of the release. Hitting the publish button on this workflow will use GitHub Actions to publish the package to npm on the correct dist-tag and includes npm package provenance for the release.

- Main release: no version suffix publishes to `latest` (default) tag on npm
  - Make sure to include OpenCollective usernames for release notes here https://www.11ty.dev/supporters-for-release-notes/
- Canary release: `-alpha.` version suffix in `package.json` publishes to `canary` tag on npm: https://github.com/11ty/buildawesome/issues/2758
- Beta release: `-beta.` version suffix publishes to `beta` tag on npm

Unfortunate note about npm and tags (specifically `canary` here): if you push a 1.0.0-canary.x to `canary` (even though `2.0.0-canary.x` exists), it will use the last pushed tag when you npm install from `@canary` (not the highest version number)

# Docs/Website (Main releases only)

1. Maybe search for `-alpha.` (`-canary.`?) or `-beta.` in the docs copy to update to the stable release, if applicable.
1. Check in a new `11ty/docs` site with updated `package.json` version.
1. Add version to `11ty/docs` `versions.json`
1. Commit it
1. Create a new branch for branched version
1. (Main) Check out the previous version git branch and add `outdated: true` to `_data/config.json` and commit/push.
1. Go to https://app.netlify.com/sites/11ty/settings/domain and set up a subdomain for it.

# Downstream dependencies

1. Update `11ty/eleventy-base-blog` to use new version
1. Update `11ty/docs` to use new version
