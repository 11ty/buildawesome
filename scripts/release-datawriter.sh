# Release script for @awesome.me/ba-datawriter only.
# Core (and its lockstep workspaces) are released by scripts/release.sh — keep the two
# separate: this package is independently versioned and ships on its own cadence.

PACKAGE_DIR="packages/datawriter"

if [ -z "$NPM_DATAWRITER_PUBLISH_TAG" ]; then
	echo 'Release error: missing NPM_DATAWRITER_PUBLISH_TAG environment variable'
	exit 1
fi

if ! npm ci; then
	echo 'Release error: npm ci command failed.'
	exit 1
fi

# Independently versioned, so nothing else keeps the git tag and package.json in step.
if [ -n "$RELEASE_TAG_NAME" ]; then
	EXPECTED_TAG="datawriter@$(node -p "require('./$PACKAGE_DIR/package.json').version")"

	if [ "$RELEASE_TAG_NAME" != "$EXPECTED_TAG" ]; then
		echo "Release error: release tag '$RELEASE_TAG_NAME' does not match $PACKAGE_DIR/package.json (expected '$EXPECTED_TAG')."
		exit 1
	fi
fi

if ! npm run test --workspace=$PACKAGE_DIR; then
	echo 'Release error: package test suite failed.'
	exit 1
fi

# The package carries its own copy of Eleventy's reserved data property names so that it
# can be used without Eleventy. This asserts the copy has not drifted.
if ! npx ava test/DataWriterReservedKeysTest.js; then
	echo 'Release error: reserved key parity test failed.'
	exit 1
fi

# npm stage publish requires npm 11.15 or newer.
npm stage publish --workspace=$PACKAGE_DIR --provenance --access=public --tag=$NPM_DATAWRITER_PUBLISH_TAG $DRY_RUN
