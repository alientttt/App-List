import React, { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import {
  Edit2,
  Save,
  X,
  Clock,
  Hash,
  LayoutDashboard,
  ChevronRight,
  Download,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";

// Import library PDF
import jsPDF from "jspdf";
import "jspdf-autotable";

// --- Firebase Configuration & Initialization ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId =
  typeof __app_id !== "undefined" ? __app_id : "default-tugas-akhir-app";

// --- Vanilla JS OOP untuk Logika Data (Model) ---
class TugasAkhirManager {
  constructor(db, appId, collectionName = "tugas_akhir_list") {
    this.db = db;
    this.collectionRef = collection(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      collectionName,
    );
  }

  async add(data, userId) {
    if (!userId) throw new Error("User must be logged in to add");
    return addDoc(this.collectionRef, {
      ...data,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async update(docId, data, userId) {
    if (!userId) throw new Error("User must be logged in to update");
    const docRef = doc(this.collectionRef, docId);
    return updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }
}

const taManager = new TugasAkhirManager(db, appId);

// --- React Components ---
export default function App() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Form State
  const [nama, setNama] = useState("");
  const [npm, setNpm] = useState("");
  const [judul, setJudul] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data State
  const [listTA, setListTA] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Filter/Sort State
  const [filterType, setFilterType] = useState("recent"); // 'recent' or 'npm'

  // Edit State
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ judul: "", npm: "", nama: "" });

  // 1. Setup Auth
  useEffect(() => {
    let unsubscribe;
    const initAuth = async () => {
      try {
        if (
          typeof __initial_auth_token !== "undefined" &&
          __initial_auth_token
        ) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
        setErrorMsg("Gagal melakukan autentikasi. " + err.message);
      }
    };

    initAuth();

    unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // 2. Fetch Data
  useEffect(() => {
    if (!user) {
      setListTA([]);
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    const unsubscribe = onSnapshot(
      taManager.collectionRef,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        }));
        setListTA(data);
        setLoadingData(false);
      },
      (error) => {
        console.error("Fetch data error:", error);
        setErrorMsg("Gagal mengambil data. " + error.message);
        setLoadingData(false);
      },
    );

    return () => unsubscribe();
  }, [user]);

  // Sorting Logic
  const sortedListTA = useMemo(() => {
    const listCopy = [...listTA];
    if (filterType === "recent") {
      listCopy.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } else if (filterType === "npm") {
      listCopy.sort((a, b) => a.npm.localeCompare(b.npm));
    }
    return listCopy;
  }, [listTA, filterType]);

  // Generate PDF Logic
  const generatePDF = () => {
    const doc = new jsPDF("p", "mm", "a4");

    // Header PDF
    doc.setFontSize(18);
    doc.text("Laporan Daftar Tugas Akhir", 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100);
    const dateNow = new Date().toLocaleString("id-ID");
    doc.text(`Dicetak pada: ${dateNow}`, 14, 30);
    doc.text(`Total Data: ${sortedListTA.length} Mahasiswa`, 14, 35);

    // Setup Kolom & Baris
    const tableColumn = [
      "No",
      "NPM",
      "Nama",
      "Judul Tugas Akhir",
      "Update Terakhir",
    ];
    const tableRows = [];

    // Loop data dari state yang sudah diurutkan (sortedListTA)
    sortedListTA.forEach((task, index) => {
      const taskData = [
        index + 1,
        task.npm,
        task.nama,
        task.judul,
        formatExactTime(task.updatedAt),
      ];
      tableRows.push(taskData);
    });

    // Buat Tabel
    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: "striped",
      headStyles: { fillColor: [147, 51, 234] }, // Warna background ungu (purple-600)
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 10 }, // No
        1: { cellWidth: 25 }, // NPM
        2: { cellWidth: 40 }, // Nama
        3: { cellWidth: "auto" }, // Judul
        4: { cellWidth: 35 }, // Date
      },
    });

    // Download PDF
    doc.save("Laporan_Tugas_Akhir.pdf");
  };

  // Handlers (Submit & Edit)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nama.trim() || !npm.trim() || !judul.trim()) {
      setErrorMsg("Semua field (Nama, NPM, Judul) harus diisi!");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }

    setIsSubmitting(true);
    try {
      await taManager.add({ nama, npm, judul }, user.uid);
      setNama("");
      setNpm("");
      setJudul("");
      setErrorMsg("");
    } catch (err) {
      console.error("Add error:", err);
      setErrorMsg("Gagal menambahkan data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (item) => {
    setEditingId(item.id);
    setEditForm({ judul: item.judul, npm: item.npm, nama: item.nama });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ judul: "", npm: "", nama: "" });
  };

  const handleSaveEdit = async (id) => {
    if (
      !editForm.judul.trim() ||
      !editForm.npm.trim() ||
      !editForm.nama.trim()
    ) {
      setErrorMsg("Field edit tidak boleh kosong.");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }
    try {
      await taManager.update(id, editForm, user.uid);
      setEditingId(null);
    } catch (err) {
      console.error("Update error:", err);
      setErrorMsg("Gagal mengupdate data.");
    }
  };

  // Helper UI
  const getInitials = (name) => {
    return name ? name.charAt(0).toUpperCase() : "?";
  };

  const formatTime = (date) => {
    try {
      return formatDistanceToNow(date, { addSuffix: true, locale: id });
    } catch (e) {
      return "baru saja";
    }
  };

  const formatExactTime = (date) => {
    try {
      return format(date, "d MMM yyyy, HH:mm", { locale: id });
    } catch (e) {
      return "";
    }
  };

  if (loadingAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F9FB] text-gray-800 font-sans flex">
      {/* Sidebar (Mockup to match design context) */}
      <div className="hidden md:flex w-64 flex-col border-r border-gray-200 bg-white min-h-screen">
        <div className="p-4 border-b border-gray-100 flex items-center space-x-2">
          <LayoutDashboard size={20} className="text-gray-600" />
          <span className="font-semibold text-gray-700">Dashboard</span>
        </div>
        <div className="p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Menu
          </p>
          <div className="flex items-center space-x-2 text-purple-600 bg-purple-50 p-2 rounded-lg cursor-pointer">
            <LayoutDashboard size={18} />
            <span className="font-medium text-sm">List Tugas Akhir</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full">
        {/* Header (Top Nav) */}
        <header className="bg-white border-b border-gray-200 p-4 flex items-center text-sm text-gray-500">
          <span className="cursor-pointer hover:text-purple-600">
            Dashboard
          </span>
          <ChevronRight size={14} className="mx-2" />
          <span className="font-semibold text-gray-800">List Tugas Akhir</span>
        </header>

        <main className="p-6 md:p-10 flex-1 overflow-y-auto">
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded shadow-sm">
              <p>{errorMsg}</p>
            </div>
          )}

          {/* Top Card: Title & Form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8 mb-10 relative overflow-hidden">
            <div className="absolute top-6 right-6">
              <span className="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                Form Input
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              List Tugas Akhir
            </h1>

            <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Mahasiswa
                  </label>
                  <input
                    type="text"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                    placeholder="Masukkan nama lengkap"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    NPM
                  </label>
                  <input
                    type="text"
                    value={npm}
                    onChange={(e) => setNpm(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                    placeholder="Contoh: 12345678"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Judul Tugas Akhir
                </label>
                <textarea
                  value={judul}
                  onChange={(e) => setJudul(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all min-h-[80px]"
                  placeholder="Masukkan judul tugas akhir..."
                  required
                />
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 px-6 rounded-lg transition-colors flex items-center gap-2 ${isSubmitting ? "opacity-70 cursor-not-allowed" : ""}`}
                >
                  {isSubmitting ? "Menyimpan..." : "Tambahkan ke List"}
                </button>
              </div>
            </form>
          </div>

          {/* List Section */}
          <div className="mb-4">
            <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-6 gap-4">
              <h2 className="text-2xl font-bold text-gray-900">
                Daftar Tugas Akhir
              </h2>

              {/* Tombol Export PDF */}
              <button
                onClick={generatePDF}
                className="bg-gray-800 hidden hover:bg-gray-900 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm flex items-center gap-2 shadow-sm"
              >
                <Download size={16} /> Export ke PDF
              </button>
            </div>

            {/* Tabs / Filters */}
            <div className="flex items-center justify-between border-b border-gray-200 mb-6 pb-0">
              <div className="flex space-x-8">
                <button
                  onClick={() => setFilterType("recent")}
                  className={`pb-3 text-sm font-medium transition-colors relative ${
                    filterType === "recent"
                      ? "text-purple-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Terakhir ditambahkan
                  {filterType === "recent" && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-600 rounded-t-md"></span>
                  )}
                </button>
                <button
                  onClick={() => setFilterType("npm")}
                  className={`pb-3 text-sm font-medium transition-colors relative ${
                    filterType === "npm"
                      ? "text-purple-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Urutkan NPM
                  {filterType === "npm" && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-600 rounded-t-md"></span>
                  )}
                </button>
              </div>
              <div className="text-sm text-gray-500 pb-3">
                {sortedListTA.length} Judul
              </div>
            </div>
          </div>

          {/* Cards Stack */}
          {loadingData ? (
            <div className="text-center py-10 text-gray-500">
              Memuat data...
            </div>
          ) : sortedListTA.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-500">
                Belum ada tugas akhir yang ditambahkan.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedListTA.map((item) => {
                const isOwner = user && user.uid === item.userId;
                const isEditing = editingId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`bg-white border rounded-xl p-5 md:p-6 shadow-sm transition-all ${
                      isOwner
                        ? "border-purple-200 bg-purple-50/10"
                        : "border-gray-200"
                    }`}
                  >
                    {isEditing ? (
                      // Edit Mode View
                      <div className="space-y-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded-full uppercase tracking-wider">
                            Mode Edit
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveEdit(item.id)}
                              className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200"
                              title="Simpan"
                            >
                              <Save size={18} />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                              title="Batal"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-gray-500">
                              Nama
                            </label>
                            <input
                              type="text"
                              value={editForm.nama}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  nama: e.target.value,
                                })
                              }
                              className="w-full p-2 border border-gray-300 rounded text-sm focus:border-purple-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">NPM</label>
                            <input
                              type="text"
                              value={editForm.npm}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  npm: e.target.value,
                                })
                              }
                              className="w-full p-2 border border-gray-300 rounded text-sm focus:border-purple-500 outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Judul</label>
                          <textarea
                            value={editForm.judul}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                judul: e.target.value,
                              })
                            }
                            className="w-full p-2 border border-gray-300 rounded text-sm min-h-[60px] focus:border-purple-500 outline-none"
                          />
                        </div>
                      </div>
                    ) : (
                      // Normal View
                      <div className="flex flex-col md:flex-row gap-4">
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 text-gray-600 font-bold text-sm">
                            {getInitials(item.nama)}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-gray-900 text-base">
                                {item.nama}
                              </h3>
                              <div className="flex items-center text-xs text-gray-500 mt-1 space-x-3">
                                <span
                                  className="flex items-center gap-1"
                                  title={formatExactTime(item.updatedAt)}
                                >
                                  <Clock size={12} />
                                  {formatTime(item.updatedAt)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Hash size={12} />
                                  {item.npm}
                                </span>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            {isOwner && (
                              <button
                                onClick={() => handleStartEdit(item)}
                                className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                title="Edit list Anda"
                              >
                                <Edit2 size={16} />
                              </button>
                            )}
                          </div>

                          <div className="mt-3 text-gray-800 text-sm md:text-base leading-relaxed bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                            {item.judul}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
