var cred;

/*
  block to inject script into the web page
  - check if a credential has been set before
  - set potentially saved credential as script attribute 
*/ 
chrome.storage.local.get('credential', function(data) {
    if (data.hasOwnProperty('credential')) {
      cred = data.credential;
      console.log('Credential retrieved:', cred);
      var s = document.createElement('script');
      s.setAttribute('cred', cred);
      s.src = chrome.runtime.getURL('inject.js');
      (document.head || document.documentElement)
      .appendChild(s);
    } else {
      console.log('Credential not found in storage.');
      var s = document.createElement('script');
      s.src = chrome.runtime.getURL('inject.js');
      (document.head || document.documentElement)
      .appendChild(s);
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