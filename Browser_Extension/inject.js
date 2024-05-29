/*
    logic for Threshold RSA Key generation:
    - this code is essentially a javascript implementation of following github repo written in GO
    - https://github.com/katzenpost/circl/tree/d6395ee88f68a4f6f48cccfe964d807275996c88/tss/rsa
*/

class KeyShare {
    constructor(players, threshold, si, index) {
        this.players = players;
        this.threshold = threshold;
        this.si = si;
        this.index = index;
        this.twoDeltaSi = null;
    }

    get2DeltaSi() {
        const delta = calculateDelta(this.players);
        // 2Δs_i: delta * 2
        this.twoDeltaSi = delta * 2n * this.si;
        return this.twoDeltaSi;
    }
}

function calculateDelta(l) {
    // ∆ = l!
    let delta = 1n;
    for (let i = 1n; i <= l; i++) {
        delta *= i;
    }
    return delta;
}

// TODO add in contentScript/popup.js
/*function validateParams(players, threshold) {
    if (players < threshold) {
        throw new Error("Number of players must be greater than or equal to the threshold");
    }
    if (threshold < 2) {
        throw new Error("Threshold must be at least 2");
    }
    return true;
}*/

function deal(randSource, players, threshold, keyComponents) {

    const ONE = 1n;
    const { primes, e } = keyComponents;

    if (primes.length !== 2) {
        throw new Error("Multiprime RSA keys are unsupported");
    }

    const p = primes[0];
    const q = primes[1];

    const pprime = (p - ONE) / 2n;
    const qprime = (q - ONE) / 2n;
    const m = pprime * qprime;

    const d = modInverse(e, m);
    console.log(d);
    if (d === null) {
        throw new Error("rsa_threshold: no ModInverse for e in Z/Zm");
    }

    const a = [d];
    for (let i = 1n; i < threshold; i++) {
        const ai = randomBigInt(0n, m - 1n);
        a.push(ai);
    }

    const shares = [];
    for (let i = 1n; i <= players; i++) {
        const si = computePolynomial(threshold, a, i, m);
        const share = new KeyShare(players, threshold, si, i);
        share.get2DeltaSi();
        shares.push(share);
    }

    return shares;
}

function computePolynomial(k, a, x, m) {
    let sum = 0n;
    for (let i = 0n; i < k; i++) {
        const xi = BigInt(x) ** BigInt(i);
        const prod = (a[i] * xi) % m;
        sum = (sum + prod) % m;
    }
    return sum;
}

function modInverse(a, m) {
    let m0 = m, t, q;
    let x0 = 0n, x1 = 1n;
    if (m === 1n) return 0n;
    while (a > 1n) {
        q = a / m;
        t = m;
        m = a % m;
        a = t;
        t = x0;
        x0 = x1 - q * x0;
        x1 = t;
    }
    if (x1 < 0n) x1 += m0;
    return x1;
}

function randomBigInt(min, max) {
    const range = max - min + 1n;
    let rand = BigInt('0x' + crypto.getRandomValues(new Uint32Array(16)).reduce((str, n) => str + n.toString(16).padStart(8, '0'), ''));
    return min + (rand % range);
}

async function generateRsaKey() {
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: "RSA-PSS",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]), // look into later
            hash: { name: "SHA-256" },
        },
        true,
        ["sign", "verify"] 
    );
    return keyPair;
}

async function exportPrivateKeyComponents(privateKey) {
    const keyData = await window.crypto.subtle.exportKey("jwk", privateKey);

    // Convert base64url to BigInt
    const toBigInt = (base64url) => BigInt('0x' + atob(base64url.replace(/-/g, '+').replace(/_/g, '/')).split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));

    const primes = [toBigInt(keyData.p), toBigInt(keyData.q)];
    const e = toBigInt(keyData.e);

    return { primes, e };
}

function encodeStringToUint8Array(str) {
    return new TextEncoder().encode(str);
}


/*
    Override original credentials.create
    - TODO: configure FIDO challenges
*/

var currentScript = document.currentScript;
var orig_create = navigator.credentials.create;
navigator.credentials.create = async function() {
    var number1 = parseInt(currentScript.getAttribute('t'));
    var number2 = parseInt(currentScript.getAttribute('n'));
    /*
        Generating RSA Key Pair, which will then be split according to Practical Threshold signatures paper 
    */
    const keyPair = await generateRsaKey();
    const keyComponents = await exportPrivateKeyComponents(keyPair.privateKey);
    console.log(keyComponents);

    /*
        splitting the key with set treshold
    */
    const threshold = BigInt(number1);
    const players = BigInt(number2);
    
    try {
        const shares = deal(null, players, threshold, keyComponents);
        console.log(shares);
        // save original challenge for later
        const challenge = arguments[0]['publicKey']['challenge'];
        // change rk to true for as first round flag TODO: maybe use something different
        arguments[0]['publicKey']['residentKey'] = "required";
        for(let i = 0; i < shares.length; i++) {
            const first = shares[i];
            const shareString = JSON.stringify(first.si.toString());
            const encodedChallenge = encodeStringToUint8Array(shareString);
            
            // use challenge to send key share
            arguments[0]['publicKey']['challenge'] = encodedChallenge;
            // await needed because otherwise 'Request is already pending' error
            var response = await orig_create.apply(navigator.credentials, arguments);
            /*
                TODO: Listen for success
            */
            /*
                TODO: collect signatures with real challenge
            */
        }
        arguments[0]['publicKey']['challenge'] = challenge;
        var result = orig_create.apply(navigator.credentials, arguments);
        return result;
        /*
            Now onto FIDO calls
        */
    } catch (err) {
        console.error(err.message);
    }
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
