// content.js - Content script that runs in the context of web pages

// Use a self-executing function to avoid variable redeclaration issues
// when the script is injected multiple times
(function() {
// Check if the script has already been injected
if (window.chromeTabRecorderInitialized) {
  console.log("Chrome Tab Recorder already initialized");
  return;
}

// Mark as initialized
window.chromeTabRecorderInitialized = true;

// Use window properties to store state
window.chromeTabRecorder = window.chromeTabRecorder || {
  mediaRecorder: null,
  recordedChunks: [],
  stream: null,
  isRecording: false
};

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("Content script received message:", request);
  if (request.action === "startRecording") {
    // Check if already recording
    if (window.chromeTabRecorder.isRecording) {
      console.log("Already recording, cannot start another recording");
      sendResponse({
        success: false, 
        error: "Already recording. Stop the current recording before starting a new one."
      });
      return true;
    }
    
    startRecording(request.streamId, request.tabId)
      .then(() => {
        sendResponse({success: true});
      })
      .catch(error => {
        sendResponse({
          success: false, 
          error: error.message || "Failed to start recording"
        });
      });
    return true;
  } else if (request.action === "stopRecording") {
    const result = stopRecording();
    sendResponse({
      success: true,
      wasRecording: result.wasRecording
    });
    return true;
  } else if (request.action === "getRecordingStatus") {
    sendResponse({
      isRecording: window.chromeTabRecorder.isRecording
    });
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
    window.chromeTabRecorder.stream = await navigator.mediaDevices.getUserMedia(constraints);
    window.chromeTabRecorder.isRecording = true;
    
    // Notify popup that recording has started
    chrome.runtime.sendMessage({action: "recordingStarted"});
    
    // Configure MediaRecorder with better quality options
    const options = { 
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: 5000000 // 5 Mbps for better quality
    };
    
    try {
      window.chromeTabRecorder.mediaRecorder = new MediaRecorder(window.chromeTabRecorder.stream, options);
    } catch (e) {
      // Fallback if the specified options aren't supported
      console.warn("MediaRecorder with specified options not supported, using default options");
      window.chromeTabRecorder.mediaRecorder = new MediaRecorder(window.chromeTabRecorder.stream);
    }
    
    window.chromeTabRecorder.recordedChunks = [];
    
    window.chromeTabRecorder.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        window.chromeTabRecorder.recordedChunks.push(e.data);
      }
    };
    
    window.chromeTabRecorder.mediaRecorder.onstop = () => {
      // Only process if we have chunks to work with
      if (window.chromeTabRecorder.recordedChunks.length > 0) {
        // Create a blob from the recorded chunks
        const blob = new Blob(window.chromeTabRecorder.recordedChunks, { type: 'video/webm' });
        
        // Get the tab title to use in the filename
        chrome.tabs.get(tabId, (tab) => {
          try {
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
          } catch (error) {
            console.error("Error saving recording:", error);
          }
          
          // Reset recording state
          window.chromeTabRecorder.isRecording = false;
          
          // Notify popup that recording has stopped
          chrome.runtime.sendMessage({action: "recordingStopped"});
        });
      } else {
        // No chunks recorded, just reset state
        window.chromeTabRecorder.isRecording = false;
        chrome.runtime.sendMessage({action: "recordingStopped"});
      }
    };
    
    // Start recording with timeslices to get data during recording
    window.chromeTabRecorder.mediaRecorder.start(1000); // Collect data every second
    
    // Continue to play the captured audio to the user
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(window.chromeTabRecorder.stream);
    source.connect(audioContext.destination);
    
  } catch (error) {
    console.error("Error starting recording:", error);
    window.chromeTabRecorder.isRecording = false;
    chrome.runtime.sendMessage({
      action: "recordingError",
      error: error.message || "Unknown error occurred while starting recording"
    });
    
    // Clean up any resources
    if (window.chromeTabRecorder.stream) {
      window.chromeTabRecorder.stream.getTracks().forEach(track => track.stop());
    }
    
    // Re-throw the error for proper promise handling
    throw error;
  }
}

// Function to stop recording
function stopRecording() {
  let wasRecording = false;
  
  try {
    if (window.chromeTabRecorder.mediaRecorder && window.chromeTabRecorder.mediaRecorder.state !== 'inactive') {
      wasRecording = true;
      window.chromeTabRecorder.mediaRecorder.stop();
      
      // Stop all tracks in the stream
      if (window.chromeTabRecorder.stream) {
        window.chromeTabRecorder.stream.getTracks().forEach(track => track.stop());
      }
      
      // Reset stream variable
      window.chromeTabRecorder.stream = null;
    } else {
      // Not recording or already stopped
      window.chromeTabRecorder.isRecording = false;
      chrome.runtime.sendMessage({
        action: "recordingStopped"
      });
    }
  } catch (error) {
    console.error("Error stopping recording:", error);
    // Force reset recording state in case of errors
    window.chromeTabRecorder.isRecording = false;
    chrome.runtime.sendMessage({
      action: "recordingStopped"
    });
  }
  
  return { wasRecording };
}

// Close the self-executing function
})();
