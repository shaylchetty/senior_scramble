const DATA_URL = "./profiles.json";
const SWIPE_THRESHOLD = 110;
const STORAGE_KEY = "campus-match-decisions";
const STORAGE_VERSION = 2;

const defaultState = () => ({
  version: STORAGE_VERSION,
  decisions: { saved: [], ignored: [] },
  history: [],
  currentView: "swipe",
  profileOrder: [],
  searchQuery: "",
});

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
const resumeNote = document.getElementById("resume-note");
const exportButton = document.getElementById("export-button");
const importButton = document.getElementById("import-button");
const importInput = document.getElementById("import-input");
const searchInput = document.getElementById("search-input");
const clearSearchButton = document.getElementById("clear-search-button");

let profiles = [];
let persistedState = loadState();
let decisions = persistedState.decisions;
let history = persistedState.history;
let currentView = persistedState.currentView;
let profileOrder = persistedState.profileOrder;
let searchQuery = persistedState.searchQuery;

function normalizeDecisionState(value) {
  const unique = Array.isArray(value)
    ? [...new Set(value.filter(Boolean).map(String))]
    : [];
  return unique;
}

function normalizeHistory(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (entry) =>
        entry && typeof entry === "object" && entry.uni && entry.direction,
    )
    .map((entry) => ({
      uni: String(entry.uni),
      direction: entry.direction === "save" ? "save" : "ignore",
    }));
}

function normalizeView(value) {
  return ["swipe", "saved", "ignored"].includes(value) ? value : "swipe";
}

function normalizeProfileOrder(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter(Boolean).map(String))]
    : [];
}

function normalizeSearchQuery(value) {
  return value === null || value === undefined
    ? ""
    : String(value).trim().toLowerCase();
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (!parsed) {
      return defaultState();
    }

    if (Array.isArray(parsed.saved) || Array.isArray(parsed.ignored)) {
      return {
        version: STORAGE_VERSION,
        decisions: {
          saved: normalizeDecisionState(parsed.saved),
          ignored: normalizeDecisionState(parsed.ignored),
        },
        history: [],
        currentView: "swipe",
        profileOrder: [],
        searchQuery: "",
      };
    }

    return {
      version: STORAGE_VERSION,
      decisions: {
        saved: normalizeDecisionState(parsed.decisions?.saved),
        ignored: normalizeDecisionState(parsed.decisions?.ignored),
      },
      history: normalizeHistory(parsed.history),
      currentView: normalizeView(parsed.currentView),
      profileOrder: normalizeProfileOrder(parsed.profileOrder),
      searchQuery: normalizeSearchQuery(parsed.searchQuery),
    };
  } catch {
    return defaultState();
  }
}

function persistState() {
  persistedState = {
    version: STORAGE_VERSION,
    decisions: {
      saved: normalizeDecisionState(decisions.saved),
      ignored: normalizeDecisionState(decisions.ignored),
    },
    history: normalizeHistory(history),
    currentView: normalizeView(currentView),
    profileOrder: normalizeProfileOrder(profileOrder),
    searchQuery: normalizeSearchQuery(searchQuery),
  };

  decisions = persistedState.decisions;
  history = persistedState.history;
  currentView = persistedState.currentView;
  profileOrder = persistedState.profileOrder;
  searchQuery = persistedState.searchQuery;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
  updateCounts();
  updateResumeNote();
  clearSearchButton.classList.toggle("is-visible", Boolean(searchQuery));
}

function updateCounts() {
  savedCount.textContent = String(decisions.saved.length);
  ignoredCount.textContent = String(decisions.ignored.length);
}

function updateResumeNote() {
  const reviewedCount = decisions.saved.length + decisions.ignored.length;
  const totalCount = profiles.length;
  const remainingCount = totalCount
    ? Math.max(totalCount - reviewedCount, 0)
    : 0;
  const viewLabel =
    currentView === "swipe"
      ? "All Profiles"
      : currentView === "saved"
        ? "Saved"
        : "Skip";
  const searchSuffix = searchQuery
    ? ` Search is filtering results for "${searchQuery}".`
    : "";

  if (!totalCount) {
    resumeNote.textContent =
      "Progress and lists stay in this browser, and you can export a backup anytime.";
    return;
  }

  resumeNote.textContent =
    `You have reviewed ${reviewedCount} of ${totalCount} profiles, with ${remainingCount} left. ` +
    `You’ll reopen on ${viewLabel} in this browser.${searchSuffix}`;
}

function sanitizeValue(value, fallback = "N/A") {
  if (value === null || value === undefined) {
    return fallback;
  }

  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : fallback;
}

function searchableText(profile) {
  return [
    profile.instagram,
    normalizeInstagramHandle(profile.instagram),
    profile.uni,
    profile.school,
    profile.major,
    profile.minor,
    profile.zodiac,
    profile.sexual_orientation,
    profile.bio,
    profile.quote,
  ]
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function matchesSearch(profile) {
  if (!searchQuery) {
    return true;
  }

  return searchableText(profile).includes(searchQuery);
}

function visibleProfiles() {
  const seen = new Set([...decisions.saved, ...decisions.ignored]);
  const profileMap = new Map(
    profiles.map((profile) => [String(profile.uni), profile]),
  );
  const ordered = profileOrder
    .map((uni) => profileMap.get(String(uni)))
    .filter(Boolean);

  return ordered.filter(
    (profile) => !seen.has(profile.uni) && matchesSearch(profile),
  );
}

function profilesByDecision(type) {
  const profileMap = new Map(
    profiles.map((profile) => [String(profile.uni), profile]),
  );
  const orderedIds = decisions[type];
  return orderedIds
    .map((uni) => profileMap.get(String(uni)))
    .filter(Boolean)
    .filter(matchesSearch)
    .reverse();
}

function shuffleList(items) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function initializeProfileOrder() {
  const allUnis = profiles.map((profile) => String(profile.uni));
  const knownUnis = new Set(allUnis);
  const cleanedExisting = profileOrder.filter((uni) =>
    knownUnis.has(String(uni)),
  );
  const missingUnis = allUnis.filter((uni) => !cleanedExisting.includes(uni));

  if (!cleanedExisting.length) {
    profileOrder = shuffleList(allUnis);
    persistState();
    return;
  }

  if (missingUnis.length) {
    profileOrder = [...cleanedExisting, ...shuffleList(missingUnis)];
    persistState();
    return;
  }

  profileOrder = cleanedExisting;
}

function normalizeInstagramHandle(value) {
  const raw = sanitizeValue(value, "");
  if (!raw) {
    return "";
  }

  return raw
    .replace(/^@+/, "")
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/\/+$/, "");
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
  return (
    normalized !== "n/a" &&
    normalized !== "na" &&
    normalized !== "null" &&
    normalized !== "undefined"
  );
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
  const card = image.closest(".profile-card, .collection-card");

  if (imageUrl) {
    image.src = imageUrl;
    image.alt = `${sanitizeValue(profile.instagram, "Profile")} from ${sanitizeValue(profile.school)}`;
    image.classList.remove("is-hidden");
    card?.classList.remove("no-image");
  } else {
    image.removeAttribute("src");
    image.alt = "";
    image.classList.add("is-hidden");
    card?.classList.add("no-image");
  }

  image.loading = "eager";
  image.onerror = () => {
    image.removeAttribute("src");
    image.alt = "";
    image.classList.add("is-hidden");
    card?.classList.add("no-image");
  };
  image.onload = () => {
    image.classList.remove("is-hidden");
    card?.classList.remove("no-image");
  };
}

function populateProfileFields(card, profile) {
  const bio = sanitizeValue(profile.bio, "");
  const quote = sanitizeValue(profile.quote, "");
  const instagramHandle = normalizeInstagramHandle(profile.instagram);
  const instagramEl = card.querySelector(".profile-instagram");

  card.querySelector(".profile-name").textContent = sanitizeValue(
    profile.instagram,
    profile.uni,
  );
  card.querySelector(".profile-school").textContent =
    composeSchoolLine(profile);
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
  setOptionalField(
    card,
    ".profile-orientation",
    ".orientation-wrapper",
    profile.sexual_orientation,
  );
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

  decisions[sourceGroup] = decisions[sourceGroup].filter(
    (uni) => uni !== profile.uni,
  );
  decisions[targetGroup] = decisions[targetGroup].filter(
    (uni) => uni !== profile.uni,
  );
  decisions[targetGroup].push(profile.uni);

  persistState();
  renderCurrentView();
}

function renderDeck() {
  deck.innerHTML = "";
  const remaining = visibleProfiles();

  if (!remaining.length) {
    deck.innerHTML = `
      <div class="profile-card empty-state">
        <div>
          <h2>${searchQuery ? "No profiles match" : "You’re caught up"}</h2>
          <p>${searchQuery ? "Try another search term or clear search to see more profiles." : "Reset decisions to review these profiles again, or swap in a new JSON file."}</p>
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
          <h2>${searchQuery ? "No profiles match" : "No profiles here yet"}</h2>
          <p>${
            searchQuery
              ? "Try another search term or clear search to see more profiles."
              : type === "saved"
                ? "Profiles you save will show up here."
                : "Profiles you skip will show up here."
          }</p>
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
  persistState();
  renderCurrentView();
}

function setSearchQuery(nextQuery) {
  searchQuery = normalizeSearchQuery(nextQuery);
  persistState();
  renderCurrentView();
}

function commitDecision(profile, direction) {
  history.push({ uni: profile.uni, direction });

  if (direction === "save") {
    decisions.saved.push(profile.uni);
  } else {
    decisions.ignored.push(profile.uni);
  }

  persistState();
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
    decisions.ignored = decisions.ignored.filter(
      (uni) => uni !== lastDecision.uni,
    );
  }

  persistState();
  renderCurrentView();
}

function exportState() {
  const payload = {
    version: STORAGE_VERSION,
    exportedAt: new Date().toISOString(),
    decisions,
    history,
    currentView,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `senior-scramble-backup-${stamp}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function importState(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const nextState = {
    version: STORAGE_VERSION,
    decisions: {
      saved: normalizeDecisionState(parsed.decisions?.saved ?? parsed.saved),
      ignored: normalizeDecisionState(
        parsed.decisions?.ignored ?? parsed.ignored,
      ),
    },
    history: normalizeHistory(parsed.history),
    currentView: normalizeView(parsed.currentView),
  };

  decisions = nextState.decisions;
  history = nextState.history;
  currentView = nextState.currentView;
  persistState();
  renderCurrentView();
}

async function init() {
  updateCounts();
  updateResumeNote();
  searchInput.value = searchQuery;
  clearSearchButton.classList.toggle("is-visible", Boolean(searchQuery));

  try {
    const response = await fetch(DATA_URL);

    if (!response.ok) {
      throw new Error(`Failed to load ${DATA_URL}`);
    }

    profiles = await response.json();
    initializeProfileOrder();
    renderCurrentView();
    updateResumeNote();
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
exportButton.addEventListener("click", exportState);
importButton.addEventListener("click", () => importInput.click());
searchInput.addEventListener("input", (event) => {
  setSearchQuery(event.target.value);
});
clearSearchButton.addEventListener("click", () => {
  searchInput.value = "";
  setSearchQuery("");
  searchInput.focus();
});
importInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  try {
    await importState(file);
    searchInput.value = searchQuery;
  } catch {
    window.alert("That backup file could not be imported.");
  } finally {
    importInput.value = "";
  }
});
resetButton.addEventListener("click", () => {
  const shouldReset = window.confirm(
    "Reset your saved, skipped, rewind history, and current progress in this browser?",
  );

  if (!shouldReset) {
    return;
  }

  decisions = { saved: [], ignored: [] };
  history = [];
  currentView = "swipe";
  persistState();
  setView("swipe");
});

init();
