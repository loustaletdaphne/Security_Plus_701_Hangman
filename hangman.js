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
  document.getElementById('guess-input').focus(); // must happen inside the click so tablets show their keyboard
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

// ---------- Screens & gameplay ----------
// Hangman parts appear in the order drawn in the mockups
const PARTS = ['hm-head', 'hm-body', 'hm-arm-l', 'hm-leg-l', 'hm-leg-r', 'hm-arm-r'];
const $ = id => document.getElementById(id);
let unguessed = [], misses = 0, active = false, endTimer = null;

function showScreen(name) {
  clearTimeout(endTimer);
  active = false;
  $('stage').dataset.screen = name;
  if (name !== 'game') $('hint').textContent = '';
}

function activateGamePlay(entry) {
  currentEntry = entry;
  misses = 0;
  unguessed = 'abcdefghijklmnopqrstuvwxyz'.split('');
  document.querySelectorAll('.part').forEach(p => p.classList.remove('on'));
  $('missed-letters').textContent = '';
  $('full-name').textContent = '';
  buildSlots(entry.word);
  $('hint').textContent = 'Hint: ' + entry.definition;
  showScreen('game');
  active = true;
}

// Letters become blanks; digits/symbols (AES-256, TCP/IP) are shown up front; spaces become gaps
function buildSlots(word) {
  const box = $('word');
  box.innerHTML = '';
  for (const ch of word) {
    const s = document.createElement('span');
    s.className = 'slot';
    s.dataset.ch = ch;
    if (/[a-z]/i.test(ch)) s.classList.add('blank');
    else if (ch === ' ') s.classList.add('space');
    else { s.classList.add('fixed'); s.textContent = ch; }
    box.appendChild(s);
  }
}

function handleGuess(key) {
  if (!active || !/^[a-z]$/.test(key) || !unguessed.includes(key)) return; // also ignores repeats
  unguessed.splice(unguessed.indexOf(key), 1);

  let hit = false;
  document.querySelectorAll('#word .blank').forEach(s => {
    if (s.dataset.ch.toLowerCase() === key) {
      s.textContent = s.dataset.ch;      // keep the term's original casing
      s.classList.add('filled');
      hit = true;
    }
  });

  if (hit) {
    if (!document.querySelector('#word .blank:not(.filled)')) endRound(true);
  } else {
    $('missed-letters').textContent += key;
    $(PARTS[misses++]).classList.add('on');
    if (misses >= PARTS.length) endRound(false);
  }
}

// Win or out of guesses: reveal the answer, then move to the result screen after a short pause
function endRound(won) {
  if (!active) return;
  active = false;
  if (!won) {
    document.querySelectorAll('#word .blank:not(.filled)').forEach(s => {
      s.textContent = s.dataset.ch;
      s.classList.add('revealed');         // red = letters you didn't get
    });
    PARTS.forEach(id => $(id).classList.add('on'));
    $('hm-face').classList.add('on');      // X eyes
  }
  $('full-name').textContent = currentEntry.fullName;
  endTimer = setTimeout(() => showResult(won), 2800);
}

function showResult(won) {
  const t = $('result-title');
  t.textContent = won ? 'YOU WON!' : 'YOU LOSE :(';
  t.className = 'title-card result-title ' + (won ? 'win' : 'lose');
  $('result-answer').textContent = won ? '' : 'The correct answer was ' + currentEntry.word;
  showScreen('result');
}

// Input: physical keyboards fire keydown; tablet keyboards go through the hidden input.
// A letter handled by one path is already "guessed" when the other fires, so nothing double-counts.
document.addEventListener('keydown', e => {
  if (!e.ctrlKey && !e.metaKey && !e.altKey) handleGuess(e.key.toLowerCase());
});
$('guess-input').addEventListener('input', e => {
  for (const ch of e.target.value) handleGuess(ch.toLowerCase());
  e.target.value = '';
});
document.querySelector('.board').addEventListener('click', () => {
  if (active) $('guess-input').focus();
});