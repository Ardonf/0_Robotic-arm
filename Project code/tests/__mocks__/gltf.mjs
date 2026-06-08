/**
 * Minimal mock of GLTFLoader
 */
export class GLTFLoader {
  load(url, onLoad, onProgress, onError) {
    // no-op — tests never actually load a model
  }
}
