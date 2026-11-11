const fileInput = document.getElementById("fileInput");
const browseButton = document.getElementById("browseButton");
const uploadArea = document.getElementById("uploadArea");
const fileList = document.getElementById("fileList");
const clearFiles = document.getElementById("clearFiles");
const textTransfer = document.getElementById("textTransfer");
const textMessage = document.getElementById("textMessage");
const characterCount = document.getElementById("characterCount");
const sendButton = document.getElementById("sendButton");

const tabs = document.querySelectorAll(".data-tab");

const receiverIP = document.getElementById("receiverIP");
const receiverPort = document.getElementById("receiverPort");

const transferMedium = document.getElementById("transferMedium");
const transferProtocol = document.getElementById("transferProtocol");

const transferStatus = document.getElementById("transferStatus");
const statusMessage = document.getElementById("statusMessage");

const progressBar = document.getElementById("progressBar");
const progressPercentage = document.getElementById("progressPercentage");
const progressContainer = document.getElementById("progressContainer");

let selectedFiles = [];
let activeType = "file";


// FILE SIZE FORMAT

function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}


// STATUS MESSAGE

function updateStatus(message, type = "") {
    statusMessage.textContent = message;
    transferStatus.className = "transfer-status";

    if (type) {
        transferStatus.classList.add(type);
    }
}


// UPDATE FILE INPUT TYPE

function updateFileAccept() {
    const types = {
        file: "*",
        image: "image/*",
        audio: "audio/*",
        video: "video/*"
    };

    fileInput.accept = types[activeType] || "*";
}


// SWITCH DATA TABS

tabs.forEach(tab => {
    tab.addEventListener("click", () => {

        tabs.forEach(item => item.classList.remove("active"));

        tab.classList.add("active");

        activeType = tab.dataset.type;

        const isText = activeType === "text";

        uploadArea.style.display = isText ? "none" : "flex";
        document.getElementById("selectedFiles").style.display =
            isText ? "none" : "block";

        textTransfer.style.display = isText ? "block" : "none";

        updateFileAccept();

        updateStatus("Ready to select data.");
    });
});


// BROWSE FILES

browseButton.addEventListener("click", () => {
    fileInput.click();
});


// VALIDATE FILE TYPE

function isValidFile(file) {

    if (activeType === "file") return true;
    if (activeType === "image") return file.type.startsWith("image/");
    if (activeType === "audio") return file.type.startsWith("audio/");
    if (activeType === "video") return file.type.startsWith("video/");

    return false;
}


// ADD FILES

function addFiles(files) {

    let rejected = 0;

    Array.from(files).forEach(file => {

        if (!isValidFile(file)) {
            rejected++;
            return;
        }

        const duplicate = selectedFiles.some(existing =>
            existing.name === file.name &&
            existing.size === file.size &&
            existing.lastModified === file.lastModified
        );

        if (!duplicate) {
            selectedFiles.push(file);
        }
    });

    renderFiles();

    if (rejected > 0) {
        updateStatus(rejected + " unsupported file(s) ignored.", "error");
    } else {
        updateStatus(selectedFiles.length + " file(s) selected.");
    }
}


// FILE INPUT CHANGE

fileInput.addEventListener("change", () => {

    addFiles(fileInput.files);

    fileInput.value = "";
});


// DRAG AND DROP

uploadArea.addEventListener("dragover", event => {

    event.preventDefault();

    uploadArea.classList.add("dragover");
});

uploadArea.addEventListener("dragleave", () => {

    uploadArea.classList.remove("dragover");
});

uploadArea.addEventListener("drop", event => {

    event.preventDefault();

    uploadArea.classList.remove("dragover");

    addFiles(event.dataTransfer.files);
});


// DISPLAY SELECTED FILES

function renderFiles() {

    fileList.innerHTML = "";

    if (selectedFiles.length === 0) {

        fileList.innerHTML =
            '<p class="empty-message">No files selected yet.</p>';

        return;
    }

    selectedFiles.forEach((file, index) => {

        const item = document.createElement("div");
        item.className = "file-item";

        const details = document.createElement("div");
        details.className = "file-details";

        const name = document.createElement("h4");
        name.textContent = file.name;

        const info = document.createElement("p");
        info.textContent = formatSize(file.size) + " · " + (file.type || "unknown type");

        details.appendChild(name);
        details.appendChild(info);

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "remove-file";
        removeButton.textContent = "Remove";

        removeButton.addEventListener("click", () => {
            selectedFiles.splice(index, 1);
            renderFiles();
        });

        item.appendChild(details);
        item.appendChild(removeButton);

        fileList.appendChild(item);
    });
}


// CLEAR ALL FILES

clearFiles.addEventListener("click", () => {

    selectedFiles = [];

    renderFiles();

    updateStatus("All selected files cleared.");
});


// TEXT CHARACTER COUNT

textMessage.addEventListener("input", () => {

    characterCount.textContent =
        textMessage.value.length + " characters";
});


/* =====================================================
   SEND DATA
===================================================== */

function resetSendButton() {
    sendButton.disabled = false;
    sendButton.innerHTML = "<span>↑</span> Send Data";
}

sendButton.addEventListener("click", () => {

    const ip = receiverIP.value.trim();
    const port = receiverPort.value.trim();

    const isText = activeType === "text";
    const message = textMessage.value.trim();

    if (!ip) {
        updateStatus("Enter the receiver IP address first.", "error");
        return;
    }

    if (!/^[\w.\-]+$/.test(ip)) {
        updateStatus("That IP address looks invalid.", "error");
        return;
    }

    if (!port || Number(port) < 1 || Number(port) > 65535) {
        updateStatus("Enter a valid receiver port.", "error");
        return;
    }

    if (isText && !message) {
        updateStatus("Please enter a text message.", "error");
        return;
    }

    if (!isText && selectedFiles.length === 0) {
        updateStatus("Please select at least one file.", "error");
        return;
    }

    const formData = new FormData();

    if (isText) {
        formData.append("text", message);
        formData.append("type", "text");
    } else {
        selectedFiles.forEach(file => {
            formData.append("files", file);
        });

        formData.append("type", activeType);
    }

    formData.append("medium", transferMedium.value);
    formData.append("protocol", transferProtocol.value);

    const serverURL = `http://${ip}:${port}/api/upload`;

    const xhr = new XMLHttpRequest();

    xhr.open("POST", serverURL);

    sendButton.disabled = true;
    sendButton.textContent = "Sending...";

    progressContainer.style.display = "block";
    progressBar.style.width = "0%";
    progressPercentage.textContent = "0%";

    updateStatus("Connecting to receiver...");

    xhr.upload.addEventListener("progress", event => {

        if (event.lengthComputable) {

            const progress = Math.round((event.loaded / event.total) * 100);

            progressBar.style.width = progress + "%";
            progressPercentage.textContent = progress + "%";

            updateStatus("Transferring data... " + progress + "%");
        }
    });

    xhr.onload = () => {

        resetSendButton();

        try {

            const response = JSON.parse(xhr.responseText);

            if (xhr.status >= 200 && xhr.status < 300 && response.success) {

                progressBar.style.width = "100%";
                progressPercentage.textContent = "100%";

                updateStatus("Data successfully delivered to receiver!", "success");

                if (isText) {
                    textMessage.value = "";
                    characterCount.textContent = "0 characters";
                } else {
                    selectedFiles = [];
                    renderFiles();
                }

            } else {

                updateStatus(response.message || "Transfer failed.", "error");
            }

        } catch (error) {

            updateStatus("Invalid response from receiver.", "error");
        }
    };

    xhr.onerror = () => {

        resetSendButton();

        updateStatus(
            "Connection failed. Check receiver IP, same Wi-Fi, and that server.py is running.",
            "error"
        );
    };

    xhr.onabort = () => {

        resetSendButton();

        updateStatus("Transfer cancelled.", "error");
    };

    xhr.send(formData);
});


// INITIALIZATION

renderFiles();

updateFileAccept();

progressContainer.style.display = "block";