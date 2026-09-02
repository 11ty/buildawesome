export NPM_DATAWRITER_PUBLISH_TAG="latest"
export DRY_RUN="--dry-run" # leave that space as-is

echo "Publishing: @awesome.me/ba-datawriter (dry run)"

./scripts/release-datawriter.sh
