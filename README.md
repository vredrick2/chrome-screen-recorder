# Chrome Tab Screen Recorder

A Chrome extension that allows you to record your Chrome tab and save the recordings locally to your PC.

## Features

- Record any Chrome tab with audio
- High-quality video recording (VP9 codec at 5Mbps)
- Recording duration display
- Automatic file naming based on tab title
- Simple and intuitive user interface
- Local saving of recordings

## Installation

### From Source Code

1. Clone this repository or download the source code
   ```
   git clone https://github.com/vredrick2/chrome-screen-recorder.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" using the toggle in the top-right corner

4. Click "Load unpacked" and select the extension folder

5. The extension should appear in your extensions list

### From ZIP File

1. Download the `chrome-screen-recorder-extension.zip` file

2. Extract the ZIP file to a folder on your computer

3. Open Chrome and navigate to `chrome://extensions/`

4. Enable "Developer mode" using the toggle in the top-right corner

5. Click "Load unpacked" and select the extracted folder

6. The extension should appear in your extensions list

## Usage

1. Click on the extension icon in your Chrome toolbar to open the popup

2. Navigate to the tab you want to record

3. Click "Start Recording" to begin recording the current tab

4. The recording status will show the duration of the recording

5. Click "Stop Recording" when you're finished

6. The recording will be automatically saved to your Downloads folder with a filename based on the tab title

## Permissions

This extension requires the following permissions:

- `activeTab`: To access the current tab for recording
- `storage`: To store extension settings
- `tabs`: To get information about the current tab
- `scripting`: To inject scripts for recording
- `tabCapture`: To capture tab content for recording
- `downloads`: To save recordings to your computer

## Technical Details

- Uses the Chrome `tabCapture` API to record tab content
- Implements MediaRecorder API for video recording
- Saves recordings in WebM format with VP9 video codec and Opus audio codec
- Uses Chrome's download API for better file handling

## Development

The extension consists of the following components:

- `manifest.json`: Extension configuration
- `popup.html` and `popup.js`: User interface
- `background.js`: Core recording functionality
- `content.js`: Content script for page interactions

## License

This project is licensed under the MIT License.

## Privacy

This extension does not collect or transmit any user data. All recordings are saved locally to your computer and are not uploaded to any server.
