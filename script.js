/* =========================================================
   STEPA MANAGEMENT - SCRIPT.JS
   LOGIN AMAN + KAS + ABSENSI + CALON ANGGOTA
   + UPLOAD EXCEL / CSV
   ========================================================= */

const API_URL = "https://script.google.com/macros/s/AKfycbxYeIYi85RfKBRPuey7v7Z7c9aJ3Iw6MSx9iAmsDuOYsHOEad6jJY2cvvu3aQYvB5q_Dw/exec";

let currentUser = null;
let data = { anggota: [], kas: [], absensi: [] };

const UPLOAD_KEY = "stepa_uploaded_anggota_v2";
let xlsxLoading = null;

/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", () => {
    checkSession();
    setupEventListeners();
});

/* ================= API ================= */

function callAPI(action, params = {}) {
    return new Promise((resolve, reject) => {
        const callbackName =
            "jsonp_cb_" + Date.now() + "_" + Math.floor(Math.random() * 10000);

        const queryParams = new URLSearchParams({
            action,
            callback: callbackName,
            ...params
        });

        const script = document.createElement("script");
        script.src = `${API_URL}?${queryParams.toString()}`;

        const timer = setTimeout(() => {
            cleanup();
            reject(new Error("Koneksi ke Google Apps Script timeout."));
        }, 20000);

        function cleanup() {
            clearTimeout(timer);
            delete window[callbackName];
            if (document.body.contains(script)) script.remove();
        }

        window[callbackName] = function (response) {
            cleanup();

            if (response && response.success) {
                resolve(response);
            } else {
                reject(
                    new Error(
                        response?.message || "Gagal memproses data."
                    )
                );
            }
        };

        script.onerror = function () {
            cleanup();
            reject(new Error("Gagal terhubung ke Google Apps Script."));
        };

        document.body.appendChild(script);
    });
}

/* ================= UI UTILS ================= */

function showToast(message) {
    const toast = document.getElementById("toast");

    if (toast) {
        toast.textContent = message;
        toast.classList.add("show");

        setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    } else {
        alert(message);
    }
}

function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("show");
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("show");
}

/* ================= AUTH ================= */

function checkSession() {
    const saved = localStorage.getItem("stepa_user");

    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            showMainApp();
        } catch {
            localStorage.removeItem("stepa_user");
            showLoginPage();
        }
    } else {
        showLoginPage();
    }
}

function showLoginPage() {
    const login = document.getElementById("loginSection");
    const app = document.getElementById("appSection");

    if (login) login.style.display = "flex";
    if (app) app.style.display = "none";
}

function showMainApp() {
    const login = document.getElementById("loginSection");
    const app = document.getElementById("appSection");

    if (login) login.style.display = "none";
    if (app) app.style.display = "block";

    if (document.getElementById("userDisplayName")) {
        document.getElementById("userDisplayName").textContent =
            currentUser.nama || currentUser.username;
    }

    if (document.getElementById("userRoleBadge")) {
        document.getElementById("userRoleBadge").textContent =
            currentUser.role || "Anggota";
    }

    setupUserRoleUI();
    loadAllData();
}

function setupUserRoleUI() {
    const isPengurus =
        currentUser &&
        String(currentUser.role || "").toLowerCase() === "pengurus";

    document.querySelectorAll(".pengurus-only").forEach(el => {
        el.style.display = isPengurus ? "" : "none";
    });

    setupAccountMenu();
}

/* ================= EVENTS ================= */

function setupEventListeners() {
    const loginForm = document.getElementById("loginForm");
    if (loginForm) loginForm.addEventListener("submit", handleLogin);

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

    const syncBtn = document.getElementById("syncBtn");
    if (syncBtn) syncBtn.addEventListener("click", syncData);

    document.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", e => {
            e.preventDefault();

            const target = link.getAttribute("data-tab");

            document.querySelectorAll(".nav-link")
                .forEach(l => l.classList.remove("active"));

            link.classList.add("active");

            document.querySelectorAll(".tab-content")
                .forEach(tab => tab.style.display = "none");

            const activeTab =
                document.getElementById(target + "Tab");

            if (activeTab) activeTab.style.display = "block";
        });
    });

    document.querySelectorAll(".close-modal").forEach(btn => {
        btn.addEventListener("click", () => {
            closeModal(btn.getAttribute("data-close"));
        });
    });

    const addAnggotaBtn = document.getElementById("addAnggotaBtn");
    if (addAnggotaBtn) {
        addAnggotaBtn.addEventListener("click", () =>
            openModal("anggotaModal")
        );
    }

    const anggotaForm = document.getElementById("anggotaForm");
    if (anggotaForm) {
        anggotaForm.addEventListener("submit", handleAddAnggota);
    }

    const addKasBtn = document.getElementById("addKasBtn");
    if (addKasBtn) {
        addKasBtn.addEventListener("click", () =>
            openModal("kasModal")
        );
    }

    const kasForm = document.getElementById("kasForm");
    if (kasForm) {
        kasForm.addEventListener("submit", handleAddKas);
    }

    const addAbsensiBtn = document.getElementById("addAbsensiBtn");
    if (addAbsensiBtn) {
        addAbsensiBtn.addEventListener("click", () =>
            openModal("absensiModal")
        );
    }

    const absensiForm = document.getElementById("absensiForm");
    if (absensiForm) {
        absensiForm.addEventListener("submit", handleAddAbsensi);
    }
}

/* ================= LOGIN ================= */

async function handleLogin(e) {
    e.preventDefault();

    const u = document.getElementById("username").value.trim();
    const p = document.getElementById("password").value.trim();

    if (!u || !p) {
        showToast("Username dan password wajib diisi.");
        return;
    }

    try {
        const res = await callAPI("login", {
            username: u,
            password: p
        });

        currentUser = {
            ...res.data,
            password: p
        };

        localStorage.setItem(
            "stepa_user",
            JSON.stringify(currentUser)
        );

        showToast("Login berhasil! Selamat datang " + currentUser.nama);
        showMainApp();

    } catch (err) {
        showToast("Login gagal: " + err.message);
    }
}

function handleLogout() {
    localStorage.removeItem("stepa_user");
    currentUser = null;

    showToast("Berhasil logout.");
    showLoginPage();
}

/* ================= DATA ================= */

async function loadAllData() {
    try {
        const res = await callAPI("allData");
        data = res.data || {
            anggota: [],
            kas: [],
            absensi: []
        };

        // Tambahkan data upload lokal.
        const uploaded = getUploadedAnggota();

        data.anggota = mergeAnggota(
            data.anggota || [],
            uploaded
        );

        renderAll();

    } catch (err) {
        showToast("Gagal memuat data: " + err.message);
    }
}

async function syncData() {
    const btn = document.getElementById("syncBtn");

    if (btn) btn.disabled = true;

    showToast("Menyinkronkan data dari Google Sheets...");

    try {
        await loadAllData();
        showToast("Semua data berhasil disinkronkan!");
    } catch (err) {
        showToast("Sinkronisasi gagal: " + err.message);
    } finally {
        if (btn) btn.disabled = false;
    }
}

/* ================= ANGGOTA ================= */

async function handleAddAnggota(e) {
    e.preventDefault();

    const nama =
        document.getElementById("anggotaNama").value.trim();

    const kelas =
        document.getElementById("anggotaKelas").value.trim();

    const hp =
        document.getElementById("anggotaHp").value.trim();

    const status =
        document.getElementById("anggotaStatus").value;

    try {
        await callAPI("addAnggota", {
            nama,
            kelas,
            hp,
            status,
            username: currentUser.username
        });

        closeModal("anggotaModal");
        e.target.reset();

        await loadAllData();

        showToast("Calon anggota berhasil ditambahkan.");

    } catch (err) {
        showToast(err.message);
    }
}

async function deleteAnggota(id) {
    if (!confirm("Apakah Anda yakin ingin menghapus data anggota ini?")) {
        return;
    }

    try {
        await callAPI("deleteAnggota", {
            id,
            username: currentUser.username
        });

        // Hapus juga dari upload lokal bila ada.
        const uploaded = getUploadedAnggota()
            .filter(x => String(x.id) !== String(id));

        saveUploadedAnggota(uploaded);

        await loadAllData();

        showToast("Data anggota berhasil dihapus.");

    } catch (err) {
        showToast(err.message);
    }
}

/* ================= KAS ================= */

async function handleAddKas(e) {
    e.preventDefault();

    const jenis =
        document.getElementById("kasJenis").value;

    const keterangan =
        document.getElementById("kasKeterangan").value.trim();

    const nominal =
        document.getElementById("kasNominal").value;

    try {
        await callAPI("addKas", {
            jenis,
            keterangan,
            nominal,
            username: currentUser.username
        });

        closeModal("kasModal");
        e.target.reset();

        await loadAllData();

        showToast("Transaksi kas berhasil disimpan.");

    } catch (err) {
        showToast(err.message);
    }
}

async function deleteKas(id) {
    if (!confirm("Apakah Anda yakin ingin menghapus data kas ini?")) {
        return;
    }

    try {
        await callAPI("deleteKas", {
            id,
            username: currentUser.username
        });

        await loadAllData();

        showToast("Data kas berhasil dihapus.");

    } catch (err) {
        showToast(err.message);
    }
}

/* ================= ABSENSI ================= */

async function handleAddAbsensi(e) {
    e.preventDefault();

    const tanggal =
        document.getElementById("absensiTanggal").value;

    const select =
        document.getElementById("absensiNamaSelect") ||
        document.getElementById("absensiNama");

    const nama = select ? select.value : "";

    const status =
        document.getElementById("absensiStatus").value;

    const keterangan =
        document.getElementById("absensiKeterangan").value.trim();

    try {
        await callAPI("addAbsensi", {
            tanggal,
            nama,
            status,
            keterangan,
            username: currentUser.username
        });

        closeModal("absensiModal");
        e.target.reset();

        await loadAllData();

        showToast("Absensi berhasil dicatat.");

    } catch (err) {
        showToast(err.message);
    }
}

async function deleteAbsensi(id) {
    if (!confirm("Apakah Anda yakin ingin menghapus data absensi ini?")) {
        return;
    }

    try {
        await callAPI("deleteAbsensi", {
            id,
            username: currentUser.username
        });

        await loadAllData();

        showToast("Data absensi berhasil dihapus.");

    } catch (err) {
        showToast(err.message);
    }
}

/* ================= UPLOAD EXCEL / CSV ================= */

function getUploadedAnggota() {
    try {
        return JSON.parse(
            localStorage.getItem(UPLOAD_KEY) || "[]"
        );
    } catch {
        return [];
    }
}

function saveUploadedAnggota(list) {
    localStorage.setItem(
        UPLOAD_KEY,
        JSON.stringify(list)
    );
}

function mergeAnggota(server, uploaded) {
    const result = [];
    const seen = new Set();

    [...server, ...uploaded].forEach(item => {
        const key =
            String(item.id || "") ||
            (
                String(item.nama || "").toLowerCase() +
                "|" +
                String(item.kelas || "").toLowerCase()
            );

        if (!seen.has(key)) {
            seen.add(key);
            result.push(item);
        }
    });

    return result;
}

function setupUploadAnggota() {
    const page = document.getElementById("anggotaPage");

    if (!page) return;

    // Sudah dibuat.
    if (document.getElementById("uploadExcelBtn")) return;

    const actions =
        page.querySelector(".page-actions");

    if (!actions) return;

    const button = document.createElement("button");
    button.id = "uploadExcelBtn";
    button.type = "button";
    button.className = "primary-btn";
    button.innerHTML = "📁 Upload Excel / CSV";

    const input = document.createElement("input");
    input.id = "uploadExcelInput";
    input.type = "file";
    input.accept = ".xlsx,.xls,.csv";
    input.style.display = "none";

    button.addEventListener("click", () => {
        input.click();
    });

    input.addEventListener("change", handleUploadExcel);

    actions.appendChild(button);
    actions.appendChild(input);
}

function loadSheetJS() {
    if (window.XLSX) {
        return Promise.resolve(window.XLSX);
    }

    if (xlsxLoading) {
        return xlsxLoading;
    }

    xlsxLoading = new Promise((resolve, reject) => {
        const script = document.createElement("script");

        script.src =
            "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

        script.onload = () => resolve(window.XLSX);

        script.onerror = () =>
            reject(
                new Error(
                    "Library Excel gagal dimuat. Periksa koneksi internet."
                )
            );

        document.head.appendChild(script);
    });

    return xlsxLoading;
}

function normalizeHeader(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");
}

function normalizeUploadedRow(row) {
    const clean = {};

    Object.keys(row).forEach(key => {
        clean[normalizeHeader(key)] = row[key];
    });

    const nama =
        clean.nama ||
        clean.name ||
        clean.namacalonanggota ||
        "";

    const kelas =
        clean.kelas ||
        clean.class ||
        "-";

    const hp =
        clean.hp ||
        clean.nohp ||
        clean.nomorhp ||
        clean.telepon ||
        "-";

    const status =
        clean.status ||
        "Aktif";

    return {
        id:
            clean.id ||
            "UP-" +
            Date.now() +
            "-" +
            Math.random().toString(36).slice(2, 8),

        nama: String(nama).trim(),
        kelas: String(kelas).trim(),
        hp: String(hp).trim(),
        status: String(status).trim()
    };
}

function parseCSV(text) {
    const rows = [];
    const lines = text
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .filter(line => line.trim());

    if (!lines.length) return rows;

    // Mendukung CSV koma atau titik koma.
    const delimiter =
        lines[0].includes(";") ? ";" : ",";

    const headers = parseCSVLine(
        lines.shift(),
        delimiter
    ).map(normalizeHeader);

    lines.forEach(line => {
        const values = parseCSVLine(
            line,
            delimiter
        );

        const row = {};

        headers.forEach((header, index) => {
            row[header] = values[index] ?? "";
        });

        rows.push(row);
    });

    return rows;
}

function parseCSVLine(line, delimiter) {
    const result = [];
    let current = "";
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (quoted && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                quoted = !quoted;
            }
        } else if (char === delimiter && !quoted) {
            result.push(current.trim());
            current = "";
        } else {
            current += char;
        }
    }

    result.push(current.trim());

    return result;
}

async function handleUploadExcel(e) {
    const file = e.target.files?.[0];

    if (!file) return;

    try {
        showToast("Membaca file...");

        let rows = [];

        if (
            file.name.toLowerCase().endsWith(".csv")
        ) {
            rows = parseCSV(await file.text());

        } else {
            const XLSX = await loadSheetJS();

            const buffer =
                await file.arrayBuffer();

            const workbook =
                XLSX.read(buffer, {
                    type: "array"
                });

            if (!workbook.SheetNames.length) {
                throw new Error(
                    "File Excel tidak mempunyai sheet."
                );
            }

            const sheet =
                workbook.Sheets[
                    workbook.SheetNames[0]
                ];

            rows =
                XLSX.utils.sheet_to_json(
                    sheet,
                    {
                        defval: ""
                    }
                );
        }

        const imported =
            rows
                .map(normalizeUploadedRow)
                .filter(item => item.nama);

        if (!imported.length) {
            throw new Error(
                "Tidak menemukan data. Pastikan ada kolom 'nama'."
            );
        }

        const old =
            getUploadedAnggota();

        const merged =
            mergeAnggota(old, imported);

        saveUploadedAnggota(merged);

        // Gabungkan langsung ke tampilan.
        data.anggota =
            mergeAnggota(
                data.anggota || [],
                imported
            );

        renderAll();

        showToast(
            `${imported.length} calon anggota berhasil dimuat dari file.`
        );

    } catch (err) {
        alert(
            "Upload gagal:\n\n" +
            (err.message || err)
        );
    } finally {
        e.target.value = "";
    }
}

/* ================= RENDER ================= */

function renderAll() {
    renderAnggota();
    renderKas();
    renderAbsensi();
    populateAbsensiNames();

    setupUserRoleUI();
    setupUploadAnggota();
}

function renderAnggota() {
    const table =
        document.getElementById("anggotaTable");

    if (!table) return;

    table.innerHTML = "";

    if (!data.anggota || !data.anggota.length) {
        table.innerHTML =
            `<tr>
                <td colspan="6" class="empty">
                    Belum ada calon anggota.
                </td>
            </tr>`;

        return;
    }

    data.anggota.forEach((item, index) => {
        const tr =
            document.createElement("tr");

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${escapeHTML(item.nama)}</td>
            <td>${escapeHTML(item.kelas || "-")}</td>
            <td>${escapeHTML(item.hp || "-")}</td>
            <td>
                <span class="badge ${
                    item.status === "Aktif"
                        ? "hadir"
                        : "alpa"
                }">
                    ${escapeHTML(item.status || "Aktif")}
                </span>
            </td>
            <td class="pengurus-only">
                <button
                    class="delete-btn"
                    onclick="deleteAnggota('${escapeJS(item.id)}')">
                    Hapus
                </button>
            </td>
        `;

        table.appendChild(tr);
    });
}

function renderKas() {
    const table =
        document.getElementById("kasTable");

    if (!table) return;

    table.innerHTML = "";

    let totalMasuk = 0;
    let totalKeluar = 0;

    if (!data.kas || !data.kas.length) {
        table.innerHTML =
            `<tr>
                <td colspan="6" class="empty">
                    Belum ada catatan kas.
                </td>
            </tr>`;
    } else {
        data.kas.forEach((item, index) => {
            const nominal =
                Number(item.nominal) || 0;

            if (
                item.jenis === "Masuk" ||
                item.jenis === "Pemasukan"
            ) {
                totalMasuk += nominal;
            } else {
                totalKeluar += nominal;
            }

            const tr =
                document.createElement("tr");

            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${escapeHTML(item.tanggal || "-")}</td>
                <td>
                    <span class="badge ${
                        item.jenis === "Masuk" ||
                        item.jenis === "Pemasukan"
                            ? "hadir"
                            : "alpa"
                    }">
                        ${escapeHTML(item.jenis)}
                    </span>
                </td>
                <td>${escapeHTML(item.keterangan || "-")}</td>
                <td>
                    Rp ${nominal.toLocaleString("id-ID")}
                </td>
                <td class="pengurus-only">
                    <button
                        class="delete-btn"
                        onclick="deleteKas('${escapeJS(item.id)}')">
                        Hapus
                    </button>
                </td>
            `;

            table.appendChild(tr);
        });
    }

    const saldo =
        totalMasuk - totalKeluar;

    if (document.getElementById("totalMasuk")) {
        document.getElementById("totalMasuk").textContent =
            "Rp " +
            totalMasuk.toLocaleString("id-ID");
    }

    if (document.getElementById("totalKeluar")) {
        document.getElementById("totalKeluar").textContent =
            "Rp " +
            totalKeluar.toLocaleString("id-ID");
    }

    if (document.getElementById("sisaSaldo")) {
        document.getElementById("sisaSaldo").textContent =
            "Rp " +
            saldo.toLocaleString("id-ID");
    }

    setupUserRoleUI();
}

function renderAbsensi() {
    const table =
        document.getElementById("absensiTable");

    if (!table) return;

    table.innerHTML = "";

    if (!data.absensi || !data.absensi.length) {
        table.innerHTML =
            `<tr>
                <td colspan="6" class="empty">
                    Belum ada catatan absensi.
                </td>
            </tr>`;

        return;
    }

    data.absensi.forEach((item, index) => {
        let badgeClass = "hadir";

        if (
            item.status === "Izin" ||
            item.status === "Sakit"
        ) {
            badgeClass = "izin";
        } else if (
            item.status === "Alpa"
        ) {
            badgeClass = "alpa";
        }

        const tr =
            document.createElement("tr");

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${escapeHTML(item.tanggal || "-")}</td>
            <td>${escapeHTML(item.nama)}</td>
            <td>
                <span class="badge ${badgeClass}">
                    ${escapeHTML(item.status)}
                </span>
            </td>
            <td>${escapeHTML(item.keterangan || "-")}</td>
            <td class="pengurus-only">
                <button
                    class="delete-btn"
                    onclick="deleteAbsensi('${escapeJS(item.id)}')">
                    Hapus
                </button>
            </td>
        `;

        table.appendChild(tr);
    });

    setupUserRoleUI();
}

function populateAbsensiNames() {
    const select =
        document.getElementById("absensiNamaSelect") ||
        document.getElementById("absensiNama");

    if (!select) return;

    select.innerHTML =
        `<option value="">
            -- Pilih Anggota --
        </option>`;

    if (data.anggota && data.anggota.length) {
        data.anggota.forEach(item => {
            const option =
                document.createElement("option");

            option.value = item.nama;

            option.textContent =
                `${item.nama} (${item.kelas || "-"})`;

            select.appendChild(option);
        });
    }
}

/* ================= ACCOUNT MENU ================= */

function setupAccountMenu() {
    if (!currentUser) return;

    const isPengurus =
        String(currentUser.role || "").toLowerCase() === "pengurus";

    let button =
        document.getElementById("accountMenuBtn");

    if (!isPengurus) {
        if (button) button.remove();
        return;
    }

    if (button) return;

    const nav =
        document.querySelector(".nav-link")?.parentElement;

    if (!nav) return;

    button =
        document.createElement("a");

    button.id = "accountMenuBtn";
    button.href = "#";
    button.className = "nav-link pengurus-only";
    button.setAttribute("data-tab", "akun");

    button.innerHTML =
        "⚙️ <span>Manajemen Akun</span>";

    button.addEventListener("click", e => {
        e.preventDefault();
        openAccountPage();
    });

    nav.appendChild(button);
}

function openAccountPage() {
    let page =
        document.getElementById("akunTab");

    if (!page) {
        page =
            document.createElement("section");

        page.id = "akunTab";
        page.className = "tab-content";

        page.innerHTML = `
            <div class="page-actions">
                <div>
                    <h2>Manajemen Akun</h2>
                    <p>
                        Kelola username, password, nama,
                        role, dan status akun.
                    </p>
                </div>
            </div>

            <div class="panel">
                <div class="panel-header">
                    <h3>Daftar Akun</h3>
                    <button
                        class="primary-btn"
                        id="newAccountBtn">
                        ＋ Tambah Akun
                    </button>
                </div>

                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Nama</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="usersTable">
                            <tr>
                                <td colspan="5">
                                    Memuat akun...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        const app =
            document.getElementById("appSection") ||
            document.querySelector("main") ||
            document.body;

        app.appendChild(page);

        document
            .getElementById("newAccountBtn")
            .addEventListener(
                "click",
                () => showAccountForm()
            );
    }

    document.querySelectorAll(".tab-content")
        .forEach(x => x.style.display = "none");

    page.style.display = "block";

    document.querySelectorAll(".nav-link")
        .forEach(x => x.classList.remove("active"));

    document
        .getElementById("accountMenuBtn")
        ?.classList.add("active");

    loadUsers();
}

async function loadUsers() {
    const table =
        document.getElementById("usersTable");

    if (!table) return;

    try {
        const res =
            await callAPI("listUsers", {
                username: currentUser.username,
                password: currentUser.password
            });

        table.innerHTML = "";

        (res.data || []).forEach(user => {
            const tr =
                document.createElement("tr");

            tr.innerHTML = `
                <td>${escapeHTML(user.username)}</td>
                <td>${escapeHTML(user.nama)}</td>
                <td>${escapeHTML(user.role)}</td>
                <td>${user.aktif ? "Aktif" : "Nonaktif"}</td>
                <td>
                    <button
                        class="primary-btn"
                        onclick='showAccountForm(${JSON.stringify(user)})'>
                        Edit
                    </button>
                    ${
                        user.username.toLowerCase() !==
                        currentUser.username.toLowerCase()
                            ? `
                            <button
                                class="delete-btn"
                                onclick="removeUser('${escapeJS(user.username)}')">
                                Hapus
                            </button>
                            `
                            : ""
                    }
                </td>
            `;

            table.appendChild(tr);
        });

        if (!(res.data || []).length) {
            table.innerHTML =
                `<tr>
                    <td colspan="5">
                        Belum ada akun.
                    </td>
                </tr>`;
        }

    } catch (err) {
        table.innerHTML =
            `<tr>
                <td colspan="5">
                    ${escapeHTML(err.message)}
                </td>
            </tr>`;
    }
}

function showAccountForm(user = null) {
    const old =
        document.getElementById("accountFormModal");

    if (old) old.remove();

    const modal =
        document.createElement("div");

    modal.id = "accountFormModal";
    modal.className = "modal show";

    modal.innerHTML = `
        <div class="modal-card">
            <div class="modal-header">
                <h2>
                    ${user ? "Edit Akun" : "Tambah Akun"}
                </h2>

                <button
                    class="close-modal"
                    type="button"
                    id="closeAccountForm">
                    ×
                </button>
            </div>

            <form id="accountForm">
                <input
                    type="hidden"
                    id="accountOldUsername"
                    value="${escapeHTML(user?.username || "")}">

                <label>Username</label>
                <input
                    id="accountUsername"
                    value="${escapeHTML(user?.username || "")}"
                    required>

                <label>
                    Password
                    ${user
                        ? "(kosongkan jika tidak diubah)"
                        : ""}
                </label>

                <input
                    id="accountPassword"
                    type="password"
                    ${user ? "" : "required"}>

                <label>Nama</label>
                <input
                    id="accountNama"
                    value="${escapeHTML(user?.nama || "")}"
                    required>

                <label>Role</label>
                <select id="accountRole">
                    <option
                        ${user?.role === "Anggota" ? "selected" : ""}>
                        Anggota
                    </option>
                    <option
                        ${user?.role === "Pengurus" ? "selected" : ""}>
                        Pengurus
                    </option>
                </select>

                <label>Status</label>
                <select id="accountAktif">
                    <option
                        value="TRUE"
                        ${user?.aktif !== false ? "selected" : ""}>
                        Aktif
                    </option>
                    <option
                        value="FALSE"
                        ${user?.aktif === false ? "selected" : ""}>
                        Nonaktif
                    </option>
                </select>

                <button
                    class="primary-btn"
                    type="submit">
                    Simpan
                </button>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    document
        .getElementById("closeAccountForm")
        .onclick = () => modal.remove();

    document
        .getElementById("accountForm")
        .onsubmit = saveAccount;
}

async function saveAccount(e) {
    e.preventDefault();

    const oldUsername =
        document.getElementById(
            "accountOldUsername"
        ).value;

    const username =
        document.getElementById(
            "accountUsername"
        ).value.trim();

    const password =
        document.getElementById(
            "accountPassword"
        ).value;

    const nama =
        document.getElementById(
            "accountNama"
        ).value.trim();

    const role =
        document.getElementById(
            "accountRole"
        ).value;

    const aktif =
        document.getElementById(
            "accountAktif"
        ).value;

    try {
        const action =
            oldUsername
                ? "updateUser"
                : "addUser";

        await callAPI(action, {
            username: currentUser.username,
            password: currentUser.password,
            oldUsername,
            oldPassword: currentUser.password,
            newPassword: password,
            nama,
            role,
            aktif
        });

        document
            .getElementById("accountFormModal")
            ?.remove();

        loadUsers();

        showToast("Akun berhasil disimpan.");

    } catch (err) {
        showToast(err.message);
    }
}

async function removeUser(username) {
    if (!confirm(
        "Hapus akun " + username + "?"
    )) return;

    try {
        await callAPI("deleteUser", {
            username: currentUser.username,
            password: currentUser.password,
            requester: currentUser.username,
            oldUsername: username
        });

        loadUsers();

        showToast("Akun berhasil dihapus.");

    } catch (err) {
        showToast(err.message);
    }
}

/* ================= HELPERS ================= */

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeJS(value) {
    return String(value ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");
}

/* ================= GLOBAL ================= */

window.openModal = openModal;
window.closeModal = closeModal;
window.deleteAnggota = deleteAnggota;
window.deleteKas = deleteKas;
window.deleteAbsensi = deleteAbsensi;
window.showAccountForm = showAccountForm;
window.removeUser = removeUser;
window.openAccountPage = openAccountPage;
