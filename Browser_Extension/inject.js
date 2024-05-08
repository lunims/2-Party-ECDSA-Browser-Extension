/*
    Override original credentials.create
    - TODO: change if-condition
*/

var currentScript = document.currentScript;
var orig_create = navigator.credentials.create;
navigator.credentials.create = function() {
    const cred = currentScript.getAttribute('cred');
    if (cred !== null) {
        console.log("PLACEHOLDER - HERE COMES NEW CREATION");
    }
    var result = orig_create.apply(navigator.credentials, arguments);
    result.then(function(credential) {
        // TODO: STORING MIGHT NOT BE NECESSARY
        console.log(credential);
        var jsonData = {
            id: credential.id,
            rawId: bufferToBase64url(credential.rawId),
            response: {
                attestationObject: bufferToBase64url(credential.response.attestationObject),
                clientDataJSON: bufferToBase64url(credential.response.clientDataJSON)
            },
            type: credential.type
        };
        var event = new CustomEvent("PassToBackground", {detail: JSON.stringify(jsonData)});
        window.dispatchEvent(event);
    })
    .catch(function(error) {
        console.error("Error caught:", error);
    });
    return result;
} 

var orig_get = navigator.credentials.get;
navigator.credentials.get = function() {
    var result = orig_get.apply(navigator.credentials, arguments);
    return result;
}

/*
    function to encode Base64url
    - modified from https://github.com/github/webauthn-json/blob/main/src/webauthn-json/base64url.ts
    - STACK OVERFLOW DISCUSSION
    - LINK: https://stackoverflow.com/questions/67719572/publickeycredential-not-possible-to-serialize
*/
function bufferToBase64url (buffer) {
    const byteView = new Uint8Array(buffer);
    let str = "";
    for (const charCode of byteView) {
        str += String.fromCharCode(charCode);
    }

    // Binary string to base64
    const base64String = btoa(str);

    // Base64 to base64url
    // We assume that the base64url string is well-formed.
    const base64urlString = base64String.replace(/\+/g, "-").replace(
        /\//g,
        "_",
    ).replace(/=/g, "");
    return base64urlString;
}


// Function to decode base64url and return a Uint8Array
function decodeBase64Url(base64Url) {
    // Replace '-' with '+' and '_' with '/' and add padding if necessary
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/').padEnd((base64Url.length + 3) & ~3, '=');
    // Decode the base64 string
    const binaryString = atob(base64);
    // Create a Uint8Array from the binary string
    const arrayBuffer = new ArrayBuffer(binaryString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < binaryString.length; i++) {
      uint8Array[i] = binaryString.charCodeAt(i);
    }
    return uint8Array;
  }
