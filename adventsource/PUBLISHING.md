# Public Uniform Guide data

The public `adventsource.html` fetches
`https://lonnystartpage.pages.dev/adventsource/uniform-details-backup.json`
on every page load and refresh with `cache: 'no-store'`, regardless of where
the page is hosted. Deploy the updated JSON file to that Cloudflare Pages
site to update the published tables; local backup files are not used.

- Existing browser storage is neither read nor overwritten.
- The published backup is validated and shared-item tables are normalized before display.
  Tables that do not require merging retain every row in its original order,
  including repeated blank spacer rows and repeated content.
- **Settings > Restore from Backup** replaces only the current page's tables.
  The next page load or refresh fetches the published backup again.
- **Backup All** downloads the currently loaded tables, including a temporary
  restore. It does not change the published JSON file.
- Loading failures are shown in the page's status message; browser storage is
  not used as a fallback. Restore remains available after a loading failure.

The public page's restore control is disabled while published data is loading
so that a late network response cannot overwrite a temporary restore.
These changes do not alter the master editor's storage or publishing behavior.