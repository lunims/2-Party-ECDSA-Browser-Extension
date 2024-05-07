/*
    send credential back to content script
*/
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    console.log("message in background");    
    const tabId = sender.tab.id;
    chrome.tabs.sendMessage(tabId, message);
});