(() => {
  const volumes = Array.isArray(window.PATHWAYS_VOLUMES)
    ? window.PATHWAYS_VOLUMES
    : [];
  const flatTracks = volumes.flatMap((volume, volumeIndex) =>
    volume.tracks.map((track, trackIndex) => ({
      ...track,
      volume: volume.title,
      volumeIndex,
      trackIndex,
      globalIndex: 0,
    })),
  );
  flatTracks.forEach((track, index) => {
    track.globalIndex = index;
  });

  const audio = document.getElementById("audio");
  const grid = document.getElementById("volume-grid");
  const tabs = document.getElementById("volume-tabs");
  const search = document.getElementById("episode-search");
  const summary = document.getElementById("result-summary");
  const emptyState = document.getElementById("empty-state");
  const playerTitle = document.getElementById("player-title");
  const playerVolume = document.getElementById("player-volume");
  const playToggle = document.getElementById("play-toggle");
  const previousButton = document.getElementById("previous-track");
  const nextButton = document.getElementById("next-track");
  const seekSlider = document.getElementById("seek-slider");
  const currentTime = document.getElementById("current-time");
  const duration = document.getElementById("duration");
  const startButton = document.getElementById("start-listening");

  let activeVolume = "all";
  let currentTrackIndex = -1;
  let isSeeking = false;

  function episodeNumber(track) {
    const match = track.src.match(/(?:^|\/)(\d{1,3})_/);
    return match ? match[1].padStart(3, "0") : "—";
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  }

  function createTab(label, value, selected = false) {
    const button = document.createElement("button");
    button.className = "volume-tab";
    button.type = "button";
    button.role = "tab";
    button.textContent = label;
    button.dataset.volume = value;
    button.setAttribute("aria-selected", String(selected));
    button.addEventListener("click", () => {
      activeVolume = value;
      tabs.querySelectorAll(".volume-tab").forEach((tab) => {
        tab.setAttribute(
          "aria-selected",
          String(tab.dataset.volume === activeVolume),
        );
      });
      renderLibrary();
    });
    return button;
  }

  function renderTabs() {
    tabs.replaceChildren(createTab("All", "all", true));
    volumes.forEach((volume, index) => {
      tabs.appendChild(createTab(String(index + 1), String(index)));
    });
  }

  function matchesSearch(track, query) {
    if (!query) return true;
    return `${track.title} ${track.volume} ${episodeNumber(track)}`
      .toLowerCase()
      .includes(query);
  }

  function createTrackButton(track) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "track-button";
    button.dataset.trackIndex = String(track.globalIndex);
    button.classList.toggle("is-current", track.globalIndex === currentTrackIndex);
    button.setAttribute("aria-label", `Play ${track.title}`);

    const number = document.createElement("span");
    number.className = "track-number";
    number.textContent = episodeNumber(track);

    const title = document.createElement("span");
    title.className = "track-title";
    title.textContent = track.title;

    const play = document.createElement("span");
    play.className = "track-play";
    play.setAttribute("aria-hidden", "true");
    play.textContent = track.globalIndex === currentTrackIndex && !audio.paused
      ? "Ⅱ"
      : "▶";

    button.append(number, title, play);
    button.addEventListener("click", () => playTrack(track.globalIndex));
    return button;
  }

  function createVolumeSection(volume, tracks) {
    const section = document.createElement("article");
    section.className = "volume-section";

    const header = document.createElement("header");
    header.className = "volume-header";
    const heading = document.createElement("h3");
    heading.textContent = volume.title;
    const count = document.createElement("span");
    count.textContent = `${tracks.length} ${tracks.length === 1 ? "episode" : "episodes"}`;
    header.append(heading, count);

    const list = document.createElement("ol");
    list.className = "track-list";
    tracks.forEach((track) => {
      const item = document.createElement("li");
      item.appendChild(createTrackButton(track));
      list.appendChild(item);
    });

    section.append(header, list);
    return section;
  }

  function renderLibrary() {
    const query = search.value.trim().toLowerCase();
    let total = 0;
    grid.replaceChildren();

    volumes.forEach((volume, volumeIndex) => {
      if (activeVolume !== "all" && activeVolume !== String(volumeIndex)) {
        return;
      }
      const tracks = volume.tracks
        .map((track, trackIndex) => flatTracks.find(
          (entry) =>
            entry.volumeIndex === volumeIndex && entry.trackIndex === trackIndex,
        ))
        .filter((track) => matchesSearch(track, query));
      if (!tracks.length) return;
      total += tracks.length;
      grid.appendChild(createVolumeSection(volume, tracks));
    });

    summary.textContent = `${total} ${total === 1 ? "episode" : "episodes"}`;
    emptyState.hidden = total !== 0;
  }

  function syncCurrentTrackUi() {
    document.querySelectorAll(".track-button").forEach((button) => {
      const isCurrent = Number(button.dataset.trackIndex) === currentTrackIndex;
      button.classList.toggle("is-current", isCurrent);
      const icon = button.querySelector(".track-play");
      if (icon) icon.textContent = isCurrent && !audio.paused ? "Ⅱ" : "▶";
    });
    playToggle.textContent = audio.paused ? "▶" : "Ⅱ";
    playToggle.setAttribute(
      "aria-label",
      audio.paused ? "Play episode" : "Pause episode",
    );
  }

  function setTrack(index, autoplay = true) {
    if (!flatTracks.length) return;
    const normalized = (index + flatTracks.length) % flatTracks.length;
    const track = flatTracks[normalized];
    currentTrackIndex = normalized;
    audio.src = track.src;
    playerTitle.textContent = track.title;
    playerVolume.textContent = `${track.volume} · Episode ${episodeNumber(track)}`;
    localStorage.setItem("pathwaysCurrentTrack", String(normalized));
    syncCurrentTrackUi();
    if (autoplay) {
      audio.play().catch(() => syncCurrentTrackUi());
    }
  }

  function playTrack(index) {
    if (currentTrackIndex === index && audio.src) {
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
      return;
    }
    setTrack(index, true);
  }

  function togglePlayback() {
    if (currentTrackIndex < 0) {
      setTrack(0, true);
      return;
    }
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  function moveTrack(direction) {
    const start = currentTrackIndex < 0 ? 0 : currentTrackIndex;
    setTrack(start + direction, true);
  }

  search.addEventListener("input", renderLibrary);
  playToggle.addEventListener("click", togglePlayback);
  previousButton.addEventListener("click", () => moveTrack(-1));
  nextButton.addEventListener("click", () => moveTrack(1));
  startButton.addEventListener("click", () => {
    setTrack(currentTrackIndex < 0 ? 0 : currentTrackIndex, true);
    document.getElementById("episodes").scrollIntoView({ behavior: "smooth" });
  });

  audio.addEventListener("play", syncCurrentTrackUi);
  audio.addEventListener("pause", syncCurrentTrackUi);
  audio.addEventListener("ended", () => moveTrack(1));
  audio.addEventListener("loadedmetadata", () => {
    duration.textContent = formatTime(audio.duration);
  });
  audio.addEventListener("timeupdate", () => {
    if (isSeeking || !Number.isFinite(audio.duration)) return;
    currentTime.textContent = formatTime(audio.currentTime);
    seekSlider.value = String((audio.currentTime / audio.duration) * 100 || 0);
  });

  seekSlider.addEventListener("input", () => {
    isSeeking = true;
    if (Number.isFinite(audio.duration)) {
      currentTime.textContent = formatTime(
        (Number(seekSlider.value) / 100) * audio.duration,
      );
    }
  });
  seekSlider.addEventListener("change", () => {
    if (Number.isFinite(audio.duration)) {
      audio.currentTime = (Number(seekSlider.value) / 100) * audio.duration;
    }
    isSeeking = false;
  });

  renderTabs();
  renderLibrary();

  const savedTrack = Number(localStorage.getItem("pathwaysCurrentTrack"));
  if (Number.isInteger(savedTrack) && savedTrack >= 0 && savedTrack < flatTracks.length) {
    setTrack(savedTrack, false);
  }
})();
