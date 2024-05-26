## SameSite.DidUThink.com

Validating different scenarios where browsers send cookies with different `SameSite` attributes.

[samsite.diduthink.com](https://samesite.diduthink.com)

The `SameSite` sandbox is requires two domains for cross-domain request checks.
When running in a two-domain configuration use the `-altDomain` and `-primaryDomain` options.

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

In order to build, first build the assets:

```
./bin/build-assets
```

And then build the binary:

```
export CGO_ENABLED GOOS GOARCH
go build -ldflags "-w" -o samesite !(*_test).go
```
Alternatively, the script `./bin/watch` will watch for changes and rebuild everything when ever a change is detected (requires the tool `entr` to run).

This is the most fastest way to validate changes during development.
