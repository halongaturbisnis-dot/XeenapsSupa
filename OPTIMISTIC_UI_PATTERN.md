# Xeenaps Optimistic UI & State Handover Protocol

## 1. Core Philosophy: Single Source of Truth
Untuk memastikan pengalaman pengguna (UX) yang sangat cepat (*snappy*) tanpa jeda loading ("Zero-Latency"), **Parent Component** (Gallery/List View) harus bertindak sebagai "Pemegang Kebenaran Utama" (*Single Source of Truth*) untuk data list. 

Komponen Anak (Modal, Detail View) **DILARANG** memicu *re-fetch* (memanggil ulang data dari server) pada Parent. Sebaliknya, mereka harus melakukan **Handover State** (mengoper data) ke Parent untuk memperbarui memori lokal secara instan.

---

## 2. Pattern A: Create (Instant Injection)
**Skenario**: User membuat data baru melalui Modal.

1.  **API Call**: Modal menangani request ke server/API.
2.  **Success**: Jika sukses, Modal mengembalikan *objek item baru* yang lengkap ke Parent melalui prop callback `onSuccess`.
3.  **Injection**: Parent menyuntikkan objek tersebut ke posisi paling atas array `items` secara manual.

**Implementasi Parent (`ConsultationGallery.tsx`):**
```typescript
<InputModal
  onSuccess={(newItem, newContent) => {
    // 1. Inject ke state lokal secara instan (JANGAN Refetch!)
    setItems(prev => [newItem, ...prev]);
    setTotalCount(prev => prev + 1);

    // 2. Buka tampilan Detail/Result secara langsung
    setSelectedConsult(newItem);
    setView('result');
  }}
/>
```
*Hasil: Saat user menekan "Back" dari detail view, item baru sudah ada di list tanpa loading.*

---

## 3. Pattern B: Update (State Handover)
**Skenario**: User mengedit data (misal: toggle Favorite atau ubah Judul) di dalam Detail View.

1.  **Local State**: Child mengupdate tampilannya sendiri.
2.  **Handover**: Child memanggil prop callback `onUpdate` milik Parent dengan membawa data terbaru.
3.  **Parent Sync**: Parent mencari item berdasarkan ID di array lokal dan menggantinya.

**Parent Code:**
```typescript
const handleItemUpdateLocally = (updated: ItemType) => {
  // Cari item dengan ID sama, ganti dengan data baru
  setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
};
```

**Child Code (`ConsultationResultView.tsx`):**
```typescript
const handleSaveChanges = async () => {
  const updatedItem = { ...item, ...newData };
  
  // 1. Update UI Anak
  setItem(updatedItem); 

  // 2. Handover ke Bapak (agar List di belakang layar juga update)
  if (onUpdate) onUpdate(updatedItem);

  // 3. Background Sync ke Server
  await api.save(updatedItem);
};
```

---

## 4. Pattern C: Delete (Instant Removal)
**Skenario**: User menghapus item saat berada di dalam Detail View.

1.  **Konfirmasi**: User menekan "Yes" pada dialog hapus.
2.  **Handover**: Child memanggil `onDeleteOptimistic(id)`.
3.  **Parent Reaction**: Parent langsung membuang item dari array, mengurangi total count, dan menutup tampilan detail.
4.  **Background Sync**: Request hapus ke server dilakukan *setelah* atau *bersamaan* dengan update UI.

**Parent Code:**
```typescript
const handleItemDeleteLocally = (id: string) => {
  // 1. Hapus dari memori lokal
  setItems(prev => prev.filter(i => i.id !== id));
  // 2. Koreksi jumlah total
  setTotalCount(prev => Math.max(0, prev - 1));
  // 3. Kembali ke Gallery
  setView('gallery'); 
};
```

---

## 5. Ringkasan Manfaat
*   **Zero Latency**: User tidak pernah melihat spinner loading untuk aksi Create/Update/Delete standar.
*   **Reduced Server Load**: Mengurangi beban server karena tidak perlu mengambil ulang seluruh daftar data.
*   **Seamless Navigation**: Perpindahan antar halaman terasa instan dan *fluid*.
