/* =========================================================
   PERBAIKAN CALON ANGGOTA
   Tujuan:
   - Pengurus dapat upload/hapus
   - Anggota dapat melihat data yang sama
   - Data calon anggota tersimpan di Google Sheets
   - Tidak lagi bergantung pada localStorage
   ========================================================= */


/* =========================================================
   LOAD DATA
   ========================================================= */

async function loadAllData() {

    if (!currentUser) return;

    if (!currentUser.password) {
        toast("Session lama terdeteksi. Silakan login kembali.");
        handleLogout();
        return;
    }

    try {

        const response = await callAPI(
            "allData",
            authParams()
        );

        const serverData = response.data || {};

        data = {
            anggota: Array.isArray(serverData.anggota)
                ? serverData.anggota
                : [],

            kas: Array.isArray(serverData.kas)
                ? serverData.kas
                : [],

            absensi: Array.isArray(serverData.absensi)
                ? serverData.absensi
                : []
        };

        /*
         * JANGAN lagi mengambil calon anggota
         * dari localStorage.
         *
         * Semua perangkat mengambil data
         * langsung dari Google Sheets.
         */

        renderAll();

    } catch (error) {

        console.error("LOAD DATA ERROR:", error);

        toast(
            "Gagal memuat data: " +
            error.message
        );
    }
}


/* =========================================================
   CALON ANGGOTA
   ========================================================= */

function renderAnggota() {

    const table = $("anggotaTable");

    if (!table) return;

    const anggota = Array.isArray(data.anggota)
        ? data.anggota
        : [];

    if (!anggota.length) {

        table.innerHTML = `
            <tr>
                <td colspan="6" class="empty">
                    Belum ada data calon anggota.
                </td>
            </tr>
        `;

        if ($("statAnggota")) {
            $("statAnggota").textContent = "0";
        }

        return;
    }

    table.innerHTML = "";

    anggota.forEach((item, index) => {

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${index + 1}</td>

            <td>
                ${escapeHTML(item.nama || "-")}
            </td>

            <td>
                ${escapeHTML(item.kelas || "-")}
            </td>

            <td>
                ${escapeHTML(
                    item.hp ||
                    item.no_hp ||
                    "-"
                )}
            </td>

            <td>
                <span class="badge hadir">
                    ${escapeHTML(
                        item.status || "Aktif"
                    )}
                </span>
            </td>

            ${
                isPengurus()
                    ? `
                    <td>
                        <button
                            type="button"
                            class="small-btn danger-btn"
                            data-anggota-index="${index}"
                        >
                            🗑️ Hapus
                        </button>
                    </td>
                    `
                    : `
                    <td>
                        <span class="badge">
                            Lihat saja
                        </span>
                    </td>
                    `
            }
        `;

        if (isPengurus()) {

            row
                .querySelector("[data-anggota-index]")
                ?.addEventListener(
                    "click",
                    () => deleteAnggota(index)
                );
        }

        table.appendChild(row);
    });

    if ($("statAnggota")) {
        $("statAnggota").textContent =
            anggota.length;
    }
}


/* =========================================================
   HAPUS CALON ANGGOTA
   ========================================================= */

async function deleteAnggota(index) {

    if (!isPengurus()) {
        toast(
            "Hanya Pengurus yang dapat menghapus calon anggota."
        );
        return;
    }

    const anggota = data.anggota[index];

    if (!anggota) {
        toast("Data calon anggota tidak ditemukan.");
        return;
    }

    const nama =
        anggota.nama ||
        "calon anggota ini";

    if (
        !confirm(
            `Yakin ingin menghapus "${nama}"?`
        )
    ) {
        return;
    }

    if (!anggota.id) {
        toast(
            "ID calon anggota tidak ditemukan."
        );
        return;
    }

    try {

        await callAPI(
            "deleteAnggota",
            {
                ...authParams(),
                id: anggota.id
            }
        );

        await loadAllData();

        toast(
            `"${nama}" berhasil dihapus.`
        );

    } catch (error) {

        console.error(
            "DELETE ANGGOTA ERROR:",
            error
        );

        toast(
            "Gagal menghapus calon anggota: " +
            error.message
        );
    }
}


/* =========================================================
   UPLOAD EXCEL / CSV
   ========================================================= */

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
                    {
                        type: "array"
                    }
                );

            const firstSheet =
                workbook.Sheets[
                    workbook.SheetNames[0]
                ];

            rows =
                XLSX.utils.sheet_to_json(
                    firstSheet,
                    {
                        defval: ""
                    }
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

        let berhasil = 0;

        /*
         * KIRIM SETIAP CALON ANGGOTA
         * KE GOOGLE SHEETS.
         */
        for (const anggota of newMembers) {

            await callAPI(
                "addAnggota",
                {
                    ...authParams(),

                    nama:
                        anggota.nama,

                    kelas:
                        anggota.kelas,

                    hp:
                        anggota.hp,

                    status:
                        anggota.status
                }
            );

            berhasil++;
        }

        /*
         * Ambil ulang dari server.
         * Data sekarang akan sama di HP,
         * laptop, dan perangkat lain.
         */
        await loadAllData();

        toast(
            `${berhasil} calon anggota berhasil disimpan ke Google Sheets.`
        );

    } catch (error) {

        console.error(
            "UPLOAD ANGGOTA ERROR:",
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
   SINKRONISASI
   ========================================================= */

async function syncData() {

    if (!currentUser) {
        toast(
            "Silakan login terlebih dahulu."
        );
        return;
    }

    try {

        await loadAllData();

        toast(
            "Data berhasil disinkronkan dari Google Sheets."
        );

    } catch (error) {

        console.error(
            "SYNC ERROR:",
            error
        );

        toast(
            "Sinkronisasi gagal: " +
            error.message
        );
    }
}


/* =========================================================
   ROLE UI
   ========================================================= */

function setupUserRoleUI() {

    const pengurus = isPengurus();

    /*
     * Semua elemen pengurus-only hanya terlihat
     * oleh Pengurus.
     */
    document
        .querySelectorAll(".pengurus-only")
        .forEach(element => {

            element.style.display =
                pengurus ? "" : "none";
        });

    /*
     * Anggota tetap boleh melihat halaman
     * Calon Anggota.
     */
    const anggotaNav =
        document.querySelector(
            '[data-page="anggota"]'
        );

    if (anggotaNav) {
        anggotaNav.style.display = "";
    }
}


/* =========================================================
   EXPORT
   ========================================================= */

window.loadAllData = loadAllData;
window.renderAnggota = renderAnggota;
window.deleteAnggota = deleteAnggota;
window.uploadAnggotaFile = uploadAnggotaFile;
window.syncData = syncData;
