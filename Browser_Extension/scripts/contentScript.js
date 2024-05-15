var cred;
var toggle = 'false';

chrome.storage.local.get('toggle', function(data) {
  if (data.hasOwnProperty('toggle')) {
    toggle = data.toggle;
  }
  /*
  block to inject script into the web page
  - check if a credential has been set before
  - set potentially saved credential as script attribute 
  */
  if (toggle === 'true') {
    chrome.storage.local.get('credential', function(data) {
      if (data.hasOwnProperty('credential')) {
        cred = data.credential;
        var s = document.createElement('script');
        s.setAttribute('cred', cred);
        s.src = chrome.runtime.getURL('inject.js');
        (document.head || document.documentElement)
        .appendChild(s);
      } else {
        var s = document.createElement('script');
        s.src = chrome.runtime.getURL('inject.js');
        (document.head || document.documentElement)
        .appendChild(s);
      }
    });
  }
});

/*
  Event-listener for event in inject.js - needed to store credential
*/

window.addEventListener("PassToBackground", function(evt) {
  chrome.runtime.sendMessage(evt.detail);
}, false);

/*
  storing the credential 
*/

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    console.log('Response from background script:', message);
    chrome.storage.local.set({'credential': message}, function() {
      console.log('Credential stored in local storage:', message);
    });
});