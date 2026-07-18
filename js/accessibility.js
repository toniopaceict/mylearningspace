(function () {
  "use strict";

  let glipVoices = [];
  let currentSpeakButton = null;
  let currentUtterance = null;
  let isSpeechPaused = false;

  function loadGlipVoices() {
    if (!("speechSynthesis" in window)) return;
    glipVoices = window.speechSynthesis.getVoices();
  }

  function cleanReadableText(text) {
    return String(text || "")
      .replace(/🔊/g, "")
      .replace(/⏸/g, "")
      .replace(/▶/g, "")
      .replace(/Check Answers/g, "")
      .replace(/Reset/g, "")
      .replace(/Score:\s*\d+\s*\/\s*\d+/g, "")
      .replace(/Q(\d+)/g, "Question $1")
      .replace(/β₀/g, "beta zero")
      .replace(/β₁/g, "beta one")
      .replace(/β₂/g, "beta two")
      .replace(/≈/g, "approximately")
      .replace(/%/g, " percent")
      .replace(/€/g, "euro ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getBestVoice() {
    return (
      glipVoices.find(v => v.name.includes("Microsoft Sonia")) ||
      glipVoices.find(v => v.name.includes("Google UK English Female")) ||
      glipVoices.find(v => v.name.includes("Google UK English")) ||
      glipVoices.find(v => v.lang === "en-GB") ||
      glipVoices.find(v => v.lang && v.lang.startsWith("en")) ||
      null
    );
  }

  function setSpeakButton(button, state) {
    if (!button) return;

    if (state === "reading") {
      button.textContent = "⏸";
      button.setAttribute("aria-label", "Pause reading");
      button.title = "Pause reading";
      return;
    }

    if (state === "paused") {
      button.textContent = "▶";
      button.setAttribute("aria-label", "Resume reading");
      button.title = "Resume reading";
      return;
    }

    button.textContent = "🔊";
    button.setAttribute("aria-label", "Start reading");
    button.title = "Start reading";
  }

  function resetSpeakButtons() {
    document.querySelectorAll(".speak-btn").forEach(button => {
      setSpeakButton(button, "idle");
    });

    currentSpeakButton = null;
    currentUtterance = null;
    isSpeechPaused = false;
  }

  function startSpeaking(text, button) {
    if (!("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }

    loadGlipVoices();

    const cleanText = cleanReadableText(text);
    if (!cleanText) return;

    window.speechSynthesis.cancel();
    resetSpeakButtons();

    currentSpeakButton = button;
    isSpeechPaused = false;

    setSpeakButton(button, "reading");

    setTimeout(function () {
      const utterance = new SpeechSynthesisUtterance(cleanText);

      utterance.lang = "en-GB";
      utterance.rate = 0.85;
      utterance.pitch = 1;
      utterance.volume = 1;

      const voice = getBestVoice();

      if (voice) {
        utterance.voice = voice;
      }

      utterance.onend = resetSpeakButtons;
      utterance.onerror = resetSpeakButtons;

      currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    }, 100);
  }

  window.speakSection = function (button) {
    if (!("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }

    const isSameButton = currentSpeakButton === button;

    if (isSameButton && window.speechSynthesis.speaking && !isSpeechPaused) {
      window.speechSynthesis.pause();
      isSpeechPaused = true;
      setSpeakButton(button, "paused");
      return;
    }

    if (isSameButton && isSpeechPaused) {
      window.speechSynthesis.resume();
      isSpeechPaused = false;
      setSpeakButton(button, "reading");
      return;
    }

    if (!isSameButton) {
      window.speechSynthesis.cancel();
      resetSpeakButtons();
      isSpeechPaused = false;
      currentUtterance = null;
    }

    const section = button.closest(".readable-section");

    if (!section) return;

    const readableItems = section.querySelectorAll("[data-read]");

    const text =
      readableItems.length > 0
        ? Array.from(readableItems)
            .map(item => item.innerText)
            .join(". ")
        : section.innerText;

    setTimeout(function () {
      startSpeaking(text, button);
    }, 120);
  };

 
document.addEventListener("DOMContentLoaded", function () {
  loadGlipVoices();
  resetSpeakButtons();
  });

  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = loadGlipVoices;
  }
})();
