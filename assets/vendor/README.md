# ACA video control components

`aca-media-ui-10.6.0.js` is a self-contained ES module built from the official
`@videojs/cdn@10.6.0` npm package (Apache-2.0). It registers HTML UI components
around the existing native video element. It does not include an additional
playback engine or skin, and makes no runtime CDN request.

Upstream: https://videojs.org/ and https://www.npmjs.com/package/@videojs/cdn
Package integrity:
`sha512-DsuXvdxbqvaTBiecbiDJ/pF4/ttso3JHfGxSMuN7K43UvPY8zUTKJqhAY9f+DTDN/Xjuen491FKDMcgP4Gr7kQ==`

Reproduce by packing that exact version, extracting it into `package/`, and
bundling this entry with the repository's esbuild:

```js
import './package/player-CduD1gHP.js';
import './package/ui/container.js';
import './package/ui/play-button.js';
import './package/ui/time-slider.js';
import './package/ui/slider-track.js';
import './package/ui/slider-fill.js';
import './package/ui/slider-buffer.js';
import './package/ui/slider-thumb.js';
import './package/ui/mute-button.js';
import './package/ui/volume-slider.js';
import './package/ui/fullscreen-button.js';
import './package/ui/pip-button.js';
import './package/ui/time.js';
```

```sh
esbuild entry.js --bundle --format=esm --minify --legal-comments=linked --outfile=aca-media-ui-10.6.0.js
```

The pinned player entry is the native-video registration imported by upstream's
`video-compat.js`. Keep the generated `.LEGAL.txt` and copied upstream LICENSE
alongside the bundle. Revalidate keyboard controls, native text-track defaults,
private asynchronous tracks, fullscreen, HLS and browser-control fallback before
updating the version. ACA styling/controller code lives one directory above.
