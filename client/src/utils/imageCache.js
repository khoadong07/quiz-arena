/**
 * ImageCache Utility
 * Uses the dynamic Cache Storage API to store and retrieve images locally.
 * This speeds up subsequent loads and provides a smoother experience during transitions.
 */

const CACHE_NAME = 'khoot-image-cache-v1';

export const imageCache = {
  /**
   * Preload an array of image URLs
   * @param {string[]} urls 
   */
  async preload(urls) {
    if (!('caches' in window)) return;
    
    const validUrls = urls.filter(url => url && typeof url === 'string');
    if (validUrls.length === 0) return;

    try {
      const cache = await caches.open(CACHE_NAME);
      // We use addAll but wrap in individual try-catch to not fail all if one fails
      await Promise.all(
        validUrls.map(async (url) => {
          try {
            // Check if already in cache
            const existing = await cache.match(url);
            if (!existing) {
              await cache.add(url);
              console.log(`[ImageCache] Cached: ${url}`);
            }
          } catch (err) {
            console.warn(`[ImageCache] Failed to cache: ${url}`, err);
          }
        })
      );
    } catch (err) {
      console.error('[ImageCache] Error opening cache', err);
    }
  },

  /**
   * Get a cached image URL or original if not found
   * @param {string} url 
   * @returns {Promise<string>}
   */
  async get(url) {
    if (!url || !('caches' in window)) return url;

    try {
      const cache = await caches.open(CACHE_NAME);
      const response = await cache.match(url);
      
      if (response) {
        const blob = await response.blob();
        return URL.createObjectURL(blob);
      }
      
      // If not in cache, start caching it for next time but return original
      this.preload([url]);
      return url;
    } catch (err) {
      return url;
    }
  },

  /**
   * Clear the entire image cache
   */
  async clear() {
    if (!('caches' in window)) return;
    return caches.delete(CACHE_NAME);
  }
};
