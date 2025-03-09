// popup.js - Handles the popup UI interactions

document.addEventListener('DOMContentLoaded', function() {
  const startButton = document.getElementById('startRecording');
  const stopButton = document.getElementById('stopRecording');
  const statusDiv = document.getElementById('status');
  let recordingTimer = null;
  
  // Check recording status when popup opens
  checkRecordingStatus();
  
  // Listen for error messages from the content script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "recordingError") {
      startButton.disabled = false;
      stopButton.disabled = false; // Always enable stop button to allow recovery
      statusDiv.textContent = "Recording error: " + message.error;
      statusDiv.classList.remove('recording');
      statusDiv.classList.add('error');
      
      // Clear the timer if it exists
      if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
      }
    } else if (message.action === "recordingStarted") {
      startButton.disabled = true;
      stopButton.disabled = false;
      statusDiv.textContent = "Recording... (0s)";
      statusDiv.classList.add('recording');
      statusDiv.classList.remove('error');
      
      // Start timer to update recording duration
      let seconds = 0;
      recordingTimer = setInterval(() => {
        seconds++;
        statusDiv.textContent = `Recording... (${seconds}s)`;
      }, 1000);
    } else if (message.action === "recordingStopped") {
      startButton.disabled = false;
      stopButton.disabled = true;
      statusDiv.textContent = "Recording saved";
      statusDiv.classList.remove('recording');
      statusDiv.classList.remove('error');
      
      // Clear the timer
      if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
      }
    }
  });
  
  // Function to check current recording status
  function checkRecordingStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs || tabs.length === 0) {
        console.error("No active tab found");
        return;
      }
      
      const tab = tabs[0];
      
      // First ensure the content script is injected
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['js/content.js']
      }, function() {
        if (chrome.runtime.lastError) {
          console.error("Failed to inject content script:", chrome.runtime.lastError);
          statusDiv.textContent = "Error: " + chrome.runtime.lastError.message;
          statusDiv.classList.add('error');
          return;
        }
        
        // Ask content script for recording status
        chrome.tabs.sendMessage(tab.id, { action: "getRecordingStatus" }, function(response) {
          if (chrome.runtime.lastError) {
            console.error("Failed to get recording status:", chrome.runtime.lastError);
            return;
          }
          
          if (response && response.isRecording) {
            // Tab is already recording, update UI
            startButton.disabled = true;
            stopButton.disabled = false;
            statusDiv.textContent = "Recording...";
            statusDiv.classList.add('recording');
            
            // Start timer
            let seconds = 0;
            recordingTimer = setInterval(() => {
              seconds++;
              statusDiv.textContent = `Recording... (${seconds}s)`;
            }, 1000);
          }
        });
      });
    });
  }
  
  // Start recording when the start button is clicked
  startButton.addEventListener('click', function() {
    // Get the current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const tab = tabs[0];
      
      // Only check for chrome:// URLs if the URL is available
      // Some URLs might not be available due to permissions
      if (tab.url && tab.url.startsWith('chrome://')) {
        statusDiv.textContent = "Cannot record chrome:// pages due to security restrictions. Please navigate to a regular webpage to use the screen recorder.";
        statusDiv.classList.add('error');
        return;
      }
      
      // First inject the content script to ensure it's available
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['js/content.js']
      }, function() {
        if (chrome.runtime.lastError) {
          statusDiv.textContent = "Failed to inject content script: " + chrome.runtime.lastError.message;
          statusDiv.classList.add('error');
          return;
        }
        
        // Get the media stream ID for the current tab
        chrome.tabCapture.getMediaStreamId({ consumerTabId: tab.id }, function(streamId) {
          if (chrome.runtime.lastError) {
            statusDiv.textContent = "Failed to start recording: " + chrome.runtime.lastError.message;
            statusDiv.classList.add('error');
            return;
          }
          
          // Send the stream ID to the content script to start recording
          chrome.tabs.sendMessage(tab.id, { 
            action: "startRecording", 
            streamId: streamId,
            tabId: tab.id
          }, function(response) {
            if (chrome.runtime.lastError) {
              statusDiv.textContent = "Failed to communicate with page: " + chrome.runtime.lastError.message;
              statusDiv.classList.add('error');
              return;
            }
            
            if (!response) {
              statusDiv.textContent = "No response from content script. Please refresh the page and try again.";
              statusDiv.classList.add('error');
              return;
            }
            
            if (response.error) {
              statusDiv.textContent = "Failed to start recording: " + response.error;
              statusDiv.classList.add('error');
              return;
            }
            
            // Success will be handled by message listener
          });
        });
      });
    });
  });
  
  // Stop recording when the stop button is clicked
  stopButton.addEventListener('click', function() {
    statusDiv.textContent = "Stopping recording...";
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const tab = tabs[0];
      
      // First ensure the content script is injected
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['js/content.js']
      }, function() {
        if (chrome.runtime.lastError) {
          console.error("Failed to inject content script:", chrome.runtime.lastError);
          // Even if there's an error, try to force stop any recording
          forceStopRecording();
          return;
        }
        
        // Send stop message to content script
        chrome.tabs.sendMessage(tab.id, { action: "stopRecording" }, function(response) {
          if (chrome.runtime.lastError) {
            console.error("Failed to communicate with page:", chrome.runtime.lastError);
            // Even if there's an error, try to force stop any recording
            forceStopRecording();
            return;
          }
          
          // If we didn't actually stop a recording, update UI immediately
          if (response && response.success && !response.wasRecording) {
            startButton.disabled = false;
            stopButton.disabled = true;
            statusDiv.textContent = "Ready to record";
            statusDiv.classList.remove('recording');
            statusDiv.classList.remove('error');
            
            // Clear the timer if it exists
            if (recordingTimer) {
              clearInterval(recordingTimer);
              recordingTimer = null;
            }
          }
          // Otherwise wait for recordingStopped message
        });
      });
    });
  });
  
  // Function to force stop recording in case of errors
  function forceStopRecording() {
    startButton.disabled = false;
    stopButton.disabled = true;
    statusDiv.textContent = "Recording stopped (forced)";
    statusDiv.classList.remove('recording');
    
    // Clear the timer if it exists
    if (recordingTimer) {
      clearInterval(recordingTimer);
      recordingTimer = null;
    }
  }
  
  // Initialize UI state
  startButton.disabled = false;
  stopButton.disabled = true;
  statusDiv.textContent = "Ready to record";
  statusDiv.classList.remove('recording');
  statusDiv.classList.remove('error');
  
  // Clean up timer when popup closes
  window.addEventListener('unload', function() {
    if (recordingTimer) {
      clearInterval(recordingTimer);
    }
  });
});
