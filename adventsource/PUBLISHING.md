# Public Uniform Guide data

The public `adventsource.html` fetches `uniform-details-backup.json` on every
page load and refresh with `cache: 'no-store'`. Deploy the updated JSON file
alongside the page to update the published tables.

- Existing browser storage is neither read nor overwritten.
- The published backup is validated and shared-item tables are normalized before display.
- **Settings > Restore from Backup** replaces only the current page's tables.
  The next page load or refresh fetches the published backup again.
- **Backup All** downloads the currently loaded tables, including a temporary
  restore. It does not change the published JSON file.
- Loading failures are shown in the page's status message; browser storage is
  not used as a fallback. Restore remains available after a loading failure.

The public page's restore control is disabled while published data is loading
so that a late network response cannot overwrite a temporary restore.
These changes do not alter the master editor's storage or publishing behavior.