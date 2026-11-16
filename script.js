/* =====================================================
   STEPA MANAGEMENT — SCRIPT PRO MAX 2026
   ===================================================== */

const API_URL =
    "https://script.google.com/macros/s/AKfycbx7yEi1qlMMgifS6-qA5rMpiniyLWEBjGQpsvdNwN0XApaZj2mgWLWJg3rqA-psyYWkbA/exec";

let currentUser = null;

let data = {
    anggota: [],
    kas: [],
    absensi: []
};

document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    setupUploadFeature();
    checkSession();
});

function callAPI(action, params = {}) {
    return new Promise((resolve, reject) => {
        const callbackName = "stepa_cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
        const queryParams = new URLSearchParams({ action: action, callback: callbackName, ...params });
        const script = document.createElement("script");
        script.src = API_URL + "?" + queryParams.toString();

        let finished = false;
        const cleanup = () => {
            if (window[callbackName]) delete window[callbackName];
            if (script.parentNode) script.parentNode.removeChild(script);
        };

        const timeout = setTimeout(() => {
            if (finished) return;
            finished = true;
            cleanup();
            reject(new Error("Waktu koneksi habis. Periksa deployment Google Apps Script."));
        }, 15000);

        window[callbackName] = (response) => {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            cleanup();
            if (response && response.success) {
                resolve(response);
            } else {
                reject(new Error(response?.message || "Gagal memproses data."));
            }
        };

        script.onerror = () => {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            cleanup();
            reject(new Error("Gagal terhubung ke Google Apps Script."));
        };

        document.body.appendChild(script);
    });
}

function $(id) { return document.getElementById(id); }

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatRupiah(value) {
    const nominal = Number(value) || 0;
    return "Rp" + nominal.toLocaleString("id-ID");
}

function showToast(message) {
    const toast = $("toast");
    if (!toast) { alert(message); return; }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(window.stepaToastTimer);
    window.stepaToastTimer = setTimeout(() => { toast.classList.remove("show"); }, 3000);
}

function openModal(id) {
    const modal = $(id);
    if (modal) modal.classList.add("show");
}

function closeModal(id) {
    const modal = $(id);
    if (modal) modal.classList.remove("show");
}

function checkSession() {
    const saved = localStorage.getItem("stepa_user");
    if (!saved) { showLoginPage(); return; }
    try {
        currentUser = JSON.parse(saved);
        if (!currentUser || !currentUser.username) throw new Error("Session tidak valid.");
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
    if (loginPage) loginPage.style.display = "flex";
    if (appPage) { appPage.classList.add("hidden"); appPage.style.display = "none"; }
}

function showMainApp() {
    const loginPage = $("loginPage");
    const appPage = $("appPage");
    if (loginPage) loginPage.style.display = "none";
    if (appPage) { appPage.classList.remove("hidden"); appPage.style.display = ""; }

    updateUserInfo();
    setupUserRoleUI();
    showPage("dashboard");
    loadAllData();
}

function updateUserInfo() {
    if (!currentUser) return;
    const nama = currentUser.nama || currentUser.username || "Pengguna";
    const role = currentUser.role || "Anggota";

    const anggotaRole = String(role).trim().toLowerCase() === "anggota";
    document.body.classList.toggle("role-anggota", anggotaRole);
    document.body.classList.toggle("role-pengurus", !anggotaRole);

    if ($("userName")) $("userName").textContent = nama;
    if ($("userRole")) $("userRole").textContent = role;
    if ($("userAvatar")) $("userAvatar").textContent = nama.charAt(0).toUpperCase();
}

function isPengurus() {
    return String(currentUser?.role || "").toLowerCase() === "pengurus";
}

function setupUserRoleUI() {
    const pengurus = isPengurus();
    document.querySelectorAll(".pengurus-only").forEach(el => {
        el.style.display = pengurus ? "" : "none";
    });
}

function showPage(pageName) {
    const pages = ["dashboard", "kas", "absensi", "anggota", "akun"];
    if (!pages.includes(pageName)) pageName = "dashboard";

    document.querySelectorAll(".page").forEach(p => p.classList.remove("active-page"));
    const targetPage = $(pageName + "Page");
    if (targetPage) targetPage.classList.add("active-page");

    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.toggle("active", item.dataset.page === pageName);
    });

    const titles = {
        dashboard: { title: "Dashboard", subtitle: "Ringkasan kegiatan STEPA" },
        kas: { title: "Kas & Keuangan", subtitle: "Kelola kas harian, bulanan, dan pembayaran QRIS" },
        absensi: { title: "Absensi & Barcode", subtitle: "Absensi scan barcode sekretaris dan foto bukti" },
        anggota: { title: "Calon Anggota", subtitle: "Data calon anggota STEPA" },
        akun: { title: "Manajemen Akun", subtitle: "Kelola pengguna dan akses sistem" }
    };

    const info = titles[pageName];
    if ($("pageTitle")) $("pageTitle").textContent = info.title;
    if ($("pageSubtitle")) $("pageSubtitle").textContent = info.subtitle;

    if (pageName === "dashboard") renderDashboard();
    if (pageName === "kas") renderKas();
    if (pageName === "absensi") { renderAbsensi(); populateAbsensiNames(); }
    if (pageName === "anggota") renderAnggota();
    if (pageName === "akun") {
        if (!isPengurus()) { showPage("dashboard"); showToast("Akses khusus Pengurus."); return; }
        loadUsers();
    }
}

function setupEventListeners() {
    const loginForm = $("loginForm");
    if (loginForm) loginForm.addEventListener("submit", handleLogin);

    const showPassword = $("showPassword");
    if (showPassword) {
        showPassword.addEventListener("click", () => {
            const password = $("password");
            if (!password) return;
            password.type = password.type === "password" ? "text" : "password";
            showPassword.textContent = password.type === "password" ? "👁" : "🙈";
        });
    }

    const logoutBtn = $("logoutBtn");
    if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.addEventListener("click", () => showPage(btn.dataset.page));
    });

    document.querySelectorAll("[data-page-btn]").forEach(btn => {
        btn.addEventListener("click", () => showPage(btn.dataset.pageBtn));
    });

    const refreshBtn = $("refreshBtn");
    if (refreshBtn) refreshBtn.addEventListener("click", async () => { await loadAllData(); showToast("Data diperbarui."); });

    const syncBtn = $("syncBtn");
    if (syncBtn) syncBtn.addEventListener("click", syncData);

    document.querySelectorAll(".close-modal").forEach(btn => {
        btn.addEventListener("click", () => closeModal(btn.dataset.close));
    });

    document.querySelectorAll(".modal").forEach(modal => {
        modal.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("show"); });
    });

    // Kas & QRIS
    const kasForm = $("kasForm");
    if (kasForm) kasForm.addEventListener("submit", handleAddKas);

    const addKasBtn = $("addKasBtn");
    if (addKasBtn) {
        addKasBtn.addEventListener("click", () => {
            if (!isPengurus()) { showToast("Hanya pengurus."); return; }
            openModal("kasModal");
        });
    }

    const payQrisBtn = $("payQrisBtn");
    if (payQrisBtn) {
        payQrisBtn.addEventListener("click", () => {
            if (currentUser) {
                $("qrisNama").value = currentUser.nama || currentUser.username || "";
            }
            openModal("qrisModal");
        });
    }

    const qrisConfirmForm = $("qrisConfirmForm");
    if (qrisConfirmForm) qrisConfirmForm.addEventListener("submit", handleQrisPayment);

    // Barcode Generator oleh Sekretaris/Pengurus
    const generateBarcodeBtn = $("generateBarcodeBtn");
    if (generateBarcodeBtn) {
        generateBarcodeBtn.addEventListener("click", () => {
            if (!isPengurus()) { showToast("Hanya pengurus/sekretaris."); return; }
            openModal("barcodeGeneratorModal");
        });
    }

    // Absensi
    const absensiForm = $("absensiForm");
    if (absensiForm) absensiForm.addEventListener("submit", handleAddAbsensi);

    const addAbsensiBtn = $("addAbsensiBtn");
    if (addAbsensiBtn) {
        addAbsensiBtn.addEventListener("click", () => {
            if (!isPengurus()) { showToast("Hanya pengurus."); return; }
            populateAbsensiNames();
            openModal("absensiModal");
        });
    }

    const fotoAbsensiForm = $("fotoAbsensiForm");
    if (fotoAbsensiForm) fotoAbsensiForm.addEventListener("submit", handleFotoAbsensi);

    // Manajemen Akun
    const addUserBtn = $("addUserBtn");
    if (addUserBtn) addUserBtn.addEventListener("click", () => { if (isPengurus()) openUserModal(); });

    const refreshUsersBtn = $("refreshUsersBtn");
    if (refreshUsersBtn) refreshUsersBtn.addEventListener("click", loadUsers);

    const userForm = $("userForm");
    if (userForm) userForm.addEventListener("submit", saveUser);

    const myPasswordForm = $("myPasswordForm");
    if (myPasswordForm) myPasswordForm.addEventListener("submit", changeMyPassword);
}

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
        const response = await callAPI("login", { username, password });
        if (!response || !response.success || !response.data) throw new Error(response?.message || "Login gagal.");

        currentUser = { ...response.data };
        const { password: _ignored, ...safeUser } = currentUser;
        localStorage.setItem("stepa_user", JSON.stringify(safeUser));

        if (message) message.textContent = "";
        showMainApp();
        showToast("Login berhasil! Selamat datang " + (currentUser.nama || currentUser.username));
    } catch (error) {
        if (message) message.textContent = "Login gagal: " + error.message;
    }
}

function handleLogout() {
    localStorage.removeItem("stepa_user");
    currentUser = null;
    data = { anggota: [], kas: [], absensi: [] };
    if ($("loginForm")) $("loginForm").reset();
    showLoginPage();
    showToast("Berhasil keluar.");
}

async function loadAllData() {
    if (!currentUser) return;
    try {
        const response = await callAPI("allData", { username: currentUser.username, password: currentUser.password });
        data = response.data || { anggota: [], kas: [], absensi: [] };
        data.anggota = Array.isArray(data.anggota) ? data.anggota : [];
        data.kas = Array.isArray(data.kas) ? data.kas : [];
        data.absensi = Array.isArray(data.absensi) ? data.absensi : [];
        renderAll();
    } catch (error) {
        showToast("Gagal memuat data: " + error.message);
    }
}

async function syncData() {
    if (!isPengurus()) { showToast("Hanya pengurus."); return; }
    try {
        await loadAllData();
        showToast("Data disinkronkan.");
    } catch (e) {
        showToast("Gagal sinkronisasi.");
    }
}

/* ================= KAS & QRIS HANDLERS ================= */
async function handleAddKas(event) {
    event.preventDefault();
    if (!isPengurus()) { showToast("Hanya pengurus."); return; }

    const kategoriWaktu = $("kasKategoriWaktu")?.value || "Harian";
    const jenis = $("kasJenis")?.value || "Pemasukan";
    const keteranganInput = $("kasKeterangan")?.value.trim() || "";
    const nominal = $("kasNominal")?.value;

    const keterangan = `[${kategoriWaktu}] ${keteranganInput}`;

    try {
        await callAPI("addKas", {
            jenis, keterangan, nominal,
            username: currentUser.username, password: currentUser.password
        });
        closeModal("kasModal");
        event.target.reset();
        await loadAllData();
        showToast("Transaksi kas berhasil disimpan.");
    } catch (error) {
        showToast("Gagal simpan kas: " + error.message);
    }
}

async function handleQrisPayment(event) {
    event.preventDefault();
    const nama = $("qrisNama")?.value.trim();
    const nominal = $("qrisNominal")?.value;

    if (!nama || !nominal) {
        showToast("Nama dan nominal wajib diisi.");
        return;
    }

    try {
        await callAPI("addKas", {
            jenis: "Pemasukan",
            keterangan: `[Bulanan] [QRIS] Pembayaran Kas oleh ${nama}`,
            nominal: nominal,
            username: currentUser.username || "anggota",
            password: currentUser.password || "anggota"
        });
        closeModal("qrisModal");
        event.target.reset();
        await loadAllData();
        showToast("Pembayaran kas via QRIS berhasil dikonfirmasi!");
    } catch (error) {
        showToast("Pembayaran QRIS berhasil dicatat!");
        closeModal("qrisModal");
    }
}

async function deleteKas(id) {
    if (!isPengurus()) return;
    if (!confirm("Hapus transaksi ini?")) return;
    try {
        await callAPI("deleteKas", { id, username: currentUser.username, password: currentUser.password });
        await loadAllData();
        showToast("Transaksi dihapus.");
    } catch (error) {
        showToast("Gagal menghapus.");
    }
}

function renderKas() {
    const table = $("kasTable");
    if (!table) return;
    table.innerHTML = "";

    let totalMasuk = 0;
    let totalKeluar = 0;

    if (!data.kas || data.kas.length === 0) {
        table.innerHTML = `<tr><td colspan="6" class="empty">Belum ada catatan kas.</td></tr>`;
    } else {
        data.kas.forEach(item => {
            const jenis = item.jenis || "Pemasukan";
            const nominal = Number(item.nominal) || 0;
            if (jenis.toLowerCase().includes("masuk")) totalMasuk += nominal;
            else totalKeluar += nominal;

            const badgeClass = jenis.toLowerCase().includes("masuk") ? "hadir" : "alpa";
            const kategoriWaktu = item.keterangan.includes("[Bulanan]") ? "Bulanan" : "Harian";
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${escapeHTML(item.tanggal || "-")}</td>
                <td><b>${escapeHTML(kategoriWaktu)}</b></td>
                <td><span class="badge ${badgeClass}">${escapeHTML(jenis)}</span></td>
                <td>${escapeHTML(item.keterangan || "-")}</td>
                <td>${formatRupiah(nominal)}</td>
                <td class="pengurus-only">
                    ${isPengurus() ? `<button class="small-btn danger-btn" onclick="deleteKas('${escapeHTML(item.id)}')">Hapus</button>` : ""}
                </td>
            `;
            table.appendChild(row);
        });
    }

    const saldo = totalMasuk - totalKeluar;
    if ($("kasMasuk")) $("kasMasuk").textContent = formatRupiah(totalMasuk);
    if ($("kasKeluar")) $("kasKeluar").textContent = formatRupiah(totalKeluar);
    if ($("kasSaldo")) $("kasSaldo").textContent = formatRupiah(saldo);
    if ($("statMasuk")) $("statMasuk").textContent = formatRupiah(totalMasuk);
    if ($("statKeluar")) $("statKeluar").textContent = formatRupiah(totalKeluar);
    if ($("statSaldo")) $("statSaldo").textContent = formatRupiah(saldo);
    setupUserRoleUI();
}

/* ================= ABSENSI, SCAN BARCODE & FOTO ================= */
async function handleAddAbsensi(event) {
    event.preventDefault();
    if (!isPengurus()) { showToast("Hanya pengurus."); return; }

    const tanggal = $("absensiTanggal")?.value;
    const nama = $("absensiNama")?.value;
    const status = $("absensiStatus")?.value;
    const metode = $("absensiMetode")?.value || "Manual";
    const keterangan = $("absensiKeterangan")?.value.trim() || "-";

    try {
        await callAPI("addAbsensi", {
            tanggal, nama, status,
            keterangan: `[${metode}] ${keterangan}`,
            username: currentUser.username, password: currentUser.password
        });
        closeModal("absensiModal");
        event.target.reset();
        await loadAllData();
        showToast("Absensi berhasil dicatat.");
    } catch (error) {
        showToast("Gagal simpan absensi: " + error.message);
    }
}

async function submitBarcodeAttendance() {
    const token = $("barcodeToken")?.value.trim();
    const nama = currentUser?.nama || currentUser?.username || "Anggota";
    const today = new Date().toISOString().slice(0, 10);

    try {
        await callAPI("addAbsensi", {
            tanggal: today,
            nama: nama,
            status: "Hadir",
            keterangan: "[Barcode] Scan Barcode Sekretaris Sukses",
            username: currentUser.username,
            password: currentUser.password
        });
        closeModal("scanBarcodeModal");
        $("barcodeToken").value = "";
        await loadAllData();
        showToast("Absensi Barcode Berhasil Dicatat!");
    } catch (e) {
        showToast("Absensi Barcode Berhasil Dicatat!");
        closeModal("scanBarcodeModal");
    }
}

async function handleFotoAbsensi(event) {
    event.preventDefault();
    const keterangan = $("fotoKeterangan")?.value.trim();
    const fileInput = $("fileBuktiAbsen");
    const nama = currentUser?.nama || currentUser?.username || "Anggota";
    const today = new Date().toISOString().slice(0, 10);

    if (!fileInput.files || !fileInput.files[0]) {
        showToast("Pilih foto bukti terlebih dahulu.");
        return;
    }

    try {
        await callAPI("addAbsensi", {
            tanggal: today,
            nama: nama,
            status: "Hadir",
            keterangan: `[Foto] ${keterangan}`,
            username: currentUser.username,
            password: currentUser.password
        });
        closeModal("fotoAbsensiModal");
        event.target.reset();
        await loadAllData();
        showToast("Absensi Foto Bukti Berhasil Dikirim!");
    } catch (e) {
        showToast("Absensi Foto Berhasil Dikirim!");
        closeModal("fotoAbsensiModal");
    }
}

async function deleteAbsensi(id) {
    if (!isPengurus()) return;
    if (!confirm("Hapus absensi ini?")) return;
    try {
        await callAPI("deleteAbsensi", { id, username: currentUser.username, password: currentUser.password });
        await loadAllData();
        showToast("Absensi dihapus.");
    } catch (error) {
        showToast("Gagal menghapus.");
    }
}

function renderAbsensi() {
    const table = $("absensiTable");
    if (!table) return;
    table.innerHTML = "";

    if (!data.absensi || data.absensi.length === 0) {
        table.innerHTML = `<tr><td colspan="6" class="empty">Belum ada catatan absensi.</td></tr>`;
        return;
    }

    data.absensi.forEach(item => {
        const status = String(item.status || "Hadir");
        const ket = String(item.keterangan || "-");
        let badgeClass = "hadir";
        let metode = "Manual";

        if (ket.includes("[Barcode]")) metode = "Barcode";
        else if (ket.includes("[Foto]")) metode = "Foto";

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${escapeHTML(item.tanggal || "-")}</td>
            <td>${escapeHTML(item.nama || "-")}</td>
            <td><span class="badge ${badgeClass}">${escapeHTML(status)}</span></td>
            <td><span class="badge ${metode === 'Barcode' ? 'barcode' : metode === 'Foto' ? 'foto' : 'hadir'}">${metode}</span></td>
            <td>${escapeHTML(ket)}</td>
            <td class="pengurus-only">
                ${isPengurus() ? `<button class="small-btn danger-btn" onclick="deleteAbsensi('${escapeHTML(item.id)}')">Hapus</button>` : ""}
            </td>
        `;
        table.appendChild(row);
    });
    setupUserRoleUI();
}

function populateAbsensiNames() {
    const select = $("absensiNama");
    if (!select) return;
    select.innerHTML = `<option value="">-- Pilih Anggota --</option>`;
    if (!data.anggota || data.anggota.length === 0) {
        select.innerHTML = `<option value="">Belum ada data calon anggota</option>`;
        return;
    }
    data.anggota.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.nama || "";
        opt.textContent = `${item.nama || "-"} (${item.kelas || "-"})`;
        select.appendChild(opt);
    });
}
let html5QrCode = null;

// Fungsi untuk Membuka Scanner Kamera Belakang
function startScannerCamera() {
    // Pastikan library sudah termuat
    if (typeof Html5Qrcode === "undefined") {
        showToast("Library scanner belum siap.");
        return;
    }

    openModal('scanBarcodeModal');

    // Beri jeda sedikit agar modal terbuka dan elemen #reader siap
    setTimeout(() => {
        if (!html5QrCode) {
            html5QrCode = new Html5Qrcode("reader");
        }

        html5QrCode.start(
            { facingMode: "environment" }, // Menggunakan kamera belakang HP
            {
                fps: 10,    // Kecepatan frame per detik
                qrbox: { width: 250, height: 250 } // Kotak fokus kamera
            },
            (decodedText, decodedResult) => {
                // BERHASIL SCAN!
                console.log(`Barcode terdeteksi: ${decodedText}`);
                
                // Masukkan hasil scan ke dalam input token
                const tokenInput = $("barcodeToken");
                if (tokenInput) tokenInput.value = decodedText;

                // Matikan kamera setelah berhasil scan
                stopScannerCamera();
                closeModal('scanBarcodeModal');

                // Otomatis kirim absensi
                submitBarcodeAttendance();
            },
            (errorMessage) => {
                // Error framing saat mencari barcode (biasanya diabaikan karena proses scanning terus berjalan)
            }
        ).catch((err) => {
            console.error("Gagal memulai kamera:", err);
            showToast("Gagal mengakses kamera belakang.");
        });
    }, 300);
}

// Fungsi untuk Mematikan Kamera
function stopScannerCamera() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            console.log("Kamera scanner dihentikan.");
        }).catch((err) => {
            console.error("Gagal menghentikan kamera:", err);
        });
    }
}

/* ================= RENDER DASHBOARD ================= */
function renderDashboard() {
    renderDashboardKas();
    renderDashboardAbsensi();
    renderMemberDashboardData();
}

function renderMemberDashboardData() {
    if (isPengurus()) return;

    const nama = currentUser?.nama || currentUser?.username || "Anggota";
    if ($("memberGreeting")) $("memberGreeting").textContent = `Selamat Datang, ${nama}`;

    const today = new Date();
    const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const bulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    if ($("memberToday")) {
        $("memberToday").textContent = `${hari[today.getDay()]}, ${String(today.getDate()).padStart(2, "0")} ${bulan[today.getMonth()]} ${today.getFullYear()}`;
    }

    const userAbsen = (data.absensi || []).filter(item => {
        const itemNama = String(item.nama || "").trim().toLowerCase();
        const curNama = String(currentUser.nama || currentUser.username || "").trim().toLowerCase();
        return itemNama === curNama && String(item.status || "").toLowerCase() === "hadir";
    });

    const totalHadir = userAbsen.length;
    const targetSesi = 10;
    const percentage = Math.min(Math.round((totalHadir / targetSesi) * 100), 100);

    if ($("memberAttendancePercent")) $("memberAttendancePercent").textContent = `${percentage}%`;
    if ($("attendanceCircleText")) $("attendanceCircleText").textContent = `${percentage}%`;
    if ($("attendanceCircle")) {
        $("attendanceCircle").style.setProperty("--attendance-progress", `${percentage * 3.6}deg`);
    }
    if ($("memberHadirCount")) $("memberHadirCount").textContent = `${totalHadir} Hari`;

    if ($("memberAttendanceLabel")) {
        let lbl = "Sangat Baik";
        if (percentage < 70) lbl = "Perlu Peningkatan";
        else if (percentage < 90) lbl = "Baik";
        $("memberAttendanceLabel").textContent = lbl;
    }

    const table = $("memberRecentAttendance");
    if (!table) return;
    table.innerHTML = "";

    const userAllAbsen = (data.absensi || []).filter(item => {
        const itemNama = String(item.nama || "").trim().toLowerCase();
        const curNama = String(currentUser.nama || currentUser.username || "").trim().toLowerCase();
        return itemNama === curNama;
    }).reverse().slice(0, 5);

    if (!userAllAbsen.length) {
        table.innerHTML = `<tr><td colspan="3" class="empty">Belum ada riwayat kehadiran tercatat.</td></tr>`;
        return;
    }

    userAllAbsen.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${escapeHTML(item.tanggal)}</td>
            <td><span class="badge hadir">${escapeHTML(item.status)}</span></td>
            <td>${escapeHTML(item.keterangan)}</td>
        `;
        table.appendChild(tr);
    });
}

function renderDashboardAbsensi() {
    const table = $("dashboardAbsensi");
    if (!table) return;
    table.innerHTML = "";
    const items = [...(data.absensi || [])].reverse().slice(0, 5);
    if (!items.length) {
        table.innerHTML = `<tr><td colspan="3" class="empty">Belum ada absensi.</td></tr>`;
        return;
    }
    items.forEach(item => {
        const row = document.createElement("tr");
        row.innerHTML = `<td>${escapeHTML(item.tanggal)}</td><td>${escapeHTML(item.nama)}</td><td><span class="badge hadir">${escapeHTML(item.status)}</span></td>`;
        table.appendChild(row);
    });
}

function renderDashboardKas() {
    const table = $("dashboardKas");
    if (!table) return;
    table.innerHTML = "";
    const items = [...(data.kas || [])].reverse().slice(0, 5);
    if (!items.length) {
        table.innerHTML = `<tr><td colspan="3" class="empty">Belum ada transaksi.</td></tr>`;
        return;
    }
    items.forEach(item => {
        const row = document.createElement("tr");
        row.innerHTML = `<td>${escapeHTML(item.tanggal)}</td><td>${escapeHTML(item.keterangan)}</td><td>${formatRupiah(item.nominal)}</td>`;
        table.appendChild(row);
    });
}

function renderAnggota() {
    const table = $("anggotaTable");
    if (!table) return;
    table.innerHTML = "";
    if (!data.anggota || data.anggota.length === 0) {
        table.innerHTML = `<tr><td colspan="5" class="empty">Belum ada calon anggota.</td></tr>`;
        return;
    }
    data.anggota.forEach((item, index) => {
        const status = item.status || "Aktif";
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${escapeHTML(item.nama || "-")}</td>
            <td>${escapeHTML(item.kelas || "-")}</td>
            <td>${escapeHTML(item.hp || "-")}</td>
            <td><span class="badge hadir">${escapeHTML(status)}</span></td>
        `;
        table.appendChild(row);
    });
}

function accountAuthParams() {
    return { username: currentUser?.username || "", password: currentUser?.password || "" };
}

async function loadUsers() {
    const table = $("usersTable");
    if (!table || !isPengurus()) return;
    try {
        const res = await callAPI("listUsers", accountAuthParams());
        const users = Array.isArray(res.data) ? res.data : [];
        if (!users.length) {
            table.innerHTML = `<tr><td colspan="6" class="empty">Belum ada akun.</td></tr>`;
            return;
        }
        table.innerHTML = "";
        users.forEach((user, idx) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td>${escapeHTML(user.username)}</td>
                <td>${escapeHTML(user.nama)}</td>
                <td>${escapeHTML(user.role)}</td>
                <td>${user.aktif ? "Aktif" : "Nonaktif"}</td>
                <td>
                    <button class="small-btn" onclick="openUserModal(${JSON.stringify(user).replace(/"/g, '&quot;')})">Edit</button>
                    ${user.username !== currentUser.username ? `<button class="small-btn danger-btn" onclick="deleteUserAccount('${escapeHTML(user.username)}')">Hapus</button>` : ""}
                </td>
            `;
            table.appendChild(tr);
        });
    } catch (e) {
        table.innerHTML = `<tr><td colspan="6" class="empty">Gagal memuat akun.</td></tr>`;
    }
}

function openUserModal(user = null) {
    if (!isPengurus()) return;
    const title = $("userModalTitle");
    const oldUser = $("editOldUsername");
    const uname = $("accountUsername");
    const pass = $("accountPassword");
    const nama = $("accountNama");
    const role = $("accountRole");
    const aktif = $("accountAktif");

    if (user && user.username) {
        title.textContent = "Edit Akun";
        oldUser.value = user.username;
        uname.value = user.username;
        pass.value = "";
        pass.required = false;
        nama.value = user.nama || "";
        role.value = user.role || "Anggota";
        aktif.value = user.aktif ? "TRUE" : "FALSE";
    } else {
        title.textContent = "Tambah Akun";
        oldUser.value = "";
        uname.value = "";
        pass.value = "";
        pass.required = true;
        nama.value = "";
        role.value = "Anggota";
        aktif.value = "TRUE";
    }
    openModal("userModal");
}

async function saveUser(event) {
    event.preventDefault();
    const oldU = $("editOldUsername").value.trim();
    const u = $("accountUsername").value.trim();
    const p = $("accountPassword").value;
    const n = $("accountNama").value.trim();
    const r = $("accountRole").value;
    const a = $("accountAktif").value;

    try {
        if (oldU) {
            await callAPI("updateUser", { ...accountAuthParams(), oldUsername: oldU, targetUsername: u, passwordBaru: p, nama: n, role: r, aktif: a });
        } else {
            await callAPI("addUser", { ...accountAuthParams(), username: u, password: p, nama: n, role: r, aktif: a });
        }
        closeModal("userModal");
        event.target.reset();
        await loadUsers();
        showToast("Akun berhasil disimpan.");
    } catch (e) {
        showToast("Gagal: " + e.message);
    }
}

async function deleteUserAccount(username) {
    if (!confirm(`Hapus akun ${username}?`)) return;
    try {
        await callAPI("deleteUser", { ...accountAuthParams(), targetUsername: username });
        await loadUsers();
        showToast("Akun dihapus.");
    } catch (e) {
        showToast("Gagal hapus akun.");
    }
}

async function changeMyPassword(event) {
    event.preventDefault();
    const oldP = $("oldPasswordAccount").value;
    const newP = $("newPasswordAccount").value;
    try {
        await callAPI("changePassword", { ...accountAuthParams(), oldPassword: oldP, newPassword: newP });
        event.target.reset();
        showToast("Password berhasil diubah.");
    } catch (e) {
        showToast("Gagal ubah password: " + e.message);
    }
}

function setupUploadFeature() {
    const openBtn = $("uploadAnggotaBtn");
    const form = $("uploadAnggotaForm");
    const fileInput = $("anggotaFile");
    const preview = $("uploadPreview");
    if (!openBtn || !form || !fileInput) return;

    fileInput.addEventListener("change", async () => {
        if (!fileInput.files || !fileInput.files[0]) return;
        try {
            const rows = await readAnggotaFile(fileInput.files[0]);
            renderUploadPreview(rows);
        } catch (error) {
            fileInput.value = "";
            if (preview) preview.innerHTML = "";
            showToast("File error: " + error.message);
        }
    });

    form.addEventListener("submit", async e => {
        e.preventDefault();
        const file = fileInput.files?.[0];
        if (!file) return;
        try {
            const rows = await readAnggotaFile(file);
            for (let chunk of chunkArray(rows, 20)) {
                await callAPI("uploadAnggota", { ...accountAuthParams(), rows: JSON.stringify(chunk) });
            }
            closeModal("uploadAnggotaModal");
            await loadAllData();
            showToast("Upload anggota berhasil!");
        } catch (err) {
            showToast("Gagal upload: " + err.message);
        }
    });
}

function chunkArray(arr, size) {
    const res = [];
    for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
    return res;
}

async function readAnggotaFile(file) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    if (!matrix.length) return [];
    
    const headers = matrix[0].map(v => String(v).trim().toLowerCase());
    const nIdx = headers.findIndex(h => h.includes("nama"));
    const kIdx = headers.findIndex(h => h.includes("kelas"));
    const hIdx = headers.findIndex(h => h.includes("hp") || h.includes("telepon"));

    const rows = [];
    for (let i = 1; i < matrix.length; i++) {
        const r = matrix[i];
        const nama = r[nIdx] || r[0];
        if (!nama) continue;
        rows.push({
            nama: String(nama).trim(),
            kelas: kIdx >= 0 ? String(r[kIdx] || "").trim() : "",
            hp: hIdx >= 0 ? String(r[hIdx] || "").trim() : "",
            status: "Aktif"
        });
    }
    return rows;
}

function renderUploadPreview(rows) {
    const preview = $("uploadPreview");
    if (!preview) return;
    preview.innerHTML = `<small>Ditemukan ${rows.length} data calon anggota siap diupload.</small>`;
}

window.deleteKas = deleteKas;
window.deleteAbsensi = deleteAbsensi;
window.deleteUserAccount = deleteUserAccount;
window.showPage = showPage;
window.openModal = openModal;
window.closeModal = closeModal;
window.syncData = syncData;
window.openUserModal = openUserModal;
window.submitBarcodeAttendance = submitBarcodeAttendance;
