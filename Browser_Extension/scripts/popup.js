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

/*
  get saved numbers and display them in div container
*/
chrome.storage.local.get(['number1', 'number2'], function(result) {
  console.log(result);
  if (result.number1 && result.number2) {
    const savedNumbers = document.getElementById('savedNumbers');
    savedNumbers.innerHTML = `t: ${result.number1} out of n: ${result.number2}`;
  }
});

/*
  logic for receiving threhsold input
*/
optionToggle.addEventListener('change', changeToggle);

submitButton.addEventListener('click', function() {
  const number1 = parseFloat(document.getElementById('number1').value);
  const number2 = parseFloat(document.getElementById('number2').value);

  if (!isNaN(number1) && !isNaN(number2)) {
    const numbers = `t: ${number1}, n: ${number2}`;
    alert(`You entered: ${numbers}`);

    chrome.storage.local.set({'number1': number1.toString()}, function() {});
    chrome.storage.local.set({'number2': number2.toString() });
  } else {
    alert('Please enter valid numbers.');
  }
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