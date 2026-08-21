# Website showcase

Put each website in its own folder inside this directory, then add one entry to `sites.json`.

Example layout:

```text
websites/
  sites.json
  museum/
    index.html
    styles.css
    app.js
  shop/
    index.html
```

Example `sites.json`:

```json
{
  "sites": [
    {
      "title": "Museum website",
      "folder": "museum",
      "role": "Design + development",
      "description": "Public-facing museum site and visitor experience."
    },
    {
      "title": "Storefront",
      "folder": "shop",
      "role": "E-commerce",
      "description": "Custom catalogue, checkout, and order experience."
    }
  ]
}
```

`folder` is resolved as `/websites/<folder>/`. You can also use `path` or `url` instead. The portfolio renders each entry as a live miniature preview and opens the same page in the built-in fake browser.
