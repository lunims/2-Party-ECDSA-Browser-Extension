localStorage.setItem('flag', false);
var s = document.createElement('script');
s.setAttribute('test', "test");
s.src = chrome.runtime.getURL('inject.js');
(document.head || document.documentElement)
.appendChild(s);


// Content script
// Listen for the event
window.addEventListener("PassToBackground", function(evt) {
  chrome.runtime.sendMessage(evt.detail);
}, false);

// Listen for messages from the background script
// TODO listen for credential and save
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    console.log('Response from background script:', message);
});