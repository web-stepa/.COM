/* =====================================================
   STEPA MANAGEMENT - script.js FULL
   Login + Role + Dashboard + Kas + Absensi +
   Calon Anggota + Upload Excel/CSV
   ===================================================== */

const API_URL = "https://script.google.com/macros/s/AKfycbxYeIYi85RfKBRPuey7v7Z7c9aJ3Iw6MSx9iAmsDuOYsHOEad6jJY2cvvu3aQYvB5q_Dw/exec";

const LOCAL_ANGGOTA_KEY = "stepa_uploaded_anggota_v1";

let currentUser = null;

let data = {
    anggota: [],
    kas: [],
    absensi: []
};


/* =====================================================
   INIT
   ===================================================== */

document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    setupUploadAnggota();
    checkSession();
});


/* =====================================================
   API JSONP
   ===================================================== */

function callAPI(action, params = {}) {
    return new Promise((resolve, reject) => {
        const callbackName =
            "stepa_cb_" + Date.now() + "_" +
            Math.floor(Math.random() * 100000);

        const query = new URLSearchParams({
            action,
            callback: callbackName,
            ...params
        });

        const script = document.createElement("script");
        script.src = API_URL + "?" + query.toString();

        let done = false;

        const cleanup = () => {
            clearTimeout(timeout);
            if (window[callbackName]) delete window[callbackName];
            if (script.parentNode) script.parentNode.removeChild(script);
        };

        const timeout = setTimeout(() => {
            if (done) return;
            done = true;
            cleanup();
            reject(new Error("Koneksi ke Google Apps Script timeout."));
        }, 15000);

        window[callbackName] = (response) => {
            if (done) return;
            done = true;
            cleanup();

            if (response?.success) {
                resolve(response);
            } else {
                reject(new Error(response?.message || "Permintaan gagal."));
            }
        };

        script.onerror = () => {
            if (done) return;
            done = true;
            cleanup();
            reject(new Error("Tidak dapat terhubung ke Google Apps Script."));
        };

        document.body.appendChild(script);
    });
}


/* =====================================================
   UTILITIES
   ===================================================== */

function $(id) {
    return document.getElementById(id);
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatRupiah(value) {
    return "Rp" + (Number(value) || 0).toLocaleString("id-ID");
}

function showToast(message) {
    const toast = $("toast");

    if (!toast) {
        console.log(message);
        return;
    }

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(window.stepaToastTimer);
    window.stepaToastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function openModal(id) {
    const modal = $(id);
    if (modal) modal.classList.add("show");
}

function closeModal(id) {
    const modal = $(id);
    if (modal) modal.classList.remove("show");
}

function isPengurus() {
    return String(currentUser?.role || "").toLowerCase() === "pengurus";
}


/* =====================================================
   SESSION / LOGIN
   ===================================================== */

function checkSession() {
    const saved = localStorage.getItem("stepa_user");

    if (!saved) {
        showLoginPage();
        return;
    }

    try {
        currentUser = JSON.parse(saved);

        if (!currentUser?.username) {
            throw new Error("Session tidak valid.");
        }

        showMainApp();
    } catch (error) {
        localStorage.removeItem("stepa_user");
        currentUser = null;
        showLoginPage();
    }
}

function showLoginPage() {
    const loginPage = $("loginPage");
    const appPage = $("appPage");

    if (loginPage) {
        loginPage.style.display = "flex";
    }

    if (appPage) {
        appPage.classList.add("hidden");
        appPage.style.display = "none";
    }
}

function showMainApp() {
    const loginPage = $("loginPage");
    const appPage = $("appPage");

    if (loginPage) loginPage.style.display = "none";

    if (appPage) {
        appPage.classList.remove("hidden");
        appPage.style.display = "";
    }

    updateUserInfo();
    setupUserRoleUI();
    showPage("dashboard");
    loadAllData();
}

function updateUserInfo() {
    if (!currentUser) return;

    const nama = currentUser.nama || currentUser.username || "Pengguna";
    const role = currentUser.role || "Anggota";

    if ($("userName")) $("userName").textContent = nama;
    if ($("userRole")) $("userRole").textContent = role;

    if ($("userAvatar")) {
        $("userAvatar").textContent = nama.charAt(0).toUpperCase();
    }
}

function setupUserRoleUI() {
    document.querySelectorAll(".pengurus-only").forEach((element) => {
        element.style.display = isPengurus() ? "" : "none";
    });
}


/* =====================================================
   NAVIGASI
   ===================================================== */

function showPage(pageName) {
    const validPages = ["dashboard", "kas", "absensi", "anggota"];

    if (!validPages.includes(pageName)) {
        pageName = "dashboard";
    }

    document.querySelectorAll(".page").forEach((page) => {
        page.classList.remove("active-page");
    });

    const target = $(pageName + "Page");
    if (target) target.classList.add("active-page");

    document.querySelectorAll(".nav-item").forEach((item) => {
        item.classList.toggle("active", item.dataset.page === pageName);
    });

    const titles = {
        dashboard: ["Dashboard", "Ringkasan kegiatan STEPA"],
        kas: ["Kas STEPA", "Kelola pemasukan dan pengeluaran kas"],
        absensi: ["Absensi", "Catat kehadiran calon anggota STEPA"],
        anggota: ["Calon Anggota", "Data calon anggota STEPA"]
    };

    const title = titles[pageName];

    if ($("pageTitle")) $("pageTitle").textContent = title[0];
    if ($("pageSubtitle")) $("pageSubtitle").textContent = title[1];

    if (pageName === "dashboard") renderDashboard();
    if (pageName === "kas") renderKas();
    if (pageName === "absensi") {
        renderAbsensi();
        populateAbsensiNames();
    }
    if (pageName === "anggota") {
        renderAnggota();
        setupUploadAnggota();
    }
}


/* =====================================================
   EVENT LISTENERS
   ===================================================== */

function setupEventListeners() {
    const loginForm = $("loginForm");
    if (loginForm && !loginForm.dataset.bound) {
        loginForm.addEventListener("submit", handleLogin);
        loginForm.dataset.bound = "true";
    }

    const showPassword = $("showPassword");
    if (showPassword && !showPassword.dataset.bound) {
        showPassword.addEventListener("click", () => {
            const password = $("password");
            if (!password) return;

            if (password.type === "password") {
                password.type = "text";
                showPassword.textContent = "🙈";
            } else {
                password.type = "password";
                showPassword.textContent = "👁";
            }
        });
        showPassword.dataset.bound = "true";
    }

    const logoutBtn = $("logoutBtn");
    if (logoutBtn && !logoutBtn.dataset.bound) {
        logoutBtn.addEventListener("click", handleLogout);
        logoutBtn.dataset.bound = "true";
    }

    document.querySelectorAll(".nav-item").forEach((button) => {
        if (button.dataset.bound) return;

        button.addEventListener("click", () => {
            showPage(button.dataset.page);
        });

        button.dataset.bound = "true";
    });

    document.querySelectorAll("[data-page-btn]").forEach((button) => {
        if (button.dataset.bound) return;

        button.addEventListener("click", () => {
            showPage(button.dataset.pageBtn);
        });

        button.dataset.bound = "true";
    });

    const refreshBtn = $("refreshBtn");
    if (refreshBtn && !refreshBtn.dataset.bound) {
        refreshBtn.addEventListener("click", async () => {
            await loadAllData();
            showToast("Data berhasil diperbarui.");
        });
        refreshBtn.dataset.bound = "true";
    }

    const syncBtn = $("syncBtn");
    if (syncBtn && !syncBtn.dataset.bound) {
        syncBtn.addEventListener("click", syncData);
        syncBtn.dataset.bound = "true";
    }

    document.querySelectorAll(".close-modal").forEach((button) => {
        if (button.dataset.bound) return;

        button.addEventListener("click", () => {
            closeModal(button.dataset.close);
        });

        button.dataset.bound = "true";
    });

    document.querySelectorAll(".modal").forEach((modal) => {
        if (modal.dataset.bound) return;

        modal.addEventListener("click", (event) => {
            if (event.target === modal) modal.classList.remove("show");
        });

        modal.dataset.bound = "true";
    });

    const kasForm = $("kasForm");
    if (kasForm && !kasForm.dataset.bound) {
        kasForm.addEventListener("submit", handleAddKas);
        kasForm.dataset.bound = "true";
    }

    const addKasBtn = $("addKasBtn");
    if (addKasBtn && !addKasBtn.dataset.bound) {
        addKasBtn.addEventListener("click", () => {
            if (!isPengurus()) {
                showToast("Hanya pengurus yang dapat menginput kas.");
                return;
            }
            openModal("kasModal");
        });
        addKasBtn.dataset.bound = "true";
    }

    const absensiForm = $("absensiForm");
    if (absensiForm && !absensiForm.dataset.bound) {
        absensiForm.addEventListener("submit", handleAddAbsensi);
        absensiForm.dataset.bound = "true";
    }

    const addAbsensiBtn = $("addAbsensiBtn");
    if (addAbsensiBtn && !addAbsensiBtn.dataset.bound) {
        addAbsensiBtn.addEventListener("click", () => {
            if (!isPengurus()) {
                showToast("Hanya pengurus yang dapat menginput absensi.");
                return;
            }
            populateAbsensiNames();
            openModal("absensiModal");
        });
        addAbsensiBtn.dataset.bound = "true";
    }
}


/* =====================================================
   LOGIN
   ===================================================== */

async function handleLogin(event) {
    event.preventDefault();

    const username = $("username")?.value.trim();
    const password = $("password")?.value.trim();
    const message = $("loginMessage");

    if (!username || !password) {
        if (message) message.textContent = "Username dan password wajib diisi.";
        return;
    }

    if (message) message.textContent = "Sedang masuk...";

    try {
        const response = await callAPI("login", {
            username,
            password
        });

        currentUser = response.data;

        localStorage.setItem(
            "stepa_user",
            JSON.stringify(currentUser)
        );

        if (message) message.textContent = "";

        showMainApp();

        showToast(
            "Login berhasil! Selamat datang " +
            (currentUser.nama || currentUser.username)
        );
    } catch (error) {
        if (message) {
            message.textContent = "Login gagal: " + error.message;
        }

        console.error("STEPA LOGIN ERROR:", error);
    }
}

function handleLogout() {
    localStorage.removeItem("stepa_user");
    currentUser = null;

    data = {
        anggota: [],
        kas: [],
        absensi: []
    };

    if ($("loginForm")) $("loginForm").reset();
    if ($("loginMessage")) $("loginMessage").textContent = "";

    showLoginPage();
}


/* =====================================================
   LOAD DATA
   ===================================================== */

async function loadAllData() {
    if (!currentUser) return;

    try {
        const response = await callAPI("allData");

        const serverData = response.data || {};

        data.kas = Array.isArray(serverData.kas)
            ? serverData.kas
            : [];

        data.absensi = Array.isArray(serverData.absensi)
            ? serverData.absensi
            : [];

        /*
         * Anggota:
         * Data hasil upload Excel/CSV disimpan lokal.
         * Data dari Apps Script tetap dipakai jika ada.
         * Data upload lokal digabung dengan data server.
         */
        const serverAnggota = Array.isArray(serverData.anggota)
            ? serverData.anggota
            : [];

        const localAnggota = getLocalAnggota();

        data.anggota = mergeAnggota(
            serverAnggota,
            localAnggota
        );

        renderAll();
    } catch (error) {
        console.error("LOAD DATA ERROR:", error);

        // Jika API gagal, data upload lokal tetap bisa ditampilkan.
        data.anggota = getLocalAnggota();
        renderAll();

        showToast("Gagal memuat server. Data upload lokal tetap tersedia.");
    }
}

function mergeAnggota(serverAnggota, localAnggota) {
    const result = [];
    const ids = new Set();

    [...serverAnggota, ...localAnggota].forEach((item) => {
        const normalized = normalizeAnggota(item);

        const key =
            normalized.id ||
            (
                normalized.nama.toLowerCase() +
                "|" +
                normalized.kelas.toLowerCase()
            );

        if (!ids.has(key)) {
            ids.add(key);
            result.push(normalized);
        }
    });

    return result;
}


/* =====================================================
   UPLOAD EXCEL / CSV
   ===================================================== */

/*
 * Tidak perlu menambahkan library ke index.html.
 * Script.js akan memuat SheetJS otomatis dari CDN
 * saat tombol Upload File digunakan.
 */

let xlsxLoaderPromise = null;

function loadXLSXLibrary() {
    if (window.XLSX) {
        return Promise.resolve(window.XLSX);
    }

    if (xlsxLoaderPromise) {
        return xlsxLoaderPromise;
    }

    xlsxLoaderPromise = new Promise((resolve, reject) => {
        const existing =
            document.querySelector(
                'script[data-stepa-xlsx="true"]'
            );

        if (existing) {
            existing.addEventListener("load", () => resolve(window.XLSX));
            existing.addEventListener("error", () => reject(
                new Error("Library Excel gagal dimuat.")
            ));
            return;
        }

        const script = document.createElement("script");

        script.src =
            "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

        script.async = true;
        script.dataset.stepaXlsx = "true";

        script.onload = () => {
            if (window.XLSX) {
                resolve(window.XLSX);
            } else {
                reject(
                    new Error("Library XLSX tidak tersedia.")
                );
            }
        };

        script.onerror = () => {
            reject(
                new Error(
                    "Gagal memuat library Excel. Periksa koneksi internet."
                )
            );
        };

        document.head.appendChild(script);
    });

    return xlsxLoaderPromise;
}


function setupUploadAnggota() {
    const table = $("anggotaTable");

    if (!table) return;

    // Cari container terdekat dari tabel.
    const parent =
        table.closest(".table-container") ||
        table.parentElement;

    if (!parent) return;

    let uploadArea =
        $("stepaUploadAnggotaArea");

    if (!uploadArea) {
        uploadArea =
            document.createElement("div");

        uploadArea.id =
            "stepaUploadAnggotaArea";

        uploadArea.style.cssText = `
            display:flex;
            flex-wrap:wrap;
            gap:10px;
            align-items:center;
            margin:0 0 16px 0;
        `;

        parent.parentNode.insertBefore(
            uploadArea,
            parent
        );
    }

    if (!uploadArea.querySelector("#stepaUploadAnggotaBtn")) {
        const button =
            document.createElement("button");

        button.type = "button";
        button.id = "stepaUploadAnggotaBtn";
        button.textContent = "📁 Upload Excel / CSV";

        button.style.cssText = `
            border:0;
            border-radius:10px;
            padding:10px 16px;
            cursor:pointer;
            font-weight:600;
        `;

        button.addEventListener(
            "click",
            openAnggotaFilePicker
        );

        uploadArea.appendChild(button);
    }

    if (!uploadArea.querySelector("#stepaClearLocalAnggotaBtn")) {
        const clearButton =
            document.createElement("button");

        clearButton.type = "button";
        clearButton.id = "stepaClearLocalAnggotaBtn";
        clearButton.textContent = "🗑️ Hapus Data Upload";

        clearButton.style.cssText = `
            border:0;
            border-radius:10px;
            padding:10px 16px;
            cursor:pointer;
            font-weight:600;
        `;

        clearButton.addEventListener(
            "click",
            clearLocalAnggota
        );

        uploadArea.appendChild(clearButton);
    }

    if (!uploadArea.querySelector("#stepaUploadInfo")) {
        const info =
            document.createElement("span");

        info.id = "stepaUploadInfo";

        info.textContent =
            "Format: .xlsx, .xls, atau .csv";

        info.style.cssText = `
            font-size:13px;
            opacity:.75;
        `;

        uploadArea.appendChild(info);
    }

    if (!$("stepaAnggotaFileInput")) {
        const input =
            document.createElement("input");

        input.type = "file";
        input.id = "stepaAnggotaFileInput";
        input.accept = ".xlsx,.xls,.csv,text/csv";
        input.style.display = "none";

        input.addEventListener(
            "change",
            handleAnggotaFile
        );

        document.body.appendChild(input);
    }
}


function openAnggotaFilePicker() {
    if (!isPengurus()) {
        showToast(
            "Hanya pengurus yang dapat mengupload data anggota."
        );
        return;
    }

    const input =
        $("stepaAnggotaFileInput");

    if (input) {
        input.value = "";
        input.click();
    }
}


async function handleAnggotaFile(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!isPengurus()) {
        showToast(
            "Hanya pengurus yang dapat mengupload data anggota."
        );
        return;
    }

    try {
        const extension =
            file.name
                .split(".")
                .pop()
                .toLowerCase();

        if (!["xlsx", "xls", "csv"].includes(extension)) {
            throw new Error(
                "File harus berformat XLSX, XLS, atau CSV."
            );
        }

        showToast("Membaca file...");

        let rows;

        if (extension === "csv") {
            const text =
                await file.text();

            rows =
                parseCSV(text);
        } else {
            const XLSX =
                await loadXLSXLibrary();

            const buffer =
                await file.arrayBuffer();

            const workbook =
                XLSX.read(buffer, {
                    type: "array"
                });

            if (!workbook.SheetNames.length) {
                throw new Error(
                    "Sheet Excel tidak ditemukan."
                );
            }

            const firstSheet =
                workbook.Sheets[
                    workbook.SheetNames[0]
                ];

            rows =
                XLSX.utils.sheet_to_json(
                    firstSheet,
                    {
                        defval: "",
                        raw: false
                    }
                );
        }

        const imported =
            rows
                .map(normalizeAnggota)
                .filter((item) => item.nama);

        if (!imported.length) {
            throw new Error(
                "Tidak ada data anggota yang valid."
            );
        }

        const existing =
            getLocalAnggota();

        const merged =
            mergeAnggota(
                existing,
                imported
            );

        saveLocalAnggota(merged);

        // Gabungkan dengan data server tanpa menimpa upload lokal.
        data.anggota =
            mergeAnggota(
                data.anggota || [],
                imported
            );

        renderAnggota();
        populateAbsensiNames();
        renderDashboard();

        showToast(
            `${imported.length} data anggota berhasil diupload.`
        );

    } catch (error) {
        console.error(
            "UPLOAD ANGGOTA ERROR:",
            error
        );

        alert(
            "Upload gagal:\n\n" +
            error.message
        );
    } finally {
        event.target.value = "";
    }
}


/* =====================================================
   CSV PARSER
   Mendukung koma, titik koma, dan quoted values.
   ===================================================== */

function parseCSV(text) {
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;

    text = String(text || "")
        .replace(/^\uFEFF/, "");

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"') {
            if (quoted && next === '"') {
                value += '"';
                i++;
            } else {
                quoted = !quoted;
            }

            continue;
        }

        if (!quoted && (char === "," || char === ";")) {
            row.push(value.trim());
            value = "";
            continue;
        }

        if (!quoted && char === "\n") {
            row.push(value.trim());

            if (row.some((cell) => cell !== "")) {
                rows.push(row);
            }

            row = [];
            value = "";
            continue;
        }

        if (!quoted && char === "\r") {
            continue;
        }

        value += char;
    }

    row.push(value.trim());

    if (row.some((cell) => cell !== "")) {
        rows.push(row);
    }

    if (!rows.length) return [];

    const headers = rows[0].map(normalizeHeader);

    return rows
        .slice(1)
        .map((cells) => {
            const object = {};

            headers.forEach((header, index) => {
                object[header] =
                    cells[index] ?? "";
            });

            return object;
        });
}


/* =====================================================
   NORMALISASI DATA ANGGOTA
   ===================================================== */

function normalizeHeader(header) {
    return String(header ?? "")
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, "");
}


function getField(object, names) {
    const keys =
        Object.keys(object || {});

    for (const name of names) {
        const wanted =
            normalizeHeader(name);

        const key =
            keys.find(
                (item) =>
                    normalizeHeader(item) === wanted
            );

        if (key !== undefined) {
            return object[key];
        }
    }

    return "";
}


function normalizeAnggota(item) {
    const raw = item || {};

    let id =
        getField(raw, [
            "id",
            "kode",
            "nomor",
            "no"
        ]);

    let nama =
        getField(raw, [
            "nama",
            "namalengkap",
            "name"
        ]);

    let kelas =
        getField(raw, [
            "kelas",
            "class"
        ]);

    let hp =
        getField(raw, [
            "hp",
            "nohp",
            "nomorhp",
            "telepon",
            "telp",
            "whatsapp",
            "wa"
        ]);

    let status =
        getField(raw, [
            "status",
            "keaktifan"
        ]);


    nama = String(nama ?? "").trim();
    kelas = String(kelas ?? "-").trim() || "-";
    hp = String(hp ?? "-").trim() || "-";
    status = String(status ?? "Aktif").trim() || "Aktif";

    if (!id && nama) {
        id =
            "UPLOAD-" +
            Date.now() +
            "-" +
            Math.random()
                .toString(36)
                .slice(2, 7);
    }

    return {
        id: String(id || ""),
        nama,
        kelas,
        hp,
        status
    };
}


function getLocalAnggota() {
    try {
        const saved =
            localStorage.getItem(
                LOCAL_ANGGOTA_KEY
            );

        if (!saved) return [];

        const parsed =
            JSON.parse(saved);

        return Array.isArray(parsed)
            ? parsed.map(normalizeAnggota)
            : [];
    } catch (error) {
        console.error(
            "LOCAL ANGGOTA ERROR:",
            error
        );

        return [];
    }
}


function saveLocalAnggota(list) {
    localStorage.setItem(
        LOCAL_ANGGOTA_KEY,
        JSON.stringify(
            list.map(normalizeAnggota)
        )
    );
}


function clearLocalAnggota() {
    const total =
        getLocalAnggota().length;

    if (!total) {
        showToast(
            "Belum ada data hasil upload."
        );
        return;
    }

    const yes =
        confirm(
            `Hapus ${total} data anggota hasil upload dari browser ini?`
        );

    if (!yes) return;

    localStorage.removeItem(
        LOCAL_ANGGOTA_KEY
    );

    // Setelah data lokal dihapus, tampilkan data server saja.
    loadAllData();

    showToast(
        "Data upload lokal berhasil dihapus."
    );
}


/* =====================================================
   RENDER ANGGOTA
   ===================================================== */

function renderAnggota() {
    const table = $("anggotaTable");
    if (!table) return;

    table.innerHTML = "";

    if (!data.anggota?.length) {
        table.innerHTML = `
            <tr>
                <td colspan="6" class="empty">
                    Belum ada calon anggota.
                </td>
            </tr>
        `;
        return;
    }

    data.anggota.forEach((item, index) => {
        const row =
            document.createElement("tr");

        const status =
            item.status || "Aktif";

        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${escapeHTML(item.nama || "-")}</td>
            <td>${escapeHTML(item.kelas || "-")}</td>
            <td>${escapeHTML(item.hp || "-")}</td>
            <td>
                <span class="badge hadir">
                    ${escapeHTML(status)}
                </span>
            </td>
            <td class="pengurus-only">
                ${
                    isPengurus()
                        ? `
                            <button
                                type="button"
                                class="delete-btn"
                                onclick="deleteLocalAnggota('${escapeHTML(item.id)}')"
                            >
                                Hapus
                            </button>
                        `
                        : ""
                }
            </td>
        `;

        table.appendChild(row);
    });

    setupUserRoleUI();
}


function deleteLocalAnggota(id) {
    if (!isPengurus()) {
        showToast("Anda tidak memiliki akses.");
        return;
    }

    const local =
        getLocalAnggota();

    const found =
        local.find(
            (item) =>
                String(item.id) === String(id)
        );

    if (!found) {
        showToast(
            "Data ini berasal dari server Google Sheets."
        );
        return;
    }

    if (
        !confirm(
            `Hapus data ${found.nama}?`
        )
    ) {
        return;
    }

    const filtered =
        local.filter(
            (item) =>
                String(item.id) !== String(id)
        );

    saveLocalAnggota(filtered);

    data.anggota =
        mergeAnggota(
            data.anggota.filter(
                (item) =>
                    String(item.id) !== String(id)
            ),
            []
        );

    renderAnggota();
    populateAbsensiNames();
    renderDashboard();

    showToast("Data anggota berhasil dihapus.");
}


/* =====================================================
   KAS
   ===================================================== */

function normalizeKasJenis(jenis) {
    const value =
        String(jenis || "")
            .trim()
            .toLowerCase();

    if (
        value === "pemasukan" ||
        value === "masuk"
    ) return "Masuk";

    if (
        value === "pengeluaran" ||
        value === "keluar"
    ) return "Keluar";

    return jenis || "";
}


function getKasTotals() {
    let masuk = 0;
    let keluar = 0;

    (data.kas || []).forEach((item) => {
        const jenis =
            normalizeKasJenis(item.jenis);

        const nominal =
            Number(item.nominal) || 0;

        if (jenis === "Masuk") masuk += nominal;
        if (jenis === "Keluar") keluar += nominal;
    });

    return {
        masuk,
        keluar,
        saldo: masuk - keluar
    };
}


function renderKas() {
    const table = $("kasTable");
    const totals = getKasTotals();

    if (table) {
        table.innerHTML = "";

        if (!data.kas?.length) {
            table.innerHTML = `
                <tr>
                    <td colspan="5" class="empty">
                        Belum ada catatan kas.
                    </td>
                </tr>
            `;
        } else {
            data.kas.forEach((item) => {
                const jenis =
                    normalizeKasJenis(item.jenis);

                const nominal =
                    Number(item.nominal) || 0;

                const row =
                    document.createElement("tr");

                row.innerHTML = `
                    <td>${escapeHTML(item.tanggal || "-")}</td>
                    <td>${escapeHTML(jenis || "-")}</td>
                    <td>${escapeHTML(item.keterangan || "-")}</td>
                    <td>${formatRupiah(nominal)}</td>
                    <td class="pengurus-only">
                        ${
                            isPengurus()
                                ? `
                                    <button
                                        type="button"
                                        class="delete-btn"
                                        onclick="deleteKas('${escapeHTML(item.id)}')"
                                    >
                                        Hapus
                                    </button>
                                `
                                : ""
                        }
                    </td>
                `;

                table.appendChild(row);
            });
        }
    }

    if ($("kasMasuk")) $("kasMasuk").textContent = formatRupiah(totals.masuk);
    if ($("kasKeluar")) $("kasKeluar").textContent = formatRupiah(totals.keluar);
    if ($("kasSaldo")) $("kasSaldo").textContent = formatRupiah(totals.saldo);

    if ($("statMasuk")) $("statMasuk").textContent = formatRupiah(totals.masuk);
    if ($("statKeluar")) $("statKeluar").textContent = formatRupiah(totals.keluar);
    if ($("statSaldo")) $("statSaldo").textContent = formatRupiah(totals.saldo);

    setupUserRoleUI();
}


async function handleAddKas(event) {
    event.preventDefault();

    if (!isPengurus()) {
        showToast("Hanya pengurus yang dapat menambah kas.");
        return;
    }

    const jenis =
        normalizeKasJenis($("kasJenis")?.value);

    const keterangan =
        $("kasKeterangan")?.value.trim();

    const nominal =
        $("kasNominal")?.value;

    if (!jenis || !keterangan || !nominal) {
        showToast("Semua data transaksi wajib diisi.");
        return;
    }

    try {
        await callAPI("addKas", {
            jenis,
            keterangan,
            nominal,
            username: currentUser.username
        });

        closeModal("kasModal");
        event.target.reset();

        await loadAllData();

        showToast("Transaksi kas berhasil disimpan.");
    } catch (error) {
        showToast("Gagal menyimpan kas: " + error.message);
    }
}


async function deleteKas(id) {
    if (!isPengurus()) {
        showToast("Anda tidak memiliki akses.");
        return;
    }

    if (!confirm("Apakah Anda yakin ingin menghapus transaksi ini?")) {
        return;
    }

    try {
        await callAPI("deleteKas", {
            id,
            username: currentUser.username
        });

        await loadAllData();

        showToast("Transaksi berhasil dihapus.");
    } catch (error) {
        showToast("Gagal menghapus transaksi: " + error.message);
    }
}


/* =====================================================
   ABSENSI
   ===================================================== */

function renderAbsensi() {
    const table = $("absensiTable");
    if (!table) return;

    table.innerHTML = "";

    if (!data.absensi?.length) {
        table.innerHTML = `
            <tr>
                <td colspan="5" class="empty">
                    Belum ada catatan absensi.
                </td>
            </tr>
        `;
        return;
    }

    data.absensi.forEach((item) => {
        const status =
            String(item.status || "");

        let badgeClass = "hadir";

        if (
            status.toLowerCase() === "izin" ||
            status.toLowerCase() === "sakit"
        ) {
            badgeClass = "izin";
        }

        if (
            status.toLowerCase() === "alpa"
        ) {
            badgeClass = "alpa";
        }

        const row =
            document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(item.tanggal || "-")}</td>
            <td>${escapeHTML(item.nama || "-")}</td>
            <td>
                <span class="badge ${badgeClass}">
                    ${escapeHTML(status || "-")}
                </span>
            </td>
            <td>${escapeHTML(item.keterangan || "-")}</td>
            <td class="pengurus-only">
                ${
                    isPengurus()
                        ? `
                            <button
                                type="button"
                                class="delete-btn"
                                onclick="deleteAbsensi('${escapeHTML(item.id)}')"
                            >
                                Hapus
                            </button>
                        `
                        : ""
                }
            </td>
        `;

        table.appendChild(row);
    });

    setupUserRoleUI();
}


function populateAbsensiNames() {
    const select = $("absensiNama");
    if (!select) return;

    select.innerHTML =
        `<option value="">-- Pilih Anggota --</option>`;

    if (!data.anggota?.length) {
        select.innerHTML =
            `<option value="">Belum ada calon anggota</option>`;
        return;
    }

    data.anggota.forEach((item) => {
        const option =
            document.createElement("option");

        option.value = item.nama || "";
        option.textContent =
            `${item.nama || "-"} (${item.kelas || "-"})`;

        select.appendChild(option);
    });
}


async function handleAddAbsensi(event) {
    event.preventDefault();

    if (!isPengurus()) {
        showToast("Hanya pengurus yang dapat menginput absensi.");
        return;
    }

    const tanggal = $("absensiTanggal")?.value;
    const nama = $("absensiNama")?.value;
    const status = $("absensiStatus")?.value;
    const keterangan =
        $("absensiKeterangan")?.value.trim();

    if (!tanggal || !nama || !status) {
        showToast("Tanggal, nama, dan status wajib diisi.");
        return;
    }

    try {
        await callAPI("addAbsensi", {
            tanggal,
            nama,
            status,
            keterangan: keterangan || "-",
            username: currentUser.username
        });

        closeModal("absensiModal");
        event.target.reset();

        await loadAllData();

        showToast("Absensi berhasil dicatat.");
    } catch (error) {
        showToast("Gagal menyimpan absensi: " + error.message);
    }
}


async function deleteAbsensi(id) {
    if (!isPengurus()) {
        showToast("Anda tidak memiliki akses.");
        return;
    }

    if (!confirm("Apakah Anda yakin ingin menghapus absensi ini?")) {
        return;
    }

    try {
        await callAPI("deleteAbsensi", {
            id,
            username: currentUser.username
        });

        await loadAllData();

        showToast("Absensi berhasil dihapus.");
    } catch (error) {
        showToast("Gagal menghapus absensi: " + error.message);
    }
}


/* =====================================================
   DASHBOARD
   ===================================================== */

function renderDashboard() {
    const totals = getKasTotals();

    if ($("statAnggota")) {
        $("statAnggota").textContent =
            data.anggota?.length || 0;
    }

    if ($("statMasuk")) {
        $("statMasuk").textContent =
            formatRupiah(totals.masuk);
    }

    if ($("statKeluar")) {
        $("statKeluar").textContent =
            formatRupiah(totals.keluar);
    }

    if ($("statSaldo")) {
        $("statSaldo").textContent =
            formatRupiah(totals.saldo);
    }

    renderDashboardAbsensi();
    renderDashboardKas();
}


function renderDashboardAbsensi() {
    const table = $("dashboardAbsensi");
    if (!table) return;

    table.innerHTML = "";

    const items =
        [...(data.absensi || [])]
            .reverse()
            .slice(0, 5);

    if (!items.length) {
        table.innerHTML = `
            <tr>
                <td colspan="3" class="empty">
                    Belum ada data absensi.
                </td>
            </tr>
        `;
        return;
    }

    items.forEach((item) => {
        const status =
            String(item.status || "");

        let badgeClass = "hadir";

        if (
            status.toLowerCase() === "izin" ||
            status.toLowerCase() === "sakit"
        ) {
            badgeClass = "izin";
        }

        if (status.toLowerCase() === "alpa") {
            badgeClass = "alpa";
        }

        const row =
            document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(item.tanggal || "-")}</td>
            <td>${escapeHTML(item.nama || "-")}</td>
            <td>
                <span class="badge ${badgeClass}">
                    ${escapeHTML(status || "-")}
                </span>
            </td>
        `;

        table.appendChild(row);
    });
}


function renderDashboardKas() {
    const table = $("dashboardKas");
    if (!table) return;

    table.innerHTML = "";

    const items =
        [...(data.kas || [])]
            .reverse()
            .slice(0, 5);

    if (!items.length) {
        table.innerHTML = `
            <tr>
                <td colspan="3" class="empty">
                    Belum ada transaksi kas.
                </td>
            </tr>
        `;
        return;
    }

    items.forEach((item) => {
        const row =
            document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(item.tanggal || "-")}</td>
            <td>${escapeHTML(item.keterangan || "-")}</td>
            <td>${formatRupiah(item.nominal)}</td>
        `;

        table.appendChild(row);
    });
}


/* =====================================================
   SYNC
   ===================================================== */

async function syncData() {
    if (!isPengurus()) {
        showToast(
            "Hanya pengurus yang dapat melakukan sinkronisasi."
        );
        return;
    }

    const button = $("syncBtn");

    if (button) {
        button.disabled = true;
        button.dataset.oldText = button.textContent;
        button.textContent = "⏳ Menyinkronkan...";
    }

    try {
        await loadAllData();
        showToast("Data berhasil disinkronkan.");
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent =
                button.dataset.oldText ||
                "🔄 Sinkronisasi";
        }
    }
}


/* =====================================================
   RENDER SEMUA
   ===================================================== */

function renderAll() {
    renderDashboard();
    renderAnggota();
    renderKas();
    renderAbsensi();
    populateAbsensiNames();
    setupUserRoleUI();
    setupUploadAnggota();
}


/* =====================================================
   GLOBAL
   ===================================================== */

window.deleteKas = deleteKas;
window.deleteAbsensi = deleteAbsensi;
window.deleteLocalAnggota = deleteLocalAnggota;

window.showPage = showPage;
window.openModal = openModal;
window.closeModal = closeModal;
window.syncData = syncData;
window.openAnggotaFilePicker = openAnggotaFilePicker;
