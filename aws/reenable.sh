#!/usr/bin/env bash
# Undo a cut-off: re-enable the CloudFront distribution. Run in CloudShell (us-east-1).
# Find out what tripped it first (the cut-off email names the alarm) so it doesn't trip again straight away.
set -euo pipefail
export AWS_DEFAULT_REGION=us-east-1
STACK="${STACK:-emitrain}"
DIST="$(aws cloudformation describe-stacks --stack-name "$STACK" --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text)"
TMP="$(mktemp)"
aws cloudfront get-distribution-config --id "$DIST" > "$TMP"
ETAG="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['ETag'])" "$TMP")"
python3 -c "import json,sys; d=json.load(open(sys.argv[1]))['DistributionConfig']; d['Enabled']=True; json.dump(d, open(sys.argv[1]+'.cfg','w'))" "$TMP"
aws cloudfront update-distribution --id "$DIST" --if-match "$ETAG" --distribution-config "file://$TMP.cfg" --query 'Distribution.Status' --output text
rm -f "$TMP" "$TMP.cfg"
echo "Re-enabled. CloudFront takes a few minutes to come back."
