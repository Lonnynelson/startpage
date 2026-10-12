# Publishing uniform tables

The master editor's **Settings > Publish to GitHub** form updates
`adventsource/uniform-details-backup.json` in `Lonnynelson/startpage`. It uses the
Vercel function at `/api/uniform-tables`; GitHub Pages alone cannot accept writes.
Downloading and restoring backups still work as before.

## Deploy the publishing service

1. Import `Lonnynelson/startpage` into Vercel. Set the project root to the repository
   root, **not** the `adventsource` folder. The root `vercel.json` configures a static
   site with a Node.js serverless API. Use Node.js 22 or newer.
2. Create a fine-grained GitHub personal access token with access only to this
   repository and **Contents: Read and write** permission. Set an expiration date.
   If required by the account or organization, approve the token. The target branch
   must allow this token to commit; this implementation does not bypass branch
   protection or create pull requests.
3. Add these **server-side environment variables** in Vercel for Production:

   | Variable | Value |
   | --- | --- |
   | `GITHUB_TOKEN` | The fine-grained token. Never put it in HTML, JavaScript, or this repository. |
   | `PUBLISH_PASSPHRASE` | A unique, randomly generated ASCII passphrase of at least 24 characters (maximum 1,000). Use a password manager. This is separate from your GitHub password and token. |
   | `PUBLISH_ALLOWED_ORIGIN` | The exact origin serving the editor, such as `https://lonnynelson.github.io`. No path or trailing slash. If the editor uses a custom domain, use that origin instead. |
   | `GITHUB_BRANCH` | Optional; defaults to `main`. This must be the branch that deploys your public site. |

4. Redeploy after adding or changing environment variables. Note the production
   URL, such as `https://your-project.vercel.app`.
5. Make the API reachable from the editor's origin. Vercel deployment protection
   must not block browser requests or CORS preflights to the production API.
   The endpoint has its own passphrase authentication. Do not place the passphrase
   in a deployment-protection bypass URL.
6. Configure Vercel Firewall rate limiting for `/api/uniform-tables` before using
   the endpoint publicly, for example 10 requests per minute per IP. The function
   does not implement a persistent rate limiter. Keep the passphrase high-entropy
   and rotate it if disclosed.
7. Ensure your existing GitHub Pages deployment runs when this JSON file changes
   on the configured branch. Publishing commits the file; it does not independently
   run a deployment.

Only the configured HTTPS editor origin is allowed. If you host the editor on
Vercel instead of GitHub Pages, configure that production Vercel origin. Local
HTTP development origins and preview origins are not allowed by this configuration.
The service is fixed to the repository and file above; browser requests cannot
choose another repository, branch, or path.

## Publish from the editor

1. Open [AS-master-edit.html](./AS-master-edit.html) on the allowed site.
2. Before editing on a new device, use **Restore from Backup** to load the current
   published [JSON file](./uniform-details-backup.json). The master editor continues
   to use its own locally saved data; it does not automatically replace your drafts
   with the published file.
3. Edit the tables and select **Save Table**. Save or cancel any open editor.
4. Open **Settings**. Enter your Vercel service origin (not an `/api` URL) and your
   publishing passphrase, then select **Publish Tables** and confirm.
5. The editor publishes a snapshot of **all saved tables**, replacing the entire
   JSON file. It is not a per-table merge. An empty backup or a request over 1 MiB
   is rejected.
6. After success, follow **View commit** to see the GitHub commit. Once GitHub Pages
   redeploys, refreshing [the public guide](./adventsource.html) loads the new data.

The service reads the current file SHA immediately before the confirmed upload.
GitHub rejects an upload if the file changes between that read and the update.
On a conflict, review and restore the latest published backup, reconcile your
edits, and publish again. This does not detect changes made before you press
Publish, so coordinate with other editors and avoid publishing an outdated local
backup. No automatic merge or retry is performed.

The passphrase is sent over HTTPS in an Authorization header, kept only for the
request, and cleared from the input afterward. It is not saved to localStorage.
Neither the server-side GitHub token nor the passphrase should be shared through
chat, committed, or added to a browser URL. A password manager/browser extension
may have its own storage behavior.

## Errors and recovery

- **Incorrect passphrase:** re-enter the publishing passphrase, not the GitHub token.
- **Not configured / incorrect service response:** check environment variables,
  the project root, URL, and Vercel deployment protection.
- **Failed to fetch:** check HTTPS connectivity, the allowed origin, and whether
  CORS preflight requests reach the API.
- **GitHub rejected / missing file:** check token access, expiration, permissions,
  branch protection, branch selection, and GitHub rate limits.
- **Conflict:** reconcile the latest published data before retrying.
- If an upload times out, check GitHub commit history before retrying: GitHub may
  have accepted the commit even if the browser did not receive the response.
- To undo an incorrect publication, restore the previous JSON using GitHub's
  commit history and deploy it again. Publishing does not discard local drafts.

## Validation

Run the dependency-free API and backup-schema tests from the repository root:

```sh
node --test tests/uniform-tables.test.cjs
```

The tests mock GitHub requests; they do not use credentials or write to GitHub.
