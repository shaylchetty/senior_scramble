# Senior Scramble UI

A static swipe-style profile browser built with plain HTML, CSS, and JavaScript.

## Files

- `index.html`: app structure and templates
- `styles.css`: layout and visual styling
- `app.js`: swipe logic, saved/skip views, rewind, and profile rendering
- `profiles.json`: profile data source

## Local Run

Because the app loads `profiles.json` with `fetch`, serve it over HTTP instead of opening `index.html` directly.

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Deploy To GitHub Pages

1. Create a new GitHub repository.
2. Push these files to the repository root.
3. In GitHub, open `Settings` -> `Pages`.
4. Under deploy source, choose your main branch and `/ (root)`.
5. Save, then wait for GitHub Pages to publish the site.

The app is fully static, so GitHub Pages works well out of the box.

## Data Notes

- `profiles.json` is publicly accessible once hosted on GitHub Pages.
- Saved and skipped state is stored in each visitor's browser with `localStorage`.
- Users can export and import their saved/skipped lists from the app header for a manual backup.
- If you update `profiles.json`, the site will use the new data on refresh.
