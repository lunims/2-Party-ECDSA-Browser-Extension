var orig_create = navigator.credentials.create;
navigator.credentials.create = function() {
    return orig_create.apply(navigator.credentials, arguments);
}
var orig_get = navigator.credentials.get;
navigator.credentials.get = function() {
    return orig_get.apply(navigator.credentials, arguments);
}

// Get a reference to the currently executing script element
var currentScript = document.currentScript;

// Retrieve the values of the attributes set on the script element
var devDomain = currentScript.getAttribute('test');