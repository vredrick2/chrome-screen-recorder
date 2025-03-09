// content.js - Content script that runs in the context of web pages

// This script can be used to communicate with the web page
// For this extension, most functionality is handled by the background script
// using the chrome.tabCapture API

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getPageInfo") {
    // Get information about the current page if needed
    const pageInfo = {
      title: document.title,
      url: window.location.href
    };
    sendResponse(pageInfo);
    return true;
  }
});
