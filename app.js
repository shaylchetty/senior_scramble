const DATA_URL = "./profiles.json";
const SWIPE_THRESHOLD = 110;
const STORAGE_KEY = "campus-match-decisions";

const deck = document.getElementById("card-deck");
const collectionView = document.getElementById("collection-view");
const template = document.getElementById("profile-card-template");
const collectionTemplate = document.getElementById("collection-card-template");
const saveButton = document.getElementById("save-button");
const ignoreButton = document.getElementById("ignore-button");
const rewindButton = document.getElementById("rewind-button");
const resetButton = document.getElementById("reset-button");
const savedCount = document.getElementById("saved-count");
const ignoredCount = document.getElementById("ignored-count");
const viewAllButton = document.getElementById("view-all-button");
const viewSavedButton = document.getElementById("view-saved-button");
const viewIgnoredButton = document.getElementById("view-ignored-button");
const actionRow = document.querySelector(".action-row");

let profiles = [];
let decisions = loadDecisions();
let history = [];
let currentView = "swipe";

function loadDecisions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? { saved: [], ignored: [] };
  } catch {
    return { saved: [], ignored: [] };
  }
}

function persistDecisions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decisions));
  updateCounts();
}

function updateCounts() {
  savedCount.textContent = String(decisions.saved.length);
  ignoredCount.textContent = String(decisions.ignored.length);
}

function sanitizeValue(value, fallback = "N/A") {
  if (value === null || value === undefined) {
    return fallback;
  }

  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : fallback;
}

function visibleProfiles() {
  const seen = new Set([...decisions.saved, ...decisions.ignored]);
  return profiles.filter((profile) => !seen.has(profile.uni));
}

function profilesByDecision(type) {
  const orderedIds = decisions[type];
  return orderedIds
    .map((uni) => profiles.find((profile) => profile.uni === uni))
    .filter(Boolean)
    .reverse();
}

function normalizeInstagramHandle(value) {
  const raw = sanitizeValue(value, "");
  if (!raw) {
    return "";
  }

  return raw.replace(/^@+/, "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/+$/, "");
}

function hasDisplayValue(value) {
  if (value === null || value === undefined) {
    return false;
  }

  const content = String(value).trim();
  if (!content) {
    return false;
  }

  const normalized = content.toLowerCase();
  return normalized !== "n/a" && normalized !== "na" && normalized !== "null" && normalized !== "undefined";
}

function composeSchoolLine(profile) {
  const parts = [];

  if (hasDisplayValue(profile.school)) {
    parts.push(String(profile.school).trim());
  }

  if (hasDisplayValue(profile.uni)) {
    parts.push(String(profile.uni).trim());
  }

  return parts.join(" • ");
}

function setOptionalField(card, selector, wrapperSelector, value) {
  const wrapper = card.querySelector(wrapperSelector);
  if (!hasDisplayValue(value)) {
    wrapper.hidden = true;
    wrapper.classList.add("is-hidden");
    card.querySelector(selector).textContent = "";
    return;
  }

  const content = String(value).trim();
  wrapper.hidden = false;
  wrapper.classList.remove("is-hidden");
  card.querySelector(selector).textContent = content;
}

function wireInstagramLink(link, handle) {
  if (!handle) {
    link.hidden = true;
    link.removeAttribute("href");
    link.textContent = "";
    return;
  }

  link.hidden = false;
  link.href = `https://www.instagram.com/${handle}/`;
  link.textContent = `@${handle}`;
}

function applyImageState(image, profile) {
  const imageUrl = sanitizeValue(profile.image_url, "");

  if (imageUrl) {
    image.src = imageUrl;
    image.alt = `${sanitizeValue(profile.instagram, "Profile")} from ${sanitizeValue(profile.school)}`;
    image.classList.remove("is-hidden");
  } else {
    image.removeAttribute("src");
    image.alt = "";
    image.classList.add("is-hidden");
  }

  image.loading = "eager";
  image.onerror = () => {
    image.removeAttribute("src");
    image.alt = "";
    image.classList.add("is-hidden");
  };
  image.onload = () => {
    image.classList.remove("is-hidden");
  };
}

function populateProfileFields(card, profile) {
  const bio = sanitizeValue(profile.bio, "");
  const quote = sanitizeValue(profile.quote, "");
  const instagramHandle = normalizeInstagramHandle(profile.instagram);
  const instagramEl = card.querySelector(".profile-instagram");

  card.querySelector(".profile-name").textContent = sanitizeValue(profile.instagram, profile.uni);
  card.querySelector(".profile-school").textContent = composeSchoolLine(profile);
  wireInstagramLink(instagramEl, instagramHandle);

  const bioEl = card.querySelector(".profile-bio");
  if (!bio) {
    bioEl.hidden = true;
    bioEl.textContent = "";
  } else {
    bioEl.hidden = false;
    bioEl.textContent = bio;
  }

  setOptionalField(card, ".profile-major", ".major-wrapper", profile.major);
  setOptionalField(card, ".profile-minor", ".minor-wrapper", profile.minor);
  setOptionalField(card, ".profile-orientation", ".orientation-wrapper", profile.sexual_orientation);
  setOptionalField(card, ".profile-zodiac", ".zodiac-wrapper", profile.zodiac);

  const quoteEl = card.querySelector(".profile-quote");
  if (!quote) {
    quoteEl.hidden = true;
    quoteEl.textContent = "";
  } else {
    quoteEl.hidden = false;
    quoteEl.textContent = `“${quote}”`;
  }
}

function renderCollectionCard(profile) {
  const card = collectionTemplate.content.firstElementChild.cloneNode(true);
  const image = card.querySelector(".collection-image");

  applyImageState(image, profile);
  populateProfileFields(card, profile);

  return card;
}

function moveProfileToGroup(profile, targetGroup) {
  const sourceGroup = targetGroup === "saved" ? "ignored" : "saved";

  decisions[sourceGroup] = decisions[sourceGroup].filter((uni) => uni !== profile.uni);
  decisions[targetGroup] = decisions[targetGroup].filter((uni) => uni !== profile.uni);
  decisions[targetGroup].push(profile.uni);

  persistDecisions();
  renderCurrentView();
}

function renderDeck() {
  deck.innerHTML = "";
  const remaining = visibleProfiles();

  if (!remaining.length) {
    deck.innerHTML = `
      <div class="profile-card empty-state">
        <div>
          <h2>You’re caught up</h2>
          <p>Reset decisions to review these profiles again, or swap in a new JSON file.</p>
        </div>
      </div>
    `;
    return;
  }

  remaining
    .slice(0, 3)
    .reverse()
    .forEach((profile, index) => {
      const card = template.content.firstElementChild.cloneNode(true);
      const isTopCard = index === remaining.slice(0, 3).length - 1;

      if (!isTopCard) {
        card.classList.add("is-next");
      }

      populateCard(card, profile);
      deck.append(card);

      if (isTopCard) {
        attachSwipe(card, profile);
      }
    });
}

function populateCard(card, profile) {
  const image = card.querySelector(".profile-image");
  applyImageState(image, profile);
  populateProfileFields(card, profile);
}

function renderCollection(type) {
  collectionView.innerHTML = "";
  const collectionProfiles = profilesByDecision(type);

  if (!collectionProfiles.length) {
    collectionView.innerHTML = `
      <div class="profile-card empty-state">
        <div>
          <h2>No profiles here yet</h2>
          <p>${type === "saved" ? "Profiles you save will show up here." : "Profiles you skip will show up here."}</p>
        </div>
      </div>
    `;
    return;
  }

  collectionProfiles.forEach((profile) => {
    const card = renderCollectionCard(profile);
    const moveButton = card.querySelector(".collection-move-button");
    const targetGroup = type === "saved" ? "ignored" : "saved";

    moveButton.textContent = type === "saved" ? "Skip" : "Save";
    moveButton.classList.add(type === "saved" ? "to-skip" : "to-save");
    moveButton.addEventListener("click", () => {
      moveProfileToGroup(profile, targetGroup);
    });

    collectionView.append(card);
  });
}

function updateViewButtons() {
  viewAllButton.classList.toggle("is-active", currentView === "swipe");
  viewSavedButton.classList.toggle("is-active", currentView === "saved");
  viewIgnoredButton.classList.toggle("is-active", currentView === "ignored");
}

function renderCurrentView() {
  updateViewButtons();

  if (currentView === "swipe") {
    deck.hidden = false;
    collectionView.hidden = true;
    actionRow.hidden = false;
    renderDeck();
    return;
  }

  deck.hidden = true;
  collectionView.hidden = false;
  actionRow.hidden = true;
  renderCollection(currentView);
}

function setView(view) {
  currentView = view;
  renderCurrentView();
}

function commitDecision(profile, direction) {
  history.push({ uni: profile.uni, direction });

  if (direction === "save") {
    decisions.saved.push(profile.uni);
  } else {
    decisions.ignored.push(profile.uni);
  }

  persistDecisions();
  renderCurrentView();
}

function animateOff(card, profile, direction) {
  const finalX = direction === "save" ? window.innerWidth : -window.innerWidth;
  const rotation = direction === "save" ? 18 : -18;
  card.style.transform = `translate(${finalX}px, -20px) rotate(${rotation}deg)`;
  card.style.opacity = "0";

  window.setTimeout(() => {
    commitDecision(profile, direction);
  }, 180);
}

function updateIndicators(card, deltaX) {
  const left = card.querySelector(".swipe-indicator-left");
  const right = card.querySelector(".swipe-indicator-right");
  const amount = Math.min(Math.abs(deltaX) / SWIPE_THRESHOLD, 1);

  left.style.opacity = deltaX < 0 ? String(amount) : "0";
  right.style.opacity = deltaX > 0 ? String(amount) : "0";
}

function attachSwipe(card, profile) {
  let startX = 0;
  let startY = 0;
  let deltaX = 0;
  let deltaY = 0;
  let dragging = false;
  const instagramLink = card.querySelector(".profile-instagram");

  if (instagramLink) {
    instagramLink.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });

    instagramLink.addEventListener("click", (event) => {
      event.stopPropagation();
      const href = instagramLink.getAttribute("href");

      if (!href) {
        event.preventDefault();
        return;
      }

      window.open(href, "_blank", "noopener,noreferrer");
      event.preventDefault();
    });
  }

  const onPointerDown = (event) => {
    if (event.target.closest(".profile-instagram")) {
      return;
    }

    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    deltaX = 0;
    deltaY = 0;
    card.classList.add("is-dragging");
    card.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!dragging) {
      return;
    }

    deltaX = event.clientX - startX;
    deltaY = event.clientY - startY;
    const rotation = deltaX * 0.06;

    card.style.transform = `translate(${deltaX}px, ${deltaY * 0.14}px) rotate(${rotation}deg)`;
    updateIndicators(card, deltaX);
  };

  const onPointerUp = (event) => {
    if (!dragging) {
      return;
    }

    dragging = false;
    card.classList.remove("is-dragging");
    card.releasePointerCapture(event.pointerId);

    if (deltaX > SWIPE_THRESHOLD) {
      animateOff(card, profile, "save");
      return;
    }

    if (deltaX < -SWIPE_THRESHOLD) {
      animateOff(card, profile, "ignore");
      return;
    }

    card.style.transform = "";
    updateIndicators(card, 0);
  };

  card.addEventListener("pointerdown", onPointerDown);
  card.addEventListener("pointermove", onPointerMove);
  card.addEventListener("pointerup", onPointerUp);
  card.addEventListener("pointercancel", onPointerUp);
}

function triggerTopCard(direction) {
  const topCard = deck.querySelector(".profile-card:last-child");
  const remaining = visibleProfiles();

  if (!topCard || !remaining.length) {
    return;
  }

  animateOff(topCard, remaining[0], direction);
}

function rewindLastDecision() {
  const lastDecision = history.pop();

  if (!lastDecision) {
    return;
  }

  if (lastDecision.direction === "save") {
    decisions.saved = decisions.saved.filter((uni) => uni !== lastDecision.uni);
  } else {
    decisions.ignored = decisions.ignored.filter((uni) => uni !== lastDecision.uni);
  }

  persistDecisions();
  renderCurrentView();
}

async function init() {
  updateCounts();

  try {
    const response = await fetch(DATA_URL);

    if (!response.ok) {
      throw new Error(`Failed to load ${DATA_URL}`);
    }

    profiles = await response.json();
    renderCurrentView();
  } catch (error) {
    deck.innerHTML = `
      <div class="profile-card empty-state">
        <div>
          <h2>Profiles unavailable</h2>
          <p>${error.message}</p>
        </div>
      </div>
    `;
  }
}

saveButton.addEventListener("click", () => triggerTopCard("save"));
ignoreButton.addEventListener("click", () => triggerTopCard("ignore"));
rewindButton.addEventListener("click", rewindLastDecision);
viewAllButton.addEventListener("click", () => setView("swipe"));
viewSavedButton.addEventListener("click", () => setView("saved"));
viewIgnoredButton.addEventListener("click", () => setView("ignored"));
resetButton.addEventListener("click", () => {
  decisions = { saved: [], ignored: [] };
  history = [];
  persistDecisions();
  setView("swipe");
});

init();
