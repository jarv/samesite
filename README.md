## samesite.surveymoji.com

Validating different scenarios where browsers send cookies with different `SameSite` attributes.

[samsite.surveymoji.com](https://samesite.surveymoji.com)

The `SameSite` sandbox requires two domains for cross-domain request checks.
When running in a two-domain configuration, use the `-altDomain` and `-primaryDomain` options.

QR code images are generated on the fly, and stored on the filesystem.
For this to work the program needs a directory `-qrImgDir` that it can write to.

Options:

```
  -addr string
        http service address (default "localhost:8750")
  -altDomain string
        alternate domain that is used for the IFrame (default "localhost:8750")
  -json
        use json logs
  -primaryDomain string
        domain we redirect to for /redirect (default "localhost:8750")
  -qrImgDir string
        directory to store QR images (default "qrImgDir")
```

## Development

The entire site is self contained in a single compiled binary.
Static files are embedded using Go `embed`.

1. [Install `mise`](https://mise.jdx.dev/getting-started.html)


2. Install dependencies:

```
mise install
```

3. Build the assets:

```
mise run build-assets
```

4. Build the binary:

```
go build -ldflags '-w' -o samesite
```
Alternatively, the script `mise run watch` will watch for changes and rebuild everything when ever a change is detected.
