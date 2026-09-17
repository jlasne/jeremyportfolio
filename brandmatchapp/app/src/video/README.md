# The film

Drop the recording here as `tour.mp4`, then in `src/screens/Landing.tsx` set:

    const VIDEO_URL = new URL('../video/tour.mp4', import.meta.url).href

The frame on the page keeps its shape either way. Until the file exists the
play button is disabled and the frame shows the live demo behind it.

Keep it under 8 MB so the page stays fast. 1920x1080, H.264, no audio track
needed.
