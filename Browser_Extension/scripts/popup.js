// Retrieve state from local storage
const savedOption = localStorage.getItem('option');
const optionToggle = document.getElementById('optionToggle');

if (savedOption === 'true') {
   optionToggle.checked = true;
} else if (savedOption === 'false') {
   optionToggle.checked = false;
}

// Function to handle toggle change
function changeToggle() {
   const option = optionToggle.checked;
    saveOptionState(option);
   // You can perform other actions based on the toggle state here
}

// Add event listener to toggle
optionToggle.addEventListener('change', changeToggle);
// Define data to be stored
var dataToStore = {
  key: "value"
};

// Save data to storage
chrome.storage.sync.set(dataToStore, function() {
  console.log('Data saved to storage');
});

function reset() {
  if (localStorage.getItem('flag') == 'true') {
    localStorage.removeItem('credential');
  }
  localStorage.setItem('flag', 'false');
}

document.getElementById('resetButton').addEventListener('click', reset);

function save() {
    alert(localStorage.getItem('credential'));
}

document.getElementById('saveButton').addEventListener('click', save);