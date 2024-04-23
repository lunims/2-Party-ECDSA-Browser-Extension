var s = document.createElement('script');
s.setAttribute('test', "test");
s.src = chrome.runtime.getURL('inject.js');
(document.head || document.documentElement)
.appendChild(s);

// TODO wait for storage in popuo.js then set attribute