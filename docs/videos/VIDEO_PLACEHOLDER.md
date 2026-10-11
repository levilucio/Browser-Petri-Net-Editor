# SATEL Demo Video Placeholder

## Video Status

The SATEL demonstration video is planned to showcase the integrated testing features. Due to technical constraints in the cloud environment (screen recording limitations), the video will be recorded in a local development environment.

## What the Video Will Show

1. **SATEL Panel Integration**: The SATEL button in the toolbar and the sliding panel
2. **I/O Interface Visualization**: Input/output places and transitions marked in the manufacturing net
3. **Test Intention Management**: Creating, editing, and viewing test intentions
4. **Test Generation**: Automatic test case generation from high-level intentions
5. **Test Execution**: Running tests and viewing pass/fail results
6. **Complete Workflow**: End-to-end testing cycle demonstration

## Alternative Demo Options

Until the video is recorded, users can:

1. **Try the Live Demo**: https://levilucio.github.io/Browser-Petri-Net-Editor/
   - Open the editor
   - Load an algebraic net example
   - Click the SATEL button in the toolbar
   - Explore the three tabs: Test Intentions, I/O Interface, Results

2. **Run Locally**:
   ```bash
   git clone https://github.com/levilucio/Browser-Petri-Net-Editor.git
   cd Browser-Petri-Net-Editor
   git checkout cursor/satel-apn-testing-eaea
   cd petri-net-app
   npm install
   npm run dev
   ```
   Navigate to http://localhost:3000 and explore the SATEL features

3. **Review the Demo Script**: See `SATEL_DEMO_SCRIPT.md` for a detailed walkthrough

## Screenshots

For visual reference, see the following screenshots (to be added):
- `screenshot-01-toolbar-satel-button.png` - SATEL button location
- `screenshot-02-satel-panel-intentions.png` - Test Intentions tab
- `screenshot-03-satel-panel-interface.png` - I/O Interface tab
- `screenshot-04-satel-panel-results.png` - Test Results tab
- `screenshot-05-intention-editor.png` - Editing a test intention
- `screenshot-06-test-execution.png` - Test execution results

## Video Specifications (Planned)

- **Format**: MP4 (H.264)
- **Resolution**: 1920x1080 (1080p)
- **Duration**: 2-3 minutes
- **Audio**: Optional narration or captions
- **File Size**: Target < 50 MB for GitHub hosting

## Recording Instructions

To record the demo locally:

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Use screen recording software:
   - **macOS**: QuickTime Player (File → New Screen Recording)
   - **Windows**: Xbox Game Bar (Win + G)
   - **Linux**: SimpleScreenRecorder or OBS Studio

3. Follow the script in `SATEL_DEMO_SCRIPT.md`

4. Save the video as `satel-demo-integrated-editor.mp4`

5. Optimize the file size:
   ```bash
   ffmpeg -i satel-demo-integrated-editor.mp4 -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k satel-demo-optimized.mp4
   ```

6. Place in `docs/videos/` directory

## Contributing

If you'd like to contribute a demo video:

1. Follow the recording instructions above
2. Ensure the video clearly demonstrates all key features
3. Keep the duration under 5 minutes
4. Submit a PR with the video file or a link to hosted video

## Contact

For questions about SATEL or the demo:
- **GitHub Issues**: https://github.com/levilucio/Browser-Petri-Net-Editor/issues
- **Repository**: https://github.com/levilucio/Browser-Petri-Net-Editor
- **SATEL Documentation**: See `SATEL_README.md` in the repository root

---

**Note**: This is a placeholder. The actual demo video will be added once recording is completed in a suitable environment.
