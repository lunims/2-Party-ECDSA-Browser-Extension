// Listen for messages from the webpage
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    // Do something with the data received from the content script
    console.log("message in background");    
    // Send a response back to the content script
    const tabId = sender.tab.id;

    // your business logic
    chrome.tabs.sendMessage(tabId, { farewell: 'goodbye' });
});