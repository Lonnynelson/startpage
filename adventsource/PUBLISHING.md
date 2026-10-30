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

Both `AS-master-edit.html` and `adventsource.html` support 3 through 7 columns
per uniform table, including stacked tables. In **Edit Table**, choose
**Number of columns**, edit the headers and cells, then use **Save Table**.
Seven-column tables are supported in backups, restores, the master editor's
saved browser data, and the public page's published JSON loading. The public
page's existing hidden edit controls and temporary-edit behavior are unchanged.

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

Both catalog pages also use `page-background.css` and `catalog-background.css`
with `AdventSource_1.jpg` and `AdventSource_2.jpg` for alternating photo
backgrounds and translucent, blurred panels. Deploy these assets alongside
the pages. Reduced-motion preferences disable the background animation.
Both catalogs display two columns at viewport widths of 1,200 pixels and above,
and one column on smaller screens.

## Books & Flags catalogs

- [PF-Books-Flags.html](PF-Books-Flags.html) loads
  [PF_Books_Flags.json](PF_Books_Flags.json).
- [ADV-Books-Flags.html](ADV-Books-Flags.html) loads
  [Adv_Books_Flags.json](Adv_Books_Flags.json).

These pages reuse `app.js`, both background stylesheets, the photo backgrounds,
and the Home link. They also display two columns on large screens and one on
smaller screens. Browser edits and remembered save-file handles are independent
for all four catalogs. Source JSON is fetched with caching disabled.

Each JSON file contains a `tables` array. Every table has its own `title`,
`columns`, and `rows`; rows must contain strings and match that table's column
count. Language-specific catalog numbers, leading zeros, price text, duplicate
rows, and blank cells remain unchanged through import/export and saving.
The Adventurer headers identify descriptions and English/Spanish catalog
numbers; original `000000` placeholders are retained. The three extra blank
cells in Pathfinder Guides were removed to align those rows with their headers.

Thumbnails use the first numeric catalog number in the table's first row,
trying `assets/Cat<number>.jpg` and then `.png`. Missing files show an
**Image not found** placeholder with the item number. The supplied assets
currently lack `Cat001301` (Pathfinder Guides), `Cat001049` (Adventurer Leader's
Guides), and `Cat001605` (Wall Banners). Add matching JPG or PNG images to
`assets` to display them. No substitute images are chosen.

An optional table `image` overrides automatic matching; `null` hides the image.
In **Edit mode**, edit titles, individual column headings, and all cells, or
add/remove rows, columns, and tables. Clearing the image field restores automatic
matching. JSON imports are validated before asking to replace browser edits;
invalid files leave the current catalog intact. **Export JSON** downloads the
current tables; **Save to file** writes or downloads the page's named JSON file.
Replace the published JSON and deploy the pages, script, stylesheets, and assets
together to publish changes.