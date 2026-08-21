# Album Web

Portfolio web implementation of Album’s current desktop interface.

## Run locally

Serve this directory over HTTP and open `index.html`. For example:

```powershell
python -m http.server 8080 --bind 127.0.0.1
```

Then visit `http://localhost:8080/`.

## Browser behavior

- Album only receives files a visitor explicitly selects through the browser picker.
- Selected folders are inspected locally for file metadata, SHA-256 hashes, image dimensions, and representative color.
- Imported files remain in the current browser session unless a deployment adds persistent storage.
- The full desktop analysis pipeline requires Album’s authenticated local service. A static host cannot run the Python CLIP, object-detection, OCR, face/pet, sensitive-content, video, and audio models by itself.
- Vault classification shown here is session-local. Production Vault access is protected by Album’s authenticated service before this interface is served; it is not unlocked with a second in-page password prompt.

## External resources

Inter and Material Symbols Rounded are linked from Google Fonts in `index.html`. No downloaded Material Symbols are bundled.
