/**
 * AudioCache Utility
 * Preloads audio files to ensure smooth playback in real-time game stages.
 */

export const audioCache = {
  /**
   * Preload audio files by creating phantom audio elements
   * @param {string[]} urls 
   */
  preload(urls) {
    urls.forEach(url => {
      if (!url) return;
      const audio = new Audio();
      audio.src = url;
      audio.preload = 'auto';
      // Load event is not always reliable for audio, but it triggers the buffer load
      audio.load();
    });
    console.log(`[AudioCache] Buffering ${urls.length} audio files...`);
  }
};
