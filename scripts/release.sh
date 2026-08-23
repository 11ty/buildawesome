if ! npm ci; then
	echo 'Release error: npm ci command failed.'
	exit 1
fi

if ! npx playwright install; then
	echo 'Release error: npx playwright install command failed (for Vitest Browser Mode).'
	exit 1
fi

# This step includes running packages/ test suites
if ! npm test; then
	echo 'Release error: npm test command failed.'
	exit 1
fi

if [ -z "$NPM_BUILDAWESOME_PUBLISH_TAG" ]; then
  echo 'Release error: missing NPM_BUILDAWESOME_PUBLISH_TAG environment variable'
	exit 1
fi

if [ -z "$NPM_ELEVENTY_PUBLISH_TAG" ]; then
  echo 'Release error: missing NPM_ELEVENTY_PUBLISH_TAG environment variable'
	exit 1
fi

# Generate types for files listed in tsconfig.json
npm run typescript

# npm stage publish requires npm 11.15 or newer.
npm stage publish --provenance --access=public --tag=$NPM_ELEVENTY_PUBLISH_TAG $DRY_RUN

# workspace: packages/browser
node packages/browser/update-package-json.js
npm stage publish --workspace=packages/browser --provenance --access=public --tag=$NPM_ELEVENTY_PUBLISH_TAG $DRY_RUN

# workspace: packages/build-awesome
npm run typescript --workspace=packages/build-awesome

# Re-use root README
cp README.md packages/build-awesome/README.md
mkdir -p packages/build-awesome/docs/
cp -R docs/*.png packages/build-awesome/docs/

node packages/build-awesome/update-package-json.js
npm stage publish --workspace=packages/build-awesome --provenance --access=public --tag=$NPM_BUILDAWESOME_PUBLISH_TAG $DRY_RUN
