/* =====================================================
   STEPA MANAGEMENT - FRONTEND FINAL
   HTML + CSS TETAP
   ===================================================== */

const API_URL =
    "https://script.google.com/macros/s/AKfycbx7yEi1qlMMgifS6-qA5rMpiniyLWEBjGQpsvdNwN0XApaZj2mgWLWJg3rqA-psyYWkbA/exec";

let currentUser = null;

let data = {
    anggota: [],
    kas: [],
    absensi: []
};


/* =====================================================
   INISIALISASI
   ===================================================== */

document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    setupUploadFeature();
    checkSession();
});


/* =====================================================
   API / JSONP
   ===================================================== */

function callAPI(action, params = {}) {

    return new Promise((resolve, reject) => {

        const callbackName =
            "stepa_cb_" +
            Date.now() +
            "_" +
            Math.floor(Math.random() * 100000);

        const queryParams = new URLSearchParams({
            action: action,
            callback: callbackName,
            ...params
        });

        const script = document.createElement("script");

        script.src =
            API_URL + "?" + queryParams.toString();

        let finished = false;

        const cleanup = () => {

            if (window[callbackName]) {
                delete window[callbackName];
            }

            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        };

        const timeout = setTimeout(() => {

            if (finished) return;

            finished = true;
            cleanup();

            reject(
                new Error(
                    "Waktu koneksi habis. Periksa deployment Google Apps Script."
                )
            );

        }, 15000);


        window[callbackName] = (response) => {

            if (finished) return;

            finished = true;

            clearTimeout(timeout);
            cleanup();

            if (response && response.success) {

                resolve(response);

            } else {

                reject(
                    new Error(
                        response?.message ||
                        "Gagal memproses data."
                    )
                );

            }
        };


        script.onerror = () => {

            if (finished) return;

            finished = true;

            clearTimeout(timeout);
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


/* =====================================================
   UTILITAS
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

    const nominal =
        Number(value) || 0;

    return "Rp" +
        nominal.toLocaleString("id-ID");
}


function showToast(message) {

    const toast = $("toast");

    if (!toast) {
        alert(message);
        return;
    }

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(window.stepaToastTimer);

    window.stepaToastTimer =
        setTimeout(() => {

            toast.classList.remove("show");

        }, 3000);
}


function openModal(id) {

    const modal = $(id);

    if (modal) {
        modal.classList.add("show");
    }
}


function closeModal(id) {

    const modal = $(id);

    if (modal) {
        modal.classList.remove("show");
    }
}


/* =====================================================
   SESSION
   ===================================================== */

function checkSession() {

    const saved =
        localStorage.getItem("stepa_user");

    if (!saved) {

        showLoginPage();

        return;
    }

    try {

        currentUser =
            JSON.parse(saved);

        if (
            !currentUser ||
            !currentUser.username
        ) {

            throw new Error(
                "Session tidak valid."
            );
        }

        showMainApp();

    } catch (error) {

        localStorage.removeItem(
            "stepa_user"
        );

        currentUser = null;

        showLoginPage();
    }
}


function showLoginPage() {

    const loginPage =
        $("loginPage");

    const appPage =
        $("appPage");


    if (loginPage) {

        loginPage.style.display =
            "flex";
    }


    if (appPage) {

        appPage.classList.add(
            "hidden"
        );

        appPage.style.display =
            "none";
    }
}


function showMainApp() {

    const loginPage =
        $("loginPage");

    const appPage =
        $("appPage");


    if (loginPage) {

        loginPage.style.display =
            "none";
    }


    if (appPage) {

        appPage.classList.remove(
            "hidden"
        );

        appPage.style.display = "";
    }


    updateUserInfo();

    setupUserRoleUI();
    renderMemberAttendanceContent();

    showPage("dashboard");

    // Render dashboard berdasarkan role SEBELUM API dipanggil.
    // Dengan begitu dashboard Anggota tetap muncul meskipun data Google Sheets
    // sedang loading atau API mengalami timeout.
    renderMemberAttendanceDashboard();
    renderMemberAttendanceContent();

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

    // Tandai role sedini mungkin; CSS menggunakan class ini untuk
    // memastikan dashboard yang benar tampil.
    const anggotaRole = String(role).trim().toLowerCase() === "anggota";
    document.body.classList.toggle("role-anggota", anggotaRole);
    document.body.classList.toggle("role-pengurus", !anggotaRole);


    if ($("userName")) {

        $("userName").textContent =
            nama;
    }


    if ($("userRole")) {

        $("userRole").textContent =
            role;
    }


    if ($("userAvatar")) {

        $("userAvatar").textContent =
            nama.charAt(0).toUpperCase();
    }
}


/* =====================================================
   ROLE
   ===================================================== */

function isPengurus() {

    return String(
        currentUser?.role || ""
    ).toLowerCase() === "pengurus";
}


function setupUserRoleUI() {

    const pengurus =
        isPengurus();


    document
        .querySelectorAll(".pengurus-only")
        .forEach(element => {

            element.style.display =
                pengurus ? "" : "none";

        });
}


/* =====================================================
   NAVIGASI
   ===================================================== */

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


    document
        .querySelectorAll(".page")
        .forEach(page => {

            page.classList.remove(
                "active-page"
            );

        });


    const targetPage =
        $(pageName + "Page");


    if (targetPage) {

        targetPage.classList.add(
            "active-page"
        );
    }


    document
        .querySelectorAll(".nav-item")
        .forEach(item => {

            item.classList.toggle(
                "active",
                item.dataset.page === pageName
            );

        });


    const titles = {

        dashboard: {
            title: "Dashboard",
            subtitle:
                "Ringkasan kegiatan STEPA"
        },

        kas: {
            title: "Kas STEPA",
            subtitle:
                "Kelola pemasukan dan pengeluaran kas"
        },

        absensi: {
            title: "Absensi",
            subtitle:
                "Catat kehadiran calon anggota STEPA"
        },

        anggota: {
            title: "Calon Anggota",
            subtitle:
                "Data calon anggota STEPA"
        },

        akun: {
            title: "Manajemen Akun",
            subtitle:
                "Kelola username, password, role, dan status akun"
        }

    };


    const info =
        titles[pageName];


    if ($("pageTitle")) {

        $("pageTitle").textContent =
            info.title;
    }


    if ($("pageSubtitle")) {

        $("pageSubtitle").textContent =
            info.subtitle;
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
    }


    if (pageName === "akun") {

        if (!isPengurus()) {

            showPage("dashboard");

            showToast(
                "Akses hanya untuk Pengurus."
            );

            return;
        }

        loadUsers();
    }
}


/* =====================================================
   EVENT LISTENERS
   ===================================================== */

function setupEventListeners() {

    /* LOGIN */

    const loginForm =
        $("loginForm");

    if (loginForm) {

        loginForm.addEventListener(
            "submit",
            handleLogin
        );
    }


    /* SHOW PASSWORD */

    const showPassword =
        $("showPassword");

    if (showPassword) {

        showPassword.addEventListener(
            "click",
            () => {

                const password =
                    $("password");

                if (!password) return;


                if (
                    password.type ===
                    "password"
                ) {

                    password.type =
                        "text";

                    showPassword.textContent =
                        "🙈";

                } else {

                    password.type =
                        "password";

                    showPassword.textContent =
                        "👁";
                }

            }
        );
    }


    /* LOGOUT */

    const logoutBtn =
        $("logoutBtn");

    if (logoutBtn) {

        logoutBtn.addEventListener(
            "click",
            handleLogout
        );
    }


    /* NAVIGASI */

    document
        .querySelectorAll(".nav-item")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    showPage(
                        button.dataset.page
                    );

                }
            );
        });


    /* LIHAT SEMUA */

    document
        .querySelectorAll("[data-page-btn]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    showPage(
                        button.dataset.pageBtn
                    );

                }
            );
        });


    /* REFRESH */

    const refreshBtn =
        $("refreshBtn");

    if (refreshBtn) {

        refreshBtn.addEventListener(
            "click",
            async () => {

                await loadAllData();

                showToast(
                    "Data berhasil diperbarui."
                );

            }
        );
    }


    /* SINKRONISASI */

    const syncBtn =
        $("syncBtn");

    if (syncBtn) {

        syncBtn.addEventListener(
            "click",
            syncData
        );
    }


    /* MODAL CLOSE */

    document
        .querySelectorAll(".close-modal")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    closeModal(
                        button.dataset.close
                    );

                }
            );
        });


    /* KLIK LUAR MODAL */

    document
        .querySelectorAll(".modal")
        .forEach(modal => {

            modal.addEventListener(
                "click",
                event => {

                    if (
                        event.target === modal
                    ) {

                        modal.classList.remove(
                            "show"
                        );
                    }

                }
            );
        });


    /* KAS */

    const kasForm =
        $("kasForm");

    if (kasForm) {

        kasForm.addEventListener(
            "submit",
            handleAddKas
        );
    }


    const addKasBtn =
        $("addKasBtn");

    if (addKasBtn) {

        addKasBtn.addEventListener(
            "click",
            () => {

                if (!isPengurus()) {

                    showToast(
                        "Hanya pengurus yang dapat menginput kas."
                    );

                    return;
                }

                openModal("kasModal");
            }
        );
    }


    /* ABSENSI */

    const absensiForm =
        $("absensiForm");

    if (absensiForm) {

        absensiForm.addEventListener(
            "submit",
            handleAddAbsensi
        );
    }


    const addAbsensiBtn =
        $("addAbsensiBtn");

    if (addAbsensiBtn) {

        addAbsensiBtn.addEventListener(
            "click",
            () => {

                if (!isPengurus()) {

                    showToast(
                        "Hanya pengurus yang dapat menginput absensi."
                    );

                    return;
                }

                populateAbsensiNames();

                openModal(
                    "absensiModal"
                );
            }
        );
    }


    /* MANAJEMEN AKUN */

    const addUserBtn =
        $("addUserBtn");

    if (addUserBtn) {

        addUserBtn.addEventListener(
            "click",
            () => {

                if (!isPengurus()) return;

                openUserModal();
            }
        );
    }


    const refreshUsersBtn =
        $("refreshUsersBtn");

    if (refreshUsersBtn) {

        refreshUsersBtn.addEventListener(
            "click",
            loadUsers
        );
    }


    const userForm =
        $("userForm");

    if (userForm) {

        userForm.addEventListener(
            "submit",
            saveUser
        );
    }


    const myPasswordForm =
        $("myPasswordForm");

    if (myPasswordForm) {

        myPasswordForm.addEventListener(
            "submit",
            changeMyPassword
        );
    }
}


/* =====================================================
   LOGIN
   ===================================================== */

async function handleLogin(event) {

    event.preventDefault();


    const username =
        $("username")?.value.trim();


    const password =
        $("password")?.value.trim();


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

        message.textContent =
            "Sedang masuk...";
    }


    try {

        const response =
            await callAPI(
                "login",
                {
                    username,
                    password
                }
            );


        if (
            !response ||
            !response.success ||
            !response.data
        ) {

            throw new Error(
                response?.message ||
                "Login gagal."
            );
        }


        currentUser = {

            ...response.data,

            password: password
        };


        localStorage.setItem(
            "stepa_user",
            JSON.stringify(
                currentUser
            )
        );


        if (message) {

            message.textContent = "";
        }


        showMainApp();


        showToast(
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
        }

        console.error(
            "STEPA LOGIN ERROR:",
            error
        );
    }
}


/* =====================================================
   LOGOUT
   ===================================================== */

function handleLogout() {

    localStorage.removeItem(
        "stepa_user"
    );


    currentUser = null;


    data = {
        anggota: [],
        kas: [],
        absensi: []
    };


    if ($("loginForm")) {
        $("loginForm").reset();
    }


    if ($("loginMessage")) {
        $("loginMessage").textContent =
            "";
    }


    showLoginPage();


    showToast(
        "Berhasil keluar dari akun."
    );
}


/* =====================================================
   LOAD DATA
   ===================================================== */

async function loadAllData() {

    if (!currentUser) return;


    try {

        const response =
            await callAPI(
                "allData",
                {
                    username:
                        currentUser.username,

                    password:
                        currentUser.password
                }
            );


        data =
            response.data || {
                anggota: [],
                kas: [],
                absensi: []
            };


        data.anggota =
            Array.isArray(
                data.anggota
            )
                ? data.anggota
                : [];


        data.kas =
            Array.isArray(
                data.kas
            )
                ? data.kas
                : [];


        data.absensi =
            Array.isArray(
                data.absensi
            )
                ? data.absensi
                : [];


        renderAll();


    } catch (error) {

        console.error(
            "LOAD DATA ERROR:",
            error
        );


        showToast(
            "Gagal memuat data: " +
            error.message
        );
    }
}


/* =====================================================
   SINKRONISASI
   ===================================================== */

async function syncData() {

    if (!isPengurus()) {

        showToast(
            "Hanya pengurus yang dapat melakukan sinkronisasi."
        );

        return;
    }


    const button =
        $("syncBtn");


    if (button) {

        button.disabled = true;

        button.textContent =
            "⏳ Menyinkronkan...";
    }


    try {

        await loadAllData();

        showToast(
            "Data berhasil disinkronkan."
        );

    } finally {

        if (button) {

            button.disabled = false;

            button.textContent =
                "🔄 Sinkronisasi";
        }
    }
}


/* =====================================================
   ANGGOTA
   ===================================================== */

function renderAnggota() {

    const table =
        $("anggotaTable");

    if (!table) return;


    table.innerHTML = "";


    if (
        !data.anggota ||
        data.anggota.length === 0
    ) {

        table.innerHTML =
            `
            <tr>
                <td colspan="5" class="empty">
                    Belum ada calon anggota.
                </td>
            </tr>
            `;

        return;
    }


    data.anggota.forEach(
        (item, index) => {

            const status =
                item.status ||
                "Aktif";


            const badgeClass =
                String(status)
                    .toLowerCase() ===
                "aktif"
                    ? "hadir"
                    : "alpa";


            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML =
                `
                <td>
                    ${index + 1}
                </td>

                <td>
                    ${escapeHTML(
                        item.nama || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.kelas || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.hp || "-"
                    )}
                </td>

                <td>
                    <span class="badge ${badgeClass}">
                        ${escapeHTML(status)}
                    </span>
                </td>
                `;


            table.appendChild(row);
        }
    );
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
    ) {

        return "Masuk";
    }


    if (
        value === "pengeluaran" ||
        value === "keluar"
    ) {

        return "Keluar";
    }


    return jenis || "";
}


function renderKas() {

    const table =
        $("kasTable");

    if (!table) return;


    table.innerHTML = "";


    let totalMasuk = 0;
    let totalKeluar = 0;


    if (
        !data.kas ||
        data.kas.length === 0
    ) {

        table.innerHTML =
            `
            <tr>
                <td colspan="5" class="empty">
                    Belum ada catatan kas.
                </td>
            </tr>
            `;

    } else {

        data.kas.forEach(item => {

            const jenis =
                normalizeKasJenis(
                    item.jenis
                );


            const nominal =
                Number(item.nominal) ||
                0;


            if (jenis === "Masuk") {
                totalMasuk += nominal;
            }


            if (jenis === "Keluar") {
                totalKeluar += nominal;
            }


            const badgeClass =
                jenis === "Masuk"
                    ? "hadir"
                    : "alpa";


            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML =
                `
                <td>
                    ${escapeHTML(
                        item.tanggal || "-"
                    )}
                </td>

                <td>
                    <span class="badge ${badgeClass}">
                        ${escapeHTML(
                            jenis || "-"
                        )}
                    </span>
                </td>

                <td>
                    ${escapeHTML(
                        item.keterangan || "-"
                    )}
                </td>

                <td>
                    ${formatRupiah(
                        nominal
                    )}
                </td>

                <td class="pengurus-only">
                    ${
                        isPengurus()
                            ? `
                                <button
                                    class="delete-btn"
                                    onclick="deleteKas('${escapeHTML(item.id)}')">
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


    const saldo =
        totalMasuk -
        totalKeluar;


    if ($("kasMasuk")) {

        $("kasMasuk").textContent =
            formatRupiah(
                totalMasuk
            );
    }


    if ($("kasKeluar")) {

        $("kasKeluar").textContent =
            formatRupiah(
                totalKeluar
            );
    }


    if ($("kasSaldo")) {

        $("kasSaldo").textContent =
            formatRupiah(
                saldo
            );
    }


    if ($("statMasuk")) {

        $("statMasuk").textContent =
            formatRupiah(
                totalMasuk
            );
    }


    if ($("statKeluar")) {

        $("statKeluar").textContent =
            formatRupiah(
                totalKeluar
            );
    }


    if ($("statSaldo")) {

        $("statSaldo").textContent =
            formatRupiah(
                saldo
            );
    }


    setupUserRoleUI();
}


/* =====================================================
   ABSENSI
   ===================================================== */

function renderAbsensi() {

    const table =
        $("absensiTable");

    if (!table) return;


    table.innerHTML = "";


    if (
        !data.absensi ||
        data.absensi.length === 0
    ) {

        table.innerHTML =
            `
            <tr>
                <td colspan="5" class="empty">
                    Belum ada catatan absensi.
                </td>
            </tr>
            `;

        return;
    }


    data.absensi.forEach(item => {

        const status =
            String(
                item.status || ""
            );


        let badgeClass =
            "hadir";


        if (
            status.toLowerCase() ===
                "izin" ||
            status.toLowerCase() ===
                "sakit"
        ) {

            badgeClass =
                "izin";
        }


        if (
            status.toLowerCase() ===
            "alpa"
        ) {

            badgeClass =
                "alpa";
        }


        const row =
            document.createElement(
                "tr"
            );


        row.innerHTML =
            `
            <td>
                ${escapeHTML(
                    item.tanggal || "-"
                )}
            </td>

            <td>
                ${escapeHTML(
                    item.nama || "-"
                )}
            </td>

            <td>
                <span class="badge ${badgeClass}">
                    ${escapeHTML(status)}
                </span>
            </td>

            <td>
                ${escapeHTML(
                    item.keterangan || "-"
                )}
            </td>

            <td class="pengurus-only">
                ${
                    isPengurus()
                        ? `
                            <button
                                class="delete-btn"
                                onclick="deleteAbsensi('${escapeHTML(item.id)}')">
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

    const select =
        $("absensiNama");

    if (!select) return;


    select.innerHTML =
        `
        <option value="">
            -- Pilih Anggota --
        </option>
        `;


    if (
        !data.anggota ||
        data.anggota.length === 0
    ) {

        select.innerHTML =
            `
            <option value="">
                Belum ada calon anggota
            </option>
            `;

        return;
    }


    data.anggota.forEach(item => {

        const option =
            document.createElement(
                "option"
            );


        option.value =
            item.nama || "";


        option.textContent =
            `${item.nama || "-"} (${item.kelas || "-"})`;


        select.appendChild(option);

    });
}


/* =====================================================
   TANGGAL
   ===================================================== */

function parseDateOnly(value) {

    const text =
        String(value || "")
            .trim();


    const m =
        text.match(
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/
        );


    if (!m) return null;


    return new Date(
        Date.UTC(
            Number(m[1]),
            Number(m[2]) - 1,
            Number(m[3])
        )
    );
}


function getAcademicYearRange() {

    const now =
        new Date();


    const year =
        now.getFullYear();


    const month =
        now.getMonth() + 1;


    const startYear =
        month >= 7
            ? year
            : year - 1;


    return {

        start:
            `${startYear}-07-01`,

        end:
            `${startYear + 1}-06-30`

    };
}


/* =====================================================
   JADWAL LATIHAN
   Selasa = 2
   Kamis = 4
   Sabtu = 6
   ===================================================== */

function isTrainingDay(dateText) {

    const d =
        parseDateOnly(dateText);


    if (!d) return false;


    const day =
        d.getUTCDay();


    return (
        day === 2 ||
        day === 4 ||
        day === 6
    );
}


/* =====================================================
   ABSENSI PRIBADI
   ===================================================== */

function getPersonalAttendanceRecords() {

    if (!currentUser) {
        return [];
    }


    const nama =
        String(
            currentUser.nama || ""
        )
            .trim()
            .toLowerCase();


    const username =
        String(
            currentUser.username || ""
        )
            .trim()
            .toLowerCase();


    const range =
        getAcademicYearRange();


    return (data.absensi || [])

        .filter(item => {

            const tanggal =
                String(
                    item.tanggal || ""
                )
                    .slice(0, 10);


            if (!tanggal) {
                return false;
            }


            if (
                tanggal <
                    range.start ||
                tanggal >
                    range.end
            ) {

                return false;
            }


            if (
                !isTrainingDay(
                    tanggal
                )
            ) {

                return false;
            }


            const itemNama =
                String(
                    item.nama || ""
                )
                    .trim()
                    .toLowerCase();


            const itemUsername =
                String(
                    item.username || ""
                )
                    .trim()
                    .toLowerCase();


            if (itemUsername) {

                return (
                    itemUsername ===
                    username
                );
            }


            return (
                nama &&
                itemNama === nama
            );

        })

        .sort((a, b) => {

            return String(
                a.tanggal || ""
            ).localeCompare(
                String(
                    b.tanggal || ""
                )
            );

        });
}


function getPersonalAttendanceStats() {

    const records =
        getPersonalAttendanceRecords();


    let hadir = 0;
    let sakit = 0;
    let izin = 0;
    let alpa = 0;


    records.forEach(item => {

        const status =
            String(
                item.status || ""
            )
                .trim()
                .toLowerCase();


        if (status === "hadir") {
            hadir++;
        }

        else if (
            status === "sakit"
        ) {
            sakit++;
        }

        else if (
            status === "izin"
        ) {
            izin++;
        }

        else if (
            status === "alpa"
        ) {
            alpa++;
        }

    });


    const total =
        hadir +
        sakit +
        izin +
        alpa;


    const percentage =
        total > 0
            ? Math.round(
                (hadir / total) * 100
              )
            : 0;


    let label =
        "Belum Ada Data";


    if (total > 0) {

        if (percentage >= 90) {

            label =
                "Sangat Baik";

        } else if (
            percentage >= 80
        ) {

            label =
                "Baik";

        } else if (
            percentage >= 70
        ) {

            label =
                "Cukup";

        } else {

            label =
                "Perlu Perhatian";
        }
    }


    return {

        records,
        total,
        hadir,
        sakit,
        izin,
        alpa,
        percentage,
        label

    };
}


/* =====================================================
   FORMAT TANGGAL
   ===================================================== */

function formatTanggalIndonesia(value) {

    const d =
        parseDateOnly(value);


    if (!d) {

        return String(
            value || "-"
        );
    }


    const bulan = [

        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember"

    ];


    return (

        String(
            d.getUTCDate()
        ).padStart(2, "0") +

        " " +

        bulan[
            d.getUTCMonth()
        ] +

        " " +

        d.getUTCFullYear()

    );
}


function formatHariTanggalIndonesia(value) {

    const d =
        parseDateOnly(value);


    if (!d) {

        return formatTanggalIndonesia(
            value
        );
    }


    const hari = [

        "Minggu",
        "Senin",
        "Selasa",
        "Rabu",
        "Kamis",
        "Jumat",
        "Sabtu"

    ];


    return (

        hari[
            d.getUTCDay()
        ] +

        ", " +

        formatTanggalIndonesia(
            value
        )

    );
}


/* =====================================================
   GREETING
   ===================================================== */

function getGreeting() {

    const hour =
        new Date().getHours();


    if (
        hour >= 4 &&
        hour < 11
    ) {

        return "Selamat Pagi";
    }


    if (
        hour >= 11 &&
        hour < 15
    ) {

        return "Selamat Siang";
    }


    if (
        hour >= 15 &&
        hour < 18
    ) {

        return "Selamat Sore";
    }


    return "Selamat Malam";
}


/* =====================================================
   DASHBOARD ANGGOTA
   ===================================================== */

function ensureMemberAttendanceDashboard() {

    const host = $("memberAttendanceDashboard");
    if (!host) return null;

    if (!host.dataset.ready) {
        host.innerHTML = `
            <div class="member-dashboard-heading">
                <div>
                    <span class="member-dashboard-label">DASHBOARD ANGGOTA</span>
                    <h2 id="memberGreeting">Selamat Datang</h2>
                    <p id="memberToday">-</p>
                </div>
            </div>

            <div class="attendance-summary-card member-only-hadir-card">
                <div class="attendance-summary-content">
                    <span class="attendance-summary-title">Kehadiran Latihan</span>
                    <strong id="memberAttendancePercent">0%</strong>
                    <span id="memberAttendanceLabel" class="attendance-summary-status">Belum Ada Data</span>
                    <span class="attendance-summary-link">Jumlah kehadiran kamu</span>
                </div>
                <div class="attendance-summary-top">
                    <div id="attendanceCircle" class="attendance-circle">
                        <span id="attendanceCircleText">0%</span>
                    </div>
                </div>
            </div>

            <div class="member-quick-grid member-only-hadir-grid">
                <div class="member-quick-card hadir">
                    <small>Hadir</small>
                    <strong id="memberHadirCount">0 Hari</strong>
                </div>
            </div>

            <div class="member-info-grid member-only-hadir-history">
                <div class="member-info-box" style="grid-column:1 / -1;">
                    <h3>Riwayat Kehadiran</h3>
                    <div id="memberRecentAttendance" class="member-recent-list">
                        <div class="member-recent-item">
                            <div>
                                <strong>Belum ada data</strong>
                                <small>Data kehadiran akan muncul di sini.</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        host.dataset.ready = "1";
    }

    return host;
}


/* =====================================================
   RENDER DASHBOARD
   ===================================================== */

function renderDashboard() {
    renderDashboardKas();
    renderDashboardAbsensi();
    renderMemberAttendanceDashboard();
    renderMemberAttendanceContent();
}


/* =====================================================
   DASHBOARD ANGGOTA CONTENT
   ===================================================== */

function renderMemberAttendanceContent() {

    const host = ensureMemberAttendanceDashboard();
    if (!host) return;

    const pengurusDashboard = $("pengurusDashboard");

    // Pengurus: tampilkan dashboard asli, sembunyikan dashboard anggota.
    if (isPengurus()) {
        host.hidden = true;
        host.style.display = "none";
        if (pengurusDashboard) {
            pengurusDashboard.hidden = false;
            pengurusDashboard.style.display = "";
        }
        return;
    }

    // Anggota: tampilkan dashboard pribadi SAJA.
    host.hidden = false;
    host.style.display = "block";

    if (pengurusDashboard) {
        pengurusDashboard.hidden = true;
        pengurusDashboard.style.display = "none";
    }

    const stats = getPersonalAttendanceStats();
    const nama = currentUser?.nama || currentUser?.username || "Anggota";
    const today = new Date();

    const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const bulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const todayText = `${hari[today.getDay()]}, ${String(today.getDate()).padStart(2, "0")} ${bulan[today.getMonth()]} ${today.getFullYear()}`;

    if ($("memberGreeting")) $("memberGreeting").textContent = `${getGreeting()}, ${nama}`;
    if ($("memberToday")) $("memberToday").textContent = todayText;

    if ($("memberAttendancePercent")) $("memberAttendancePercent").textContent = `${stats.percentage}%`;
    if ($("attendanceCircleText")) $("attendanceCircleText").textContent = `${stats.percentage}%`;
    if ($("attendanceCircle")) {
        $("attendanceCircle").style.setProperty("--attendance-progress", `${stats.percentage * 3.6}deg`);
    }

    if ($("memberAttendanceLabel")) {
        let className = "attention";
        if (stats.total > 0 && stats.percentage >= 90) className = "excellent";
        else if (stats.total > 0 && stats.percentage >= 80) className = "good";
        else if (stats.total > 0 && stats.percentage >= 70) className = "fair";

        $("memberAttendanceLabel").textContent = stats.total ? stats.label : "Belum Ada Data";
        $("memberAttendanceLabel").className = `attendance-summary-status ${className}`;
    }

    if ($("memberHadirCount")) $("memberHadirCount").textContent = `${stats.hadir} Hari`;

    const recent = $("memberRecentAttendance");
    if (!recent) return;

    // Dashboard anggota hanya menampilkan catatan HADIR.
    const records = [...stats.records]
        .filter(item => String(item.status || "").trim().toLowerCase() === "hadir")
        .reverse()
        .slice(0, 5);

    if (!records.length) {
        recent.innerHTML = `
            <div class="member-recent-item">
                <div>
                    <strong>Belum ada kehadiran</strong>
                    <small>Catatan Hadir akan muncul setelah absensi dicatat.</small>
                </div>
            </div>
        `;
        return;
    }

    recent.innerHTML = records.map(item => `
        <div class="member-recent-item">
            <div>
                <strong>${escapeHTML(formatHariTanggalIndonesia(item.tanggal))}</strong>
                <small>${escapeHTML(item.keterangan || "Hadir latihan STEPA")}</small>
            </div>
            <span class="attendance-history-badge hadir">Hadir</span>
        </div>
    `).join("");
}


/* =====================================================
   DASHBOARD ABSENSI
   ===================================================== */

function renderDashboardAbsensi() {

    const table =
        $("dashboardAbsensi");


    if (!table) return;


    table.innerHTML = "";


    const items =
        [...(data.absensi || [])]
            .reverse()
            .slice(0, 5);


    if (items.length === 0) {

        table.innerHTML =
            `
            <tr>
                <td colspan="3" class="empty">
                    Belum ada data absensi.
                </td>
            </tr>
            `;

        return;
    }


    items.forEach(item => {

        const status =
            String(
                item.status || ""
            );


        const lower =
            status.toLowerCase();


        let badgeClass =
            "hadir";


        if (
            lower === "izin" ||
            lower === "sakit"
        ) {

            badgeClass =
                "izin";
        }


        if (
            lower === "alpa"
        ) {

            badgeClass =
                "alpa";
        }


        const row =
            document.createElement(
                "tr"
            );


        row.innerHTML =
            `
            <td>
                ${escapeHTML(
                    item.tanggal || "-"
                )}
            </td>

            <td>
                ${escapeHTML(
                    item.nama || "-"
                )}
            </td>

            <td>
                <span class="badge ${badgeClass}">
                    ${escapeHTML(status)}
                </span>
            </td>
            `;


        table.appendChild(row);

    });
}


/* =====================================================
   DASHBOARD KAS
   ===================================================== */

function renderDashboardKas() {

    const table =
        $("dashboardKas");


    if (!table) return;


    table.innerHTML = "";


    const items =
        [...(data.kas || [])]
            .reverse()
            .slice(0, 5);


    if (items.length === 0) {

        table.innerHTML =
            `
            <tr>
                <td colspan="3" class="empty">
                    Belum ada transaksi kas.
                </td>
            </tr>
            `;

        return;
    }


    items.forEach(item => {

        const nominal =
            Number(
                item.nominal
            ) || 0;


        const row =
            document.createElement(
                "tr"
            );


        row.innerHTML =
            `
            <td>
                ${escapeHTML(
                    item.tanggal || "-"
                )}
            </td>

            <td>
                ${escapeHTML(
                    item.keterangan || "-"
                )}
            </td>

            <td>
                ${formatRupiah(
                    nominal
                )}
            </td>
            `;


        table.appendChild(row);

    });
}


/* =====================================================
   POPUP DETAIL ABSENSI
   ===================================================== */

/* =====================================================
   ADD KAS
   ===================================================== */

async function handleAddKas(event) {

    event.preventDefault();


    if (!isPengurus()) {

        showToast(
            "Hanya pengurus yang dapat menambah kas."
        );

        return;
    }


    const jenisValue =
        $("kasJenis")?.value;


    const keterangan =
        $("kasKeterangan")
            ?.value.trim();


    const nominal =
        $("kasNominal")?.value;


    if (
        !jenisValue ||
        !keterangan ||
        !nominal
    ) {

        showToast(
            "Semua data transaksi wajib diisi."
        );

        return;
    }


    const jenis =
        normalizeKasJenis(
            jenisValue
        );


    try {

        await callAPI(
            "addKas",
            {
                jenis,
                keterangan,
                nominal,
                username:
                    currentUser.username,
                password:
                    currentUser.password
            }
        );


        closeModal(
            "kasModal"
        );


        event.target.reset();


        await loadAllData();


        showToast(
            "Transaksi kas berhasil disimpan."
        );


    } catch (error) {

        showToast(
            "Gagal menyimpan kas: " +
            error.message
        );
    }
}


/* =====================================================
   DELETE KAS
   ===================================================== */

async function deleteKas(id) {

    if (!isPengurus()) {

        showToast(
            "Anda tidak memiliki akses."
        );

        return;
    }


    if (
        !confirm(
            "Apakah Anda yakin ingin menghapus transaksi ini?"
        )
    ) {

        return;
    }


    try {

        await callAPI(
            "deleteKas",
            {
                id,
                username:
                    currentUser.username,
                password:
                    currentUser.password
            }
        );


        await loadAllData();


        showToast(
            "Transaksi berhasil dihapus."
        );


    } catch (error) {

        showToast(
            "Gagal menghapus transaksi: " +
            error.message
        );
    }
}


/* =====================================================
   ADD ABSENSI
   ===================================================== */

async function handleAddAbsensi(event) {

    event.preventDefault();


    if (!isPengurus()) {

        showToast(
            "Hanya pengurus yang dapat menginput absensi."
        );

        return;
    }


    const tanggal =
        $("absensiTanggal")?.value;


    const nama =
        $("absensiNama")?.value;


    const status =
        $("absensiStatus")?.value;


    const keterangan =
        $("absensiKeterangan")
            ?.value.trim();


    if (
        !tanggal ||
        !nama ||
        !status
    ) {

        showToast(
            "Tanggal, nama, dan status wajib diisi."
        );

        return;
    }


    /*
     * Validasi jadwal latihan
     */

    if (!isTrainingDay(tanggal)) {

        showToast(
            "Absensi hanya dapat dicatat pada hari Selasa, Kamis, atau Sabtu."
        );

        return;
    }


    try {

        await callAPI(
            "addAbsensi",
            {
                tanggal,
                nama,
                status,
                keterangan:
                    keterangan || "-",

                username:
                    currentUser.username,

                password:
                    currentUser.password
            }
        );


        closeModal(
            "absensiModal"
        );


        event.target.reset();


        await loadAllData();


        showToast(
            "Absensi berhasil dicatat."
        );


    } catch (error) {

        showToast(
            "Gagal menyimpan absensi: " +
            error.message
        );
    }
}


/* =====================================================
   DELETE ABSENSI
   ===================================================== */

async function deleteAbsensi(id) {

    if (!isPengurus()) {

        showToast(
            "Anda tidak memiliki akses."
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
                id,
                username:
                    currentUser.username,
                password:
                    currentUser.password
            }
        );


        await loadAllData();


        showToast(
            "Absensi berhasil dihapus."
        );


    } catch (error) {

        showToast(
            "Gagal menghapus absensi: " +
            error.message
        );
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
}


/* =====================================================
   MANAJEMEN AKUN
   ===================================================== */

function accountAuthParams() {

    return {

        username:
            currentUser?.username || "",

        password:
            currentUser?.password || ""

    };
}


async function loadUsers() {

    const table =
        $("usersTable");


    if (
        !table ||
        !isPengurus()
    ) {

        return;
    }


    if (
        !currentUser?.password
    ) {

        table.innerHTML =
            `
            <tr>
                <td colspan="6" class="empty">
                    Silakan logout lalu login kembali untuk mengelola akun.
                </td>
            </tr>
            `;

        return;
    }


    table.innerHTML =
        `
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
                accountAuthParams()
            );


        const users =
            Array.isArray(
                response.data
            )
                ? response.data
                : [];


        if (!users.length) {

            table.innerHTML =
                `
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

                const tr =
                    document.createElement(
                        "tr"
                    );


                const statusClass =
                    user.aktif
                        ? "account-status-active"
                        : "account-status-off";


                tr.innerHTML =
                    `
                    <td>
                        ${index + 1}
                    </td>

                    <td>
                        ${escapeHTML(
                            user.username
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            user.nama
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            user.role
                        )}
                    </td>

                    <td class="${statusClass}">
                        ${
                            user.aktif
                                ? "Aktif"
                                : "Nonaktif"
                        }
                    </td>

                    <td>

                        <div class="account-action">

                            <button
                                class="account-edit"
                                type="button">
                                ✏️ Edit
                            </button>

                            ${
                                String(
                                    user.username
                                ).toLowerCase() !==
                                String(
                                    currentUser.username
                                ).toLowerCase()
                                    ? `
                                        <button
                                            class="account-delete"
                                            type="button">
                                            🗑️ Hapus
                                        </button>
                                      `
                                    : ""
                            }

                        </div>

                    </td>
                    `;


                const editBtn =
                    tr.querySelector(
                        ".account-edit"
                    );


                if (editBtn) {

                    editBtn.addEventListener(
                        "click",
                        () => {

                            openUserModal(
                                user
                            );

                        }
                    );
                }


                const deleteBtn =
                    tr.querySelector(
                        ".account-delete"
                    );


                if (deleteBtn) {

                    deleteBtn.addEventListener(
                        "click",
                        () => {

                            deleteUserAccount(
                                user.username
                            );

                        }
                    );
                }


                table.appendChild(tr);

            }
        );


    } catch (error) {

        table.innerHTML =
            `
            <tr>
                <td colspan="6" class="empty">
                    Gagal memuat akun:
                    ${escapeHTML(
                        error.message
                    )}
                </td>
            </tr>
            `;


        showToast(
            error.message
        );
    }
}


/* =====================================================
   MODAL AKUN
   ===================================================== */

function openUserModal(user = null) {

    if (!isPengurus()) return;


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

        showToast(
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


        password.required =
            false;


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


        oldUsername.value =
            "";


        username.value =
            "";


        password.value =
            "";


        password.required =
            true;


        nama.value =
            "";


        role.value =
            "Anggota";


        aktif.value =
            "TRUE";


        if (hint) {

            hint.textContent =
                "Minimal 4 karakter.";
        }
    }


    openModal(
        "userModal"
    );
}


/* =====================================================
   SIMPAN AKUN
   ===================================================== */

async function saveUser(event) {

    event.preventDefault();


    if (!isPengurus()) {

        showToast(
            "Akses hanya untuk Pengurus."
        );

        return;
    }


    const oldUsername =
        $("editOldUsername")
            .value.trim();


    const username =
        $("accountUsername")
            .value.trim();


    const password =
        $("accountPassword")
            .value;


    const nama =
        $("accountNama")
            .value.trim();


    const role =
        $("accountRole")
            .value;


    const aktif =
        $("accountAktif")
            .value;


    if (
        !username ||
        !nama
    ) {

        showToast(
            "Username dan nama wajib diisi."
        );

        return;
    }


    if (
        !oldUsername &&
        password.length < 4
    ) {

        showToast(
            "Password minimal 4 karakter."
        );

        return;
    }


    if (
        oldUsername &&
        password &&
        password.length < 4
    ) {

        showToast(
            "Password minimal 4 karakter."
        );

        return;
    }


    try {

        if (oldUsername) {
            await callAPI(
                "updateUser",
                {
                    ...accountAuthParams(),
                    oldUsername: oldUsername,
                    targetUsername: username,
                    passwordBaru: password,
                    nama: nama,
                    role: role,
                    aktif: aktif
                }
            );
        } else {
            await callAPI(
                "addUser",
                {
                    ...accountAuthParams(),
                    username: username,
                    password: password,
                    nama: nama,
                    role: role,
                    aktif: aktif
                }
            );
        }


        /*
         * Kalau pengurus mengedit
         * akun sendiri.
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
                JSON.stringify(
                    currentUser
                )
            );


            updateUserInfo();

            setupUserRoleUI();
        }


        closeModal(
            "userModal"
        );


        event.target.reset();


        await loadUsers();


        showToast(
            oldUsername
                ? "Akun berhasil diperbarui."
                : "Akun berhasil dibuat."
        );


    } catch (error) {

        showToast(
            "Gagal: " +
            error.message
        );
    }
}


/* =====================================================
   HAPUS AKUN
   ===================================================== */

async function deleteUserAccount(username) {

    if (!isPengurus()) return;


    if (
        String(username).toLowerCase() ===
        String(
            currentUser.username
        ).toLowerCase()
    ) {

        showToast(
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


    try {

        /*
         * PENTING:
         *
         * username =
         * akun pengurus yang login
         *
         * targetUsername =
         * akun yang akan dihapus
         */

        await callAPI(
            "deleteUser",
            {
                username:
                    currentUser.username,

                password:
                    currentUser.password,

                targetUsername:
                    username
            }
        );


        await loadUsers();


        showToast(
            "Akun berhasil dihapus."
        );


    } catch (error) {

        showToast(
            "Gagal menghapus akun: " +
            error.message
        );
    }
}


/* =====================================================
   GANTI PASSWORD SENDIRI
   ===================================================== */

async function changeMyPassword(event) {

    event.preventDefault();


    if (
        !currentUser?.password
    ) {

        showToast(
            "Silakan logout lalu login kembali."
        );

        return;
    }


    const oldPassword =
        $("oldPasswordAccount")
            .value;


    const newPassword =
        $("newPasswordAccount")
            .value;


    if (
        newPassword.length < 4
    ) {

        showToast(
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

                oldPassword:
                    oldPassword,

                newPassword:
                    newPassword
            }
        );


        currentUser.password =
            newPassword;


        localStorage.setItem(
            "stepa_user",
            JSON.stringify(
                currentUser
            )
        );


        event.target.reset();


        showToast(
            "Password berhasil diubah."
        );


    } catch (error) {

        showToast(
            "Gagal mengubah password: " +
            error.message
        );
    }
}


/* =====================================================
   UPLOAD CALON ANGGOTA - EXCEL / CSV
   ===================================================== */

function setupUploadFeature() {

    const openButton = $("uploadAnggotaBtn");
    const form = $("uploadAnggotaForm");
    const fileInput = $("anggotaFile");
    const preview = $("uploadPreview");

    if (!openButton || !form || !fileInput) return;

    openButton.addEventListener("click", () => {
        if (!isPengurus()) {
            showToast("Hanya Pengurus yang dapat upload data.");
            return;
        }

        form.reset();
        if (preview) preview.innerHTML = "";
        openModal("uploadAnggotaModal");
    });

    fileInput.addEventListener("change", async () => {
        if (!fileInput.files || !fileInput.files[0]) return;

        try {
            const rows = await readAnggotaFile(fileInput.files[0]);
            renderUploadPreview(rows);
        } catch (error) {
            fileInput.value = "";
            if (preview) preview.innerHTML = "";
            showToast("File tidak bisa dibaca: " + error.message);
        }
    });

    form.addEventListener("submit", async event => {
        event.preventDefault();

        if (!isPengurus()) {
            showToast("Hanya Pengurus yang dapat upload data.");
            return;
        }

        const file = fileInput.files?.[0];
        if (!file) {
            showToast("Pilih file Excel atau CSV terlebih dahulu.");
            return;
        }

        const button = $("uploadAnggotaSubmit");
        const oldText = button ? button.textContent : "";

        try {
            if (button) {
                button.disabled = true;
                button.textContent = "⏳ Memproses...";
            }

            const rows = await readAnggotaFile(file);

            if (!rows.length) {
                throw new Error("Tidak ada data yang dapat diupload.");
            }

            let inserted = 0;
            let skipped = 0;

            // JSONP memakai GET, jadi data besar dikirim bertahap.
            const chunkSize = 20;

            for (let i = 0; i < rows.length; i += chunkSize) {
                const chunk = rows.slice(i, i + chunkSize);

                if (button) {
                    button.textContent =
                        `⏳ Upload ${Math.min(i + chunk.length, rows.length)}/${rows.length}...`;
                }

                const response = await callAPI("uploadAnggota", {
                    ...accountAuthParams(),
                    rows: JSON.stringify(chunk)
                });

                inserted += Number(response.data?.inserted || 0);
                skipped += Number(response.data?.skipped || 0);
            }

            closeModal("uploadAnggotaModal");
            await loadAllData();

            showToast(
                `Upload selesai: ${inserted} data ditambahkan` +
                (skipped ? `, ${skipped} data dilewati karena duplikat.` : ".")
            );

        } catch (error) {
            showToast("Upload gagal: " + error.message);
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = oldText || "📤 Upload ke Google Sheets";
            }
        }
    });
}


function normalizeUploadHeader(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[\s_\-.\/()]+/g, " ")
        .trim();
}


function findHeaderIndex(headers, aliases) {
    const normalized = headers.map(normalizeUploadHeader);

    for (const alias of aliases) {
        const index = normalized.indexOf(normalizeUploadHeader(alias));
        if (index >= 0) return index;
    }

    return -1;
}


async function readAnggotaFile(file) {

    if (typeof XLSX === "undefined") {
        throw new Error("Library pembaca Excel belum termuat. Periksa koneksi internet.");
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {
        type: "array",
        cellDates: false
    });

    const sheetName = workbook.SheetNames?.[0];
    if (!sheetName) throw new Error("Sheet pertama tidak ditemukan.");

    const worksheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        raw: false
    });

    if (!matrix.length) return [];

    const headers = matrix[0].map(value => String(value ?? "").trim());

    const idx = {
        id: findHeaderIndex(headers, ["id", "kode", "kode anggota", "nomor"]),
        nama: findHeaderIndex(headers, ["nama", "name", "nama calon anggota", "nama anggota"]),
        kelas: findHeaderIndex(headers, ["kelas", "class"]),
        hp: findHeaderIndex(headers, ["no hp", "hp", "nomor hp", "no handphone", "nomor handphone", "telepon", "no telepon"]),
        status: findHeaderIndex(headers, ["status", "status anggota"])
    };

    if (idx.nama < 0) {
        throw new Error("Kolom Nama tidak ditemukan. Pastikan baris pertama berisi header.");
    }

    const rows = [];

    for (let i = 1; i < matrix.length; i++) {
        const row = matrix[i] || [];
        const nama = String(row[idx.nama] ?? "").trim();

        if (!nama) continue;

        rows.push({
            id: idx.id >= 0 ? String(row[idx.id] ?? "").trim() : "",
            nama,
            kelas: idx.kelas >= 0 ? String(row[idx.kelas] ?? "").trim() : "",
            hp: idx.hp >= 0 ? String(row[idx.hp] ?? "").trim() : "",
            status: idx.status >= 0 ? String(row[idx.status] ?? "").trim() : "Calon Anggota"
        });
    }

    return rows;
}


function renderUploadPreview(rows) {

    const preview = $("uploadPreview");
    if (!preview) return;

    if (!rows.length) {
        preview.innerHTML = `<div class="empty">Tidak ada baris data yang ditemukan.</div>`;
        return;
    }

    const sample = rows.slice(0, 5);

    preview.innerHTML = `
        <div style="overflow:auto;max-height:220px;border:1px solid rgba(127,127,127,.2);border-radius:10px;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead>
                    <tr>
                        <th style="padding:8px;text-align:left;">Nama</th>
                        <th style="padding:8px;text-align:left;">Kelas</th>
                        <th style="padding:8px;text-align:left;">No HP</th>
                        <th style="padding:8px;text-align:left;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${sample.map(item => `
                        <tr>
                            <td style="padding:8px;">${escapeHTML(item.nama)}</td>
                            <td style="padding:8px;">${escapeHTML(item.kelas || "-")}</td>
                            <td style="padding:8px;">${escapeHTML(item.hp || "-")}</td>
                            <td style="padding:8px;">${escapeHTML(item.status || "Calon Anggota")}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
        <small style="display:block;margin-top:8px;opacity:.7;">
            Preview ${sample.length} dari ${rows.length} data. Data duplikat akan dilewati.
        </small>
    `;
}


/* =====================================================
   GLOBAL FUNCTION
   ===================================================== */

window.deleteKas =
    deleteKas;

window.deleteAbsensi =
    deleteAbsensi;

window.deleteUserAccount =
    deleteUserAccount;

window.showPage =
    showPage;

window.openModal =
    openModal;

window.closeModal =
    closeModal;

window.syncData =
    syncData;

window.openPersonalAttendanceDetail =
    openPersonalAttendanceDetail;

window.openUserModal =
    openUserModal;
