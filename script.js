/* =========================================================
   STEPA MANAGEMENT — FULL SCRIPT
   Kompatibel dengan index.html + style.css STEPA yang dikirim.

   Backend Apps Script:
   https://script.google.com/macros/s/AKfycbxYeIYi85RfKBRPuey7v7Z7c9aJ3Iw6MSx9iAmsDuOYsHOEad6jJY2cvvu3aQYvB5q_Dw/exec

   Fitur:
   - Login Google Apps Script / Sheet Users
   - Role Pengurus / Anggota
   - Kas
   - Absensi
   - Calon Anggota
   - Upload Excel / CSV (tersimpan di browser)
   - Manajemen akun untuk Pengurus
   ========================================================= */

const API_URL = "https://script.google.com/macros/s/AKfycbxYeIYi85RfKBRPuey7v7Z7c9aJ3Iw6MSx9iAmsDuOYsHOEad6jJY2cvvu3aQYvB5q_Dw/exec";
const SESSION_KEY = "stepa_user";
const LOCAL_ANGGOTA_KEY = "stepa_uploaded_anggota_v1";

let currentUser = null;
let data = { anggota: [], kas: [], absensi: [] };
let xlsxPromise = null;
let toastTimer = null;

const $ = (id) => document.getElementById(id);

function esc(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function rupiah(value) {
    return "Rp" + (Number(value) || 0).toLocaleString("id-ID");
}

function isPengurus() {
    return String(currentUser?.role || "").trim().toLowerCase() === "pengurus";
}

function authParams() {
    return {
        username: currentUser?.username || "",
        password: currentUser?.password || ""
    };
}

function toast(message) {
    const el = $("toast");
    if (!el) {
        alert(message);
        return;
    }
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
}

function setLoginMessage(message, error = true) {
    const el = $("loginMessage");
    if (!el) return;
    el.textContent = message || "";
    el.style.color = error ? "#dc2626" : "#16a34a";
}

/* =========================================================
   API JSONP
   ========================================================= */
function api(action, params = {}) {
    return new Promise((resolve, reject) => {
        const callbackName = "stepa_cb_" + Date.now() + "_" + Math.random().toString(36).slice(2);
        const script = document.createElement("script");
        const query = new URLSearchParams({ action, ...params, callback: callbackName });
        let finished = false;

        const cleanup = () => {
            clearTimeout(timeout);
            try { delete window[callbackName]; } catch (_) {}
            script.remove();
        };

        const timeout = setTimeout(() => {
            if (finished) return;
            finished = true;
            cleanup();
            reject(new Error("Koneksi ke server timeout. Coba lagi."));
        }, 20000);

        window[callbackName] = (result) => {
            if (finished) return;
            finished = true;
            cleanup();
            if (result && result.success) resolve(result);
            else reject(new Error(result?.message || "Permintaan gagal."));
        };

        script.onerror = () => {
            if (finished) return;
            finished = true;
            cleanup();
            reject(new Error("Gagal terhubung ke Google Apps Script."));
        };

        script.src = API_URL + "?" + query.toString();
        document.body.appendChild(script);
    });
}

/* =========================================================
   LOGIN / SESSION
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
    bindStaticEvents();
    checkSession();
});

function bindStaticEvents() {
    $("loginForm")?.addEventListener("submit", login);

    $("showPassword")?.addEventListener("click", () => {
        const password = $("password");
        if (!password) return;
        password.type = password.type === "password" ? "text" : "password";
    });

    $("logoutBtn")?.addEventListener("click", logout);
    $("refreshBtn")?.addEventListener("click", async () => {
        await loadData(true);
    });

    $("addKasBtn")?.addEventListener("click", () => openModal("kasModal"));
    $("addAbsensiBtn")?.addEventListener("click", () => openModal("absensiModal"));
    $("kasForm")?.addEventListener("submit", submitKas);
    $("absensiForm")?.addEventListener("submit", submitAbsensi);
    $("syncBtn")?.addEventListener("click", async () => loadData(true));

    document.addEventListener("click", (event) => {
        const nav = event.target.closest(".nav-item[data-page]");
        if (nav) {
            showPage(nav.dataset.page);
            return;
        }

        const pageButton = event.target.closest("[data-page-btn]");
        if (pageButton) {
            showPage(pageButton.dataset.pageBtn);
            return;
        }

        const close = event.target.closest("[data-close]");
        if (close) {
            closeModal(close.dataset.close);
        }
    });
}

function checkSession() {
    try {
        const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
        if (!saved?.username || !saved?.password) {
            showLogin();
            return;
        }
        currentUser = saved;
        showApp();
    } catch (_) {
        logout();
    }
}

function showLogin() {
    $("loginPage")?.classList.remove("hidden");
    $("loginPage")?.style.setProperty("display", "flex");
    $("appPage")?.classList.add("hidden");
    $("appPage")?.style.setProperty("display", "none");
}

function showApp() {
    $("loginPage")?.classList.add("hidden");
    $("loginPage")?.style.setProperty("display", "none");
    $("appPage")?.classList.remove("hidden");
    $("appPage")?.style.setProperty("display", "flex");

    updateUserInfo();
    applyRoleUI();
    ensureAccountMenu();
    showPage("dashboard");
    loadData();
}

async function login(event) {
    event.preventDefault();
    const username = $("username")?.value.trim();
    const password = $("password")?.value || "";

    setLoginMessage("");
    if (!username || !password) {
        setLoginMessage("Username dan password wajib diisi.");
        return;
    }

    const button = event.submitter || document.querySelector("#loginForm button[type='submit']");
    const oldText = button?.textContent;
    if (button) {
        button.disabled = true;
        button.textContent = "Memeriksa...";
    }

    try {
        const result = await api("login", { username, password });
        currentUser = {
            username: result.data.username,
            password,
            nama: result.data.nama,
            role: result.data.role
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
        setLoginMessage("");
        showApp();
        toast("Login berhasil.");
    } catch (error) {
        setLoginMessage(error.message || "Username atau password salah.");
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = oldText || "Masuk";
        }
    }
}

function logout() {
    currentUser = null;
    data = { anggota: [], kas: [], absensi: [] };
    localStorage.removeItem(SESSION_KEY);
    showLogin();
}

function updateUserInfo() {
    if ($("userName")) $("userName").textContent = currentUser?.nama || currentUser?.username || "Pengguna";
    if ($("userRole")) $("userRole").textContent = currentUser?.role || "Anggota";
    if ($("userAvatar")) $("userAvatar").textContent = (currentUser?.nama || currentUser?.username || "U").charAt(0).toUpperCase();
}

/* =========================================================
   ROLE UI
   ========================================================= */
function applyRoleUI() {
    document.querySelectorAll(".pengurus-only").forEach((el) => {
        el.style.display = isPengurus() ? "" : "none";
    });
}

function ensureAccountMenu() {
    const nav = document.querySelector(".sidebar nav");
    if (!nav || !isPengurus() || $("accountNavItem")) return;

    const button = document.createElement("button");
    button.id = "accountNavItem";
    button.type = "button";
    button.className = "nav-item pengurus-only";
    button.dataset.page = "akun";
    button.innerHTML = "⚙️ <span>Manajemen Akun</span>";
    nav.appendChild(button);

    createAccountPage();
}

function removeAccountMenuIfNeeded() {
    if (isPengurus()) return;
    $("accountNavItem")?.remove();
    $("akunPage")?.remove();
}

/* =========================================================
   PAGE NAVIGATION
   ========================================================= */
function showPage(page) {
    const pages = ["dashboard", "kas", "absensi", "anggota", "akun"];
    if (!pages.includes(page)) page = "dashboard";
    if (page === "akun" && !isPengurus()) page = "dashboard";

    document.querySelectorAll(".page").forEach((el) => el.classList.remove("active-page"));
    const target = $(page + "Page");
    if (target) target.classList.add("active-page");

    document.querySelectorAll(".nav-item[data-page]").forEach((el) => {
        el.classList.toggle("active", el.dataset.page === page);
    });

    const titles = {
        dashboard: ["Dashboard", "Ringkasan kegiatan STEPA"],
        kas: ["Kas STEPA", "Kelola pemasukan dan pengeluaran kas"],
        absensi: ["Absensi", "Catat kehadiran calon anggota STEPA"],
        anggota: ["Calon Anggota", "Data calon anggota STEPA"],
        akun: ["Manajemen Akun", "Kelola username, password, role, dan status akun"]
    };

    if ($("pageTitle")) $("pageTitle").textContent = titles[page][0];
    if ($("pageSubtitle")) $("pageSubtitle").textContent = titles[page][1];

    if (page === "akun") loadUsers();
}

/* =========================================================
   LOAD DATA
   ========================================================= */
async function loadData(showMessage = false) {
    if (!currentUser?.username || !currentUser?.password) return;

    try {
        const result = await api("allData", authParams());
        data = result.data || { anggota: [], kas: [], absensi: [] };

        const uploaded = getLocalAnggota();
        data.anggota = mergeAnggota(data.anggota || [], uploaded);

        renderAll();
        if (showMessage) toast("Data berhasil diperbarui.");
    } catch (error) {
        if (showMessage) toast(error.message);
        console.error("loadData:", error);
    }
}

function mergeAnggota(serverData, localData) {
    const output = [];
    const keys = new Set();
    [...serverData, ...localData].forEach((item) => {
        const key = item.id ? "id:" + item.id : "nama:" + String(item.nama || "").trim().toLowerCase() + "|kelas:" + String(item.kelas || "").trim().toLowerCase();
        if (!keys.has(key)) {
            keys.add(key);
            output.push(item);
        }
    });
    return output;
}

function renderAll() {
    renderDashboard();
    renderKas();
    renderAbsensi();
    renderAnggota();
    populateAbsensiNames();
    applyRoleUI();
}

function calculateKas() {
    let masuk = 0;
    let keluar = 0;

    (data.kas || []).forEach((item) => {
        const nominal = Number(item.nominal) || 0;
        const jenis = String(item.jenis || "").trim().toLowerCase();
        if (jenis === "pemasukan" || jenis === "masuk") masuk += nominal;
        if (jenis === "pengeluaran" || jenis === "keluar") keluar += nominal;
    });

    return { masuk, keluar, saldo: masuk - keluar };
}

function renderDashboard() {
    const kas = calculateKas();
    if ($("statAnggota")) $("statAnggota").textContent = (data.anggota || []).length;
    if ($("statMasuk")) $("statMasuk").textContent = rupiah(kas.masuk);
    if ($("statKeluar")) $("statKeluar").textContent = rupiah(kas.keluar);
    if ($("statSaldo")) $("statSaldo").textContent = rupiah(kas.saldo);

    const absensi = [...(data.absensi || [])].slice(-5).reverse();
    const dashAbsensi = $("dashboardAbsensi");
    if (dashAbsensi) {
        dashAbsensi.innerHTML = absensi.length
            ? absensi.map((item) => `
                <tr>
                    <td>${esc(item.tanggal)}</td>
                    <td>${esc(item.nama)}</td>
                    <td>${esc(item.status)}</td>
                </tr>`).join("")
            : `<tr><td colspan="3">Belum ada data absensi.</td></tr>`;
    }

    const kasRows = [...(data.kas || [])].slice(-5).reverse();
    const dashKas = $("dashboardKas");
    if (dashKas) {
        dashKas.innerHTML = kasRows.length
            ? kasRows.map((item) => `
                <tr>
                    <td>${esc(item.tanggal)}</td>
                    <td>${esc(item.keterangan)}</td>
                    <td>${rupiah(item.nominal)}</td>
                </tr>`).join("")
            : `<tr><td colspan="3">Belum ada transaksi kas.</td></tr>`;
    }
}

/* =========================================================
   KAS
   ========================================================= */
function renderKas() {
    const summary = calculateKas();
    if ($("kasMasuk")) $("kasMasuk").textContent = rupiah(summary.masuk);
    if ($("kasKeluar")) $("kasKeluar").textContent = rupiah(summary.keluar);
    if ($("kasSaldo")) $("kasSaldo").textContent = rupiah(summary.saldo);

    const table = $("kasTable");
    if (!table) return;

    if (!(data.kas || []).length) {
        table.innerHTML = `<tr><td colspan="5">Belum ada catatan kas.</td></tr>`;
        return;
    }

    table.innerHTML = data.kas.map((item) => `
        <tr>
            <td>${esc(item.tanggal)}</td>
            <td>${esc(item.jenis)}</td>
            <td>${esc(item.keterangan)}</td>
            <td>${rupiah(item.nominal)}</td>
            <td class="pengurus-only">
                <button class="small-btn danger-action" type="button" data-delete-kas="${esc(item.id)}">Hapus</button>
            </td>
        </tr>`).join("");

    table.querySelectorAll("[data-delete-kas]").forEach((button) => {
        button.addEventListener("click", () => deleteKas(button.dataset.deleteKas));
    });
}

async function submitKas(event) {
    event.preventDefault();
    if (!isPengurus()) return toast("Anda tidak memiliki akses.");

    const jenis = $("kasJenis")?.value;
    const keterangan = $("kasKeterangan")?.value.trim();
    const nominal = $("kasNominal")?.value;
    if (!jenis || !keterangan || !nominal) return toast("Lengkapi data transaksi.");

    try {
        const result = await api("addKas", {
            ...authParams(),
            jenis,
            keterangan,
            nominal
        });
        $("kasForm")?.reset();
        closeModal("kasModal");
        await loadData();
        toast(result.message || "Kas berhasil ditambahkan.");
    } catch (error) {
        toast(error.message);
    }
}

async function deleteKas(id) {
    if (!isPengurus() || !confirm("Hapus transaksi kas ini?")) return;
    try {
        const result = await api("deleteKas", { ...authParams(), id });
        await loadData();
        toast(result.message || "Transaksi berhasil dihapus.");
    } catch (error) {
        toast(error.message);
    }
}

/* =========================================================
   ABSENSI
   ========================================================= */
function renderAbsensi() {
    const table = $("absensiTable");
    if (!table) return;

    if (!(data.absensi || []).length) {
        table.innerHTML = `<tr><td colspan="5">Belum ada catatan absensi.</td></tr>`;
        return;
    }

    table.innerHTML = data.absensi.map((item) => `
        <tr>
            <td>${esc(item.tanggal)}</td>
            <td>${esc(item.nama)}</td>
            <td>${esc(item.status)}</td>
            <td>${esc(item.keterangan || "-")}</td>
            <td class="pengurus-only">
                <button class="small-btn danger-action" type="button" data-delete-absensi="${esc(item.id)}">Hapus</button>
            </td>
        </tr>`).join("");

    table.querySelectorAll("[data-delete-absensi]").forEach((button) => {
        button.addEventListener("click", () => deleteAbsensi(button.dataset.deleteAbsensi));
    });
}

function populateAbsensiNames() {
    const select = $("absensiNama");
    if (!select) return;

    const oldValue = select.value;
    select.innerHTML = `<option value="">-- Pilih Anggota --</option>`;
    (data.anggota || []).forEach((item) => {
        if (!item.nama) return;
        const option = document.createElement("option");
        option.value = item.nama;
        option.textContent = item.nama + (item.kelas ? " (" + item.kelas + ")" : "");
        select.appendChild(option);
    });
    if ([...select.options].some((o) => o.value === oldValue)) select.value = oldValue;
}

async function submitAbsensi(event) {
    event.preventDefault();
    if (!isPengurus()) return toast("Anda tidak memiliki akses.");

    const tanggal = $("absensiTanggal")?.value;
    const nama = $("absensiNama")?.value;
    const status = $("absensiStatus")?.value;
    const keterangan = $("absensiKeterangan")?.value.trim() || "-";

    if (!tanggal || !nama || !status) return toast("Lengkapi data absensi.");

    try {
        const result = await api("addAbsensi", {
            ...authParams(), tanggal, nama, status, keterangan
        });
        $("absensiForm")?.reset();
        closeModal("absensiModal");
        await loadData();
        toast(result.message || "Absensi berhasil disimpan.");
    } catch (error) {
        toast(error.message);
    }
}

async function deleteAbsensi(id) {
    if (!isPengurus() || !confirm("Hapus data absensi ini?")) return;
    try {
        const result = await api("deleteAbsensi", { ...authParams(), id });
        await loadData();
        toast(result.message || "Absensi berhasil dihapus.");
    } catch (error) {
        toast(error.message);
    }
}

/* =========================================================
   CALON ANGGOTA + UPLOAD EXCEL / CSV
   ========================================================= */
function renderAnggota() {
    const table = $("anggotaTable");
    if (!table) return;

    if (!(data.anggota || []).length) {
        table.innerHTML = `<tr><td colspan="5">Belum ada calon anggota.</td></tr>`;
        return;
    }

    table.innerHTML = data.anggota.map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${esc(item.nama)}</td>
            <td>${esc(item.kelas || "-")}</td>
            <td>${esc(item.hp || "-")}</td>
            <td>${esc(item.status || "Aktif")}</td>
        </tr>`).join("");

    ensureUploadControls();
}

function ensureUploadControls() {
    const page = $("anggotaPage");
    const actions = page?.querySelector(".page-actions");
    if (!actions || !isPengurus() || $("uploadAnggotaBtn")) return;

    const button = document.createElement("button");
    button.id = "uploadAnggotaBtn";
    button.type = "button";
    button.className = "primary-btn pengurus-only";
    button.style.marginLeft = "8px";
    button.textContent = "📁 Upload Excel / CSV";
    button.addEventListener("click", () => $("anggotaFileInput")?.click());
    actions.appendChild(button);

    const input = document.createElement("input");
    input.id = "anggotaFileInput";
    input.type = "file";
    input.accept = ".xlsx,.xls,.csv";
    input.style.display = "none";
    input.addEventListener("change", handleUploadFile);
    document.body.appendChild(input);
}

function getLocalAnggota() {
    try {
        const value = JSON.parse(localStorage.getItem(LOCAL_ANGGOTA_KEY) || "[]");
        return Array.isArray(value) ? value : [];
    } catch (_) {
        return [];
    }
}

function saveLocalAnggota(list) {
    localStorage.setItem(LOCAL_ANGGOTA_KEY, JSON.stringify(list));
}

async function handleUploadFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        let rows = [];
        const lower = file.name.toLowerCase();

        if (lower.endsWith(".csv")) {
            rows = parseCSV(await file.text());
        } else {
            const XLSX = await loadXLSX();
            const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
        }

        const anggota = rows.map(normalizeAnggota).filter((item) => item.nama);
        if (!anggota.length) throw new Error("Tidak menemukan data. Pastikan ada kolom nama.");

        const merged = mergeAnggota(getLocalAnggota(), anggota);
        saveLocalAnggota(merged);
        data.anggota = mergeAnggota(data.anggota || [], anggota);
        renderAll();
        toast(anggota.length + " data anggota berhasil diupload.");
    } catch (error) {
        alert("Upload gagal: " + error.message);
    } finally {
        event.target.value = "";
    }
}

async function loadXLSX() {
    if (window.XLSX) return window.XLSX;
    if (xlsxPromise) return xlsxPromise;

    xlsxPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
        script.onload = () => resolve(window.XLSX);
        script.onerror = () => reject(new Error("Library Excel gagal dimuat."));
        document.head.appendChild(script);
    });

    return xlsxPromise;
}

function parseCSV(text) {
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
    if (!lines.length) return [];

    const delimiter = lines[0].includes(";") ? ";" : ",";
    const headers = splitCSVLine(lines.shift(), delimiter).map((x) => x.trim().toLowerCase());

    return lines.map((line) => {
        const values = splitCSVLine(line, delimiter);
        const obj = {};
        headers.forEach((header, index) => obj[header] = values[index] ?? "");
        return obj;
    });
}

function splitCSVLine(line, delimiter) {
    const result = [];
    let value = "";
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (quoted && line[i + 1] === '"') {
                value += '"';
                i++;
            } else {
                quoted = !quoted;
            }
        } else if (char === delimiter && !quoted) {
            result.push(value.trim());
            value = "";
        } else {
            value += char;
        }
    }
    result.push(value.trim());
    return result;
}

function normalizeAnggota(row) {
    const get = (...names) => {
        for (const name of names) {
            const key = Object.keys(row).find((k) => String(k).trim().toLowerCase() === name);
            if (key && String(row[key]).trim() !== "") return row[key];
        }
        return "";
    };

    return {
        id: get("id") || "UP-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        nama: String(get("nama", "name", "nama lengkap")).trim(),
        kelas: String(get("kelas", "class")).trim() || "-",
        hp: String(get("hp", "no hp", "no. hp", "nohp", "telepon", "no telepon")).trim() || "-",
        status: String(get("status")).trim() || "Aktif"
    };
}

/* =========================================================
   MODAL
   ========================================================= */
function openModal(id) {
    $(id)?.classList.add("show");
}

function closeModal(id) {
    $(id)?.classList.remove("show");
}

window.openModal = openModal;
window.closeModal = closeModal;
window.showPage = showPage;

/* =========================================================
   MANAJEMEN AKUN
   ========================================================= */
function createAccountPage() {
    if (!isPengurus() || $("akunPage")) return;

    const main = document.querySelector(".main");
    if (!main) return;

    const section = document.createElement("section");
    section.id = "akunPage";
    section.className = "page";
    section.innerHTML = `
        <div class="page-actions">
            <div>
                <h2>Manajemen Akun</h2>
                <p>Tambah dan ubah username, password, nama, role, serta status akun.</p>
            </div>
            <button id="addAccountBtn" class="primary-btn" type="button">＋ Tambah Akun</button>
        </div>

        <div class="panel">
            <div class="panel-header">
                <div>
                    <h2>Daftar Akun</h2>
                    <p>Perubahan tersimpan langsung ke sheet Users.</p>
                </div>
                <button id="refreshUsersBtn" class="small-btn" type="button">🔄 Refresh</button>
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
                        <tr><td colspan="5">Memuat akun...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="panel" style="margin-top:20px;">
            <div class="panel-header">
                <div>
                    <h2>Ubah Password Saya</h2>
                    <p>Password akun yang sedang login dapat diubah tanpa membuka Google Sheets.</p>
                </div>
            </div>
            <form id="myPasswordForm" style="padding:0 20px 20px;display:grid;gap:10px;max-width:500px;">
                <label>Password Lama</label>
                <input id="myOldPassword" type="password" required placeholder="Password lama">
                <label>Password Baru</label>
                <input id="myNewPassword" type="password" required minlength="4" placeholder="Minimal 4 karakter">
                <button class="primary-btn" type="submit">🔐 Simpan Password</button>
            </form>
        </div>

        <div id="accountModal" class="modal">
            <div class="modal-card">
                <div class="modal-header">
                    <h2 id="accountModalTitle">Tambah Akun</h2>
                    <button class="close-modal" type="button" id="closeAccountModal">×</button>
                </div>
                <form id="accountForm">
                    <input type="hidden" id="accountOldUsername">
                    <label>Username</label>
                    <input id="accountUsername" type="text" required placeholder="Contoh: andi">
                    <label>Password</label>
                    <input id="accountPassword" type="password" placeholder="Password baru / password akun">
                    <small id="accountPasswordHelp" style="color:#64748b;">Wajib saat membuat akun. Saat edit, kosongkan jika tidak ingin mengganti password.</small>
                    <label>Nama</label>
                    <input id="accountName" type="text" required placeholder="Nama pengguna">
                    <label>Role</label>
                    <select id="accountRole" required>
                        <option value="Anggota">Anggota</option>
                        <option value="Pengurus">Pengurus</option>
                    </select>
                    <label>Status</label>
                    <select id="accountActive" required>
                        <option value="TRUE">Aktif</option>
                        <option value="FALSE">Nonaktif</option>
                    </select>
                    <button class="primary-btn" type="submit">💾 Simpan Akun</button>
                </form>
            </div>
        </div>`;

    main.appendChild(section);

    $("addAccountBtn")?.addEventListener("click", () => openAccountForm());
    $("refreshUsersBtn")?.addEventListener("click", loadUsers);
    $("closeAccountModal")?.addEventListener("click", () => closeModal("accountModal"));
    $("accountForm")?.addEventListener("submit", saveAccount);
    $("myPasswordForm")?.addEventListener("submit", changeOwnPassword);

    $("accountModal")?.addEventListener("click", (event) => {
        if (event.target === $("accountModal")) closeModal("accountModal");
    });
}

async function loadUsers() {
    if (!isPengurus() || !$("usersTable")) return;

    $("usersTable").innerHTML = `<tr><td colspan="5">Memuat akun...</td></tr>`;

    try {
        const result = await api("listUsers", authParams());
        const users = result.data || [];

        if (!users.length) {
            $("usersTable").innerHTML = `<tr><td colspan="5">Belum ada akun.</td></tr>`;
            return;
        }

        $("usersTable").innerHTML = users.map((user) => {
            const self = String(user.username).toLowerCase() === String(currentUser.username).toLowerCase();
            return `
                <tr>
                    <td><strong>${esc(user.username)}</strong>${self ? " <small>(Anda)</small>" : ""}</td>
                    <td>${esc(user.nama)}</td>
                    <td>${esc(user.role)}</td>
                    <td>${user.aktif ? '<span style="color:#16a34a;font-weight:700;">Aktif</span>' : '<span style="color:#dc2626;font-weight:700;">Nonaktif</span>'}</td>
                    <td>
                        <button class="small-btn" type="button" data-edit-user="${encodeURIComponent(JSON.stringify(user))}">✏️ Edit</button>
                        ${self ? "" : `<button class="small-btn danger-action" type="button" data-delete-user="${esc(user.username)}">🗑️ Hapus</button>`}
                    </td>
                </tr>`;
        }).join("");

        $("usersTable").querySelectorAll("[data-edit-user]").forEach((button) => {
            button.addEventListener("click", () => {
                const user = JSON.parse(decodeURIComponent(button.dataset.editUser));
                openAccountForm(user);
            });
        });

        $("usersTable").querySelectorAll("[data-delete-user]").forEach((button) => {
            button.addEventListener("click", () => deleteUser(button.dataset.deleteUser));
        });
    } catch (error) {
        $("usersTable").innerHTML = `<tr><td colspan="5">Gagal memuat akun: ${esc(error.message)}</td></tr>`;
    }
}

function openAccountForm(user = null) {
    $("accountOldUsername").value = user?.username || "";
    $("accountUsername").value = user?.username || "";
    $("accountPassword").value = "";
    $("accountName").value = user?.nama || "";
    $("accountRole").value = user?.role || "Anggota";
    $("accountActive").value = user?.aktif === false ? "FALSE" : "TRUE";
    $("accountModalTitle").textContent = user ? "Edit Akun" : "Tambah Akun";
    $("accountPassword").required = !user;
    $("accountPasswordHelp").textContent = user
        ? "Kosongkan jika password tidak ingin diubah."
        : "Wajib saat membuat akun. Minimal 4 karakter.";
    openModal("accountModal");
}

async function saveAccount(event) {
    event.preventDefault();
    if (!isPengurus()) return toast("Anda tidak memiliki akses.");

    const oldUsername = $("accountOldUsername").value.trim();
    const username = $("accountUsername").value.trim();
    const password = $("accountPassword").value;
    const nama = $("accountName").value.trim();
    const role = $("accountRole").value;
    const aktif = $("accountActive").value;

    if (!username || !nama) return toast("Username dan nama wajib diisi.");
    if (!oldUsername && password.length < 4) return toast("Password minimal 4 karakter.");
    if (oldUsername && password && password.length < 4) return toast("Password minimal 4 karakter.");

    try {
        const action = oldUsername ? "updateUser" : "addUser";
        const result = await api(action, {
            ...authParams(),
            oldUsername,
            username,
            password,
            nama,
            role,
            aktif
        });

        if (oldUsername && oldUsername.toLowerCase() === currentUser.username.toLowerCase()) {
            currentUser.username = username;
            currentUser.nama = nama;
            currentUser.role = role;
            if (password) currentUser.password = password;
            localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
            updateUserInfo();
        }

        closeModal("accountModal");
        await loadUsers();
        applyRoleUI();
        toast(result.message || "Akun berhasil disimpan.");
    } catch (error) {
        toast(error.message);
    }
}

async function deleteUser(username) {
    if (!isPengurus()) return;
    if (String(username).toLowerCase() === String(currentUser.username).toLowerCase()) {
        toast("Akun yang sedang digunakan tidak boleh dihapus.");
        return;
    }
    if (!confirm("Hapus akun " + username + "?")) return;

    try {
        const result = await api("deleteUser", {
            ...authParams(),
            username,
            requester: currentUser.username
        });
        await loadUsers();
        toast(result.message || "Akun berhasil dihapus.");
    } catch (error) {
        toast(error.message);
    }
}

async function changeOwnPassword(event) {
    event.preventDefault();
    const oldPassword = $("myOldPassword").value;
    const newPassword = $("myNewPassword").value;
    if (newPassword.length < 4) return toast("Password baru minimal 4 karakter.");

    try {
        const result = await api("changePassword", {
            ...authParams(),
            username: currentUser.username,
            oldPassword,
            newPassword
        });
        currentUser.password = newPassword;
        localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
        event.target.reset();
        toast(result.message || "Password berhasil diubah.");
    } catch (error) {
        toast(error.message);
    }
}

/* Jalankan pembersihan jika role berubah menjadi Anggota setelah edit akun sendiri. */
function refreshRoleAfterEdit() {
    applyRoleUI();
    if (!isPengurus()) {
        removeAccountMenuIfNeeded();
        showPage("dashboard");
    }
}
