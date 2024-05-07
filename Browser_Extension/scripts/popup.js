/*
  logic to store toggle-switch
*/

const savedOption = localStorage.getItem('option');
const optionToggle = document.getElementById('optionToggle');

if (savedOption === 'true') {
   optionToggle.checked = true;
} else if (savedOption === 'false') {
   optionToggle.checked = false;
}

function changeToggle() {
   const option = optionToggle.checked;
    saveOptionState(option);
}

function saveOptionState(option) {
  localStorage.setItem('option', option ? 'true' : 'false');
}

optionToggle.addEventListener('change', changeToggle);

var dataToStore = {
  key: "value"
};

chrome.storage.sync.set(dataToStore, function() {
  console.log('Data saved to storage');
});

/*
  logic to reset a saved credential
*/

function reset() {
  chrome.storage.local.remove('credential', function() {
    if (chrome.runtime.lastError) {
      console.error('Error removing credential:', chrome.runtime.lastError);
    } else {
      console.log('Credential removed from local storage.');
    }
  });
}

document.getElementById('resetButton').addEventListener('click', reset);