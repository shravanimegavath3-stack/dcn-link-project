const receiverIPValue = document.getElementById("receiverIPValue");
const receiverPortValue = document.getElementById("receiverPortValue");
const receiverURL = document.getElementById("receiverURL");

const copyIP = document.getElementById("copyIP");
const copyAddress = document.getElementById("copyAddress");
const copyMessage = document.getElementById("copyMessage");

const incomingList = document.getElementById("incomingList");
const incomingCount = document.getElementById("incomingCount");
const clearIncoming = document.getElementById("clearIncoming");

const historyList = document.getElementById("historyList");
const historyCount = document.getElementById("historyCount");
const clearHistory = document.getElementById("clearHistory");

const serverDot = document.getElementById("serverDot");
const serverText = document.getElementById("serverText");

let receiverInfo = null;
let lastIncomingSig = "";
let lastHistorySig = "";


// FORMAT HELPERS

function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function formatTime(ms) {
    return new Date(ms).toLocaleString([], {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}


// COPY TO CLIPBOARD (works on plain http too)

async function copyText(text) {

    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (error) {
        // fall through to the legacy method
    }

    const box = document.createElement("textarea");
    box.value = text;
    box.style.position = "fixed";
    box.style.opacity = "0";
    document.body.appendChild(box);
    box.select();

    let ok = false;

    try {
        ok = document.execCommand("copy");
    } catch (error) {
        ok = false;
    }

    box.remove();
    return ok;
}

function flashMessage(text) {

    const original = "Both devices must be on the same network (Wi-Fi or hotspot).";

    copyMessage.textContent = text;

    setTimeout(() => {
        copyMessage.textContent = original;
    }, 2200);
}

copyIP.addEventListener("click", async () => {

    if (!receiverInfo) return;

    const ok = await copyText(receiverInfo.ip);

    flashMessage(ok ? "IP address copied." : "Copy failed. Select it manually.");
});

copyAddress.addEventListener("click", async () => {

    if (!receiverInfo) return;

    const ok = await copyText(receiverInfo.ip + ":" + receiverInfo.port);

    flashMessage(ok ? "IP and port copied." : "Copy failed. Select it manually.");
});


// SERVER STATUS (navbar pill)

function setOnline(online) {

    serverDot.classList.toggle("offline", !online);

    serverText.textContent = online ? "Receiver Mode" : "Server Offline";
}


// LOAD RECEIVER ADDRESS

async function loadInfo() {

    try {

        const response = await fetch("/api/info", { cache: "no-store" });

        receiverInfo = await response.json();

        receiverIPValue.textContent = receiverInfo.ip;
        receiverPortValue.textContent = receiverInfo.port;
        receiverURL.textContent = receiverInfo.url;

        setOnline(true);

    } catch (error) {

        receiverIPValue.textContent = "Unavailable";
        receiverPortValue.textContent = "—";
        receiverURL.textContent = "Start the receiver with: python server.py";

        setOnline(false);
    }
}


// INCOMING ITEMS

function buildPreview(item) {

    const url = "/files/" + encodeURIComponent(item.stored || "");

    if (item.kind === "image") {
        const img = document.createElement("img");
        img.className = "incoming-preview";
        img.src = url;
        img.alt = item.name;
        img.loading = "lazy";
        return img;
    }

    if (item.kind === "audio") {
        const audio = document.createElement("audio");
        audio.className = "incoming-media";
        audio.controls = true;
        audio.preload = "none";
        audio.src = url;
        return audio;
    }

    if (item.kind === "video") {
        const video = document.createElement("video");
        video.className = "incoming-preview";
        video.controls = true;
        video.preload = "metadata";
        video.src = url;
        return video;
    }

    if (item.kind === "text") {
        const text = document.createElement("pre");
        text.className = "incoming-text";
        text.textContent = item.text;
        return text;
    }

    return null;
}

function buildItem(item) {

    const card = document.createElement("div");
    card.className = "incoming-item";

    const top = document.createElement("div");
    top.className = "incoming-top";

    const title = document.createElement("h4");
    title.textContent = item.name;

    const badge = document.createElement("span");
    badge.className = "type-badge";
    badge.textContent = item.kind.toUpperCase();

    top.appendChild(title);
    top.appendChild(badge);

    if (item.downloads > 0) {
        const tag = document.createElement("span");
        tag.className = "downloaded-tag";
        tag.textContent = "Downloaded ×" + item.downloads;
        top.appendChild(tag);
    }

    const meta = document.createElement("p");
    meta.textContent =
        formatSize(item.size) +
        " · from " + item.sender +
        " · via " + item.medium +
        " · " + formatTime(item.time);

    card.appendChild(top);
    card.appendChild(meta);

    const preview = buildPreview(item);

    if (preview) {
        card.appendChild(preview);
    }

    const actions = document.createElement("div");
    actions.className = "incoming-actions";

    if (item.kind === "text") {

        const copyButton = document.createElement("button");
        copyButton.type = "button";
        copyButton.className = "download-button";
        copyButton.textContent = "Copy Text";

        copyButton.addEventListener("click", async () => {

            const ok = await copyText(item.text);

            copyButton.textContent = ok ? "Copied" : "Copy failed";

            if (ok) {
                fetch("/api/history/" + item.id + "/copied", { method: "POST" })
                    .then(refreshSoon)
                    .catch(() => {});
            }

            setTimeout(() => {
                copyButton.textContent = "Copy Text";
            }, 1500);
        });

        actions.appendChild(copyButton);

    } else {

        const link = document.createElement("a");
        link.className = "download-button";
        link.href = "/files/" + encodeURIComponent(item.stored) + "?download=1";
        link.textContent = "Download";

        // the server logs the download; refresh the lists shortly after
        link.addEventListener("click", refreshSoon);

        actions.appendChild(link);
    }

    card.appendChild(actions);

    return card;
}

function renderIncoming(items) {

    incomingList.innerHTML = "";

    incomingCount.textContent =
        items.length + (items.length === 1 ? " item" : " items");

    if (items.length === 0) {

        incomingList.innerHTML =
            '<p class="empty-message">Waiting for incoming data...</p>';

        return;
    }

    items.forEach(item => {
        incomingList.appendChild(buildItem(item));
    });
}


// DOWNLOAD HISTORY

function buildHistoryEntry(entry) {

    const row = document.createElement("div");
    row.className = "history-item";

    const main = document.createElement("div");
    main.className = "history-main";

    const name = document.createElement("h4");
    name.textContent = entry.name;

    const meta = document.createElement("p");
    meta.textContent =
        entry.kind.toUpperCase() +
        " · " + formatSize(entry.size) +
        " · by " + entry.by +
        " · " + formatTime(entry.time);

    main.appendChild(name);
    main.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "history-actions";

    const badge = document.createElement("span");
    badge.className = "history-badge" + (entry.action === "copied" ? " copied" : "");
    badge.textContent = entry.action === "copied" ? "COPIED" : "DOWNLOADED";
    actions.appendChild(badge);

    if (entry.action === "downloaded" && entry.available) {
        const again = document.createElement("a");
        again.className = "download-button";
        again.href = "/files/" + encodeURIComponent(entry.stored) + "?download=1";
        again.textContent = "Download again";
        again.addEventListener("click", refreshSoon);
        actions.appendChild(again);
    }

    row.appendChild(main);
    row.appendChild(actions);

    return row;
}

function renderHistory(entries) {

    historyList.innerHTML = "";

    historyCount.textContent =
        entries.length + (entries.length === 1 ? " entry" : " entries");

    if (entries.length === 0) {

        historyList.innerHTML =
            '<p class="empty-message">No downloads yet.</p>';

        return;
    }

    entries.forEach(entry => {
        historyList.appendChild(buildHistoryEntry(entry));
    });
}


// POLL FOR NEW DATA + HISTORY

async function poll() {

    try {

        const [incomingResponse, historyResponse] = await Promise.all([
            fetch("/api/incoming", { cache: "no-store" }),
            fetch("/api/history", { cache: "no-store" })
        ]);

        const items = await incomingResponse.json();
        const entries = await historyResponse.json();

        setOnline(true);

        // item.downloads is included so the "Downloaded" tag refreshes too
        const incomingSig = items
            .map(item => item.id + ":" + item.downloads)
            .join(",");

        if (incomingSig !== lastIncomingSig) {
            lastIncomingSig = incomingSig;
            renderIncoming(items);
        }

        const historySig = entries.map(entry => entry.id).join(",");

        if (historySig !== lastHistorySig) {
            lastHistorySig = historySig;
            renderHistory(entries);
        }

    } catch (error) {

        setOnline(false);
    }
}

function refreshSoon() {
    setTimeout(poll, 700);
}


// CLEAR BUTTONS

clearIncoming.addEventListener("click", async () => {

    try {
        await fetch("/api/incoming", { method: "DELETE" });
    } catch (error) {
        // ignore, poll will show the offline state
    }

    lastIncomingSig = "";

    poll();
});

clearHistory.addEventListener("click", async () => {

    if (!confirm("Clear the whole download history?")) return;

    try {
        await fetch("/api/history", { method: "DELETE" });
    } catch (error) {
        // ignore, poll will show the offline state
    }

    lastHistorySig = "";

    poll();
});


// INITIALIZATION

loadInfo();

poll();

setInterval(poll, 2000);