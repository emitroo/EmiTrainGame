#!/usr/bin/env bash
# One-time setup (and later updates) from AWS CloudShell in us-east-1:
#   git clone -b claude/emi-train-game-09t9sr https://github.com/emitroo/EmiTrainGame && cd EmiTrainGame && bash aws/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
export AWS_DEFAULT_REGION=us-east-1
STACK="${STACK:-emitrain}"
SIGNAL="${SIGNAL:-wss://0.peerjs.com}"

read -rp 'Email for alarms and cut-off notices: ' EMAIL
OIDC=true
if aws iam list-open-id-connect-providers --output text | grep -q token.actions.githubusercontent.com; then OIDC=false; fi

aws cloudformation deploy --stack-name "$STACK" --template-file aws/template.yaml --capabilities CAPABILITY_IAM \
  --parameter-overrides AlertEmail="$EMAIL" SignallingOrigin="$SIGNAL" CreateGitHubOidcProvider="$OIDC" --no-fail-on-empty-changeset

out() { aws cloudformation describe-stacks --stack-name "$STACK" --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
bash aws/upload-site.sh "$(out SiteBucketName)" "$(out DistributionId)"

cat <<MSG

Done. Confirm the two "AWS Notification - Subscription Confirmation" emails sent to $EMAIL.

  App on AWS:   $(out SiteUrl)

For automatic deploys, add these as GitHub repository *variables* (Settings -> Secrets and variables -> Actions -> Variables):
  AWS_DEPLOY_ROLE_ARN   $(out DeployRoleArn)
  AWS_SITE_BUCKET       $(out SiteBucketName)
  AWS_DISTRIBUTION_ID   $(out DistributionId)
MSG
