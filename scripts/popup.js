function registerCredential() {
  const option = localStorage.getItem('option') === 'true';
  if (option == true) {
    // Generate a new challenge
    const challenge = generateRandomChallenge(32); // Generate a random challenge of length 32 bytes
    alert(challenge)
    // Prepare options for credential creation
    const publicKeyCredentialCreationOptions = {
        challenge: challenge,
        rp: {
            name: "Your Relying Party Name"
        },
        user: {
            id: new Uint8Array(16), // Example: You should generate a unique user ID,
            name: "user@example.com",
            displayName: "User Name"
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
          { type: "public-key", alg: -257 } // RS256
        ],
        timeout: 60000, // Timeout in milliseconds
        attestation: "direct"
    };

    // Request credential creation
    navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
    }).then((newCredentialInfo) => {
        console.log('New credential created:', newCredentialInfo);
    }).catch((error) => {
        console.error('Error creating new credential:', error);
    });
  }
}   

function generateRandomChallenge(length) {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return array;
}

 // Retrieve state from local storage
 const savedOption = localStorage.getItem('option');
 const optionToggle = document.getElementById('optionToggle');

 if (savedOption === 'true') {
     optionToggle.checked = true;
 } else if (savedOption === 'false') {
     optionToggle.checked = false;
 }

 function saveOptionState(state) {
     localStorage.setItem('option', state);
 }

 // Function to handle toggle change
 function changeToggle() {
     const option = optionToggle.checked;
     saveOptionState(option);
     // You can perform other actions based on the toggle state here
 }

 // Add event listener to toggle
optionToggle.addEventListener('change', changeToggle);

document.getElementById("requestButton").addEventListener('click', registerCredential);

// Define data to be stored
var dataToStore = {
  key: "value"
};

// Save data to storage
chrome.storage.sync.set(dataToStore, function() {
  console.log('Data saved to storage');
});