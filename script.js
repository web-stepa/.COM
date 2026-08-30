/* =========================================================
   STEPA MANAGEMENT - SCRIPT.JS FINAL
   Cocok dengan index.html STEPA + Code.gs yang diberikan
   ========================================================= */

const API_URL = "https://script.google.com/macros/s/AKfycbxYeIYi85RfKBRPuey7v7Z7c9aJ3Iw6MSx9iAmsDuOYsHOEad6jJY2cvvu3aQYvB5q_Dw/exec";

let currentUser = null;

let data = {
    anggota: [],
    kas: [],
    absensi: []
};

let xlsxPromise = null;


/* =========================================================
   UTILITAS
   ========================================================= */

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
    const n = Number(value) || 0;
    return "Rp" + n.toLocaleString("id-ID");
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

    clearTimeout(window.stepaToastTimer);

    window.stepaToastTimer = setTimeout(() => {
        el.classList.remove("show");
    }, 3000);
}

function openModal(id) {
    $(id)?.classList.add("show");
}

function closeModal(id) {
    $(id)?.classList.remove("show");
}


/* =========================================================
   API JSONP
   ========================================================= */

function callAPI(action, params = {}) {
    return new Promise((resolve, reject) => {

        const callbackName =
            "stepa_cb_" +
            Date.now() +
            "_" +
            Math.floor(Math.random() * 100000);

        const query = new URLSearchParams({
            action,
            callback: callbackName,
            ...params
        });

        const script = document.createElement("script");

        script.src = API_URL + "?" + query.toString();

        let finished = false;

        const timeout = setTimeout(() => {
            if (finished) return;

            finished = true;
            cleanup();

            reject(
                new Error(
                    "Waktu koneksi habis. Periksa deployment Google Apps Script."
                )
            );
        }, 20000);

        function cleanup() {
            clearTimeout(timeout);
            delete window[callbackName];

            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        }

        window[callbackName] = (response) => {
            if (finished) return;

            finished = true;
            cleanup();

            if (response?.success) {
                resolve(response);
            } else {
                reject(
                    new Error(
                        response?.message ||
                        "Permintaan gagal."
                    )
                );
            }
        };

        script.onerror = () => {
            if (finished) return;

            finished = true;
            cleanup();

            reject(
                new Error(
                    "Gagal terhubung ke Google Apps Script."
                )
            );
        };

        document.body.appendChild(script);
    });
}


/* =========================================================
   START
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    checkSession();
});


/* =========================================================
   SESSION / LOGIN
   ========================================================= */

function checkSession() {
    const saved = localStorage.getItem("stepa_user");

    if (!saved) {
        showLoginPage();
        return;
    }

    try {
        const user = JSON.parse(saved);

        /*
         * Password diperlukan oleh Code.gs untuk operasi
         * Pengurus. Session lama yang tidak punya password
         * harus login ulang.
         */
        if (
            !user ||
            !user.username ||
            !user.password
        ) {
            localStorage.removeItem("stepa_user");
            currentUser = null;
            showLoginPage();

            if ($("loginMessage")) {
                $("loginMessage").textContent =
                    "Silakan login kembali.";
            }

            return;
        }

        currentUser = user;

        showMainApp();

    } catch (error) {
        localStorage.removeItem("stepa_user");
        currentUser = null;
        showLoginPage();
    }
}

async function handleLogin(event) {
    event.preventDefault();

    const username =
        $("username")?.value.trim();

    const password =
        $("password")?.value || "";

    const message =
        $("loginMessage");

    if (!username || !password) {
        if (message) {
            message.textContent =
                "Username dan password wajib diisi.";
        }

        return;
    }

    if (message) {
        message.textContent = "Sedang masuk...";
    }

    try {
        const response = await callAPI(
            "login",
            {
                username,
                password
            }
        );

        if (
            !response?.success ||
            !response.data
        ) {
            throw new Error(
                response?.message ||
                "Login gagal."
            );
        }

        /*
         * PENTING:
         * Password disimpan di session agar request
         * addKas/deleteKas/allData/listUsers dapat
         * melewati autentikasi Code.gs.
         */
        currentUser = {
            ...response.data,
            password
        };

        localStorage.setItem(
            "stepa_user",
            JSON.stringify(currentUser)
        );

        if (message) {
            message.textContent = "";
        }

        showMainApp();

        toast(
            "Login berhasil! Selamat datang " +
            (
                currentUser.nama ||
                currentUser.username
            )
        );

    } catch (error) {

        if (message) {
            message.textContent =
                "Login gagal: " +
                error.message;
        } else {
            toast(error.message);
        }

        console.error(
            "STEPA LOGIN ERROR:",
            error
        );
    }
}

function handleLogout() {
    currentUser = null;

    localStorage.removeItem("stepa_user");

    data = {
        anggota: [],
        kas: [],
        absensi: []
    };

    $("loginForm")?.reset();

    if ($("loginMessage")) {
        $("loginMessage").textContent = "";
    }

    showLoginPage();
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

    if (loginPage) {
        loginPage.style.display = "none";
    }

    if (appPage) {
        appPage.classList.remove("hidden");
        appPage.style.display = "flex";
    }

    updateUserInfo();
    setupUserRoleUI();

    showPage("dashboard");

    loadAllData();
}

function updateUserInfo() {
    if (!currentUser) return;

    const nama =
        currentUser.nama ||
        currentUser.username ||
        "Pengguna";

    const role =
        currentUser.role ||
        "Anggota";

    if ($("userName")) {
        $("userName").textContent = nama;
    }

    if ($("userRole")) {
        $("userRole").textContent = role;
    }

    if ($("userAvatar")) {
        $("userAvatar").textContent =
            nama.charAt(0).toUpperCase();
    }
}

function setupUserRoleUI() {
    const visible = isPengurus();

    document
        .querySelectorAll(".pengurus-only")
        .forEach(element => {
            element.style.display =
                visible ? "" : "none";
        });
}


/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function setupEventListeners() {

    $("loginForm")?.addEventListener(
        "submit",
        handleLogin
    );

    $("logoutBtn")?.addEventListener(
        "click",
        handleLogout
    );

    $("showPassword")?.addEventListener(
        "click",
        () => {
            const input = $("password");
            if (!input) return;

            input.type =
                input.type === "password"
                    ? "text"
                    : "password";
        }
    );

    document
        .querySelectorAll(".nav-item")
        .forEach(button => {
            button.addEventListener(
                "click",
                () => showPage(button.dataset.page)
            );
        });

    document
        .querySelectorAll("[data-page-btn]")
        .forEach(button => {
            button.addEventListener(
                "click",
                () => showPage(button.dataset.pageBtn)
            );
        });

    $("refreshBtn")?.addEventListener(
        "click",
        async () => {
            await loadAllData();
            toast("Data berhasil diperbarui.");
        }
    );

    $("syncBtn")?.addEventListener(
        "click",
        syncData
    );

    $("addKasBtn")?.addEventListener(
        "click",
        () => {
            if (!isPengurus()) {
                toast(
                    "Hanya Pengurus yang dapat menginput kas."
                );
                return;
            }

            openModal("kasModal");
        }
    );

    $("kasForm")?.addEventListener(
        "submit",
        handleAddKas
    );

    $("addAbsensiBtn")?.addEventListener(
        "click",
        () => {
            if (!isPengurus()) {
                toast(
                    "Hanya Pengurus yang dapat menginput absensi."
                );
                return;
            }

            setDefaultAbsensiDate();
            populateAbsensiNames();
            openModal("absensiModal");
        }
    );

    $("absensiForm")?.addEventListener(
        "submit",
        handleAddAbsensi
    );

    $("addUserBtn")?.addEventListener(
        "click",
        () => openUserModal()
    );

    $("refreshUsersBtn")?.addEventListener(
        "click",
        loadUsers
    );

    $("userForm")?.addEventListener(
        "submit",
        saveUser
    );

    $("myPasswordForm")?.addEventListener(
        "submit",
        changeMyPassword
    );

    document
        .querySelectorAll(".close-modal")
        .forEach(button => {
            button.addEventListener(
                "click",
                () => closeModal(
                    button.dataset.close
                )
            );
        });

    document
        .querySelectorAll(".modal")
        .forEach(modal => {
            modal.addEventListener(
                "click",
                event => {
                    if (event.target === modal) {
                        modal.classList.remove("show");
                    }
                }
            );
        });
}


/* =========================================================
   NAVIGASI
   ========================================================= */

function showPage(pageName) {

    const pages = [
        "dashboard",
        "kas",
        "absensi",
        "anggota",
        "akun"
    ];

    if (!pages.includes(pageName)) {
        pageName = "dashboard";
    }

    /*
     * Manajemen akun hanya untuk Pengurus.
     */
    if (
        pageName === "akun" &&
        !isPengurus()
    ) {
        toast(
            "Manajemen Akun hanya dapat diakses Pengurus."
        );

        pageName = "dashboard";
    }

    document
        .querySelectorAll(".page")
        .forEach(page => {
            page.classList.remove("active-page");
        });

    $(pageName + "Page")
        ?.classList.add("active-page");

    document
        .querySelectorAll(".nav-item")
        .forEach(item => {
            item.classList.toggle(
                "active",
                item.dataset.page === pageName
            );
        });

    const titles = {
        dashboard: [
            "Dashboard",
            "Ringkasan kegiatan STEPA"
        ],

        kas: [
            "Kas STEPA",
            "Kelola pemasukan dan pengeluaran kas"
        ],

        absensi: [
            "Absensi",
            "Catat kehadiran calon anggota STEPA"
        ],

        anggota: [
            "Calon Anggota",
            "Data calon anggota STEPA"
        ],

        akun: [
            "Manajemen Akun",
            "Kelola username, password, nama, role, dan status akun STEPA"
        ]
    };

    if ($("pageTitle")) {
        $("pageTitle").textContent =
            titles[pageName][0];
    }

    if ($("pageSubtitle")) {
        $("pageSubtitle").textContent =
            titles[pageName][1];
    }

    if (pageName === "dashboard") {
        renderDashboard();
    }

    if (pageName === "kas") {
        renderKas();
    }

    if (pageName === "absensi") {
        renderAbsensi();
        populateAbsensiNames();
    }

    if (pageName === "anggota") {
        renderAnggota();
        setupUpload();
    }

    if (pageName === "akun") {
        loadUsers();
    }
}


/* =========================================================
   LOAD DATA
   ========================================================= */

async function loadAllData() {

    if (!currentUser) return;

    if (!currentUser.password) {
        toast(
            "Session lama terdeteksi. Silakan login kembali."
        );

        handleLogout();
        return;
    }

    try {

        const response =
            await callAPI(
                "allData",
                authParams()
            );

        const serverData =
            response.data || {};

        data = {
            anggota:
                Array.isArray(serverData.anggota)
                    ? serverData.anggota
                    : [],

            kas:
                Array.isArray(serverData.kas)
                    ? serverData.kas
                    : [],

            absensi:
                Array.isArray(serverData.absensi)
                    ? serverData.absensi
                    : []
        };

        /*
         * Upload Excel/CSV versi frontend lama disimpan
         * di localStorage. Tetap dipertahankan supaya
         * data upload yang sudah ada tidak hilang.
         */
        const localAnggota =
            JSON.parse(
                localStorage.getItem(
                    "stepa_local_anggota"
                ) || "[]"
            );

        if (Array.isArray(localAnggota)) {
            data.anggota = [
                ...data.anggota,
                ...localAnggota
            ];
        }

        renderAll();

    } catch (error) {

        console.error(
            "LOAD DATA ERROR:",
            error
        );

        toast(
            "Gagal memuat data: " +
            error.message
        );
    }
}

function renderAll() {
    renderDashboard();
    renderAnggota();
    renderKas();
    renderAbsensi();
    populateAbsensiNames();
    setupUserRoleUI();
    setupUpload();
}


/* =========================================================
   DASHBOARD
   ========================================================= */

function getKasTotals() {

    let masuk = 0;
    let keluar = 0;

    (data.kas || []).forEach(item => {

        const nominal =
            Number(item.nominal) || 0;

        const jenis =
            String(item.jenis || "")
                .trim()
                .toLowerCase();

        if (
            jenis === "pemasukan" ||
            jenis === "masuk"
        ) {
            masuk += nominal;
        }

        if (
            jenis === "pengeluaran" ||
            jenis === "keluar"
        ) {
            keluar += nominal;
        }
    });

    return {
        masuk,
        keluar,
        saldo: masuk - keluar
    };
}

function renderDashboard() {

    const totals = getKasTotals();

    if ($("statAnggota")) {
        $("statAnggota").textContent =
            data.anggota.length;
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

    if ($("kasMasuk")) {
        $("kasMasuk").textContent =
            formatRupiah(totals.masuk);
    }

    if ($("kasKeluar")) {
        $("kasKeluar").textContent =
            formatRupiah(totals.keluar);
    }

    if ($("kasSaldo")) {
        $("kasSaldo").textContent =
            formatRupiah(totals.saldo);
    }

    if ($("dashboardAbsensi")) {

        const rows =
            (data.absensi || [])
                .slice(-5)
                .reverse();

        $("dashboardAbsensi").innerHTML =
            rows.map(item => `
                <tr>
                    <td>${escapeHTML(item.tanggal || "-")}</td>
                    <td>${escapeHTML(item.nama || "-")}</td>
                    <td>${escapeHTML(item.status || "-")}</td>
                </tr>
            `).join("") ||
            `<tr>
                <td colspan="3">
                    Belum ada data absensi.
                </td>
            </tr>`;
    }

    if ($("dashboardKas")) {

        const rows =
            (data.kas || [])
                .slice(-5)
                .reverse();

        $("dashboardKas").innerHTML =
            rows.map(item => `
                <tr>
                    <td>${escapeHTML(item.tanggal || "-")}</td>
                    <td>${escapeHTML(item.keterangan || "-")}</td>
                    <td>${formatRupiah(item.nominal)}</td>
                </tr>
            `).join("") ||
            `<tr>
                <td colspan="3">
                    Belum ada transaksi kas.
                </td>
            </tr>`;
    }
}


/* =========================================================
   KAS
   ========================================================= */

function normalizeKasJenis(jenis) {

    const value =
        String(jenis || "")
            .trim()
            .toLowerCase();

    if (
        value === "pemasukan" ||
        value === "masuk"
    ) {
        return "Pemasukan";
    }

    if (
        value === "pengeluaran" ||
        value === "keluar"
    ) {
        return "Pengeluaran";
    }

    return jenis || "-";
}

function renderKas() {

    const table = $("kasTable");

    if (!table) return;

    table.innerHTML = "";

    const totals = getKasTotals();

    if (!data.kas.length) {

        table.innerHTML = `
            <tr>
                <td colspan="5" class="empty">
                    Belum ada catatan kas.
                </td>
            </tr>
        `;

    } else {

        data.kas.forEach((item, index) => {

            const jenis =
                normalizeKasJenis(item.jenis);

            const nominal =
                Number(item.nominal) || 0;

            const isMasuk =
                jenis === "Pemasukan";

            const row =
                document.createElement("tr");

            row.innerHTML = `
                <td>
                    ${escapeHTML(item.tanggal || "-")}
                </td>

                <td>
                    <span class="badge ${
                        isMasuk
                            ? "hadir"
                            : "alpa"
                    }">
                        ${escapeHTML(jenis)}
                    </span>
                </td>

                <td>
                    ${escapeHTML(
                        item.keterangan || "-"
                    )}
                </td>

                <td>
                    ${formatRupiah(nominal)}
                </td>

                <td class="pengurus-only">
                    <button
                        type="button"
                        class="small-btn danger-btn"
                        data-kas-index="${index}"
                    >
                        🗑️ Hapus
                    </button>
                </td>
            `;

            row
                .querySelector("[data-kas-index]")
                ?.addEventListener(
                    "click",
                    () => deleteKas(index)
                );

            table.appendChild(row);
        });
    }

    /*
     * Ini sengaja memakai ID yang benar dari index.html:
     * kasMasuk, kasKeluar, kasSaldo.
     */
    if ($("kasMasuk")) {
        $("kasMasuk").textContent =
            formatRupiah(totals.masuk);
    }

    if ($("kasKeluar")) {
        $("kasKeluar").textContent =
            formatRupiah(totals.keluar);
    }

    if ($("kasSaldo")) {
        $("kasSaldo").textContent =
            formatRupiah(totals.saldo);
    }

    setupUserRoleUI();
}

async function handleAddKas(event) {

    event.preventDefault();

    if (!isPengurus()) {
        toast(
            "Hanya Pengurus yang dapat menambah kas."
        );
        return;
    }

    try {

        await callAPI(
            "addKas",
            {
                ...authParams(),

                jenis:
                    $("kasJenis")?.value || "",

                keterangan:
                    $("kasKeterangan")?.value.trim() || "",

                nominal:
                    $("kasNominal")?.value || "0"
            }
        );

        closeModal("kasModal");

        event.target.reset();

        await loadAllData();

        showPage("kas");

        toast(
            "Transaksi kas berhasil disimpan."
        );

    } catch (error) {

        console.error(
            "ADD KAS ERROR:",
            error
        );

        toast(
            "Gagal menyimpan kas: " +
            error.message
        );
    }
}

async function deleteKas(index) {

    if (!isPengurus()) {
        toast(
            "Hanya Pengurus yang dapat menghapus kas."
        );
        return;
    }

    const item =
        data.kas[index];

    if (!item) {
        toast("Transaksi tidak ditemukan.");
        return;
    }

    const nama =
        item.keterangan ||
        "transaksi ini";

    if (
        !confirm(
            `Yakin ingin menghapus "${nama}"?`
        )
    ) {
        return;
    }

    /*
     * JANGAN langsung splice data lokal.
     * Hapus dulu di Google Sheets.
     * Setelah berhasil, loadAllData() mengambil
     * data terbaru dari server.
     */
    try {

        await callAPI(
            "deleteKas",
            {
                ...authParams(),
                id: item.id
            }
        );

        await loadAllData();

        toast(
            "Transaksi berhasil dihapus permanen."
        );

    } catch (error) {

        console.error(
            "DELETE KAS ERROR:",
            error
        );

        toast(
            "Gagal menghapus kas: " +
            error.message
        );
    }
}


/* =========================================================
   ABSENSI
   ========================================================= */

function setDefaultAbsensiDate() {

    const input =
        $("absensiTanggal");

    if (
        input &&
        !input.value
    ) {
        const now =
            new Date();

        const local =
            new Date(
                now.getTime() -
                now.getTimezoneOffset() * 60000
            );

        input.value =
            local.toISOString()
                .slice(0, 10);
    }
}

function populateAbsensiNames() {

    const select =
        $("absensiNama");

    if (!select) return;

    const current =
        select.value;

    select.innerHTML =
        `<option value="">
            Pilih calon anggota
        </option>`;

    (data.anggota || [])
        .forEach(item => {

            if (!item.nama) return;

            const option =
                document.createElement("option");

            option.value =
                item.nama;

            option.textContent =
                item.nama;

            select.appendChild(option);
        });

    if (
        current &&
        [...select.options]
            .some(o => o.value === current)
    ) {
        select.value = current;
    }
}

function renderAbsensi() {

    const table =
        $("absensiTable");

    if (!table) return;

    table.innerHTML = "";

    if (!data.absensi.length) {

        table.innerHTML = `
            <tr>
                <td colspan="5" class="empty">
                    Belum ada data absensi.
                </td>
            </tr>
        `;

        return;
    }

    data.absensi.forEach(
        (item, index) => {

            const row =
                document.createElement("tr");

            row.innerHTML = `
                <td>
                    ${escapeHTML(item.tanggal || "-")}
                </td>

                <td>
                    ${escapeHTML(item.nama || "-")}
                </td>

                <td>
                    <span class="badge ${
                        String(item.status || "")
                            .toLowerCase() === "hadir"
                            ? "hadir"
                            : "alpa"
                    }">
                        ${escapeHTML(item.status || "-")}
                    </span>
                </td>

                <td>
                    ${escapeHTML(
                        item.keterangan || "-"
                    )}
                </td>

                <td class="pengurus-only">
                    <button
                        type="button"
                        class="small-btn danger-btn"
                        data-absensi-index="${index}"
                    >
                        🗑️ Hapus
                    </button>
                </td>
            `;

            row
                .querySelector("[data-absensi-index]")
                ?.addEventListener(
                    "click",
                    () => deleteAbsensi(item.id)
                );

            table.appendChild(row);
        }
    );

    setupUserRoleUI();
}

async function handleAddAbsensi(event) {

    event.preventDefault();

    if (!isPengurus()) {
        toast(
            "Hanya Pengurus yang dapat mengisi absensi."
        );
        return;
    }

    try {

        await callAPI(
            "addAbsensi",
            {
                ...authParams(),

                tanggal:
                    $("absensiTanggal")?.value || "",

                nama:
                    $("absensiNama")?.value || "",

                status:
                    $("absensiStatus")?.value || "",

                keterangan:
                    $("absensiKeterangan")
                        ?.value.trim() || ""
            }
        );

        closeModal("absensiModal");

        event.target.reset();

        await loadAllData();

        toast(
            "Absensi berhasil disimpan."
        );

    } catch (error) {

        toast(
            "Gagal menyimpan absensi: " +
            error.message
        );
    }
}

async function deleteAbsensi(id) {

    if (!isPengurus()) {
        toast(
            "Anda tidak memiliki akses."
        );
        return;
    }

    if (!id) {
        toast(
            "ID absensi tidak ditemukan."
        );
        return;
    }

    if (
        !confirm(
            "Apakah Anda yakin ingin menghapus absensi ini?"
        )
    ) {
        return;
    }

    try {

        await callAPI(
            "deleteAbsensi",
            {
                ...authParams(),
                id
            }
        );

        await loadAllData();

        toast(
            "Absensi berhasil dihapus."
        );

    } catch (error) {

        toast(
            "Gagal menghapus absensi: " +
            error.message
        );
    }
}


/* =========================================================
   MANAJEMEN AKUN
   ========================================================= */

async function loadUsers() {

    const table =
        $("usersTable");

    if (!table || !isPengurus()) {
        return;
    }

    if (!currentUser?.password) {
        table.innerHTML = `
            <tr>
                <td colspan="6" class="empty">
                    Silakan login kembali untuk mengelola akun.
                </td>
            </tr>
        `;
        return;
    }

    table.innerHTML = `
        <tr>
            <td colspan="6" class="empty">
                ⏳ Memuat akun...
            </td>
        </tr>
    `;

    try {

        const response =
            await callAPI(
                "listUsers",
                authParams()
            );

        const users =
            Array.isArray(response.data)
                ? response.data
                : [];

        if (!users.length) {

            table.innerHTML = `
                <tr>
                    <td colspan="6" class="empty">
                        Belum ada akun.
                    </td>
                </tr>
            `;

            return;
        }

        table.innerHTML = "";

        users.forEach(
            (user, index) => {

                const row =
                    document.createElement("tr");

                row.innerHTML = `
                    <td>${index + 1}</td>

                    <td>
                        ${escapeHTML(user.username)}
                    </td>

                    <td>
                        ${escapeHTML(user.nama)}
                    </td>

                    <td>
                        ${escapeHTML(user.role)}
                    </td>

                    <td>
                        ${
                            user.aktif
                                ? "Aktif"
                                : "Nonaktif"
                        }
                    </td>

                    <td>
                        <div class="account-action">

                            <button
                                type="button"
                                class="account-edit small-btn"
                            >
                                ✏️ Edit
                            </button>

                            ${
                                String(user.username)
                                    .toLowerCase() !==
                                String(currentUser.username)
                                    .toLowerCase()
                                    ? `
                                        <button
                                            type="button"
                                            class="account-delete small-btn danger-btn"
                                        >
                                            🗑️ Hapus
                                        </button>
                                    `
                                    : ""
                            }

                        </div>
                    </td>
                `;

                row
                    .querySelector(".account-edit")
                    ?.addEventListener(
                        "click",
                        () => openUserModal(user)
                    );

                row
                    .querySelector(".account-delete")
                    ?.addEventListener(
                        "click",
                        () => deleteUserAccount(
                            user.username
                        )
                    );

                table.appendChild(row);
            }
        );

    } catch (error) {

        table.innerHTML = `
            <tr>
                <td colspan="6" class="empty">
                    Gagal memuat akun:
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;

        toast(error.message);
    }
}

function openUserModal(user = null) {

    if (!isPengurus()) {
        toast(
            "Hanya Pengurus yang dapat mengelola akun."
        );
        return;
    }

    const title =
        $("userModalTitle");

    const oldUsername =
        $("editOldUsername");

    const username =
        $("accountUsername");

    const password =
        $("accountPassword");

    const nama =
        $("accountNama");

    const role =
        $("accountRole");

    const aktif =
        $("accountAktif");

    const hint =
        $("passwordHint");

    if (
        !title ||
        !oldUsername ||
        !username ||
        !password ||
        !nama ||
        !role ||
        !aktif
    ) {
        toast(
            "Form Manajemen Akun tidak ditemukan."
        );
        return;
    }

    if (user) {

        title.textContent =
            "Edit Akun";

        oldUsername.value =
            user.username || "";

        username.value =
            user.username || "";

        password.value = "";

        password.required = false;

        nama.value =
            user.nama || "";

        role.value =
            user.role || "Anggota";

        aktif.value =
            user.aktif
                ? "TRUE"
                : "FALSE";

        if (hint) {
            hint.textContent =
                "Kosongkan password jika tidak ingin mengubahnya.";
        }

    } else {

        title.textContent =
            "Tambah Akun";

        oldUsername.value = "";

        username.value = "";

        password.value = "";

        password.required = true;

        nama.value = "";

        role.value = "Anggota";

        aktif.value = "TRUE";

        if (hint) {
            hint.textContent =
                "Minimal 4 karakter.";
        }
    }

    openModal("userModal");
}

async function saveUser(event) {

    event.preventDefault();

    if (!isPengurus()) {
        toast(
            "Akses hanya untuk Pengurus."
        );
        return;
    }

    const oldUsername =
        $("editOldUsername")
            ?.value.trim() || "";

    const username =
        $("accountUsername")
            ?.value.trim() || "";

    const password =
        $("accountPassword")
            ?.value || "";

    const nama =
        $("accountNama")
            ?.value.trim() || "";

    const role =
        $("accountRole")
            ?.value || "Anggota";

    const aktif =
        $("accountAktif")
            ?.value || "TRUE";

    if (!username || !nama) {
        toast(
            "Username dan nama wajib diisi."
        );
        return;
    }

    if (
        !oldUsername &&
        password.length < 4
    ) {
        toast(
            "Password minimal 4 karakter."
        );
        return;
    }

    if (
        oldUsername &&
        password &&
        password.length < 4
    ) {
        toast(
            "Password minimal 4 karakter."
        );
        return;
    }

    try {

        const action =
            oldUsername
                ? "updateUser"
                : "addUser";

        await callAPI(
            action,
            {
                ...authParams(),

                oldUsername,

                username,

                password,

                nama,

                role,

                aktif
            }
        );

        /*
         * Jika akun sendiri diedit, update session.
         */
        if (
            oldUsername &&
            oldUsername.toLowerCase() ===
            currentUser.username.toLowerCase()
        ) {

            currentUser.username =
                username;

            currentUser.nama =
                nama;

            currentUser.role =
                role;

            if (password) {
                currentUser.password =
                    password;
            }

            localStorage.setItem(
                "stepa_user",
                JSON.stringify(currentUser)
            );

            updateUserInfo();
            setupUserRoleUI();
        }

        closeModal("userModal");

        event.target.reset();

        await loadUsers();

        toast(
            oldUsername
                ? "Akun berhasil diperbarui."
                : "Akun berhasil dibuat."
        );

    } catch (error) {

        toast(
            "Gagal menyimpan akun: " +
            error.message
        );
    }
}

async function deleteUserAccount(username) {

    if (!isPengurus()) return;

    if (
        String(username).toLowerCase() ===
        String(currentUser.username).toLowerCase()
    ) {
        toast(
            "Akun yang sedang digunakan tidak boleh dihapus."
        );
        return;
    }

    if (
        !confirm(
            `Hapus akun "${username}"?`
        )
    ) {
        return;
    }

    /*
     * Code.gs yang sekarang memiliki ketidaksesuaian:
     *
     * case deleteUser:
     * role(p,"Pengurus",()=>deleteUser(p.username,p.requester))
     *
     * role() menggunakan p.username/p.password sebagai
     * kredensial requester, sedangkan deleteUser juga
     * menggunakan p.username sebagai akun target.
     *
     * Karena itu frontend mengirim requester + targetUsername.
     * Backend harus menerima targetUsername agar penghapusan
     * akun berjalan benar.
     */
    try {

        await callAPI(
            "deleteUser",
            {
                ...authParams(),

                targetUsername:
                    username,

                requester:
                    currentUser.username
            }
        );

        await loadUsers();

        toast(
            "Akun berhasil dihapus."
        );

    } catch (error) {

        toast(
            "Gagal menghapus akun: " +
            error.message
        );
    }
}

async function changeMyPassword(event) {

    event.preventDefault();

    if (!currentUser?.password) {
        toast(
            "Silakan login kembali."
        );
        return;
    }

    const oldPassword =
        $("oldPasswordAccount")
            ?.value || "";

    const newPassword =
        $("newPasswordAccount")
            ?.value || "";

    if (newPassword.length < 4) {
        toast(
            "Password baru minimal 4 karakter."
        );
        return;
    }

    try {

        await callAPI(
            "changePassword",
            {
                username:
                    currentUser.username,

                password:
                    currentUser.password,

                oldPassword,

                newPassword
            }
        );

        currentUser.password =
            newPassword;

        localStorage.setItem(
            "stepa_user",
            JSON.stringify(currentUser)
        );

        event.target.reset();

        toast(
            "Password berhasil diubah."
        );

    } catch (error) {

        toast(
            "Gagal mengubah password: " +
            error.message
        );
    }
}


/* =========================================================
   UPLOAD EXCEL / CSV ANGGOTA
   ========================================================= */

function setupUpload() {

    const table =
        $("anggotaTable");

    if (!table || $("uploadAnggotaBtn")) {
        return;
    }

    const container =
        table.closest(".table-container");

    if (!container) return;

    const panel =
        container.parentElement;

    if (!panel) return;

    const button =
        document.createElement("button");

    button.id =
        "uploadAnggotaBtn";

    button.type =
        "button";

    button.className =
        "primary-btn pengurus-only";

    button.textContent =
        "📁 Upload Excel / CSV";

    button.style.marginBottom =
        "12px";

    button.addEventListener(
        "click",
        () => {
            if (!isPengurus()) {
                toast(
                    "Hanya Pengurus yang dapat upload."
                );
                return;
            }

            $("anggotaFileInput")?.click();
        }
    );

    panel.insertBefore(
        button,
        container
    );

    const input =
        document.createElement("input");

    input.id =
        "anggotaFileInput";

    input.type =
        "file";

    input.accept =
        ".xlsx,.xls,.csv";

    input.hidden = true;

    input.addEventListener(
        "change",
        uploadAnggotaFile
    );

    document.body.appendChild(input);

    setupUserRoleUI();
}

function loadXLSX() {

    if (window.XLSX) {
        return Promise.resolve(
            window.XLSX
        );
    }

    if (xlsxPromise) {
        return xlsxPromise;
    }

    xlsxPromise =
        new Promise(
            (resolve, reject) => {

                const script =
                    document.createElement("script");

                script.src =
                    "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

                script.onload =
                    () => resolve(
                        window.XLSX
                    );

                script.onerror =
                    () => reject(
                        new Error(
                            "Library Excel gagal dimuat."
                        )
                    );

                document.head.appendChild(
                    script
                );
            }
        );

    return xlsxPromise;
}

function parseCSV(text) {

    const cleaned =
        String(text || "")
            .replace(/^\uFEFF/, "");

    const lines =
        cleaned
            .split(/\r?\n/)
            .filter(
                line => line.trim()
            );

    if (lines.length < 2) {
        return [];
    }

    const delimiter =
        lines[0].includes(";")
            ? ";"
            : ",";

    const headers =
        lines.shift()
            .split(delimiter)
            .map(
                x => x
                    .trim()
                    .toLowerCase()
            );

    return lines.map(line => {

        const values =
            line.split(delimiter);

        const object = {};

        headers.forEach(
            (header, index) => {

                if (!header) return;

                object[header] =
                    String(
                        values[index] || ""
                    ).trim();
            }
        );

        return object;
    });
}

function normalizeAnggotaRow(item) {

    let nama = "";
    let kelas = "";
    let hp = "";
    let status = "";

    Object.keys(item || {})
        .forEach(key => {

            const clean =
                String(key)
                    .toLowerCase()
                    .replace(
                        /[^a-z0-9]/g,
                        ""
                    );

            const value =
                String(
                    item[key] ?? ""
                ).trim();

            if (!value) return;

            if (
                !nama &&
                (
                    clean.includes("nama") ||
                    clean.includes("name") ||
                    clean.includes("siswa") ||
                    clean.includes("anggota") ||
                    clean.includes("peserta")
                )
            ) {
                nama = value;
            }

            if (
                !kelas &&
                (
                    clean.includes("kelas") ||
                    clean.includes("class") ||
                    clean.includes("jurusan") ||
                    clean.includes("rombel")
                )
            ) {
                kelas = value;
            }

            if (
                !hp &&
                (
                    clean === "hp" ||
                    clean.includes("wa") ||
                    clean.includes("telp") ||
                    clean.includes("kontak") ||
                    clean.includes("phone")
                )
            ) {
                hp = value;
            }

            if (
                !status &&
                clean.includes("status")
            ) {
                status = value;
            }
        });

    /*
     * Fallback jika nama kolom tidak standar.
     */
    if (!nama) {

        const values =
            Object.values(item || {})
                .map(
                    value =>
                        String(value).trim()
                )
                .filter(Boolean);

        if (values.length) {
            nama = values[0];
        }

        if (
            values.length > 1 &&
            !kelas
        ) {
            kelas = values[1];
        }
    }

    return {
        nama,
        kelas: kelas || "-",
        hp: hp || "-",
        status: status || "Aktif"
    };
}

async function uploadAnggotaFile(event) {

    const file =
        event.target.files?.[0];

    if (!file) return;

    if (!isPengurus()) {

        toast(
            "Hanya Pengurus yang dapat upload."
        );

        event.target.value = "";
        return;
    }

    try {

        let rows = [];

        const name =
            file.name.toLowerCase();

        if (name.endsWith(".csv")) {

            rows =
                parseCSV(
                    await file.text()
                );

        } else {

            const XLSX =
                await loadXLSX();

            const workbook =
                XLSX.read(
                    await file.arrayBuffer(),
                    { type: "array" }
                );

            const firstSheet =
                workbook.Sheets[
                    workbook.SheetNames[0]
                ];

            rows =
                XLSX.utils.sheet_to_json(
                    firstSheet,
                    { defval: "" }
                );
        }

        const newMembers =
            rows
                .map(normalizeAnggotaRow)
                .filter(
                    item => item.nama
                );

        if (!newMembers.length) {
            throw new Error(
                "Tidak ada data nama yang bisa dibaca dari file."
            );
        }

        /*
         * Code.gs yang kamu kirim belum memiliki action
         * addAnggota. Karena itu upload tetap memakai
         * penyimpanan lokal yang sudah dipakai website.
         *
         * Ini menjaga fitur upload tetap berfungsi tanpa
         * mengirim request ke action backend yang belum ada.
         */
        const existing =
            JSON.parse(
                localStorage.getItem(
                    "stepa_local_anggota"
                ) || "[]"
            );

        const updated =
            [
                ...(Array.isArray(existing)
                    ? existing
                    : []),
                ...newMembers
            ];

        localStorage.setItem(
            "stepa_local_anggota",
            JSON.stringify(updated)
        );

        data.anggota = [
            ...(data.anggota || []),
            ...newMembers
        ];

        renderAnggota();
        populateAbsensiNames();

        if ($("statAnggota")) {
            $("statAnggota").textContent =
                data.anggota.length;
        }

        toast(
            `${newMembers.length} anggota berhasil di-upload.`
        );

    } catch (error) {

        console.error(
            "UPLOAD ERROR:",
            error
        );

        toast(
            "Upload gagal: " +
            error.message
        );

    } finally {

        event.target.value = "";
    }
}


/* =========================================================
   GLOBAL EXPORT
   ========================================================= */

window.showPage = showPage;
window.openModal = openModal;
window.closeModal = closeModal;
window.loadAllData = loadAllData;
window.deleteKas = deleteKas;
window.deleteAbsensi = deleteAbsensi;
window.loadUsers = loadUsers;
window.openUserModal = openUserModal;
window.syncData = syncData;
