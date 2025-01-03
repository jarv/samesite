import esbuild from "esbuild";

async function build() {
  try {
    await esbuild.build({
      entryPoints: ["./src/index.js"],
      bundle: true,
      minify: false,
      outdir: "./static/js",
      target: ["es2017"],
    });
  } catch (error) {
    console.error(error);
  }
}

build();
