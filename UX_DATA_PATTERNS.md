# Xeenaps UX & Data Persistence Pattern

Dokumen ini menjelaskan standar **Strategi Penyimpanan (Saving)** dan **Strategi Loading** yang digunakan dalam aplikasi Xeenaps. Pola ini dirancang untuk menyeimbangkan integritas data (mencegah *data loss*) dengan pengalaman pengguna yang responsif (*snappy*).

---

## 1. Hybrid Saving Strategy (Strategi Penyimpanan Hibrida)

Xeenaps memisahkan logika penyimpanan berdasarkan konteks interaksi: **Drafting Mode** (Edit Teks) vs **Asset Mode** (Manipulasi File).

### A. Manual Save (Drafting Mode)
Digunakan pada halaman Form atau Detail View yang berisi banyak input teks (`ActivityDetail`, `LibraryForm`, `Profile`).

*   **Prinsip**: "Change requires Confirmation". Perubahan tidak langsung ditulis ke database untuk mencegah *accidental edits* atau *incomplete data*.
*   **Mekanisme**:
    1.  **State `isDirty`**: Inisialisasi `false`. Berubah menjadi `true` saat user mengetik/mengubah input.
    2.  **Visual Trigger**: Tombol navigasi (Back/Delete) di header digantikan oleh tombol **"Save Changes"** saat `isDirty === true`.
    3.  **Navigation Guard**: Menggunakan event `beforeunload` dan pengecekan manual saat tombol Back ditekan. Jika `isDirty`, munculkan Alert (SweetAlert) untuk konfirmasi *Discard* atau *Cancel*.
    4.  **Eksekusi**: Data hanya dikirim ke Supabase/GAS saat tombol Save ditekan secara eksplisit.

### B. Auto-Triggered Save (Asset Mode)
Digunakan pada galeri dokumen, vault, atau upload file (`DocumentationVault`, `TeachingVault`).

*   **Prinsip**: "Atomic & Instant". Operasi file (upload/delete) dianggap sebagai aksi final.
*   **Mekanisme**:
    1.  **Optimistic UI**: Saat file dipilih, UI langsung menampilkan kartu file ("Ghost Card") sebelum upload selesai.
    2.  **Background Process**: Upload fisik ke GAS/Drive berjalan di latar belakang.
    3.  **Silent Sync**: Setelah upload sukses, sistem secara otomatis memperbarui JSON Vault dan metadata Supabase tanpa intervensi user.
    4.  **No Save Button**: Tidak diperlukan tombol simpan manual.

---

## 2. Tiered Loading Strategy (Strategi Loading Bertingkat)

Menghindari penggunaan satu jenis loader untuk semua situasi. Loading dibagi berdasarkan dampaknya terhadap interaksi user.

### Level 1: Initial Skeleton (Perceptual Speed)
Digunakan saat halaman pertama kali dimuat atau data sedang *refetching* masif.
*   **Visual**: Struktur `div` dengan class `.skeleton` dan animasi `animate-pulse` yang meniru tata letak asli (Input box, Header, Grid).
*   **Tujuan**: Mencegah *Cumulative Layout Shift* (CLS) dan memberikan persepsi aplikasi sudah siap.
*   **Interaksi**: Non-blocking (user bisa melihat header/sidebar), tapi konten utama belum interaktif.

### Level 2: Global Blocking Overlay (Data Integrity)
**Hanya** digunakan saat proses **Manual Save** (Teks/Form).
*   **Visual**: Komponen `<GlobalSavingOverlay />`. Layar blur putih + Spinner Logo + Teks "Saving...".
*   **Tujuan**: Memblokir total interaksi user.
*   **Kenapa?**: Mencegah *Race Condition* (misal: user mengedit field lain saat data sedang dikirim) yang bisa merusak konsistensi data di database.

### Level 3: Local/Inline Loading (Non-Blocking)
Digunakan pada **Auto-Triggered Save** (Upload File) atau aksi minor (Translate, Delete Single Item).
*   **Visual**:
    *   *Upload*: Overlay transparan dengan spinner kecil *hanya di dalam* kartu file yang sedang diproses.
    *   *Button*: Ikon tombol berubah menjadi spinner (`Loader2`).
*   **Tujuan**: Membiarkan user tetap berinteraksi dengan bagian lain aplikasi (misal: scroll galeri, melihat file lain) sementara satu item sedang diproses.

---

## 3. Implementation Cheat Sheet

### Hook untuk Dirty State (Manual Save)
```typescript
// Di dalam Component
const [isDirty, setIsDirty] = useState(false);

// 1. Navigation Guard
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [isDirty]);

// 2. Global Guard (Sidebar)
useEffect(() => {
  (window as any).xeenapsIsDirty = isDirty;
  return () => { (window as any).xeenapsIsDirty = false; };
}, [isDirty]);

// 3. Field Handler
const handleChange = (val) => {
  setData(val);
  setIsDirty(true);
};
```

### Pattern untuk Optimistic Upload (Auto Save)
```typescript
const handleUpload = async (file) => {
  // 1. Optimistic Update (Instant Feedback)
  const tempId = `temp_${Date.now()}`;
  setItems(prev => [...prev, { id: tempId, status: 'uploading', preview: URL.createObjectURL(file) }]);

  // 2. Background Process
  const result = await uploadService(file);

  // 3. Reconciliation
  if (result.success) {
    setItems(prev => prev.map(i => i.id === tempId ? result.data : i));
    await syncToDatabase(result.data); // Silent Sync
  } else {
    setItems(prev => prev.filter(i => i.id !== tempId)); // Rollback
    showToast('Upload failed');
  }
};
```