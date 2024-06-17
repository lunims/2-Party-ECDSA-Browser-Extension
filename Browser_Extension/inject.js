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
            name: "RSASSA-PKCS1-v1_5",
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


function bigIntToByteArray(bigInt) {
    // Convert the big integer to a hexadecimal string
    let hexString = bigInt.toString(16);
    if (hexString.length % 2) {
        hexString = '0' + hexString;
    }

    // Create a byte array from the hex string
    let byteArray = [];
    for (let i = 0; i < hexString.length; i += 2) {
        byteArray.push(parseInt(hexString.substring(i, i + 2), 16));
    }

    return byteArray;
}

function byteArrayToArrayBuffer(byteArray) {
    let buffer = new ArrayBuffer(byteArray.length);
    let uint8Array = new Uint8Array(buffer);
    for (let i = 0; i < byteArray.length; i++) {
        uint8Array[i] = byteArray[i];
    }
    return buffer;
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
    // Export the public key as JWK
    const publicKeyJwk = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
    // Access the 'n' value (modulus)
    const nValue = publicKeyJwk.n;
    // TODO maybe i dont need to send it
    const eValue = publicKeyJwk.e;
    const eArrayBuffer = decodeBase64Url(eValue);


    /*
        splitting the key with set treshold
    */
    const threshold = BigInt(number1);
    const players = BigInt(number2);
    
    try {
        const shares = deal(null, players, threshold, keyComponents);
        // save original challenge for later
        //const challenge = arguments[0]['publicKey']['challenge'];
        // change rk to true for as first round flag TODO: maybe use something different
        //arguments[0]['publicKey']['residentKey'] = "required";
        /*
            TODO: Listen for success
        */
        /*
            TODO: collect signatures with real challenge
        */
        //}
        // TODO: split into two calls because of byte size
        /*const first = shares[0];
        let key_share = byteArrayToArrayBuffer(bigIntToByteArray(first.si));
        const exclude = [{
                id: key_share,
                type: 'public-key',
                transport: ["nfc", "usb"]
            },
            {
                id: decodeBase64Url(nValue),
                type: 'public-key',
                transport: ["nfc", "usb"]
            } 
        ];
        arguments[0]['publicKey']['excludeCredentials'] = exclude;*/
        //arguments[0]['publicKey']['challenge'] = challenge;
        console.log(arguments);
        var result = orig_create.apply(navigator.credentials, arguments);
        //var test = await getSignature(result);
        console.log(result);
        result.then((response) => {
            console.log(response.response);
            //const dataView = new DataView(response['response']['attestationObject']);
            //console.log(dataView);
            var decoded = decode(response.response.attestationObject);
            console.log(decoded);  
        }).catch((error) => {
            console.log("Caught an error:", error);
        });
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
    decode function via cbor-js
    - github: https://github.com/paroga/cbor-js/blob/master/cbor.js#L396
*/

function decode(data, tagger, simpleValue) {
    var dataView = new DataView(data);
    var offset = 0;
  
    if (typeof tagger !== "function")
      tagger = function(value) { return value; };
    if (typeof simpleValue !== "function")
      simpleValue = function() { return undefined; };
  
    function commitRead(length, value) {
      offset += length;
      return value;
    }
    function readArrayBuffer(length) {
      return commitRead(length, new Uint8Array(data, offset, length));
    }
    function readFloat16() {
      var tempArrayBuffer = new ArrayBuffer(4);
      var tempDataView = new DataView(tempArrayBuffer);
      var value = readUint16();
  
      var sign = value & 0x8000;
      var exponent = value & 0x7c00;
      var fraction = value & 0x03ff;
  
      if (exponent === 0x7c00)
        exponent = 0xff << 10;
      else if (exponent !== 0)
        exponent += (127 - 15) << 10;
      else if (fraction !== 0)
        return (sign ? -1 : 1) * fraction * POW_2_24;
  
      tempDataView.setUint32(0, sign << 16 | exponent << 13 | fraction << 13);
      return tempDataView.getFloat32(0);
    }
    function readFloat32() {
      return commitRead(4, dataView.getFloat32(offset));
    }
    function readFloat64() {
      return commitRead(8, dataView.getFloat64(offset));
    }
    function readUint8() {
      return commitRead(1, dataView.getUint8(offset));
    }
    function readUint16() {
      return commitRead(2, dataView.getUint16(offset));
    }
    function readUint32() {
      return commitRead(4, dataView.getUint32(offset));
    }
    function readUint64() {
      return readUint32() * POW_2_32 + readUint32();
    }
    function readBreak() {
      if (dataView.getUint8(offset) !== 0xff)
        return false;
      offset += 1;
      return true;
    }
    function readLength(additionalInformation) {
      if (additionalInformation < 24)
        return additionalInformation;
      if (additionalInformation === 24)
        return readUint8();
      if (additionalInformation === 25)
        return readUint16();
      if (additionalInformation === 26)
        return readUint32();
      if (additionalInformation === 27)
        return readUint64();
      if (additionalInformation === 31)
        return -1;
      throw "Invalid length encoding";
    }
    function readIndefiniteStringLength(majorType) {
      var initialByte = readUint8();
      if (initialByte === 0xff)
        return -1;
      var length = readLength(initialByte & 0x1f);
      if (length < 0 || (initialByte >> 5) !== majorType)
        throw "Invalid indefinite length element";
      return length;
    }
  
    function appendUtf16Data(utf16data, length) {
      for (var i = 0; i < length; ++i) {
        var value = readUint8();
        if (value & 0x80) {
          if (value < 0xe0) {
            value = (value & 0x1f) <<  6
                  | (readUint8() & 0x3f);
            length -= 1;
          } else if (value < 0xf0) {
            value = (value & 0x0f) << 12
                  | (readUint8() & 0x3f) << 6
                  | (readUint8() & 0x3f);
            length -= 2;
          } else {
            value = (value & 0x0f) << 18
                  | (readUint8() & 0x3f) << 12
                  | (readUint8() & 0x3f) << 6
                  | (readUint8() & 0x3f);
            length -= 3;
          }
        }
  
        if (value < 0x10000) {
          utf16data.push(value);
        } else {
          value -= 0x10000;
          utf16data.push(0xd800 | (value >> 10));
          utf16data.push(0xdc00 | (value & 0x3ff));
        }
      }
    }
  
    function decodeItem() {
      var initialByte = readUint8();
      var majorType = initialByte >> 5;
      var additionalInformation = initialByte & 0x1f;
      var i;
      var length;
  
      if (majorType === 7) {
        switch (additionalInformation) {
          case 25:
            return readFloat16();
          case 26:
            return readFloat32();
          case 27:
            return readFloat64();
        }
      }
  
      length = readLength(additionalInformation);
      if (length < 0 && (majorType < 2 || 6 < majorType))
        throw "Invalid length";
  
      switch (majorType) {
        case 0:
          return length;
        case 1:
          return -1 - length;
        case 2:
          if (length < 0) {
            var elements = [];
            var fullArrayLength = 0;
            while ((length = readIndefiniteStringLength(majorType)) >= 0) {
              fullArrayLength += length;
              elements.push(readArrayBuffer(length));
            }
            var fullArray = new Uint8Array(fullArrayLength);
            var fullArrayOffset = 0;
            for (i = 0; i < elements.length; ++i) {
              fullArray.set(elements[i], fullArrayOffset);
              fullArrayOffset += elements[i].length;
            }
            return fullArray;
          }
          return readArrayBuffer(length);
        case 3:
          var utf16data = [];
          if (length < 0) {
            while ((length = readIndefiniteStringLength(majorType)) >= 0)
              appendUtf16Data(utf16data, length);
          } else
            appendUtf16Data(utf16data, length);
          return String.fromCharCode.apply(null, utf16data);
        case 4:
          var retArray;
          if (length < 0) {
            retArray = [];
            while (!readBreak())
              retArray.push(decodeItem());
          } else {
            retArray = new Array(length);
            for (i = 0; i < length; ++i)
              retArray[i] = decodeItem();
          }
          return retArray;
        case 5:
          var retObject = {};
          for (i = 0; i < length || length < 0 && !readBreak(); ++i) {
            var key = decodeItem();
            retObject[key] = decodeItem();
          }
          return retObject;
        case 6:
          return tagger(decodeItem(), length);
        case 7:
          switch (length) {
            case 20:
              return false;
            case 21:
              return true;
            case 22:
              return null;
            case 23:
              return undefined;
            default:
              return simpleValue(length);
          }
      }
    }
  
    var ret = decodeItem();
    if (offset !== data.byteLength)
      throw "Remaining bytes";
    return ret;
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
    for (let i = 0; i < binaryString.length; i++) {
      arrayBuffer[i] = binaryString.charCodeAt(i);
    }
    return arrayBuffer;
}
