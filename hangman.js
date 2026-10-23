let termDeck = [];     // shuffled list of rows from the CSV
let deckIndex = 0;     // next card to deal
let allTerms = null;   // parsed CSV, loaded once
let currentEntry = null; // the { word, fullName, definition } for the round in progress

// Parse CSV text into [{ word, fullName, definition }, ...]
// Handles quoted fields (e.g. definitions that contain commas)
function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;

    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } // escaped quote
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());

    if (fields[0]) {
      rows.push({
        word: fields[0],
        fullName: fields[1] || '',
        definition: fields[2] || ''
      });
    }
  }
  return rows;
}

// Fisher-Yates shuffle (in place)
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function fetchAndShowRandomWord() {
  try {
    // Load the CSV once
    if (!allTerms) {
      const resp = await fetch('acronyms_and_definitions.csv');
      if (!resp.ok) throw new Error('Network response was not OK');
      allTerms = parseCsv(await resp.text());
      if (allTerms.length === 0) throw new Error('CSV contained no terms');
    }

    // Reshuffle when starting out or when every term has been used
    if (deckIndex >= termDeck.length) {
      termDeck = shuffle([...allTerms]);
      deckIndex = 0;
    }

    activateGamePlay(termDeck[deckIndex++]);
  } catch (err) {
    console.error('Error loading word:', err);
    alert('Error loading terms. If you opened index.html straight from your computer, ' +
          'run a local server (python3 -m http.server) or use GitHub Pages.');
  }
}

// Letter Guesses

let keydownHandler = null;
let hangmanPoints = 0; /* Track which part of the hangman needs to be shown */

function activateGamePlay(entry) {
  currentEntry = entry;
  const word = entry.word.toLowerCase(); // guesses are lowercase, so compare against lowercase
  const unguessed_letters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i));
  hangmanPoints = 0; // Reset global tracker
  cleanBoard();
  generateSpaces(entry.word);
  document.getElementById('definition-text').textContent = entry.definition;
  keydownHandler = createKeydownHandler(word, unguessed_letters);
  document.addEventListener("keydown", keydownHandler);
}

function createKeydownHandler(word, unguessed_letters) {
  return function(event) {
    if (/^[a-zA-Z]$/.test(event.key)) {
      const key = event.key.toLowerCase();
      if (!unguessed_letters.includes(key)) return; // already guessed
      if (word.includes(key)) {
        showUserCorrectLetters(key, word, unguessed_letters);
      } else {
        logIncorrectLetter(key, unguessed_letters);
        hangmanPoints++;
        hangMan(hangmanPoints);
      }
    }
  };
}

function hangMan(hangmanPoints) {
  if (hangmanPoints == 1) {
    show('.head');
  } else if (hangmanPoints == 2) {
    show('.body');
  } else if (hangmanPoints == 3) {
    show('.arm.left');
  } else if (hangmanPoints == 4) {
    show('.arm.right');
  } else if (hangmanPoints == 5) {
    show('.leg.left');
  } else {
    show('.leg.right');
    revealWord();
    endGame('#lose');
  }
}

// On a loss, fill in the missing letters in red (correct guesses stay green)
function revealWord() {
  const spans = document.querySelectorAll('#underscore-container span');
  for (let i = 0; i < currentEntry.word.length; i++) {
    if (spans[i].textContent === '_') {
      spans[i].textContent = currentEntry.word[i];
      spans[i].style.color = 'red';
    }
  }
}

// Fill in and show the "Show Word" area (acronym + full name)
function revealAnswer() {
  document.getElementById('reveal-word').textContent = currentEntry.word;
  document.getElementById('reveal-full-name').textContent = currentEntry.fullName;
  document.getElementById('reveal-container').style.display = 'block';
}

function show(classname) {
  let element = document.querySelector(classname);
  element.style.display = 'block';
}

function endGame(classname) {
  document.removeEventListener("keydown", keydownHandler);
  keydownHandler = null;
  show(classname);
  revealAnswer();
  document.getElementById('replay-container').style.display = 'block';
}

function logIncorrectLetter(guess, remaining_guesses) {
  const incorrectletterbox = document.querySelector('.missed-letters');
  if (remaining_guesses.includes(guess)) {
    incorrectletterbox.textContent += guess;
  }
  removeGuess(remaining_guesses, guess);
}

function showUserCorrectLetters(guess, word, remaining_guesses) {
  const spans = document.querySelectorAll('#underscore-container span');
  for (let i = 0; i < word.length; i++) {
    if (guess === word[i]) {
      spans[i].textContent = currentEntry.word[i]; // show the term's original casing
    }
  }
  removeGuess(remaining_guesses, guess);

  // Count remaining empty spaces
  const remainingUnderscores = Array.from(spans).filter(span => span.textContent === '_').length;
  if (remainingUnderscores === 0) {
    endGame('#win');
  }
}

function removeGuess(remaining_guesses, guess) {
  for (let i = 0; i < remaining_guesses.length; i++) {
    if (remaining_guesses[i] === guess) {
      remaining_guesses.splice(i, 1);
      break;
    }
  }
}

function cleanBoard() {
  // Stop listening for keys from any previous game
  if (keydownHandler) {
    document.removeEventListener("keydown", keydownHandler);
    keydownHandler = null;
  }

  // Hide start and replay buttons while a game is in progress
  document.querySelector('.activation.button').style.display = 'none';
  document.getElementById('replay-container').style.display = 'none';

  // Hide the win/lose messages
  document.getElementById('win').style.display = 'none';
  document.getElementById('lose').style.display = 'none';

  // Hide all hangman body parts
  document.querySelectorAll('.head, .body, .arm, .leg').forEach(part => {
    part.style.display = 'none';
  });

  // Clear missed letters, the old word's blanks, the definition, and the revealed answer
  document.querySelector('.missed-letters').textContent = '';
  document.getElementById('underscore-container').innerHTML = '';
  document.getElementById('definition-text').textContent = '';
  document.getElementById('reveal-word').textContent = '';
  document.getElementById('reveal-full-name').textContent = '';
  document.getElementById('reveal-container').style.display = 'none';
}

// Letters become blanks; digits and symbols (AES-256, TCP/IP, PCI DSS) are shown up front
// because the game only accepts a-z guesses.
function generateSpaces(word) {
  const container = document.getElementById('underscore-container');

  for (const ch of word) {
    const span = document.createElement('span');
    if (/[a-zA-Z]/.test(ch)) {
      span.textContent = '_';
    } else {
      span.textContent = ch === ' ' ? '\u00A0' : ch;
      span.className = 'fixed-char';
    }
    container.appendChild(span);
  }
}