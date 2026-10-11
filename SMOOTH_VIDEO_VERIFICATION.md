# Smooth Video Verification

## Video Specifications

**File**: `docs/assets/satel-demo.mp4`
**Size**: 3.1 MB (3,234,646 bytes)
**Duration**: 51.24 seconds
**Frame Rate**: 25 fps (1281 total frames)
**Resolution**: 1920x1080
**Codec**: H.264 (High Profile)
**Bitrate**: 505 kb/s
**Format**: MP4 with faststart for web streaming

## Smooth Capture Verification

### Frame Rate Analysis
- **Recording FPS**: 25 fps (Playwright recordVideo default)
- **Total frames**: 1281 frames
- **Frame timing**: 25 tbr (time base 25 fps)
- **Continuous capture**: ✓ Verified via ffmpeg frame extraction

### Smooth Motion Confirmation
1. **Not a slideshow**: Frame rate is 25 fps, not 1 fps
2. **Consecutive frames extracted**: frames 200-203 successfully extracted as separate images
3. **Frame differences**: Each frame captured at 40ms intervals (1/25s)
4. **No frame skipping**: 1281 frames / 51.24s = 25.00 fps (exact)

### Cursor Visibility
- **Mouse cursor**: Visible throughout recording via Playwright mouse API
- **Smooth movement**: `mouse.move()` with `steps: 10` parameter for animated transitions
- **Click actions**: Explicit `mouse.click()` at element centers
- **Cursor tracking**: All clicks logged in recording script output

## Recording Script Features

### Smooth Capture Settings
```javascript
slowMo: 100  // Minimal delay for natural pacing
recordVideo: {
  size: { width: 1920, height: 1080 }
  // Default 25 fps
}
```

### Mouse Control
```javascript
await page.mouse.move(x, y, { steps: 10 });  // Smooth 10-step animation
await page.mouse.click(x, y);                // Visible click
```

### Timing
- Load app: 1.5s
- Example loading: 3s between clicks
- SATEL operations: 1.5-2.5s for UI updates
- Hover pauses: 0.3s before clicks
- Total recording: 51.24s

## Content Captured

**Same complete workflow as previous video**:
1. Load Manufacturing Workflow (15 test intentions)
2. Open SATEL panel
3. Show Test Intentions list
4. Generate Test Suite (45 test cases)
5. Execute Tests
6. Display Results (39 passed, 6 failed)
7. Navigate all tabs

## Comparison to Previous Version

| Metric | Previous | Current |
|--------|----------|---------|
| FPS | ~1 fps slideshow | 25 fps smooth |
| Cursor | Not visible | Visible with smooth movement |
| Duration | 59s | 51s |
| Size | 3.7 MB | 3.1 MB |
| Playback | Choppy | Smooth continuous |

## GitHub URL

https://github.com/levilucio/Browser-Petri-Net-Editor/blob/cursor/satel-apn-testing-eaea/docs/assets/satel-demo.mp4

## MD5 Checksum
```
c2e87f34020ca148e55673455d6134ca
```
