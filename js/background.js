// background.js - Handles the core extension functionality

let recorder = null;
let recordingTab = null;
let isRecording = false;
let chunks = [];
let recordingStartTime = null;

// Listen for messages from the popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startRecording") {
    startRecording(sendResponse);
    return true; // Keep the message channel open for the async response
  } else if (message.action === "stopRecording") {
    stopRecording(sendResponse);
    return true; // Keep the message channel open for the async response
  } else if (message.action === "getRecordingStatus") {
    sendResponse({ 
      isRecording: isRecording,
      duration: isRecording ? Math.floor((Date.now() - recordingStartTime) / 1000) : 0
    });
    return false;
  }
});

// Start the recording process
async function startRecording(sendResponse) {
  try {
    // Get the current active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    
    // Check if the tab URL is a chrome:// URL
    if (tab.url && tab.url.startsWith('chrome://')) {
      sendResponse({ 
        success: false, 
        error: "Cannot record chrome:// pages due to security restrictions. Please navigate to a regular webpage to use the screen recorder."
      });
      return;
    }
    
    recordingTab = tab.id;
    
    // Execute content script to capture the tab
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: setupRecording
    });
    
    isRecording = true;
    recordingStartTime = Date.now();
    sendResponse({ success: true });
  } catch (error) {
    console.error("Error starting recording:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Function injected into the tab to set up recording
function setupRecording() {
  // Send a message back to the background script to start the actual recording
  chrome.runtime.sendMessage({ action: "tabReadyForRecording" });
}

// Listen for the tab being ready for recording
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === "tabReadyForRecording" && sender.tab && sender.tab.id === recordingTab) {
    // Start capturing the tab
    chrome.tabCapture.capture({
      video: true,
      audio: true,
      videoConstraints: {
        mandatory: {
          minWidth: 1280,
          minHeight: 720,
          maxWidth: 1920,
          maxHeight: 1080
        }
      }
    }, (stream) => {
      if (chrome.runtime.lastError) {
        console.error("TabCapture error:", chrome.runtime.lastError);
        // Notify popup about the error
        chrome.runtime.sendMessage({
          action: "recordingError",
          error: chrome.runtime.lastError.message
        });
        return;
      }
      
      if (stream) {
        // Configure MediaRecorder with better quality options
        const options = { 
          mimeType: 'video/webm;codecs=vp9,opus',
          videoBitsPerSecond: 5000000 // 5 Mbps for better quality
        };
        
        try {
          recorder = new MediaRecorder(stream, options);
        } catch (e) {
          // Fallback if the specified options aren't supported
          console.warn("MediaRecorder with specified options not supported, using default options");
          recorder = new MediaRecorder(stream);
        }
        
        chunks = [];
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };
        
        recorder.onstop = () => {
          // Create a blob from the recorded chunks
          const blob = new Blob(chunks, { type: 'video/webm' });
          
          // Get the tab title to use in the filename
          chrome.tabs.get(recordingTab, (tab) => {
            // Create a sanitized filename from the tab title
            let filename = tab.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            if (filename.length > 50) filename = filename.substring(0, 50);
            
            // Use Chrome's download API for better file handling
            chrome.downloads.download({
              url: URL.createObjectURL(blob),
              filename: `${filename}-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`,
              saveAs: true
            });
            
            // Clean up
            stream.getTracks().forEach(track => track.stop());
          });
        };
        
        // Start recording with timeslices to get data during recording
        recorder.start(1000); // Collect data every second
      }
    });
  }
});

// Stop the recording process
function stopRecording(sendResponse) {
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop();
    isRecording = false;
    recordingStartTime = null;
    sendResponse({ success: true });
  } else {
    sendResponse({ success: false, error: "No active recording found" });
  }
}
