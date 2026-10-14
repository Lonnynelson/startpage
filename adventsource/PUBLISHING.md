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

## Pathfinder T-shirt catalog

[PF-Shirts.html](PF-Shirts.html) loads
[catalog-data.json](catalog-data.json) with caching disabled.
Serve the page over HTTP rather than opening it directly from the file system.
The JSON contains an array of styles, each with `id`, `description`, `image`,
and `sizes`; size rows contain `item`, `size`, and `price`.

The catalog's browser-edit recovery, search, and editing remain available.
In **Edit mode**, **Export JSON** downloads the current catalog and **Import JSON**
validates a selected JSON file, then asks before replacing the current catalog.
Invalid files leave the current catalog unchanged. Imported changes are retained
as browser edits until saved to the catalog file or discarded.
**Save to file** writes or downloads `catalog-data.json`.
Replace that file in `adventsource` and deploy it to publish your edits.
Previously remembered JavaScript file handles are not reused for JSON saves.

Deploy the JSON, HTML, `app.js`, and `assets` together in `adventsource`;
the former `catalog-data.js` is no longer needed.

## Adventurer T-shirt catalog

[ADV-Shirts.html](ADV-Shirts.html) uses the same catalog script but
loads [ADV_T-shirts.json](ADV_T-shirts.json). Browser edits and
remembered save-file handles are separate from the Pathfinder catalog.

The Adventurer JSON retains its `tables` format: each table has a `title`,
`columns` (`Item #`, `Description`, `Size`, `Price`), and string-valued `rows`.
Each row's description matches its table title. Prices are dollar amounts or
empty strings. Thumbnails default to `assets/Cat<first-item-number>.jpg`.
An optional `image` field overrides the default thumbnail; `null` removes it.

Import, export, and Save to file all use `ADV_T-shirts.json` in this same
format. Deploy the Adventurer page, JSON, shared `app.js`, and images together.