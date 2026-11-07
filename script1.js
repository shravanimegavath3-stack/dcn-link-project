const HISTORY_KEY = "dcn-link-transfer-history-v1";

const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");
const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const dropTitle = document.getElementById("dropTitle");
const dropHint = document.getElementById("dropHint");
const dropTypes = document.getElementById("dropTypes");
const selectedFilesBox = document.getElementById("selectedFiles");
const textPanel = document.getElementById("textPanel");
const messageInput = document.getElementById("messageInput");
const characterCount = document.getElementById("characterCount");
const transferStatus = document.getElementById("transferStatus");
const sendButton = document.getElementById("sendButton");
const progressWrap = document.getElementById("progressWrap");
const progressBar = document.getElementById("progressBar");
const progressPercent = document.getElementById("progressPercent");
const progressLabel = document.getElementById("progressLabel");
const historyList = document.getElementById("historyList");
const emptyHistory = document.getElementById("emptyHistory");

let selectedType = "file";
let selectedFiles = [];
let selectedProtocol = "TCP";
let isTransferring = false;

// Mobile navigation
menuToggle.addEventListener("click", () => {
  const isOpen = mainNav.classList.toggle("nav-open");

  menuToggle.classList.toggle("is-open", isOpen);
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute(
    "aria-label",
    isOpen ? "Close navigation" : "Open navigation"
  );
});

document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach((item) => {
      item.classList.remove("active");
    });

    link.classList.add("active");
    mainNav.classList.remove("nav-open");
    menuToggle.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation");
  });
});

// Update active navigation item while scrolling.
const observedSections = document.querySelectorAll("main section[id]");
const navObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      document.querySelectorAll(".nav-link").forEach((link) => {
        link.classList.toggle(
          "active",
          link.getAttribute("href") === `#${entry.target.id}`
        );
      });
    });
  },
  { rootMargin: "-35% 0px -55% 0px" }
);

observedSections.forEach((section) => navObserver.observe(section));

// File size helper
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Set the content type, accepted file type and visible controls.
function setContentType(type) {
  selectedType = type;

  document.querySelectorAll(".content-tab").forEach((tab) => {
    const active = tab.dataset.type === type;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  selectedFiles = [];
  fileInput.value = "";
  selectedFilesBox.replaceChildren();
  selectedFilesBox.hidden = true;

  const isText = type === "text";
  textPanel.hidden = !isText;
  dropZone.hidden = isText;

  if (isText) {
    fileInput.removeAttribute("accept");
    dropZone.hidden = true;
    messageInput.focus();
    return;
  }

  const settings = {
    file: {
      accept: "",
      title: "Choose files to transfer",
      hint: "Browse your device or drag and drop files here",
      types: "DOCUMENTS · ARCHIVES · ANY FILE TYPE"
    },
    image: {
      accept: "image/*",
      title: "Choose images to transfer",
      hint: "Select one or more image files",
      types: "JPG · PNG · GIF · WEBP · SVG"
    },
    video: {
      accept: "video/*",
      title: "Choose videos to transfer",
      hint: "Select one or more video files",
      types: "MP4 · WEBM · MOV · VIDEO FILES"
    }
  };

  const current = settings[type];
  dropTitle.textContent = current.title;
  dropHint.textContent = current.hint;
  dropTypes.textContent = current.types;

  if (current.accept) {
    fileInput.setAttribute("accept", current.accept);
  } else {
    fileInput.removeAttribute("accept");
  }
}

document.querySelectorAll(".content-tab").forEach((tab) => {
  tab.addEventListener("click", () => setContentType(tab.dataset.type));
});

// Show selected files safely using textContent.
function displayFiles(files) {
  selectedFiles = Array.from(files);
  selectedFilesBox.replaceChildren();

  if (selectedFiles.length === 0) {
    selectedFilesBox.hidden = true;
    return;
  }

  selectedFilesBox.hidden = false;
  dropTitle.textContent =
    selectedFiles.length === 1
      ? selectedFiles[0].name
      : `${selectedFiles.length} files selected`;

  selectedFiles.forEach((file) => {
    const row = document.createElement("div");
    row.className = "file-row";

    const name = document.createElement("span");
    name.textContent = file.name;

    const size = document.createElement("small");
    size.textContent = formatFileSize(file.size);

    row.append(name, size);
    selectedFilesBox.appendChild(row);
  });
}

dropZone.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  displayFiles(fileInput.files);
});

// Drag and drop support
dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("drag-over");

  const files = Array.from(event.dataTransfer.files);
  if (files.length === 0) return;

  if (selectedType === "image" && files.some((file) => !file.type.startsWith("image/"))) {
    showStatus("Please choose image files for the Images tab.", "error");
    return;
  }

  if (selectedType === "video" && files.some((file) => !file.type.startsWith("video/"))) {
    showStatus("Please choose video files for the Videos tab.", "error");
    return;
  }

  displayFiles(files);

  // Keep the dropped files in the file input where supported.
  try {
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    fileInput.files = transfer.files;
  } catch {
    // The selected file list is still available for this demo.
  }
});

// Character counter
messageInput.addEventListener("input", () => {
  characterCount.textContent = `${messageInput.value.length} / 5000`;
});

// Channel quality slider
const channelGain = document.getElementById("channelGain");
const gainValue = document.getElementById("gainValue");

channelGain.addEventListener("input", () => {
  gainValue.textContent = Number(channelGain.value).toFixed(2);
});

// TCP / UDP selection
document.querySelectorAll(".protocol-button").forEach((button) => {
  button.addEventListener("click", () => {
    selectedProtocol = button.dataset.protocol;

    document.querySelectorAll(".protocol-button").forEach((item) => {
      item.classList.toggle("is-selected", item === button);
    });
  });
});

function showStatus(message, type = "") {
  transferStatus.textContent = message;
  transferStatus.className = "transfer-status";

  if (type) {
    transferStatus.classList.add(`is-${type}`);
  }
}

function getHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function saveHistory(records) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

function renderHistory() {
  const records = getHistory();
  historyList.replaceChildren();
  emptyHistory.hidden = records.length > 0;

  records.forEach((record) => {
    const row = document.createElement("div");
    row.className = "history-row";

    const transfer = document.createElement("span");
    transfer.className = "history-name";

    const icon = document.createElement("span");
    icon.className = "history-type-icon";
    icon.textContent = record.type === "Text" ? "T" : "↥";

    const name = document.createElement("span");
    name.textContent = record.name;

    transfer.append(icon, name);

    const recipient = document.createElement("span");
    recipient.textContent = record.recipient;

    const channel = document.createElement("span");
    channel.textContent = record.channel;

    const date = document.createElement("span");
    date.textContent = new Date(record.date).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    const status = document.createElement("span");
    status.className = "history-status";
    status.textContent = "Demo complete";

    row.append(transfer, recipient, channel, date, status);
    historyList.appendChild(row);
  });
}

function getTransferDetails() {
  const recipient = document.getElementById("recipient").value.trim();
  const channel = document.getElementById("interface").value;
  const shouldSave = document.getElementById("saveHistory").checked;

  if (!recipient) {
    return { error: "Enter a recipient node before starting the transfer." };
  }

  if (selectedType === "text" && !messageInput.value.trim()) {
    return { error: "Write a message before starting the transfer." };
  }

  if (selectedType !== "text" && selectedFiles.length === 0) {
    return { error: "Choose at least one file before starting the transfer." };
  }

  const name =
    selectedType === "text"
      ? `Text message (${messageInput.value.trim().length} characters)`
      : selectedFiles.length === 1
        ? selectedFiles[0].name
        : `${selectedFiles.length} files`;

  return {
    recipient,
    channel,
    shouldSave,
    name,
    type: selectedType === "text"
      ? "Text"
      : selectedType === "image"
        ? "Images"
        : selectedType === "video"
          ? "Videos"
          : "Files"
  };
}

function runDemoTransfer(details) {
  isTransferring = true;
  sendButton.disabled = true;
  progressWrap.hidden = false;
  progressBar.style.width = "0%";
  progressPercent.textContent = "0%";
  progressLabel.textContent = "Preparing demo transfer…";
  showStatus("Running a front-end transfer simulation…");

  let progress = 0;

  const timer = window.setInterval(() => {
    progress = Math.min(progress + Math.floor(Math.random() * 13) + 7, 100);
    progressBar.style.width = `${progress}%`;
    progressPercent.textContent = `${progress}%`;

    if (progress >= 100) {
      window.clearInterval(timer);
      finishDemoTransfer(details);
    } else if (progress >= 55) {
      progressLabel.textContent = "Simulating data transmission…";
    }
  }, 130);
}

function finishDemoTransfer(details) {
  isTransferring = false;
  sendButton.disabled = false;
  progressLabel.textContent = "Demo complete";

  if (details.shouldSave) {
    const records = getHistory();

    records.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: details.name,
      type: details.type,
      recipient: details.recipient,
      channel: details.channel,
      protocol: selectedProtocol,
      date: new Date().toISOString()
    });

    // Keep the most recent 50 records.
    const saved = saveHistory(records.slice(0, 50));
    renderHistory();

    if (!saved) {
      showStatus(
        "Demo completed, but browser storage is unavailable. The history was not saved.",
        "error"
      );
      return;
    }
  }

  showStatus(
    `Demo complete for ${details.recipient}. No data was sent to another device.`,
    "success"
  );
}

sendButton.addEventListener("click", () => {
  if (isTransferring) return;

  const details = getTransferDetails();

  if (details.error) {
    showStatus(details.error, "error");

    if (details.error.includes("recipient")) {
      document.getElementById("recipient").focus();
    } else if (details.error.includes("message")) {
      messageInput.focus();
    }

    return;
  }

  runDemoTransfer(details);
});

// Clear local demo history
document.getElementById("clearHistory").addEventListener("click", () => {
  try {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
  } catch {
    showStatus("Could not clear browser history.", "error");
  }
});
