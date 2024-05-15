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
  chrome.storage.local.set({'toggle': localStorage.getItem('option')}, function() {});
}


optionToggle.addEventListener('change', changeToggle);

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