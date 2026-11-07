
const $ = id => document.getElementById(id);
const Q = s => document.querySelectorAll(s);

const esc = s =>
    String(s).replace(/[&<>"]/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;'
    }[c]));

const now = () => new Date().toLocaleTimeString('en-GB');

const fmt = b =>
    b < 1024
        ? b + ' B'
        : b < 1048576
            ? (b / 1024).toFixed(0) + ' KB'
            : b < 1073741824
                ? (b / 1048576).toFixed(1) + ' MB'
                : (b / 1073741824).toFixed(2) + ' GB';

const fmtT = s =>
    s < 1
        ? (s * 1000).toFixed(1) + ' ms'
        : s < 60
            ? s.toFixed(1) + ' s'
            : (s / 60).toFixed(1) + ' min';

const fmtR = g =>
    g >= 1
        ? g + ' Gbps'
        : g >= 0.001
            ? (g * 1000) + ' Mbps'
            : (g * 1e6) + ' kbps';

/* Channel thresholds and interface data */

const TH = 0.05;
const REC = 0.15;

const RATE = {
    fso: 10,
    mm: 5,
    wifi: 1,
    cell: 0.1,
    lora: 0.00005
};

const NAME = {
    fso: 'FSO 1550 nm',
    mm: 'mmWave',
    wifi: 'Wi-Fi 6/7',
    cell: '4G/5G/6G',
    lora: 'LoRa/LoRaWAN'
};

const ACC = {
    file: '*/*',
    image: 'image/*',
    video: 'video/*'
};

const LBL = {
    file: 'files',
    image: 'images',
    video: 'videos'
};

const TAG = {
    file: 'file',
    image: 'img',
    video: 'vid',
    text: 'txt'
};

const IFS = [
    ['FSO 1550 nm', '1–5 km', '10–100+ Gbps', 'Primary ultra-high-speed link'],
    ['mmWave', '200 m–1 km', '1–10 Gbps', 'Directional backup in fog'],
    ['Wi-Fi 6/7', '30–200 m', '1–9.6 Gbps', 'Local high-speed'],
    ['4G/5G/6G', '1–10 km', '0.1–10 Gbps', 'Wide-area backup'],
    ['Sub-6 GHz RF', '2–15 km', '50 Mbps–1 Gbps', 'Control signalling'],
    ['LoRa/LoRaWAN', '5–15 km', '0.3–50 kbps', 'Telemetry, weather sensing'],
    ['Satellite/NTN', '500+ km', '10 Mbps–1 Gbps', 'Remote coverage'],
    ['LiFi', '1–10 m', '1–10 Gbps', 'Secure indoor optical'],
    ['BLE', '10–100 m', '1–2 Mbps', 'Provisioning, alignment'],
    ['ZigBee', '10–100 m', '250 kbps', 'Sensor mesh']
];

/* Application state */

let db = [
    {
        id: 1,
        time: '10:02:11',
        role: 'sent',
        proto: 'TCP',
        message: 'Hello from Node-A'
    },
    {
        id: 2,
        time: '10:02:12',
        role: 'received',
        proto: 'TCP',
        message: 'Hello from Node-A'
    }
];

let inbox = [];
let items = [];
let nid = 0;
let kind = 'file';
let proto = 'TCP';
let sending = false;
let listening = true;
let filt = 'all';

const dbAdd = (role, p, message) =>
    db.push({
        id: db.length + 1,
        time: now(),
        role,
        proto: p,
        message
    });

/* Navigation and page routing */

const SEC = [
    'transmit',
    'how',
    'features',
    'modes',
    'channel',
    'interfaces',
    'faq'
];

const PG = ['receive', 'database'];

function show(t) {
    t = PG.includes(t) || SEC.includes(t) ? t : 'transmit';

    const pg = PG.includes(t) ? t : 'home';

    Q('.pg').forEach(x => {
        x.classList.toggle('on', x.id === 'p-' + pg);
    });

    Q('.nv').forEach(x => {
        x.classList.toggle('on', x.dataset.go === t);
    });

    try {
        history.replaceState(null, '', '#' + t);
    } catch (e) {}

    renderAll();

    const el = pg === 'home' && $(t);

    if (el) {
        el.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    } else {
        window.scrollTo(0, 0);
    }
}

document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]');

    if (g) {
        e.preventDefault();
        show(g.dataset.go);
    }
});

window.addEventListener('hashchange', () => {
    show(location.hash.slice(1));
});

/* Transmitter: channel mode selection */

function curMode(h) {
    return h >= REC
        ? ['fso', 'FSO primary', 'm-fso', 'fso']
        : h >= TH
            ? ['hyb', 'Hybrid / RF offload', 'm-hyb', 'mm']
            : ['rf', 'RF only', 'm-rf', 'wifi'];
}

/* Transmitter: render interface and file queue */

function renderTx() {
    const h = +$('hc').value;

    $('hcv').textContent = h.toFixed(2);

    const [mk, lbl, cls, auto] = curMode(h);

    $('pill').textContent = lbl;
    $('pill').className = 'mode ' + cls;

    $('dot').style.opacity = h < TH ? 0.15 : h < REC ? 0.5 : 1;
    $('arc').style.opacity = h < TH ? 0.25 : 1;

    Q('#modes-cards .mc').forEach(c => {
        c.classList.toggle('on', c.dataset.m === mk);
    });

    const on =
        mk === 'fso'
            ? [0]
            : mk === 'hyb'
                ? [0, 1, 2]
                : [1, 2, 3];

    const bk =
        mk === 'fso'
            ? [1]
            : mk === 'hyb'
                ? [3]
                : [4, 6];

    $('iftbl').innerHTML =
        '<div class="tr h l">' +
            '<span class="c1">#</span>' +
            '<span class="c2" style="font-family:var(--sans);font-size:13px">interface</span>' +
            '<span class="c3">range</span>' +
            '<span class="c4">max rate</span>' +
            '<span class="c5">purpose</span>' +
        '</div>' +

        IFS.map((r, i) =>
            `<div class="tr ${
                on.includes(i) ? 'on' : bk.includes(i) ? 'bk' : ''
            }">
                <span class="c1">${i + 1}</span>
                <span class="c2">
                    ${r[0]}
                    ${on.includes(i) ? '<span class="tag">ACTIVE</span>' : ''}
                </span>
                <span class="c3">${r[1]}</span>
                <span class="c4">${r[2]}</span>
                <span class="c5">${r[3]}</span>
            </div>`
        ).join('');

    const all = items.slice();

    if ($('msg').value.trim()) {
        all.push({
            id: 't',
            kind: 'text',
            name: 'Message.txt',
            size: new Blob([$('msg').value]).size
        });
    }

    const total = all.reduce((a, x) => a + x.size, 0);

    $('q').style.display = all.length ? 'block' : 'none';

    $('qsum').textContent =
        all.length +
        (all.length === 1 ? ' item' : ' items') +
        ' · ' +
        fmt(total);

    $('list').innerHTML = all.map(x => {
        let t = TAG[x.kind];

        if (x.url && x.kind === 'image') {
            t = `<img src="${x.url}" alt="">`;
        } else if (x.url && x.kind === 'video') {
            t = `<video src="${x.url}" muted></video>`;
        }

        return `
            <div class="row">
                <div class="th">${t}</div>
                <span class="m" title="${esc(x.name)}">
                    ${esc(x.name)}
                </span>
                <span class="t">${fmt(x.size)}</span>
                ${
                    x.id === 't'
                        ? ''
                        : `<button class="rm" data-id="${x.id}" aria-label="Remove">✕</button>`
                }
            </div>
        `;
    }).join('');

    const sel = $('ifc').value;
    const use = sel === 'auto' ? auto : sel;
    const g = RATE[use];

    let e =
        `<span>via <b>${NAME[use]}${sel === 'auto' ? ' (auto)' : ''}</b></span>` +
        `<span><b>${fmtR(g)}</b></span>` +
        `<span>${
            total
                ? 'est. <b>' + fmtT(total * 8 / (g * 1e9)) + '</b>'
                : 'nothing queued'
        }</span>`;

    if (use === 'fso' && h < TH) {
        e += '<span class="warn">FSO is below the outage threshold – transfer may stall.</span>';
    } else if (use === 'lora' && total > 1e6) {
        e += '<span class="warn">LoRa is telemetry-only – large transfers are impractical.</span>';
    }

    $('est').innerHTML = e;
    $('send').disabled = !total || sending;

    const rec = db
        .filter(r => r.role === 'sent')
        .slice(-3)
        .reverse();

    $('recent').innerHTML = $('showdb').checked
        ? rec.map(r =>
            `<div class="row">
                <span class="m">${esc(r.message)}</span>
                <span class="t">${r.proto} · ${r.time}</span>
            </div>`
        ).join('')
        : '';
}

/* Transmitter: add and select files */

function addFiles(l) {
    for (const f of l) {
        const k = f.type.startsWith('image/')
            ? 'image'
            : f.type.startsWith('video/')
                ? 'video'
                : 'file';

        items.push({
            id: ++nid,
            kind: k,
            name: f.webkitRelativePath || f.name,
            size: f.size,
            url: k === 'file' ? null : URL.createObjectURL(f)
        });
    }

    renderTx();
}

function openPicker() {
    $('pick').accept = ACC[kind];
    $('pick').click();
}

$('tabs').onclick = e => {
    const t = e.target.closest('.tab');

    if (!t) return;

    Q('.tab').forEach(x => {
        x.classList.toggle('on', x === t);
    });

    kind = t.dataset.k;

    const T = kind === 'text';

    $('drop').style.display = T ? 'none' : 'block';
    $('txt').style.display = T ? 'block' : 'none';

    if (T) {
        $('msg').focus();
    } else {
        $('dropT').textContent = 'Start · tap to choose ' + LBL[kind];
        openPicker();
    }
};

$('drop').onclick = openPicker;

$('pick').onchange = e => {
    addFiles(e.target.files);
    e.target.value = '';
};

/* Drag-and-drop upload */

['dragenter', 'dragover'].forEach(n => {
    $('drop').addEventListener(n, e => {
        e.preventDefault();
        $('drop').classList.add('over');
    });
});

['dragleave', 'drop'].forEach(n => {
    $('drop').addEventListener(n, e => {
        e.preventDefault();
        $('drop').classList.remove('over');
    });
});

$('drop').addEventListener('drop', e => {
    addFiles(e.dataTransfer.files);
});

/* Remove and clear queued files */

$('list').onclick = e => {
    const b = e.target.closest('.rm');

    if (!b) return;

    const i = items.findIndex(x => x.id == b.dataset.id);

    if (i > -1) {
        if (items[i].url) {
            URL.revokeObjectURL(items[i].url);
        }

        items.splice(i, 1);
        renderTx();
    }
};

$('clear').onclick = () => {
    items.forEach(x => {
        if (x.url) URL.revokeObjectURL(x.url);
    });

    items = [];
    $('msg').value = '';

    renderTx();
};

/* Transmitter: input listeners */

['hc', 'ifc', 'msg', 'showdb'].forEach(i => {
    $(i).addEventListener('input', renderTx);
});

/* TCP and UDP selection */

function setProto(p) {
    proto = p;

    $('tcp').className = p === 'TCP' ? 'pill' : 'ghost';
    $('udp').className = p === 'UDP' ? 'pill' : 'ghost';
}

$('tcp').onclick = () => setProto('TCP');
$('udp').onclick = () => setProto('UDP');

setProto('TCP');

/* Transmitter: simulate sending and delivery */

$('send').onclick = () => {
    if (sending) return;

    sending = true;
    renderTx();

    const pk = items.map(x => x.name + ' · ' + fmt(x.size));

    if ($('msg').value.trim()) {
        pk.unshift($('msg').value.trim());
    }

    const total =
        items.reduce((a, x) => a + x.size, 0) +
        new Blob([$('msg').value]).size;

    const dur = Math.max(
        1500,
        Math.min(6000, total / 1e6 * 40)
    );

    const t0 = performance.now();

    $('prog').style.display = 'block';
    $('res').style.display = 'none';

    (function step() {
        const p = Math.min(1, (performance.now() - t0) / dur);

        $('bar').style.width = p * 100 + '%';

        if (p < 1) {
            return requestAnimationFrame(step);
        }

        sending = false;
        $('prog').style.display = 'none';

        const via = $('est').querySelector('b').textContent;

        pk.forEach(m => {
            if ($('store').checked) {
                dbAdd('sent', proto, m);
            }

            if (listening) {
                inbox.unshift({
                    message: m,
                    proto,
                    time: now()
                });

                if ($('rsave').checked) {
                    dbAdd('received', proto, m);
                }
            }
        });

        const link =
            'https://dcnlink.example/t/' +
            Math.random().toString(36).slice(2, 8);

        $('res').innerHTML =
            '<span class="l">delivered · ' +
            proto +
            ' · ' +
            esc(via) +
            '</span>' +
            '<span class="ser">' +
            link +
            '</span>' +
            '<button class="ghost sm" id="cp">Copy link</button>';

        $('res').style.display = 'block';

        $('last').textContent = 'last packet · delivered · ' + now();

        $('cp').onclick = () => {
            try {
                navigator.clipboard.writeText(link);
                $('cp').textContent = 'Copied';
            } catch (e) {}
        };

        renderAll();
    })();
};

/* Channel model: parameters */

const CHF = [
    ['hl', 'h<sub>l</sub> geometric', 'aperture / beam', 0.4],
    ['ha', 'h<sub>a</sub> atmospheric', 'e<sup>−σL</sup>', 0.9],
    ['he', 'h<sub>e</sub> turbulence', 'Rytov', 0.92],
    ['hp', 'h<sub>p</sub> pointing', 'jitter', 0.85],
    ['hb', 'h<sub>b</sub> building sway', 'tilt', 0.95],
    ['ho', 'h<sub>obs</sub> obstruction', 'blocked area', 1]
];

$('chs').innerHTML =
    CHF.map(f =>
        `<div class="sl">
            <label>${f[1]} <i>${f[2]}</i></label>
            <input
                type="range"
                id="c_${f[0]}"
                min="0.01"
                max="1"
                step="0.01"
                value="${f[3]}"
            >
            <output></output>
        </div>`
    ).join('') +

    '<div class="sl">' +
        '<label>SNR₀ <i>dB at h<sub>c</sub> = 1</i></label>' +
        '<input type="range" id="c_s0" min="20" max="60" step="1" value="40">' +
        '<output></output>' +
    '</div>';

/* Channel model: BER approximation */

const erfc = x => {
    const t = 1 / (1 + 0.3275911 * Math.abs(x));

    const y =
        t *
        (
            0.254829592 +
            t *
            (
                -0.284496736 +
                t *
                (
                    1.421413741 +
                    t *
                    (
                        -1.453152027 +
                        t * 1.061405429
                    )
                )
            )
        ) *
        Math.exp(-x * x);

    return x >= 0 ? y : 2 - y;
};

let chHc = 0.3;

/* Channel model: calculate metrics */

function renderCh() {
    let hc = 1;

    CHF.forEach(f => {
        const v = +$('c_' + f[0]).value;

        hc *= v;

        $('c_' + f[0]).nextElementSibling.textContent =
            v.toFixed(2);
    });

    const s0 = +$('c_s0').value;

    $('c_s0').nextElementSibling.textContent = s0 + ' dB';

    const snr0 = Math.pow(10, s0 / 10);
    const g = hc * hc * snr0;
    const ber = 0.5 * erfc(Math.sqrt(g) / Math.SQRT2);

    chHc = hc;

    $('khc').textContent = hc.toFixed(4);

    $('ksnr').textContent =
        (10 * Math.log10(Math.max(g, 1e-9))).toFixed(1) + ' dB';

    $('kber').textContent =
        ber < 1e-12 ? '< 1e-12' : ber.toExponential(1);

    $('kmode').textContent = curMode(hc)[1];

    $('kth').innerHTML =
        'Calculated h<sub>th</sub> = √(22.6 / SNR₀) = ' +
        '<b style="color:var(--cream)">' +
        Math.sqrt(22.6 / snr0).toFixed(4) +
        '</b> for this SNR₀; the design thresholds are 0.05 and 0.15.';
}

Q('#chs input').forEach(i => {
    i.addEventListener('input', renderCh);
});

$('usech').onclick = () => {
    $('hc').value = Math.max(0.01, Math.min(1, chHc)).toFixed(2);

    renderTx();
    show('transmit');
};

/* Receiver: inbox and search results */

function renderRx() {
    $('inbox').innerHTML = inbox.length
        ? inbox.slice(0, 8).map(r =>
            `<div class="row">
                <span class="m">${esc(r.message)}</span>
                <span class="t">${r.proto} · ${r.time}</span>
            </div>`
        ).join('')
        : '<div class="row"><span class="m dim">[ waiting for a packet ]</span><span class="t">—</span></div>';

    const q = $('rq').value.toLowerCase();

    $('rres').innerHTML = $('rlook').checked
        ? db.filter(r =>
            !q ||
            (r.message + r.time).toLowerCase().includes(q)
        ).slice(-4).reverse().map(r =>
            `<div class="row">
                <span class="m">${esc(r.message)}</span>
                <span class="t">${r.role} · ${r.time}</span>
            </div>`
        ).join('') || '<div class="row"><span class="m dim">no matches</span></div>'
        : '';

    $('rring').classList.toggle('off', !listening);

    $('ltoggle').textContent = listening ? 'Pause' : 'Resume';
}

$('ltoggle').onclick = () => {
    listening = !listening;
    renderRx();
};

['rq', 'rlook'].forEach(i => {
    $(i).addEventListener('input', renderRx);
});

$('rsearch').onclick = () => {
    $('s').value = $('rq').value;
    show('database');
};

/* Database: render and filter records */

function renderDb() {
    const q = $('s').value.toLowerCase();

    const rows = db.filter(r =>
        (filt === 'all' || r.role === filt) &&
        (
            !q ||
            (r.message + r.time + r.role + r.proto)
                .toLowerCase()
                .includes(q)
        )
    ).slice().reverse();

    $('rows').innerHTML =
        '<div class="tr h l">' +
            '<span class="c1">id</span>' +
            '<span class="c2">time</span>' +
            '<span class="c3">role</span>' +
            '<span class="c4">proto</span>' +
            '<span class="c5" style="font-family:var(--sans);font-size:13px;color:var(--muted)">message</span>' +
        '</div>' +

        (
            rows.map(r =>
                `<div class="tr">
                    <span class="c1">${r.id}</span>
                    <span class="c2">${r.time}</span>
                    <span class="c3">${r.role}</span>
                    <span class="c4">${r.proto}</span>
                    <span class="c5">${esc(r.message)}</span>
                </div>`
            ).join('') ||
            '<div class="tr dim">No rows match.</div>'
        );

    Q('[data-f]').forEach(b => {
        b.className = b.dataset.f === filt ? 'pill' : 'ghost';
    });
}

Q('[data-f]').forEach(b => {
    b.onclick = () => {
        filt = b.dataset.f;
        renderDb();
    };
});

$('s').addEventListener('input', renderDb);

/* Database: manually add a record */

$('store2').onclick = () => {
    const v = $('n').value.trim();

    if (!v) return;

    dbAdd('sent', proto, v);

    $('n').value = '';

    renderAll();
};

$('n').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        $('store2').click();
    }
});

/* Render all application sections */

function renderAll() {
    renderTx();
    renderRx();
    renderDb();
}

/* Initialize application */

renderCh();

show((location.hash || '#transmit').slice(1));
