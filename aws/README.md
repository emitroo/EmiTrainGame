# Emi Train Game on AWS (later, optional)

> Not needed now: the game is hosted on GitHub Pages. This folder is a ready setup for when a private copy is wanted.

GitHub Pages is the primary home. This folder adds a second, private copy on AWS, in two independent modules, so
each can be adopted when needed.

```
phone ──HTTPS──► CloudFront ──(origin access control)──► S3 bucket: the app (private)        [module 1: template.yaml]
phone ──WSS────► your signalling server (PeerJS) — introduces phones only                       [module 2: signalling/]
phone ◄──WebRTC──► phone   (game traffic, direct or through the TURN relay)
CloudWatch alarms + monthly budget ──► SNS ──► email, and a cut-off Lambda that disables CloudFront
GitHub Actions ──(OIDC, short-lived role)──► S3 upload + CloudFront refresh
```

## Module 1: the app on S3 + CloudFront (free tier)

One CloudFormation stack in `us-east-1`: private bucket, CloudFront with HTTPS and security headers (strict CSP,
HSTS, `X-Frame-Options: DENY`, camera allowed only for QR pairing), three usage alarms, a $1 monthly budget counted
before credits, and a cut-off that disables the distribution if usage runs away. GitHub Pages is unaffected.

| Service | Always-free allowance | Warning email | Automatic cut-off |
| --- | --- | --- | --- |
| CloudFront requests | 10M / month | > 5,000 in an hour | > 300,000 in a day |
| CloudFront data out | 1 TB / month | n/a | > 30 GB in a day |
| Whole account cost (before credits) | n/a | > $0.50 actual, or forecast > $1 | > $1 actual this month |

A games night is a few hundred requests and a few MB.

**Deploy (CloudShell, us-east-1):**
```
git clone -b claude/emi-train-game-09t9sr https://github.com/emitroo/EmiTrainGame && cd EmiTrainGame
bash aws/deploy.sh
```
Confirm the two subscription emails. For automatic deploys on every push, add the three printed values as GitHub
repository variables (`AWS_DEPLOY_ROLE_ARN`, `AWS_SITE_BUCKET`, `AWS_DISTRIBUTION_ID`); `.github/workflows/aws-deploy.yml`
stays inactive until they exist. Undo a cut-off with `bash aws/reenable.sh`. Remove everything: empty the bucket, then
`aws cloudformation delete-stack --stack-name emitrain`.

## Module 2: a private signalling server (not free)

Online games use the free public PeerJS server to introduce phones; game data never passes through it. Run your own if
you don't want to depend on it:

1. Host `signalling/` (Dockerfile + server.js, the standard `peer` package) on any small machine with a domain name,
   e.g. a Lightsail instance or EC2 `t4g.nano` (roughly $3–4/month; not inside the always-free tier), with
   `signalling/Caddyfile` in front for automatic HTTPS.
2. Put its address in `src/config.js`: `broker: 'wss://signal.example.com/peerjs?key=peerjs'`, then `npm run build` and push.
3. Re-run `SIGNAL=wss://signal.example.com bash aws/deploy.sh` so the AWS copy's CSP allows it.

The TURN relay (for phones on mobile data that can't reach each other directly) is Metered's free plan, shared with
EBriscola. To use your own (e.g. coturn on the same machine), set `iceServers` in `src/config.js`.

## Files

- `template.yaml`: the stack (checked by `cfn-lint` in CI).
- `deploy.sh`, `upload-site.sh`, `reenable.sh`: CloudShell / CI scripts.
- `signalling/`: private signalling server.
