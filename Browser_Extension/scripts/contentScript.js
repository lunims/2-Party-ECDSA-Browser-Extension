var cred;
var toggle = 'false';
var number1;
var number2;


chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  // Check if the message contains the saved numbers
  if (message.numbers !== undefined) {
      // Do something with the saved numbers
      number1 = message.numbers.number1;
      number2 = message.numbers.number2;
  }
});

chrome.storage.local.get('toggle', function(data) {
  if (data.hasOwnProperty('toggle')) {
    toggle = data.toggle;
  }
  /*
  block to inject script into the web page
  - check if a credential has been set before
  - set potentially saved credential as script attribute 
  - set threshold
  */
  if (toggle === 'true') {
    chrome.storage.local.get(['number1', 'number2'], function(result) {
      if (result.number1 && result.number2) {
        chrome.storage.local.get('credential', function(data) {
          if (data.hasOwnProperty('credential')) {
            cred = data.credential;
            var s = document.createElement('script');
            s.setAttribute('cred', cred);
            s.setAttribute('t', result.number1);
            s.setAttribute('n', result.number2);
            s.src = chrome.runtime.getURL('inject.js');
            (document.head || document.documentElement)
            .appendChild(s);
          } else {
            var s = document.createElement('script');
            s.setAttribute('t', result.number1);
            s.setAttribute('n', result.number2);
            s.src = chrome.runtime.getURL('inject.js');
            (document.head || document.documentElement)
            .appendChild(s);
          }
        });
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