# Acceptance deployment workflow

Owner-approved 2026-11-15. `.github/workflows/deploy-acceptance.yml` deploys an exact commit to the existing, Access-protected **acceptance** Worker `afnan-collection-storefront`. It does not deploy production, change DNS, enable payments or email, or touch Cloudflare Access.

Why it exists: the Claude cloud session's credential proxy replaces Wrangler's short-lived asset-upload token, so new asset uploads fail with 401 there (see `acceptance/HOSTED-ACCEPTANCE-EXECUTION.md`). GitHub-hosted runners talk to Cloudflare directly.

## Safeguards

- **Manual only:** `workflow_dispatch`. No push or pull-request trigger.
- **Owner only:** the run fails unless the actor is the repository owner.
- **Exact commit:** the input must be a full 40-character SHA contained in a branch of this repository. Commits that exist only on fork pull-request refs are refused. The SHA is shown in the run name and summary and is stamped on the Worker version message.
- **Secret isolation — deploy uses only the verified build artifact:** the `build` job runs the commit's code (install, tests, build, bundling with pinned Wrangler) with **no secrets** and produces one artifact: the final Worker module, the static assets, a `COMMIT` file and `MANIFEST.sha256` covering every file. The `deploy` job, which is the only job that receives `CLOUDFLARE_API_TOKEN`, **never checks out the repository and never installs or runs application code**. It checks that the artifact's commit equals the requested SHA, verifies every checksum and that no unlisted files exist, writes a fixed config into a directory containing only that artifact, and uploads with a pinned Wrangler (`4.160.0`, installed with `--ignore-scripts`) using `--no-bundle`. The uploaded module is byte-for-byte the one the build job produced.
- **`main` only:** both jobs refuse to run unless the workflow was dispatched from `main`, in addition to the environment's branch policy.
- **Fixed target:** the Worker name, account, D1/R2 bindings, variables, `workers_dev: true`, `preview_urls: false` and empty routes are written by the workflow, not read from the commit.
- **Pinned actions:** every action is pinned to a full commit SHA.
- **One at a time:** concurrency allows a single deploy; a second run queues and does not cancel the first.

## Owner setup (once) — do these in order

1. **Merge the workflow PR into `main`.** GitHub only allows `workflow_dispatch` for workflows on the default branch. This is a separate approval from PRs #4 and #5.
2. **Create the environment before adding any secret.** Repository → Settings → Environments → **New environment** → name `afnan-acceptance`.
   - **Required reviewers:** add yourself (`Babaram977`). Leave "Prevent self-review" unticked if you are the only reviewer, otherwise nobody can approve.
   - **Deployment branches and tags:** choose "Selected branches and tags" and add the rule `main`. The workflow always runs from `main`; the commit to deploy is an input.
   - Leave "Allow administrators to bypass configured protection rules" **unticked**.
3. **Create a dedicated Cloudflare API token** (Cloudflare dashboard → Manage account → Account API tokens → Create token → Custom). Do not reuse the token in the Claude environment, and do not use the Access service token.
   - Name: `afnan-acceptance-github-deploy`.
   - Permissions: **Account → Workers Scripts → Edit**. If the first deploy reports a missing permission for the D1 or R2 binding, add only **Account → D1 → Read** and/or **Account → Workers R2 Storage → Read**.
   - Account resources: include only account `b4e142fe9da84ef204eecda2efe4a730`.
   - TTL: set an expiry (for example 90 days) and rotate it.
4. **Test the protection before adding the token.** Run the workflow once (see Deploying) without the secret. Check that the `deploy` job pauses for your approval. Approve it: it must stop at "CLOUDFLARE_API_TOKEN is not set" without deploying. Re-run and **reject** it: the job must not start. Only then add the secret.
5. **Add the secret to the environment, not the repository.** Settings → Environments → `afnan-acceptance` → Environment secrets → **Add secret** → name `CLOUDFLARE_API_TOKEN` → paste the token. Never paste it into chat, issues or commits.

## Deploying

Actions → **Deploy Afnan acceptance** → Run workflow (branch `main`) → `commit` = the full SHA, `reason` = a short note. The `verify-and-build` job runs the full test gate and checks the built logo's checksum. The `deploy` job then waits for your approval in the environment review. The run summary records the commit, the Worker version and the rollback command.

## Rollback

`npx wrangler rollback <previous-version-id>`, run with the acceptance Worker selected, from a machine with Cloudflare access. Alternatively, dispatch the workflow with the previous commit SHA.

## Residual risks (accepted for acceptance)

- Cloudflare cannot scope a Workers Scripts token to one Worker: the token can edit every Worker in the account (including other businesses'). It is exposed only to the `deploy` job, which runs no repository code; keep it environment-scoped, short-lived and rotated, and use a separate token for production.
- The artifact is produced by the job that runs the commit's code, so the artifact is exactly as trustworthy as the commit you approve. The manifest stops substitution between jobs, not a malicious commit. Approve only commits you have reviewed.
- GitHub masks the secret in logs; the workflow never echoes it, and Wrangler does not print tokens.
