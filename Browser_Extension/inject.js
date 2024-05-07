/*
    Override original credentials.create
    - TODO: change if-condition
*/
var currentScript = document.currentScript;
var orig_create = navigator.credentials.create;
navigator.credentials.create = function() {
    const cred = currentScript.getAttribute('data-cred');
    if (cred !== null) {
        console.log(JSON.stringify(cred));
    }
    var result = orig_create.apply(navigator.credentials, arguments);
    // Page context
    result.then(function(credential) {
        // Extracting properties from the PublicKeyCredential object
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
        // Promise rejected or an error occurred
        console.error("Error caught:", error);
    });
    return result;
} 

var orig_get = navigator.credentials.get;
navigator.credentials.get = function() {
    var result = orig_get.apply(navigator.credentials, arguments);
    /*result.then(function(credential) {
        // If authentication is successful
        if (credential !== null) {
            // Do something with the authenticated credential
            console.log("Authentication successful:", credential);
        } else {
            // Authentication failed or no matching credential found
            console.log("Authentication failed or no matching credential found.");
        }
    }).catch(function(error) {
        // Handle errors
        console.error("Error during authentication:", error);
    });*/
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
