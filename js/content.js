// content.js - Content script that runs in the context of web pages

let mediaRecorder = null;
let recordedChunks = [];
let stream = null;

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "startRecording") {
    startRecording(request.streamId, request.tabId);
    sendResponse({success: true});
    return true;
  } else if (request.action === "stopRecording") {
    stopRecording();
    sendResponse({success: true});
    return true;
  }
  return false;
});

// Function to start recording using the provided stream ID
async function startRecording(streamId, tabId) {
  try {
    // Configure media constraints for the getUserMedia call
    const constraints = {
      video: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId,
          minWidth: 1280,
          minHeight: 720,
          maxWidth: 1920,
          maxHeight: 1080
        }
      },
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      }
    };
    
    // Get the media stream
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Notify popup that recording has started
    chrome.runtime.sendMessage({action: "recordingStarted"});
    
    // Configure MediaRecorder with better quality options
    const options = { 
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: 5000000 // 5 Mbps for better quality
    };
    
    try {
      mediaRecorder = new MediaRecorder(stream, options);
    } catch (e) {
      // Fallback if the specified options aren't supported
      console.warn("MediaRecorder with specified options not supported, using default options");
      mediaRecorder = new MediaRecorder(stream);
    }
    
    recordedChunks = [];
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      // Create a blob from the recorded chunks
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      
      // Get the tab title to use in the filename
      chrome.tabs.get(tabId, (tab) => {
        // Create a sanitized filename from the tab title
        let filename = tab.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        if (filename.length > 50) filename = filename.substring(0, 50);
        
        // Create a download link for the recording
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${filename}-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
        
        // Notify popup that recording has stopped
        chrome.runtime.sendMessage({action: "recordingStopped"});
      });
    };
    
    // Start recording with timeslices to get data during recording
    mediaRecorder.start(1000); // Collect data every second
    
    // Continue to play the captured audio to the user
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(audioContext.destination);
    
  } catch (error) {
    console.error("Error starting recording:", error);
    chrome.runtime.sendMessage({
      action: "recordingError",
      error: error.message || "Unknown error occurred while starting recording"
    });
    
    // Clean up any resources
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  }
}

// Function to stop recording
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    
    // Stop all tracks in the stream
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    // Reset variables
    stream = null;
  } else {
    chrome.runtime.sendMessage({
      action: "recordingError",
      error: "No active recording found"
    });
  }
}
