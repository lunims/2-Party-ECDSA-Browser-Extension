// Listen for messages from content script
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === "getDataFromStorage") {
        // Retrieve data from storage
        chrome.storage.sync.get(['key'], function(result) {
            // Send the retrieved data back to content script
            sendResponse(result);
        });
        // Return true to indicate that the response will be sent asynchronously
        return true;
    }
});