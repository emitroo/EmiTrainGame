#!/usr/bin/env bash
# Uploads the built app to the site bucket and refreshes CloudFront.  Usage: aws/upload-site.sh <bucket> <distribution-id>
set -euo pipefail
BUCKET="$1"; DIST="$2"
cd "$(dirname "$0")/.."
# Icons can be cached for a day; the page, service worker and manifest must always be revalidated.
aws s3 sync . "s3://$BUCKET" --delete --exclude '*' --include 'icon*' --cache-control 'public, max-age=86400'
for f in index.html sw.js manifest.webmanifest; do
  aws s3 cp "$f" "s3://$BUCKET/$f" --cache-control 'no-cache'
done
aws cloudfront create-invalidation --distribution-id "$DIST" --paths '/*' --query 'Invalidation.Id' --output text
