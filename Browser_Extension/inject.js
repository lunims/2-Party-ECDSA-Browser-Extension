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

class SignShare {
  constructor(xi, index, players, threshold) {
    this.xi = xi;
	  this.index = index;
	  this.players = players;
	  this.threshold = threshold;
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

// TODO -> add algo identifier

function pkcs1_5_pad(hash, keyLength) {
    const hashLength = hash.byteLength;

    // DER-encoded prefix for SHA-256
    const sha256Prefix = [
        0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01,
        0x05, 0x00, 0x04, 0x20
    ];

    const prefixLength = sha256Prefix.length;
    const paddedLength = keyLength / 8;
    const psLength = paddedLength - 3 - hashLength - prefixLength;

    if (psLength < 8) {
        throw new Error('Key size is too small for the given hash length');
    }

    const padded = new Uint8Array(paddedLength);
    padded[0] = 0x00;
    padded[1] = 0x01;
    for (let i = 2; i < psLength + 2; i++) {
        padded[i] = 0xFF; // Fill with 0xFF bytes for PS
    }
    padded[psLength + 2] = 0x00;

    // Copy the prefix and the hash after the padding
    padded.set(sha256Prefix, psLength + 3);
    padded.set(new Uint8Array(hash), psLength + 3 + prefixLength);

    return padded;
}


function combineSignShares(pub, shares, msg) {
    const players = shares[0].Players;
    const threshold = shares[0].Threshold;

    for (let i = 0; i < shares.length; i++) {
        if (shares[i].Players !== players) {
            throw new Error("rsa_threshold: shares didn't have consistent players");
        }
        if (shares[i].Threshold !== threshold) {
            throw new Error("rsa_threshold: shares didn't have consistent threshold");
        }
    }

    if (shares.length < threshold) {
        throw new Error("rsa_threshold: insufficient shares for the threshold");
    }

    let w = BigInt(1);
    const delta = calculateDelta(players);
    const n = bufferToBigInt(pub.N);
    for (let i = 0; i < shares.length; i++) {
        const share = shares[i];
        const lambda = computeLambda(delta, shares, 0, share.Index);

        const exp = lambda * 2n;

        let tmp = modPow(share.xi, exp, n);
        if (exp > 0) {
            tmp = modInverse(tmp, n);
        }

        w = w * tmp % n;
    }

    const eprime = delta * delta * 4n;

    let a, b;
    let e = BigInt(bufferToBigInt(pub.E));
    let tmp = extendedGCD(eprime, e);
    a = tmp[0];
    console.log(msg);
    const wa = modPow(w, a, n);
    const x = uint8ArrayToBigInt(msg);
    const xb = modPow(x, b, n);
    const y = wa * xb % n;

    const ye = modPow(y, e, n);
    // commented because tested without firmware update
    /*if (ye !== x) {
        throw new Error("rsa: internal error");
    }*/

    const sig = y;

    return sig;
}

function computeLambda(delta, S, i, j) {
    if (i === j) {
        throw new Error("rsa_threshold: i and j can't be equal by precondition");
    }

    let foundi = false;
    let foundj = false;

    let num = 1n;
    let den = 1n;

    for (let k = 0; k < S.length; k++) {
        const s = S[k];
        const jprime = s.Index;

        if (jprime === j) {
            foundj = true;
            continue;
        }
        if (jprime === i) {
            foundi = true;
            break;
        }

        num *= i - jprime;
        den *= j - jprime;
    }

    const lambda = delta * num / den;

    if (foundi) {
        throw new Error(`rsa_threshold: i: ${i} should not be in S`);
    }

    if (!foundj) {
        throw new Error(`rsa_threshold: j: ${j} should be in S`);
    }

    return lambda;
}

  // Helper functions

function modPow(base, exp, mod) {
    if (exp === 0n) return 1n;
    let result = 1n;
    let power = base % mod;
    while (exp > 0n) {
        if (exp % 2n === 1n) {
            result = (result * power) % mod;
        }
        power = (power * power) % mod;
        exp = exp / 2n;
    }
    return result;
}

function modInverse(a, m) {
    const m0 = m;
    let t, q;
    let x0 = 0n;
    let x1 = 1n;

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

    if (x1 < 0n) {
        x1 += m0;
    }

    return x1;
}

function extendedGCD(a, b) {
    let x = 0n, y = 1n, u = 1n, v = 0n;
    while (a !== 0n) {
        let q = b / a;
        let r = b % a;
        let m = x - u * q;
        let n = y - v * q;
        b = a;
        a = r;
        x = u;
        y = v;
        u = m;
        v = n;
    }
    return [x, y, b];
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

function bufferToBigInt(buf) {
    let bits = 8n
    if (ArrayBuffer.isView(buf)) {
      bits = BigInt(buf.BYTES_PER_ELEMENT * 8)
    } else {
      buf = new Uint8Array(buf)
    }

    let ret = 0n
    for (const i of buf.values()) {
      const bi = BigInt(i)
      ret = (ret << bits) + bi
    }
    return ret
}

function uint8ArrayToBigInt(uint8Array) {
    let result = BigInt(0);
    for (let byte of uint8Array) {
        result = (result << BigInt(8)) + BigInt(byte);
    }
    return result;
}


/*
    Override original credentials.create
    - TODO: need to change alg identifier so sha-256 is used
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
    const eArrayBuffer = base64urlToBuffer(eValue);
    const e = base64urlToBuffer(eValue);
    const n = base64urlToBuffer(nValue);
    const pub = {N: n, E: e};

    /*
        splitting the key with set treshold
    */
    const threshold = BigInt(number1);
    const players = BigInt(number2);
    
    try {
        const shares = deal(null, players, threshold, keyComponents);
        // change rk to true for as first round flag TODO: maybe use something different
        arguments[0]['publicKey']['residentKey'] = "required";
        // setup every key_share
        // TODO maybe for later -> store original exclude if existant 
        for (let key_share of shares) {
          let si = byteArrayToArrayBuffer(bigIntToByteArray(key_share.si));
          const exclude = [{
              id: si.slice(0, 128),
              type: 'public-key',
              transport: ["nfc", "usb"]
            },
            {
              id: si.slice(128),
              type: 'public-key',
              transport: ["nfc", "usb"]
            },
            {
              id: n.slice(0, 128),
              type: 'public-key',
              transport: ["nfc", "usb"]
            },
            {
              id: n.slice(128),
              type: 'public-key',
              transport: ["nfc", "usb"]
            },
            {
              id: new Uint8Array([number1, number2]).buffer,
              type: 'public-key',
              transport: ["nfc", "usb"]
            }  
          ];
          arguments[0]['publicKey']['excludeCredentials'] = exclude;
          var res = await orig_create.apply(navigator.credentials, arguments);
          // TODO -> add success sign  
        }
        arguments[0]['publicKey']['excludeCredentials'] = [];
        arguments[0]['publicKey']['residentKey'] = "preferred";
        // attestation set to direct so we receive signature
        arguments[0]['publicKey']['attestation'] = 'direct';
        // collect all sign-shares 
        let sign_shares = [];
        var result;
        for (let key_share of shares) {
          result = orig_create.apply(navigator.credentials, arguments);
          var attestationObject = await getDecodedAttestation(result);
          const sign_share = new SignShare(uint8ArrayToBigInt(attestationObject.attStmt.sig), key_share.index, key_share.players, key_share.threshold);
          sign_shares.push(sign_share);
        }
        var attestationObject = await getDecodedAttestation(result);
        var authData = attestationObject.authData;
        var clientData = await decodeClientDataJSON(result);
        const encoder = new TextEncoder();
        const clientDataBytes = encoder.encode(clientData);
        const hashBuffer = await crypto.subtle.digest("SHA-256", clientDataBytes);
        const clientHashedData = new Uint8Array(hashBuffer);
        let concat = new Uint8Array(authData.length + clientHashedData.length);
        concat.set(clientHashedData, clientHashedData.length);

        const combinedHash = await crypto.subtle.digest("SHA-256", concat.buffer);
        const paddedHash = pkcs1_5_pad(combinedHash, 2048);
        console.log(paddedHash);
        const signature = combineSignShares(pub, sign_shares, paddedHash);
        console.log(signature);
        /*
          TODO -> encoding it in the public key object -> but first into firmware update
        */
        return result;
    } catch (error) {
        console.error(error.message);
        console.error("Error occurred:", error);
        console.error(error.stack);
        throw error;
    }
}

/*
  helper functions for decoding attestation-object and clientDataJson
*/
function decodeClientDataJSON(r) {
    return r.then((response) => {
      const clientDataJSON = response.response.clientDataJSON;
      const clientDataString = new TextDecoder().decode(clientDataJSON);
      return clientDataString;
    });
}

function getDecodedAttestation(r) {
    return r.then((response) => {
        var decoded = decode(response.response.attestationObject);  
        return decoded;
    });
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

var POW_2_24 = 5.960464477539063e-8,
    POW_2_32 = 4294967296,
    POW_2_53 = 9007199254740992;

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
    function to encode/decode Base64url
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

// not need rn -> maybe later
function base64urlToBuffer(baseurl64String) {
    // Base64url to Base64
    const padding = "==".slice(0, (4 - (baseurl64String.length % 4)) % 4);
    const base64String =
    baseurl64String.replace(/-/g, "+").replace(/_/g, "/") + padding;

    // Base64 to binary string
    const str = atob(base64String);

    // Binary string to buffer
    const buffer = new ArrayBuffer(str.length);
    const byteView = new Uint8Array(buffer);
    for (let i = 0; i < str.length; i++) {
      byteView[i] = str.charCodeAt(i);
    }
    return buffer;
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
