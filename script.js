// Updated script.js — integrates HTML5 audioElement, show/hide player per clip,
// pause/replay, and TTS rate control.

const utterance = new SpeechSynthesisUtterance();
let currentAudioIndex = 0;
let Sentences = [];

// Audio player element (will be wired to the HTML audio element)
let audioPlayer = null;

// Playlist navigation state
let usePlayListMode = false;
let navIndices = [];
let navPos = 0;

let isSpeaking = false;
let isScrambled = false;

// DOM Elements
const speakEnglishBtn = document.getElementById("speakEnglish");
const speakArabicBtn = document.getElementById("speakArabic");
const speakSelectionBtn = document.getElementById("speakSelection");
const stopBtn = document.getElementById("stop");
const scrambleCheckbox = document.getElementById("scrambleCheckbox");
const speakScrambledCheckbox = document.getElementById("speakScrambledCheckbox");

const q = document.getElementById("q");
const refer_to = document.getElementById("refer_to");
const back_to = document.getElementById("back_to");
const speaker = document.getElementById("speaker");
const keyWords = document.getElementById("keyWords");
const def = document.getElementById("def");
const english = document.getElementById("english");
const arabic = document.getElementById("arabic");
const scrambledText = document.getElementById("scrambledText");
const image = document.getElementById("image");
const illustrationDetails = document.getElementById("illustrations");
const questionBasedOnAudio = document.getElementById("questionBasedOnAudio");
const audioIndexInput = document.getElementById("audioIndex");
const autoPlayCheckbox = document.getElementById("autoPlay");

const playList = document.getElementById("playList");
const usePlayListCheckbox = document.getElementById("usePlayList");

const definitionDetails = document.getElementById("definition");
const englishDetails = document.getElementById("englishDetails");
const arabicDetails = document.getElementById("arabicDetails");
const answer = document.getElementById("answer");
const answerDetails = document.getElementById("answerDetails");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");

const speakingIndicator = document.getElementById("speakingIndicator");

// Elements added in index.html
const audioElement = document.getElementById("audioElement");
const audioPlayerContainer = document.getElementById("audioPlayerContainer");
const pauseAudioBtn = document.getElementById("pauseAudioBtn");
const replayAudioBtn = document.getElementById("replayAudioBtn");
const ttsRateSelect = document.getElementById("ttsRateSelect");

// Use the HTML audio element as our audioPlayer object
if (audioElement) {
  audioPlayer = audioElement;
}

// ========== LOAD DATA FROM JSON ==========
async function loadData() {
  try {
    const response = await fetch('blank_01.json');
    const data = await response.json();

    // Read title from JSON root
    if (data.title) {
      document.title = data.title;
      const titleEl = document.getElementById("lessonTitle");
      if (titleEl) titleEl.textContent = data.title;
    }

    Sentences = data.sentences || [];
    buildDefaultNav();
    displayData();
  } catch (error) {
    console.error('Error loading blank_01.json:', error);
  }
}

// ========== SCRAMBLE FUNCTION ==========
function scrambleWords(text) {
  const words = text.split(" ");
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }
  return words.join(" ");
}

function toggleScramble() {
  const englishText = english.textContent.trim();
  if (!englishText) return;

  isScrambled = !isScrambled;
  if (isScrambled) {
    scrambledText.textContent = scrambleWords(englishText);
    scrambledText.style.display = "block";
    englishDetails.open = false;
  } else {
    scrambledText.textContent = "";
    scrambledText.style.display = "none";
    speakScrambledCheckbox.checked = false;
  }
}
scrambleCheckbox.addEventListener("change", toggleScramble);

// ========== SPEAK SCRAMBLED FUNCTION WITH PAUSES ==========
function speakScrambledWithPauses() {
  const scrambledTextContent = scrambledText.textContent.trim();
  if (!scrambledTextContent) {
    alert("Please scramble the text first before speaking.");
    speakScrambledCheckbox.checked = false;
    return;
  }

  const words = scrambledTextContent.split(" ");
  let wordIndex = 0;

  function speakNextWord() {
    if (wordIndex >= words.length) {
      isSpeaking = false;
      updateSpeakingUI();
      return;
    }

    const word = words[wordIndex];
    const utteranceWord = new SpeechSynthesisUtterance(word);
    utteranceWord.lang = "en-US";
    // Use selected rate for scrambled playback as well
    utteranceWord.rate = parseFloat(ttsRateSelect.value || "1");

    utteranceWord.onstart = function () {
      isSpeaking = true;
      updateSpeakingUI();
    };

    utteranceWord.onend = function () {
      wordIndex++;
      setTimeout(speakNextWord, 500);
    };

    speechSynthesis.speak(utteranceWord);
  }

  speechSynthesis.cancel();
  isSpeaking = true;
  updateSpeakingUI();
  speakNextWord();
}

speakScrambledCheckbox.addEventListener("change", function () {
  if (this.checked) {
    speakScrambledWithPauses();
  } else {
    speechSynthesis.cancel();
    isSpeaking = false;
    updateSpeakingUI();
  }
});

function seqRange(input) {
  let seq = input.split("-")[0];
  seq = seq.split(",").map(Number);

  let rnge = input.split(",").pop();
  const startingRange = rnge.split("-")[0];
  const endingRange = rnge.split("-")[1];

  rnge = range(Number(startingRange), Number(endingRange));
  const combined = [...seq, ...rnge];

  return [...new Set(combined)];
}

// ========== LOOKUP TEXT FUNCTION ==========
function lookupText(txt) {
  const numScripts = [];
  const re = new RegExp(`\\b${txt}\\b`);

  for (const [i, sentence] of Sentences.entries()) {
    if (re.test((sentence.english || "").toLowerCase())) {
      numScripts.push(i);
    }
  }

  if (numScripts.length === 0) {
    alert("There aren't any scripts that contain this keyword ");
    return "alert";
  }

  return numScripts;
}

// ========== PLAYLIST MODE FUNCTIONS ==========
function buildDefaultNav() {
  navIndices = Array.from({ length: Sentences.length }, (_, i) => i);
  navPos = currentAudioIndex;
  usePlayListMode = false;
}

function range(start, end) {
  return Array.from(
    { length: end - start + 1 },
    (_, i) => start + i
  );
}

function parsePlayListInput(text) {
  const indices = [];
  const seen = new Set();

  if (!text) return [];

  else if (text.includes("-") && text.includes(",")) {
    return seqRange(text)
  }
  else if (text.includes("-")) {
    var tokens = text.split("-").map(t => t.trim()).filter(Boolean);

    let start = parseInt(tokens[0], 10);
    if (start === 0) {
      start = 1;
    }
    let end = parseInt(tokens[1], 10);

    if (start > end || start === end) {
      alert("the starting range shouldn't be smaller or equal than the end parameter, recheck the provided range");
      return 'alert';
    };

    return range(start - 1, end - 1);

  } else if (text.includes(",")) {
    var tokens = text.split(",").map(t => t.trim()).filter(Boolean);

    tokens.forEach(tok => {
      const n = parseInt(tok, 10);
      if (!Number.isFinite(n)) return;

      const idx = n - 1;
      if (idx < 0 || idx >= Sentences.length) return;

      if (!seen.has(idx)) {
        seen.add(idx);
        indices.push(idx);
      }
    });

    return indices;
  } else if (typeof text === "string") {
    console.log("got a string");
    return lookupText(text.toLowerCase());
  }
}

function enablePlaylistMode() {
  const indices = parsePlayListInput(playList.value);

  if (indices.length === 0 || indices === 'alert') {
    usePlayListCheckbox.checked = false;
    alert("Playlist is empty or invalid. Enter numbers like: 1, 3, 5");
    return;
  }

  usePlayListMode = true;
  navIndices = indices;

  const currentInList = navIndices.indexOf(currentAudioIndex);
  navPos = currentInList >= 0 ? currentInList : 0;

  displayData();
}

function disablePlaylistMode() {
  buildDefaultNav();
  displayData();
}

usePlayListCheckbox.addEventListener("change", function () {
  if (usePlayListCheckbox.checked) {
    enablePlaylistMode();
  } else {
    disablePlaylistMode();
  }
});

playList.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && usePlayListCheckbox.checked) {
    enablePlaylistMode();
  }
});

// ========== MAIN PLAY BUTTON (Audio or TTS Fallback) ==========
playMainBtn.addEventListener("click", function () {
  const s = Sentences[currentAudioIndex];

  // Check if audio file exists and has a valid path
  if (s && s.audio && s.audio.trim() !== "" && s.audio !== ".mp3") {
    // Play audio file
    playAudioFile(s.audio);
  } else if (s && s.english && s.english.trim()) {
    // Fallback: Convert text to speech (no alert, silent fallback)
    playTextToSpeech(s.english, "en-US");
  }
});

// ========== STOP MAIN BUTTON ==========
stopMainBtn.addEventListener("click", function () {
  stopAllPlayback();
});

// ========== PLAY AUDIO FILE ==========
function playAudioFile(audioPath) {
  // If we're using the HTML audio element
  if (audioPlayer && audioPlayer.tagName && audioPlayer.tagName.toLowerCase() === "audio") {
    try {
      // show the player container
      if (audioPlayerContainer) {
        audioPlayerContainer.style.display = "block";
        audioPlayerContainer.setAttribute("aria-hidden", "false");
      }

      // Stop any existing audio and set new src
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
      audioPlayer.src = audioPath;
      // ensure browser will pick up new src
      if (typeof audioPlayer.load === "function") audioPlayer.load();

      audioPlayer.play().catch(error => {
        console.error("Error playing audio:", error);
        // Silent fallback to TTS
        const s = Sentences[currentAudioIndex];
        if (s && s.english && s.english.trim()) {
          // hide player because we fell back to TTS
          if (audioPlayerContainer) {
            audioPlayerContainer.style.display = "none";
            audioPlayerContainer.setAttribute("aria-hidden", "true");
          }
          playTextToSpeech(s.english, "en-US");
        }
      });

      isSpeaking = true;
      updateSpeakingUI();

      audioPlayer.onended = function () {
        isSpeaking = false;
        updateSpeakingUI();
        if (autoPlayCheckbox.checked) {
          setTimeout(nextSentence, 500);
        }
      };

      // update pause button label
      updatePauseButton();
    } catch (err) {
      console.error("playAudioFile error:", err);
    }
  } else {
    // Legacy fallback if audio element not present: use TTS
    const s = Sentences[currentAudioIndex];
    if (s && s.english && s.english.trim()) {
      playTextToSpeech(s.english, "en-US");
    }
  }
}

// Pause/Resume button handler
function toggleAudioPause() {
  if (!audioPlayer) return;
  if (audioPlayer.paused) {
    audioPlayer.play().catch(err => console.error(err));
  } else {
    audioPlayer.pause();
  }
  updatePauseButton();
}
function updatePauseButton() {
  if (!pauseAudioBtn || !audioPlayer) return;
  if (audioPlayer.paused) {
    pauseAudioBtn.textContent = "⏵ Resume";
  } else {
    pauseAudioBtn.textContent = "⏸ Pause";
  }
}
if (pauseAudioBtn) {
  pauseAudioBtn.addEventListener("click", function () {
    toggleAudioPause();
  });
}
if (replayAudioBtn) {
  replayAudioBtn.addEventListener("click", function () {
    if (!audioPlayer) return;
    audioPlayer.currentTime = 0;
    audioPlayer.play().catch(err => console.error(err));
    updatePauseButton();
  });
}

// ========== PLAY TEXT TO SPEECH ==========
function playTextToSpeech(text, lang) {
  const cleanedText = text.replace(/<br\s*\/?>>/gi, " ");
  utterance.text = cleanedText;
  utterance.lang = lang;
  // Use the selected TTS rate
  utterance.rate = parseFloat(ttsRateSelect ? ttsRateSelect.value : 1) || 1;

  // When using TTS fallback, hide the HTML audio player area
  if (audioPlayerContainer) {
    audioPlayerContainer.style.display = "none";
    audioPlayerContainer.setAttribute("aria-hidden", "true");
  }

  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);

  isSpeaking = true;
  updateSpeakingUI();

  utterance.onend = function () {
    isSpeaking = false;
    updateSpeakingUI();
    if (autoPlayCheckbox.checked) {
      setTimeout(nextSentence, 500);
    }
  };
}

// Update TTS rate selector change (affects future TTS playback)
if (ttsRateSelect) {
  ttsRateSelect.addEventListener("change", function () {
    // If currently speaking via TTS, restart speaking with new rate
    if (!audioPlayer || (audioPlayer && audioPlayer.paused && isSpeaking)) {
      // do nothing aggressively — user can press TTS again
    }
  });
}

// ========== STOP ALL PLAYBACK ==========
function stopAllPlayback() {
  // Stop audio playback
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
  }

  // Stop TTS
  speechSynthesis.cancel();
  isSpeaking = false;
  updateSpeakingUI();

  // Update pause button label
  updatePauseButton();
}

// ========== SPEAK BUTTONS (TTS for script reading) ==========
speakEnglishBtn.addEventListener("click", function () {
  const s = Sentences[currentAudioIndex];
  if (s && s.english && s.english.trim()) {
    playTextToSpeech(s.english, "en-US");
  }
});

speakArabicBtn.addEventListener("click", function () {
  const s = Sentences[currentAudioIndex];
  if (s && s.arabic && s.arabic.trim()) {
    playTextToSpeech(s.arabic, "ar-SA");
  }
});

speakSelectionBtn.addEventListener("click", function () {
  const selectedText = window.getSelection().toString().trim();
  if (!selectedText) return;

  playTextToSpeech(selectedText, "en-US");
});

stopBtn.addEventListener("click", function () {
  stopAllPlayback();
});

// ========== NAVIGATION ==========
function updateButtonState() {
  prevBtn.disabled = navPos === 0;
  nextBtn.disabled = navPos === navIndices.length - 1;
}

function displayData() {
  if (navPos < 0) navPos = 0;
  if (navPos > navIndices.length - 1) navPos = navIndices.length - 1;

  currentAudioIndex = navIndices[navPos];
  const s = Sentences[currentAudioIndex] || {};

  q.textContent =
    (navPos + 1) + "/" + navIndices.length +
    " (Clip " + (currentAudioIndex + 1) + "/" + Sentences.length + ")";

  refer_to.textContent = s.refer_to || "";
  back_to.textContent = s.back_to || "";

  const referToContainer = document.getElementById("refer_to_container");
  const backToContainer = document.getElementById("back_to_container");

  referToContainer.style.display = s.refer_to && s.refer_to.trim() ? "block" : "none";
  backToContainer.style.display = s.back_to && s.back_to.trim() ? "block" : "none";

  keyWords.innerHTML = s.keyWord || "";
  speaker.innerHTML = s.speaker || "";
  def.innerHTML = s.definition || "";
  english.innerHTML = s.english || "";
  arabic.innerHTML = s.arabic || "";
  answer.innerHTML = s.answer || "";

  scrambledText.textContent = "";
  isScrambled = false;
  scrambleCheckbox.checked = false;
  speakScrambledCheckbox.checked = false;
  scrambledText.style.display = "none";

  questionBasedOnAudio.innerHTML = s.audioQuestion && s.audioQuestion.trim()
    ? "<details aria-label='Audio question'><summary>Question</summary>" + s.audioQuestion + "</details>"
    : "";

  answerDetails.style.display = s.answer && s.answer.trim() ? "block" : "none";
  definitionDetails.style.display = s.definition && s.definition.trim() ? "block" : "none";
  englishDetails.style.display = s.english && s.english.trim() ? "block" : "none";
  arabicDetails.style.display = s.arabic && s.arabic.trim() ? "block" : "none";

  if (s.Image && s.Image.trim() !== "" && s.Image !== ".jpg") {
    image.src = s.Image;
    image.style.display = "block";
    illustrationDetails.style.display = "block";
    illustrationDetails.open = false;
  } else {
    image.removeAttribute("src");
    image.style.display = "none";
    illustrationDetails.style.display = "none";
  }

  // Show or hide the HTML audio player container based on whether audio exists.
  const hasAudio = s.audio && s.audio.trim() !== "" && s.audio !== ".mp3";
  if (audioPlayerContainer) {
    if (hasAudio) {
      audioPlayerContainer.style.display = "block";
      audioPlayerContainer.setAttribute("aria-hidden", "false");
      // clear src until user plays (or set src if you prefer autoplay)
      if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        audioPlayer.removeAttribute("src");
        if (typeof audioPlayer.load === "function") audioPlayer.load();
      }
    } else {
      audioPlayerContainer.style.display = "none";
      audioPlayerContainer.setAttribute("aria-hidden", "true");
      if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        audioPlayer.removeAttribute("src");
        if (typeof audioPlayer.load === "function") audioPlayer.load();
      }
    }
  }

  updateButtonState();
}

function resetDetails() {
  definitionDetails.open = false;
  englishDetails.open = false;
  arabicDetails.open = false;
  answerDetails.open = false;
  illustrationDetails.open = false;
}

function scrollToTop() {
  document.querySelector("main").scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function nextSentence() {
  stopAllPlayback();

  if (navPos < navIndices.length - 1) {
    navPos++;
    displayData();
    resetDetails();
    scrollToTop();
    if (autoPlayCheckbox.checked) {
      setTimeout(function () {
        playMainBtn.click();
      }, 500);
    }
  }
}

function prevSentence() {
  stopAllPlayback();

  if (navPos > 0) {
    navPos--;
    displayData();
    resetDetails();
    scrollToTop();
    if (autoPlayCheckbox.checked) {
      setTimeout(function () {
        playMainBtn.click();
      }, 500);
    }
  }
}

nextBtn.addEventListener("click", nextSentence);
prevBtn.addEventListener("click", prevSentence);

document.getElementById("search").addEventListener("click", function () {
  const entered = parseInt(audioIndexInput.value, 10);
  if (!Number.isFinite(entered)) {
    alert("Enter a valid number.");
    return;
  }

  const idx = entered - 1;

  if (idx < 0 || idx >= Sentences.length) {
    alert("Enter a number between 1 and " + Sentences.length);
    return;
  }

  if (usePlayListCheckbox.checked) {
    const pos = navIndices.indexOf(idx);
    if (pos === -1) {
      alert("That clip is not in your playlist subset.");
      return;
    }
    navPos = pos;
    displayData();
  } else {
    navPos = idx;
    displayData();
  }
});

audioIndexInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    document.getElementById("search").click();
  }
});

document.addEventListener("keydown", function (e) {
  if (e.key === "ArrowRight") nextSentence();
  if (e.key === "ArrowLeft") prevSentence();
});

function updateSpeakingUI() {
  if (isSpeaking) {
    speakingIndicator.classList.add("active");
  } else {
    speakingIndicator.classList.remove("active");
  }
}

// Update pause button label if playback changes from the native controls (play/pause)
if (audioElement) {
  audioElement.addEventListener("play", updatePauseButton);
  audioElement.addEventListener("pause", updatePauseButton);
  audioElement.addEventListener("ended", updatePauseButton);
}

// Initialize touch gestures
let touchStartX = 0;

document.addEventListener("touchstart", function (e) {
  touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener("touchend", function (e) {
  const touchEndX = e.changedTouches[0].screenX;

  if (touchEndX < touchStartX - 50) {
    nextSentence();
  }

  if (touchEndX > touchStartX + 50) {
    prevSentence();
  }
});

loadData();
