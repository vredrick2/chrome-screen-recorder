// popup.js - Handles the popup UI interactions

document.addEventListener('DOMContentLoaded', function() {
  const startButton = document.getElementById('startRecording');
  const stopButton = document.getElementById('stopRecording');
  const statusDiv = document.getElementById('status');
  let recordingTimer = null;
  
  // Listen for error messages from the background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "recordingError") {
      startButton.disabled = false;
      stopButton.disabled = true;
      statusDiv.textContent = "Recording error: " + message.error;
      statusDiv.classList.remove('recording');
      
      // Clear the timer if it exists
      if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
      }
    }
  });
  
  // Start recording when the start button is clicked
  startButton.addEventListener('click', function() {
    chrome.runtime.sendMessage({action: "startRecording"}, function(response) {
      if (response && response.success) {
        startButton.disabled = true;
        stopButton.disabled = false;
        statusDiv.textContent = "Recording... (0s)";
        statusDiv.classList.add('recording');
        
        // Start timer to update recording duration
        let seconds = 0;
        recordingTimer = setInterval(() => {
          seconds++;
          statusDiv.textContent = `Recording... (${seconds}s)`;
        }, 1000);
      } else {
        statusDiv.textContent = "Failed to start recording: " + (response ? response.error : "Unknown error");
      }
    });
  });
  
  // Stop recording when the stop button is clicked
  stopButton.addEventListener('click', function() {
    chrome.runtime.sendMessage({action: "stopRecording"}, function(response) {
      if (response && response.success) {
        startButton.disabled = false;
        stopButton.disabled = true;
        statusDiv.textContent = "Recording saved";
        statusDiv.classList.remove('recording');
        
        // Clear the timer
        if (recordingTimer) {
          clearInterval(recordingTimer);
          recordingTimer = null;
        }
      } else {
        statusDiv.textContent = "Failed to stop recording: " + (response ? response.error : "Unknown error");
      }
    });
  });
  
  // Check current recording status when popup opens
  chrome.runtime.sendMessage({action: "getRecordingStatus"}, function(response) {
    if (response && response.isRecording) {
      startButton.disabled = true;
      stopButton.disabled = false;
      statusDiv.textContent = `Recording... (${response.duration}s)`;
      statusDiv.classList.add('recording');
      
      // Start timer to update recording duration
      let seconds = response.duration || 0;
      recordingTimer = setInterval(() => {
        seconds++;
        statusDiv.textContent = `Recording... (${seconds}s)`;
      }, 1000);
    } else {
      startButton.disabled = false;
      stopButton.disabled = true;
      statusDiv.textContent = "Ready to record";
      statusDiv.classList.remove('recording');
    }
  });
  
  // Clean up timer when popup closes
  window.addEventListener('unload', function() {
    if (recordingTimer) {
      clearInterval(recordingTimer);
    }
  });
});
