# Org Structure Deployment

This project builds into a portable static website. You can host the contents of `dist` anywhere that serves HTML, CSS, and JavaScript.

## Build

```powershell
.\build.ps1
```

## Standalone Link

Upload the `dist` folder contents to a path such as:

```text
https://yourdomain.com/org-structure/
```

That URL opens the full editable org structure app.

## Website Embed

Use the same deployed app as a contained iframe:

```html
<iframe
  src="https://yourdomain.com/org-structure/?embed=1"
  title="Organizational structure"
  style="width: 100%; height: 760px; border: 0; border-radius: 8px; overflow: hidden;"
  loading="lazy"
></iframe>
```

## Public Read-Only Link

For a link without the editor panel:

```text
https://yourdomain.com/org-structure/?view=1
```

## Notes

The app currently stores edits in the browser's local storage. For a public company site, publish the finalized build after your structure is set, or connect the app to a shared data source later if multiple people need to update it centrally.
