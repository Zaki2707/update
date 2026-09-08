var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  appExport: () => appExport,
  default: () => server_default
});
module.exports = __toCommonJS(server_exports);
var import_config = require("dotenv/config");
var import_express = __toESM(require("express"), 1);
var import_compression = __toESM(require("compression"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_os = __toESM(require("os"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_selfsigned = __toESM(require("selfsigned"), 1);
var import_genai = require("@google/genai");
var import_cloudinary = require("cloudinary");
var import_livekit_server_sdk = require("livekit-server-sdk");
var import_mammoth = __toESM(require("mammoth"), 1);
var import_firestore = require("firebase/firestore");

// src/data/sentence_bank.json
var sentence_bank_default = {
  karakteristik_materi: [
    "Materi {{MATERI_INTI}} membekali peserta didik dengan pemahaman dasar mengenai {{KONSEP_UTAMA}} serta melatih keterampilan praktis yang relevan dengan kebutuhan pembelajaran.",
    "Melalui kajian {{MATERI_INTI}}, peserta didik diajak mengenali {{KONSEP_UTAMA}} secara sistematis, runtut, dan aplikatif dalam kehidupan sehari-hari.",
    "Pembelajaran {{BAB_UTAMA}} dirancang agar peserta didik dapat memahami prinsip {{SUBBAB}}, mengkaji penerapannya, serta mengevaluasi hasil secara mandiri.",
    "{{MATERI_INTI}} melatih kemampuan peserta didik dalam menganalisis permasalahan, merumuskan tahapan logis, dan melakukan verifikasi hasil secara cermat."
  ],
  tujuan_pembelajaran: {
    C1_C2: [
      "Peserta didik mampu menjelaskan prinsip dasar {{KONSEP_UTAMA}} serta mengidentifikasi komponen utama yang digunakan dalam {{MATERI_INTI}}.",
      "Melalui pengamatan dan diskusi, peserta didik mampu menguraikan definisi esensial dan fungsi dari {{SUBBAB}} dengan tepat.",
      "Peserta didik dapat mendeskripsikan ruang lingkup dan karakteristik khas dari {{MATERI_INTI}} secara runtut."
    ],
    C3_C4: [
      "Peserta didik mampu menyusun langkah penyelesaian suatu masalah secara sistematis dan menerapkannya pada {{SUBBAB}} secara tepat.",
      "Setelah mengamati contoh konkret, peserta didik mampu menerapkan konsep dasar {{MATERI_INTI}} untuk menyelesaikan tugas/latihan serta memeriksa keakuratan hasilnya.",
      "Peserta didik mampu menguraikan tahapan proses dalam {{SUBBAB}} serta mengidentifikasi potensi kekeliruan secara teliti."
    ],
    C5_C6: [
      "Melalui telaah kritis dan perbandingan beberapa skenario, peserta didik mampu mengevaluasi serta menyempurnakan pemahaman {{MATERI_INTI}} agar optimal.",
      "Peserta didik mampu menganalisis efektivitas penerapan {{SUBBAB}} dalam studi kasus nyata serta mempresentasikan laporan hasilnya secara runtut dan bertanggung jawab."
    ]
  },
  pertanyaan_pemantik: {
    fenomena: [
      "Bagaimana keterkaitan materi {{MATERI_INTI}} dengan fenomena atau peristiwa yang sering kita temukan dalam kehidupan sehari-hari?",
      "Mengapa penting bagi kita untuk memahami konsep {{MATERI_INTI}} dalam konteks pembelajaran saat ini?"
    ],
    masalah: [
      "Apa tantangan atau kekeliruan utama yang sering muncul saat kita mempelajari {{MATERI_INTI}}?",
      "Bagaimana cara kita mengidentifikasi bagian yang membutuhkan pemahaman lebih mendalam pada {{MATERI_INTI}}?"
    ],
    prediksi: [
      "Apa yang akan terjadi jika konsep dasar {{MATERI_INTI}} tidak dipahami dengan benar sebelum melanjutkan ke materi berikutnya?",
      "Bagaimana penguasaan {{MATERI_INTI}} dapat membantu kalian memecahkan persoalan di masa depan?"
    ],
    perbandingan: [
      "Bagaimana perbandingan antara pendekatan yang tepat dengan pendekatan yang kurang efektif dalam mempelajari {{MATERI_INTI}}?",
      "Apa keunggulan penerapan konsep {{MATERI_INTI}} yang terstruktur dibandingkan pemahaman yang parsial?"
    ],
    problem_solving: [
      "Langkah strategis apa yang dapat diambil untuk memecahkan kesulitan dalam memahami {{MATERI_INTI}}?",
      "Bagaimana cara melakukan evaluasi mandiri untuk memastikan pemahaman kalian terhadap {{MATERI_INTI}} sudah tepat?"
    ]
  },
  kbc: {
    cinta_allah: [
      "Menghayati keteraturan dan hukum alam pada {{MATERI_INTI}} sebagai wujud rasa syukur atas karunia akal pikiran, serta berkomitmen menggunakan ilmu untuk kemaslahatan bersama.",
      "Menyadari bahwa keindahan dan kedalaman ilmu pada {{MATERI_INTI}} merupakan tanda keagungan Pencipta yang menganugerahkan kemampuan berpikir bagi manusia."
    ],
    cinta_ilmu: [
      "Eksplorasi terhadap {{MATERI_INTI}} diarahkan untuk menumbuhkan rasa ingin tahu yang tinggi, berpikir kritis, serta semangat mendalami ilmu pengetahuan.",
      "Mengembangkan semangat pembelajar sepanjang hayat dengan terus mendalami {{MATERI_INTI}} dan bersikap terbuka terhadap wawasan baru."
    ],
    cinta_diri: [
      "Menjaga keseimbangan antara waktu belajar {{MATERI_INTI}} dan kesehatan fisik-mental, serta menerapkan kebiasaan disiplin dan tanggung jawab pribadi.",
      "Membentengi diri dari pengaruh negatif, menjaga integritas akademik, serta bertanggung jawab terhadap perkembangan diri sendiri."
    ],
    cinta_sesama: [
      "Saat berkolaborasi dalam kelompok, peserta didik belajar bahwa penguasaan materi {{BAB_UTAMA}} seharusnya memperkuat kerja sama dan kepedulian, bukan menjadi sarana untuk bersikap sombong atau merugikan orang lain.",
      "Memanfaatkan pemahaman {{MATERI_INTI}} untuk menciptakan solusi yang membantu, mempermudah, dan menghormati hak sesama."
    ],
    cinta_lingkungan: [
      "Menerapkan perilaku hemat sumber daya serta menjaga kebersihan dan kelestarian lingkungan belajar selama mempelajari {{MATERI_INTI}}.",
      "Memanfaatkan pemahaman materi {{MATERI_INTI}} untuk merancang solusi efisiensi dan pelestarian lingkungan sekitar."
    ],
    cinta_tanah_air: [
      "Mengembangkan kemandirian belajar dan wawasan keilmuan demi memberikan kontribusi nyata bagi kemajuan dan kedaulatan bangsa Indonesia.",
      "Memasang niat menggunakan kecakapan {{MATERI_INTI}} untuk memajukan daya saing dan kesejahteraan bangsa."
    ]
  },
  refleksi_peserta_didik: [
    "1. Bagian mana dari materi {{MATERI_INTI}} yang paling mudah dan paling menantang bagi kalian?\n2. Bagaimana cara kalian mengatasi kesulitan saat mencoba memahami atau mempraktikkan {{SUBBAB}}?",
    "1. Pengalaman baru apa yang kalian peroleh setelah menyelesaikan pembelajaran {{SUBBAB}}?\n2. Seberapa yakin kalian dapat menggunakan konsep {{MATERI_INTI}} untuk menyelesaikan permasalahan sehari-hari?",
    "1. Apakah kalian merasa puas dengan hasil kerja dan proses diskusi bersama kelompok pada topik {{SUBBAB}}?\n2. Keterampilan komunikasi dan kerja sama apa yang paling terasa berkembang selama kegiatan ini?"
  ],
  refleksi_guru: [
    "1. Apakah alur kegiatan pembelajaran berhasil memandu seluruh peserta didik memahami konsep {{MATERI_INTI}} dengan baik?\n2. Bagian manakah dari aktivitas pembelajaran yang paling efektif, dan apa yang perlu disempurnakan untuk pertemuan berikutnya?",
    "1. Apakah bimbingan (scaffolding) yang diberikan sudah cukup membantu peserta didik yang mengalami kendala?\n2. Bagaimana keterlibatan dan kolaborasi peserta didik dalam kelompok selama menyelesaikan tugas {{SUBBAB}}?"
  ]
};

// src/data/rules.json
var rules_default = {
  material_types: {
    KODING: {
      name: "Koding & Pemrograman",
      keywords: [
        "algoritma",
        "pseudocode",
        "sintaks",
        "coding",
        "debugging",
        "testing",
        "error",
        "perbaikan program",
        "struktur if-else",
        "perulangan",
        "variabel"
      ],
      aksi_fenomena: "menjalankan serangkaian perintah atau program komputer",
      perangkat_sistem: "program atau baris kode",
      sistem_pemrograman: "sistem kode program",
      sistem_komputer: "komputer atau mikrokontroler",
      diagnostik: "Soal Diagnostik Koding:\n'Jika variabel nilai >= 75 berstatus LULUS, selain itu REMEDIAL. Manakah struktur percabangan yang paling tepat digunakan?'",
      pertanyaan_pemantik: {
        fenomena: "Bagaimana sebuah komputer dapat mengeksekusi perintah-perintah rumit yang kita berikan melalui baris kode program?",
        masalah: "Apa akibatnya jika terdapat kesalahan penulisan (syntax error) atau logika dalam skrip kode?",
        prediksi: "Bagaimana kita dapat memastikan program berjalan sesuai harapan sebelum dieksekusi?",
        perbandingan: "Mengapa dua cara penulisan kode (syntax) dapat menghasilkan keluaran yang sama namun efisiensi berbeda?",
        problem_solving: "Bagaimana proses debugging dilakukan secara sistematis pada program yang gagal berjalan?"
      },
      diferensiasi: {
        konten: "Menyediakan potongan contoh kode (code snippet), diagram alur logika, dan tabel rujukan sintaks dasar.",
        proses: "Live-coding terpandu untuk kelompok awal, praktik mandiri terarah, dan tantangan debugging terbuka untuk kelompok mahir.",
        produk: "Skrip program sederhana (kelompok reguler) vs program dengan penambahan fitur validasi/fungsi modular (kelompok mahir)."
      },
      persiapan_guru: "1. Memastikan IDE/Code Editor (Scratch/Python/C++/UnoArduSim) terinstal atau siap diakses.\n2. Menyiapkan skrip kode awal (starter code) dan contoh bug untuk latihan debugging.\n3. Opsi Unplugged: Menyiapkan kartu cetak instruksi logika dan lembar alur eksekusi manual.",
      deep_learning: {
        mindful: "Peserta didik menyadari bahwa ketelitian dalam menulis sintaks dan kesabaran saat melakukan debugging adalah kunci utama dalam pemrograman.",
        meaningful: "Peserta didik memahami bagaimana logika percabangan dan perulangan digunakan untuk memecahkan masalah pengambilan keputusan sehari-hari.",
        joyful: "Peserta didik merasakan kepuasan saat berhasil memperbaiki error dan melihat program berjalan sesuai harapan."
      },
      rubrik: "1. Ketepatan Logika & Sintaks (40%): Kode dapat dieksekusi tanpa syntax error dan logika sesuai spesifikasi.\n2. Struktur Kode & Penataan Variabel (20%): Penamaan variabel rapi, indentasi konsisten, dan mudah dibaca.\n3. Kemampuan Testing & Debugging (30%): Mampu menguji berbagai kondisi masukan dan memperbaiki error secara mandiri.\n4. Penjelasan & Dokumentasi (10%): Mampu menjelaskan alur kerja skrip kode kepada rekan sebaya.",
      pola_kegiatan: {
        pertemuan1: "Guru menyajikan permasalahan logika keputusan. Peserta didik mengidentifikasi variabel dan kondisi masukan, lalu menyusun pseudocode atau rancangan alur percabangan.",
        pertemuan2: "Peserta didik mengetikkan sintaks kode ke dalam IDE/editor, menjalankan program, dan menguji berbagai kombinasi nilai variabel.",
        pertemuan3: "Peserta didik melacak error/bug melalui teknik debugging, memperbaiki sintaks, dan mempresentasikan hasil program.",
        pertemuan4: "Peserta didik menambahkan fungsi perulangan atau validasi, menguji ketahanan program, dan mendokumentasikan skrip kode."
      }
    },
    AI: {
      name: "Kecerdasan Artifisial (AI)",
      keywords: [
        "dataset",
        "model",
        "prediksi",
        "generative AI",
        "prompt",
        "prompt engineering",
        "evaluasi output",
        "bias",
        "privasi",
        "etika AI"
      ],
      aksi_fenomena: "menghasilkan teks, gambar, atau ide secara otomatis",
      perangkat_sistem: "model Kecerdasan Artifisial (AI)",
      sistem_pemrograman: "sistem AI Generatif",
      sistem_komputer: "model AI",
      diagnostik: "Soal Diagnostik AI:\n'Jika sebuah sistem AI Generatif memberikan jawaban yang terlihat sangat meyakinkan namun tidak mencantumkan sumber resmi, langkah verifikasi apa yang sebaiknya dilakukan?'",
      pertanyaan_pemantik: {
        fenomena: "Pernahkah kamu mencoba meminta bantuan AI untuk menulis atau menghasilkan sesuatu, dan mendapati hasilnya sangat meyakinkan?",
        masalah: "Apa yang terjadi jika sebuah model AI memberikan informasi yang salah atau bias tanpa kita sadari?",
        prediksi: "Bagaimana cara kita memastikan bahwa keluaran (output) dari AI benar-benar akurat dan dapat dipercaya?",
        perbandingan: "Apa perbedaan mendasar antara mencari informasi di mesin pencari konvensional dengan menggunakan prompt generative AI?",
        problem_solving: "Langkah verifikasi apa yang harus dilakukan ketika menghadapi informasi halusinasi dari AI?"
      },
      diferensiasi: {
        konten: "Menyediakan contoh struktur prompt engineering, lembar panduan identifikasi bias/hallucination, dan studi kasus etika AI.",
        proses: "Penyusunan prompt terpandu dengan instruksi bertahap, eksperimen mandiri variasi peran (persona), dan diskusi evaluasi luaran.",
        produk: "Teks prompt terstruktur, tabel perbandingan output AI, dan laporan singkat evaluasi kebenaran fakta."
      },
      persiapan_guru: "1. Memeriksa akses akun/platform AI Generatif atau menyiapkan lembar studi kasus teks luaran AI cetak.\n2. Menyiapkan daftar contoh prompt awal dan instrumen verifikasi kebenaran informasi (fact-checking sheet).\n3. Opsi Unplugged: Menggunakan lembar studi kasus simulasi 'Manusia sebagai Model AI' untuk menganalisis masukan dan keluaran.",
      deep_learning: {
        mindful: "Peserta didik bersikap kritis dan tidak telan mentah-mentah setiap jawaban AI, serta menyadari pentingnya kejujuran akademik dan privasi data.",
        meaningful: "Peserta didik memahami bagaimana AI Generatif memproses bahasa dan dampaknya terhadap komunikasi serta etika publik.",
        joyful: "Peserta didik mengeksplorasi kreativitas menyusun perintah (prompt) untuk menghasilkan solusi informasi yang bermanfaat dan beretika."
      },
      rubrik: "1. Kejelasan & Keefektifan Prompt (30%): Prompt memuat peran, konteks, instruksi, dan batasan yang jelas.\n2. Akurasi Verifikasi Fakta & Cek Bias (35%): Mampu menemukan ketidaksesuaian/hallucination pada luaran AI secara kritis.\n3. Kesadaran Etika & Privasi (20%): Tidak memasukkan data sensitif/pribadi ke dalam prompt dan mencantumkan sitasi AI.\n4. Kualitas Laporan Evaluasi (15%): Menyajikan perbandingan luaran AI secara rinci dan terstruktur.",
      pola_kegiatan: {
        pertemuan1: "Guru menyajikan contoh luaran AI. Peserta didik menganalisis bagaimana model AI merespons masukan dan mengenali karakteristik generative AI.",
        pertemuan2: "Peserta didik merancang instruksi khusus (prompt engineering) dengan menyertakan konteks dan batasan, lalu menguji luaran AI.",
        pertemuan3: "Peserta didik mengevaluasi luaran AI untuk mendeteksi kemungkinan bias atau informasi palsu (hallucination), lalu menyusun pedoman penggunaan etis.",
        pertemuan4: "Peserta didik menyusun panduan penggunaan AI untuk bidang tertentu dan mempresentasikannya di depan kelas."
      }
    },
    JARINGAN: {
      name: "Jaringan Komputer & Internet",
      keywords: [
        "perangkat jaringan",
        "router",
        "switch",
        "IP address",
        "konektivitas",
        "konfigurasi",
        "topologi",
        "troubleshooting",
        "keamanan jaringan"
      ],
      aksi_fenomena: "melihat data terkirim secara instan antar perangkat di lokasi berbeda",
      perangkat_sistem: "konfigurasi router atau switch jaringan",
      sistem_pemrograman: "sistem komunikasi data",
      sistem_komputer: "node jaringan",
      diagnostik: "Soal Diagnostik Jaringan:\n'Perangkat manakah yang berfungsi untuk menghubungkan beberapa komputer dalam satu jaringan lokal (LAN) serta mengarahkan lalu lintas paket data?'",
      pertanyaan_pemantik: {
        fenomena: "Bagaimana data di perangkat kita dapat terkirim secara instan ke server lain di belahan dunia?",
        masalah: "Apa yang terjadi jika alamat IP (IP address) antar-node dalam jaringan mengalami bentrok (conflict)?",
        prediksi: "Bagaimana kita mengetahui titik mana yang menyebabkan kabel atau koneksi terputus?",
        perbandingan: "Apa perbedaan peran antara perangkat router dan switch dalam mengatur lalu lintas data?",
        problem_solving: "Langkah troubleshooting apa yang harus dilakukan ketika koneksi jaringan di lab komputer terputus?"
      },
      diferensiasi: {
        konten: "Menyediakan diagram topologi jaringan, tabel skema pengalamatan IP, dan panduan fungsi perangkat jaringan.",
        proses: "Simulasi konektivitas terpandu menggunakan software simulator/alat fisik, diikuti pengujian ping mandiri.",
        produk: "Gambar peta topologi jaringan, tabel daftar IP address, dan laporan langkah troubleshooting koneksi."
      },
      persiapan_guru: "1. Memastikan komputer lab terhubung atau simulator jaringan (misal Cisco Packet Tracer / Simulator Web) siap digunakan.\n2. Menyiapkan skema diagram topologi dan lembar perintah uji konektivitas (ping/traceroute).\n3. Opsi Unplugged: Menggunakan kartu fisik peragaan peran (komputer, switch, router) dan amplop fisik sebagai 'paket data'.",
      deep_learning: {
        mindful: "Peserta didik menyadari pentingnya keamanan jaringan dan perlindungan data saat terhubung ke dalam ekosistem digital.",
        meaningful: "Peserta didik memahami bagaimana data melintasi berbagai perangkat fisik hingga dapat sampai ke tujuan secara presisi.",
        joyful: "Peserta didik merasakan kepuasan saat berhasil menghubungkan antarnode jaringan yang semula terputus melalui analisis troubleshooting."
      },
      rubrik: "1. Pemahaman Topologi & Perangkat (30%): Mengidentifikasi fungsi router, switch, dan node jaringan secara tepat.\n2. Ketepatan Pengalamatan IP (30%): Mengatur IP address dan subnet mask tanpa bentrok (IP conflict).\n3. Analisis Troubleshooting (25%): Mampu menemukan penyebab kegagalan ping dan memperbaikinya.\n4. Kesadaran Keamanan Jaringan (15%): Menerapkan dasar-dasar proteksi akses dan kata sandi jaringan.",
      pola_kegiatan: {
        pertemuan1: "Guru mendemonstrasikan skema jaringan. Peserta didik mengidentifikasi fungsi router, switch, dan alur data dalam topologi.",
        pertemuan2: "Peserta didik melakukan konfigurasi IP address pada simulator/fisik dan melakukan tes ping antarkomputer.",
        pertemuan3: "Peserta didik menganalisis kasus gangguan koneksi (troubleshooting), melacak titik putus paket data, dan menerapkan perbaikan.",
        pertemuan4: "Peserta didik merancang skema jaringan skala kecil dan mempresentasikan proteksi keamanannya."
      }
    },
    ALGORITMA: {
      name: "Algoritma & Berpikir Komputasional",
      keywords: [
        "flowchart",
        "pseudocode",
        "dekomposisi",
        "abstraksi",
        "tracing",
        "desk-check",
        "percabangan",
        "infinite loop"
      ],
      aksi_fenomena: "menyelesaikan permasalahan sehari-hari melalui urutan langkah yang logis",
      perangkat_sistem: "bagan alur (flowchart) atau pseudocode",
      sistem_pemrograman: "alur logika algoritma",
      sistem_komputer: "sistem pemrosesan data",
      diagnostik: "Soal Diagnostik Algoritma:\n'Simbol flowchart berbentuk jajaran genjang digunakan untuk menyatakan proses masukan (input) atau keluaran (output). Apa fungsi dari simbol belah ketupat dalam diagram alur?'",
      pertanyaan_pemantik: {
        fenomena: "Pernahkah kamu menghadapi masalah sehari-hari yang harus diselesaikan melalui urutan langkah yang sistematis?",
        masalah: "Apa yang terjadi jika salah satu langkah dalam flowchart ditempatkan tidak sesuai urutan?",
        prediksi: "Bagaimana kita mengetahui bahwa flowchart sudah menggambarkan penyelesaian masalah dengan benar?",
        perbandingan: "Mengapa satu masalah dapat memiliki rancangan algoritma atau bentuk flowchart yang berbeda?",
        problem_solving: "Bagaimana cara menelusuri flowchart (tracing) ketika hasil akhirnya tidak sesuai harapan?"
      },
      diferensiasi: {
        konten: "Menyediakan kamus simbol standar flowchart, contoh notasi pseudocode, dan lembar studi kasus dekomposisi.",
        proses: "Penyusunan flowchart terpandu dengan papan tempel atau aplikasi diagram, dilanjutkan latihan penelusuran (desk-check).",
        produk: "Bagan flowchart sistematis, notasi pseudocode yang rapi, dan tabel pelacakan nilai variabel (tracing table)."
      },
      persiapan_guru: "1. Menyiapkan lembar simbol flowchart cetak atau digital (Draw.io / Lucidchart / Papan Tulis).\n2. Menyiapkan studi kasus persoalan logis sehari-hari dengan berbagai cabang kondisi.\n3. Opsi Unplugged: Menggunakan kartu simbol magnetik atau kertas untuk disusun bersama di papan flanel atau meja kelompok.",
      deep_learning: {
        mindful: "Peserta didik melatih ketelitian dan kesabaran dalam memeriksa setiap urutan instruksi agar tidak ada kondisi cabang yang terlewat.",
        meaningful: "Peserta didik menyadari bahwa masalah rumit di kehidupan nyata dapat dipecahkan secara efisien jika didekomposisi menjadi langkah-langkah logis.",
        joyful: "Peserta didik menikmati proses pengujian manual (desk-check) saat membuktikan bahwa alur algoritma buatannya terbukti benar."
      },
      rubrik: "1. Ketepatan Penggunaan Simbol (30%): Menggunakan standar simbol flowchart yang tepat sesuai fungsinya.\n2. Keruntutan & Efisiensi Logika (35%): Alur penyelesaian runtut, tidak berputar pada perulangan tanpa akhir (infinite loop), dan efisien.\n3. Ketelitian Desk-Check / Tracing (20%): Mampu menelusuri perubahan nilai variabel pada setiap langkah secara akurat.\n4. Kerapian Notasi Pseudocode (15%): Notasi ditulis secara terstruktur dan mudah dipahami.",
      pola_kegiatan: {
        pertemuan1: "Guru menyajikan studi kasus persoalan nyata. Peserta didik melakukan dekomposisi masalah, menentukan komponen input, proses, dan output, mengenal simbol dasar, serta menyusun alur sederhana.",
        pertemuan2: "Peserta didik merancang flowchart lengkap, menguji alur, melakukan tracing / desk-check untuk menemukan kesalahan logika, memperbaiki, dan mempresentasikan hasil.",
        pertemuan3: "Peserta didik mengkaji struktur percabangan dan perulangan kompleks dalam algoritma, merancang jalur alternatif keputusan, dan menguji ketahanan alur terhadap berbagai kondisi masukan.",
        pertemuan4: "Peserta didik menyempurnakan notasi pseudocode dan diagram alur secara komprehensif, melakukan simulasi kelompok, serta mendokumentasikan laporan rancangan algoritma."
      }
    },
    DATA: {
      name: "Analisis Data & Statistik",
      keywords: [
        "dataset",
        "tabel",
        "variabel",
        "analisis data",
        "visualisasi data",
        "pembersihan data",
        "statistik dasar",
        "grafik"
      ],
      aksi_fenomena: "melihat grafik visual berubah secara dinamis berdasarkan tabel angka",
      perangkat_sistem: "lembar kerja pengolahan data atau skrip spreadsheet",
      sistem_pemrograman: "model pengolahan data",
      sistem_komputer: "sistem visualisasi data",
      diagnostik: "Soal Diagnostik Data:\n'Jika kita ingin membandingkan persentase proporsi kategori dari total keseluruhan, jenis diagram apa yang paling tepat digunakan?'",
      pertanyaan_pemantik: {
        fenomena: "Bagaimana tumpukan angka mentah dapat diubah menjadi informasi visual yang mudah dipahami?",
        masalah: "Apa dampak dari adanya data kosong atau ganda (duplicate) dalam sebuah dataset?",
        prediksi: "Bagaimana tren dari grafik visual dapat membantu kita memprediksi kondisi di masa depan?",
        perbandingan: "Antara grafik batang dan grafik garis, mana yang lebih tepat untuk menunjukkan perkembangan data dari waktu ke waktu?",
        problem_solving: "Langkah pembersihan data (data cleaning) apa yang harus dilakukan sebelum dataset diolah?"
      },
      diferensiasi: {
        konten: "Menyediakan dataset mentah (CSV/Excel), panduan fungsi rumus spreadsheet dasar, dan contoh berbagai jenis grafik.",
        proses: "Pembersihan data terpandu, pembuatan diagram visual secara mandiri, dan diskusi penarikan kesimpulan berbasis data.",
        produk: "Tabel data yang sudah dibersihkan, grafik visualisasi yang komunikatif, dan ringkasan kesimpulan analisis data."
      },
      persiapan_guru: "1. Menyiapkan dataset kontekstual (misal data kehadiran, penjualan kantin, atau survei minat siswa).\n2. Memastikan perangkat pengolah data (Google Sheets/Excel/LibreOffice Calc) dapat diakses peserta didik.\n3. Opsi Unplugged: Menyiapkan lembar kerja Kertas Milimeter dan data tabel cetak untuk digambar secara manual.",
      deep_learning: {
        mindful: "Peserta didik bersikap jujur dan objektif dalam mengolah data tanpa memanipulasi angka untuk menghasilkan kesimpulan yang salah.",
        meaningful: "Peserta didik memahami bahwa fakta angka dan tren data merupakan dasar kuat dalam mengambil keputusan yang dapat dipertanggungjawabkan.",
        joyful: "Peserta didik menemukan kepuasan saat berhasil mengubah tumpukan angka mentah menjadi grafik visual yang indah dan bernilai informasi."
      },
      rubrik: "1. Kebersihan & Struktur Data (25%): Membuang data ganda/kosong dan menata variabel tabel secara terstruktur.\n2. Pemilihan Jenis Visualisasi (30%): Memilih bentuk grafik (batang/garis/lingkaran) yang sesuai dengan karakteristik data.\n3. Ketepatan Analisis & Kesimpulan (30%): Menarik kesimpulan yang relevan berdasarkan tren data yang ditampilkan.\n4. Kejelasan Presentasi Visual (15%): Memberi judul, label sumbu, dan legenda grafik yang informatif.",
      pola_kegiatan: {
        pertemuan1: "Guru menyajikan dataset mentah. Peserta didik mengidentifikasi tipe variabel, membersihkan data, dan menyusun tabel terstruktur.",
        pertemuan2: "Peserta didik mengolah data menggunakan software spreadsheet untuk menghasilkan grafik visual yang relevan.",
        pertemuan3: "Peserta didik menganalisis tren pada grafik, menyimpulkan wawasan utama, dan menyusun laporan singkat berbasis data.",
        pertemuan4: "Peserta didik mempresentasikan temuan visualisasi data di depan kelas dan mendiskusikan rekomendasi solusinya."
      }
    },
    ETIKA_DIGITAL: {
      name: "Etika & Keamanan Digital",
      keywords: [
        "hak cipta",
        "siber",
        "hoaks",
        "jejak digital",
        "etika berkomunikasi",
        "perlindungan data pribadi",
        "keamanan akun"
      ],
      aksi_fenomena: "menemukan informasi mencurigakan atau peringatan keamanan di akun digital",
      perangkat_sistem: "sistem keamanan data pribadi",
      sistem_pemrograman: "sistem verifikasi identitas digital",
      sistem_komputer: "platform jejaring digital",
      diagnostik: "Soal Diagnostik Etika Digital:\n'Langkah apa yang pertama kali harus dilakukan ketika menerima pesan berantai yang meminta data pribadi atau informasi finansial?'",
      pertanyaan_pemantik: {
        fenomena: "Mengapa informasi hoaks dapat menyebar begitu cepat di media sosial?",
        masalah: "Apa dampak negatif dari pengabaian privasi dan kebocoran data pribadi di ruang digital?",
        prediksi: "Bagaimana cara kita mengenali bahwa sebuah informasi di internet adalah disinformasi?",
        perbandingan: "Apa perbedaan antara membagikan ulang informasi yang belum diverifikasi dengan informasi resmi yang tervalidasi?",
        problem_solving: "Langkah fact-checking apa yang harus dilakukan saat menerima berita meragukan?"
      },
      diferensiasi: {
        konten: "Menyediakan contoh kasus kejahatan siber (phishing/hoaks), panduan lisensi Creative Commons, dan ceklist keamanan akun.",
        proses: "Analisis kasus kejahatan siber terpandu, latihan verifikasi fakta (fact-check), dan perancangan pesan kampanye positif.",
        produk: "Poster/infografis panduan keamanan digital, matriks verifikasi hoaks, dan dokumen komitmen budaya siber."
      },
      persiapan_guru: "1. Menyiapkan tangkapan layar contoh kasus pesan phishing, berita bohong (hoaks), dan insiden kebocoran data.\n2. Menyiapkan lembar panduan cek fakta (CRAAP Test / Cek Dulu Sebelum Sebar).\n3. Opsi Unplugged: Diskusi studi kasus menggunakan kartu skenario perilaku digital.",
      deep_learning: {
        mindful: "Peserta didik memiliki kesadaran penuh terhadap dampak jejak digital yang ditinggalkan serta menjaga kehormatan diri dan orang lain di media siber.",
        meaningful: "Peserta didik menyadari bahwa dunia digital adalah ruang publik yang membutuhkan integritas, etika, dan perlindungan hukum.",
        joyful: "Peserta didik merasa berdaya dan percaya diri saat mampu mengamankan akun pribadi serta melindungi komunitas dari informasi palsu."
      },
      rubrik: "1. Analisis Risiko & Jejak Digital (30%): Mengidentifikasi potensi bahaya kebocoran data dan ancaman siber secara tepat.\n2. Kemampuan Verifikasi Fakta (35%): Menerapkan langkah cek fakta untuk membedakan informasi valid dan hoaks.\n3. Penerapan Etika Komunikasi (20%): Menyusun pesan digital yang santun, menghargai hak cipta, dan tidak provokatif.\n4. Kualitas Karya Kampanye (15%): Infografis/media kampanye informatif dan menarik.",
      pola_kegiatan: {
        pertemuan1: "Guru menyajikan kasus jejak digital dan isu privasi. Peserta didik mengidentifikasi risiko siber dan pentingnya lisensi hak cipta.",
        pertemuan2: "Peserta didik menganalisis berbagai konten digital, menerapkan teknik fact-checking untuk mendeteksi hoaks, dan menyusun kriteria sumber valid.",
        pertemuan3: "Peserta didik merancang karya kampanye etika siber (infografis/video singkat) dan mempresentasikannya sebagai ikrar bersama.",
        pertemuan4: "Peserta didik mengevaluasi pengaturan keamanan akun pribadi dan menyusun panduan digital hygiene mandiri."
      }
    },
    PROYEK: {
      name: "Proyek Inovasi Digital",
      keywords: [
        "perancangan produk",
        "prototipe",
        "uji coba",
        "presentasi karya",
        "revisi",
        "kolaborasi tim",
        "umpan balik"
      ],
      aksi_fenomena: "membuat karya digital ciptaan sendiri dari tahap perencanaan hingga dapat digunakan",
      perangkat_sistem: "prototipe karya buatan tim",
      sistem_pemrograman: "rancangan produk digital",
      sistem_komputer: "sistem prototipe solusi",
      diagnostik: "Soal Diagnostik Proyek:\n'Sebutkan 3 tahapan utama dalam merancang sebuah produk inovasi digital dari masalah hingga siap digunakan pengguna!'",
      pertanyaan_pemantik: {
        fenomena: "Bagaimana sebuah ide kreatif dapat diwujudkan menjadi produk nyata yang berguna bagi masyarakat?",
        masalah: "Kendala apa saja yang sering muncul saat sebuah tim merancang prototipe produk digital?",
        prediksi: "Bagaimana umpan balik (feedback) pengguna dapat membantu menyempurnakan kualitas produk?",
        perbandingan: "Mengapa pembuatan prototipe awal (wireframe) penting sebelum membangun produk akhir?",
        problem_solving: "Bagaimana cara tim mengatasi perbedaan pendapat dalam perancangan proyek?"
      },
      diferensiasi: {
        konten: "Menyediakan lembar spesifikasi produk, contoh sketsa wireframe/prototipe, dan panduan manajemen tugas kelompok.",
        proses: "Pembagian peran spesifik (Ketiga/Desainer/Pengembang/Penguji), perancangan kolaboratif, dan iterasi berdasarkan umpan balik.",
        produk: "Prototipe produk digital siap uji, dokumen spesifikasi teknis, dan paparan slide pameran karya."
      },
      persiapan_guru: "1. Menyiapkan lembar kerja manajemen proyek (Kanban board / Gantt chart sederhana).\n2. Memastikan ketersediaan perangkat lunak/alat bantu pembuatan prototipe digital.\n3. Opsi Unplugged: Menggunakan Kertas Karton, Sticky Notes, dan Bahan Daur Ulang untuk membuat prototipe fisik (paper prototype).",
      deep_learning: {
        mindful: "Peserta didik menghargai perbedaan pendapat dalam tim dan menerima umpan balik kritis sebagai bahan perbaikan produk.",
        meaningful: "Peserta didik merasakan pengalaman nyata memecahkan masalah masyarakat melalui perancangan karya teknologi yang aplikatif.",
        joyful: "Peserta didik merasakan kepuasan luar biasa saat melihat ide ciptaannya berwujud menjadi produk yang berfungsi dan dipamerkan."
      },
      rubrik: "1. Orientasi Masalah & Spesifikasi (20%): Produk menjawab kebutuhan nyata pengguna secara spesifik.\n2. Kualitas Prototipe & Fungsi (40%): Prototipe bekerja sesuai alur perancangan dan minim kendala saat diuji.\n3. Kerja Sama Tim & Manajemen Proyek (20%): Pembagian tugas jelas dan jadwal pengerjaan ditaati bersama.\n4. Komunikasi Presentasi (20%): Mampu menyampaikan keunggulan produk dan merespons pertanyaan penguji dengan baik.",
      pola_kegiatan: {
        pertemuan1: "Kelompok mendefinisikan masalah target, menyusun spesifikasi produk solusi, dan membagi peran kerja dalam tim.",
        pertemuan2: "Peserta didik membangun prototipe solusi (aplikasi, media, atau perangkat) berdasarkan rancangan yang disepakati.",
        pertemuan3: "Kelompok melakukan uji coba produk, mengumpulkan umpan balik pengguna, dan menyempurnakan prototipe.",
        pertemuan4: "Kelompok mempresentasikan karya dalam pameran/forum sekolah dan menyerahkan dokumen produk akhir."
      }
    },
    KONSEP: {
      name: "Materi Inti Pembelajaran",
      keywords: [
        "definisi",
        "pemahaman",
        "penerapan",
        "analisis",
        "penalaran",
        "karakteristik"
      ],
      aksi_fenomena: "mempelajari konsep materi secara mendalam",
      perangkat_sistem: "materi pembelajaran",
      sistem_pemrograman: "struktur pemikiran",
      sistem_komputer: "dasar materi",
      diagnostik: "Soal Diagnostik:\n'Sebutkan hal yang paling mendasar tentang materi yang akan kita pelajari hari ini!'",
      pertanyaan_pemantik: {
        fenomena: "Mengapa konsep ini penting untuk kita pahami dalam konteks pembelajaran kita?",
        masalah: "Apa yang terjadi jika kita tidak menerapkan prinsip materi ini dengan benar?",
        prediksi: "Bagaimana hubungan antara konsep ini dengan hal-hal yang sering kita temui sehari-hari?",
        perbandingan: "Apa perbedaan utama antara prinsip konsep ini dengan materi sebelumnya?",
        problem_solving: "Bagaimana cara kita menerapkan prinsip teori ini untuk memecahkan soal atau masalah nyata?"
      },
      diferensiasi: {
        konten: "Bahan bacaan dengan tingkat kompleksitas yang beragam.",
        proses: "Diskusi terbimbing untuk pemahaman dasar, dan eksplorasi mandiri untuk siswa mahir.",
        produk: "Ringkasan pemahaman sederhana vs penyajian analisis materi tingkat lanjut."
      },
      persiapan_guru: "1. Menyiapkan bahan tayang, sumber bacaan, dan media pembelajaran yang sesuai.\n2. Menyiapkan lembar kerja peserta didik untuk eksplorasi materi.",
      deep_learning: {
        mindful: "Peserta didik fokus dalam memahami esensi materi yang diajarkan.",
        meaningful: "Peserta didik mampu mengaitkan materi yang dipelajari dengan nilai kehidupan dan manfaat praktisnya.",
        joyful: "Peserta didik menikmati proses eksplorasi materi melalui diskusi dan kegiatan interaktif."
      },
      rubrik: "1. Pemahaman Materi (40%): Mampu menjelaskan konsep dan inti pelajaran dengan baik.\n2. Penalaran dan Analisis (30%): Mampu menghubungkan antar-konsep secara logis.\n3. Partisipasi dan Diskusi (20%): Aktif memberikan pendapat dan merespon pertanyaan.\n4. Kerapian Hasil Kerja (10%): Menyajikan tugas atau catatan dengan struktur yang teratur.",
      pola_kegiatan: {
        pertemuan1: "Peserta didik dikenalkan dengan konsep dasar dan mengidentifikasi poin-poin utama materi.",
        pertemuan2: "Peserta didik melakukan eksplorasi kelompok dan menganalisis materi lebih dalam.",
        pertemuan3: "Peserta didik mengerjakan lembar aktivitas dan mendiskusikan temuan atau jawaban mereka.",
        pertemuan4: "Peserta didik mempresentasikan hasil pemahaman, menarik kesimpulan bersama guru, dan melakukan refleksi."
      }
    },
    BAHASA: {
      name: "Bahasa & Komunikasi",
      keywords: [
        "kosakata",
        "tata bahasa",
        "ungkapan",
        "dialog",
        "komunikasi",
        "teks",
        "pelafalan",
        "menyimak",
        "berbicara",
        "membaca",
        "menulis"
      ],
      aksi_fenomena: "berkomunikasi menggunakan bahasa yang tepat",
      perangkat_sistem: "teks atau dialog",
      sistem_pemrograman: "kaidah kebahasaan",
      sistem_komputer: "struktur bahasa",
      diagnostik: "Soal Diagnostik Bahasa:\n'Lengkapi dialog rumpang berikut dengan kosakata atau ungkapan yang tepat!'",
      pertanyaan_pemantik: {
        fenomena: "Bagaimana cara menggunakan ungkapan bahasa yang tepat dalam kehidupan sehari-hari?",
        masalah: "Apa makna yang tersirat jika kita menggunakan kosakata yang berbeda saat berbicara?",
        prediksi: "Bagaimana cara menyusun teks atau dialog yang dapat dipahami lawan bicara?",
        perbandingan: "Apa perbedaan ungkapan ini jika digunakan kepada teman sebaya dibandingkan kepada orang yang lebih tua?",
        problem_solving: "Bagaimana cara berlatih melafalkan kosakata baru agar terdengar fasih?"
      },
      diferensiasi: {
        konten: "Menyediakan teks/dialog dengan tingkat kesulitan berbeda (pendek vs panjang), dan glosarium kosakata.",
        proses: "Praktik pelafalan terbimbing untuk kelompok awal, praktik berpasangan, dan pembuatan dialog mandiri untuk kelompok mahir.",
        produk: "Membaca teks/dialog (reguler) vs menyusun dan mempraktikkan dialog kreasi sendiri (mahir)."
      },
      persiapan_guru: "1. Menyiapkan teks bacaan, contoh dialog, dan audio/visual pendukung.\n2. Menyiapkan daftar kosakata (mufradat/vocabulary) beserta pelafalannya.\n3. Menyusun pasangan atau kelompok kecil untuk praktik komunikasi.",
      deep_learning: {
        mindful: "Peserta didik menyadari bahwa kejelasan pelafalan dan ketepatan kosakata sangat penting dalam interaksi sosial.",
        meaningful: "Peserta didik memahami bahwa kemampuan berbahasa membuka wawasan dan membangun hubungan baik antarsesama.",
        joyful: "Peserta didik merasa antusias dan percaya diri saat mempraktikkan dialog berpasangan dengan teman."
      },
      rubrik: "1. Kelancaran Berbicara & Pelafalan (40%): Melafalkan kosakata dan kalimat dengan jelas dan fasih.\n2. Penguasaan Kosakata (30%): Menggunakan kosakata yang bervariasi dan tepat konteks.\n3. Pemahaman Teks/Menyimak (20%): Mampu merespon atau menjawab pertanyaan berdasarkan teks/dialog.\n4. Tata Bahasa (10%): Menggunakan struktur kalimat yang benar.",
      pola_kegiatan: {
        pertemuan1: "Guru menyajikan contoh kosakata dan ungkapan. Peserta didik menirukan pelafalan dan berlatih mencocokkan kosakata dengan artinya.",
        pertemuan2: "Peserta didik menyimak atau membaca contoh dialog, lalu mempraktikkan ungkapan secara klasikal dan kelompok.",
        pertemuan3: "Peserta didik berlatih menyusun kalimat sederhana atau melengkapi teks/dialog rumpang.",
        pertemuan4: "Peserta didik mempraktikkan percakapan (role play) secara berpasangan atau menyajikan hasil tulisan/teks di depan kelas."
      }
    }
  }
};

// src/masterGenerativeRulesEngine.js
function parseAlokasiJP(alokasiString = "") {
  if (!alokasiString || typeof alokasiString !== "string") return 4;
  const jpMatch = alokasiString.match(/(\d+)\s*JP/i);
  if (jpMatch) return parseInt(jpMatch[1], 10) || 4;
  const menitMatch = alokasiString.match(/(\d+)\s*x\s*\d+/i);
  if (menitMatch) return parseInt(menitMatch[1], 10) || 4;
  const numMatch = alokasiString.match(/(\d+)/);
  if (numMatch) {
    const val = parseInt(numMatch[1], 10);
    if (val > 0 && val <= 40) return val;
  }
  return 4;
}
function getPatternIndex(seedString, maxOptions, nonce = 0) {
  if (!maxOptions || maxOptions <= 0) return 0;
  const combined = `${seedString}_nonce_${nonce}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0;
  }
  const x = Math.sin(hash + 0.12345) * 1e4;
  const randVal = x - Math.floor(x);
  return Math.floor(randVal * maxOptions);
}
function autoDetectMaterialType(subjectName = "", topic = "", subbab = "", detail = "") {
  const combined = `${subjectName} ${topic} ${subbab} ${detail}`.toLowerCase();
  const subj = (subjectName || "").toLowerCase();
  if (subj.includes("arab") || subj.includes("inggris") || subj.includes("indonesia") || subj.includes("jerman") || subj.includes("prancis") || subj.includes("bahasa")) return "BAHASA";
  if (subj.includes("matematika") || subj.includes("math")) return "MATEMATIKA";
  if (subj.includes("biologi") || subj.includes("fisika") || subj.includes("kimia") || subj.includes("ipa")) return "ILMU_ALAM";
  if (subj.includes("sejarah") || subj.includes("geografi") || subj.includes("sosiologi") || subj.includes("ekonomi") || subj.includes("ips") || subj.includes("pkn")) return "ILMU_SOSIAL";
  if (subj.includes("pjok") || subj.includes("jasmani") || subj.includes("olahraga")) return "PJOK";
  if (subj.includes("seni") || subj.includes("art") || subj.includes("budaya") || subj.includes("prakarya")) return "PROYEK";
  if (/\b(ai|generative ai|prompt|kecerdasan buatan|chatgpt|gemini|llm|machine learning|model ai|bias ai)\b/.test(combined)) {
    return "AI";
  }
  if (/\b(etika digital|keamanan siber|jejak digital|privasi|hoaks|hak cipta|literasi digital|sosial media|phishing)\b/.test(combined)) {
    return "ETIKA_DIGITAL";
  }
  if (/\b(koding|coding|pemrograman|program|c\+\+|python|pascal|javascript|html|css|syntax|sintaks|if-else|if else|loop|for|while|array|variabel|debugging|compiler|ide|unoardusim|arduino)\b/.test(combined)) {
    return "KODING";
  }
  if (/\b(jaringan|network|router|switch|ip address|ip|topologi|lan|wan|wifi|konektivitas|troubleshooting|cyber|keamanan jaringan)\b/.test(combined)) {
    return "JARINGAN";
  }
  if (/\b(algoritma|flowchart|pseudocode|dekomposisi|abstraksi|berpikir komputasional|computational thinking|pengurutan|pencarian)\b/.test(combined)) {
    return "ALGORITMA";
  }
  if (/\b(data|dataset|tabel|grafik|analisis data|visualisasi|statistik|excel|spreadsheet|database|sql)\b/.test(combined)) {
    return "DATA";
  }
  if (/\b(proyek|prototipe|produk|karya|inovasi|pameran|perancangan)\b/.test(combined)) {
    return "PROYEK";
  }
  if (/\b(bahasa|teks|hiwar|qira|istima|kitabah|mufradat|grammar|vocabulary|speaking|listening|reading|writing|dialog|percakapan)\b/.test(combined)) {
    return "BAHASA";
  }
  return "KONSEP";
}
function deriveTopicVocabulary(materiInti) {
  if (!materiInti || typeof materiInti !== "string") {
    return {
      main: "Konsep Utama",
      list: ["Konsep Utama", "Langkah Terkait", "Penerapan Praktis", "Materi Inti"]
    };
  }
  const cleanMateri = materiInti.replace(/&/g, "dan").replace(/dan/gi, "dan").replace(/atau/gi, "atau").trim();
  const parts = cleanMateri.split(/(?:dan|atau|,\s*|\bserta\b|-|\/)/gi).map((p) => p.trim()).filter((p) => p.length > 2);
  const list = [];
  for (const part of parts) {
    const cleaned = part.replace(/^[^a-zA-Z0-9\s]+|[^a-zA-Z0-9\s]+$/g, "").trim();
    if (cleaned.length > 2 && !list.includes(cleaned)) {
      list.push(cleaned);
    }
  }
  const genericModifiers = [
    "manajemen",
    "istilah",
    "struktur",
    "dasar",
    "konsep",
    "proses",
    "sistem",
    "teknik",
    "pengenalan",
    "studi",
    "analisis",
    "teori",
    "penggunaan",
    "aplikasi",
    "metode",
    "penerapan",
    "dalam",
    "dengan",
    "yang",
    "untuk",
    "pada",
    "dan",
    "atau",
    "serta",
    "dari",
    "tentang",
    "secara",
    "contoh"
  ];
  const subPhrases = [];
  for (const part of list) {
    const words = part.split(/\s+/).map((w) => w.replace(/[^a-zA-Z0-9]/g, "").trim()).filter((w) => w.length > 2);
    if (words.length >= 2) {
      if (genericModifiers.includes(words[0].toLowerCase())) {
        const sub = words.slice(1).join(" ");
        if (sub.split(/\s+/).length >= 2) {
          if (sub.length > 2 && !subPhrases.includes(sub)) {
            subPhrases.push(sub);
          }
        }
      }
    }
  }
  for (const sp of subPhrases) {
    if (!list.some((item) => item.toLowerCase() === sp.toLowerCase())) {
      list.push(sp);
    }
  }
  if (list.length === 0) {
    list.push(cleanMateri);
  }
  const formattedList = list.map((item) => {
    return item.split(/\s+/).map((word) => {
      if (word.length === 0) return "";
      return word[0].toUpperCase() + word.substring(1).toLowerCase();
    }).join(" ");
  });
  while (formattedList.length < 4) {
    const fallbackWord = formattedList[0] || "Konsep";
    formattedList.push(fallbackWord);
  }
  return {
    main: formattedList[0] || cleanMateri,
    list: formattedList
  };
}
function resolveTerm(term, materi) {
  const lower = (materi || "").toLowerCase();
  const t = term.toLowerCase();
  if (lower.includes(t)) {
    return term;
  }
  const fallbacks = {
    "syntax": "aturan penulisan",
    "sintaks": "aturan penulisan",
    "debugging": "pengujian hasil",
    "debug": "pemeriksaan",
    "if-else": "alur keputusan",
    "if else": "alur keputusan",
    "percabangan": "alur keputusan",
    "perulangan": "proses berulang",
    "loop": "proses berulang",
    "variabel": "parameter data",
    "fungsi": "peran utama/kegunaan",
    "objek": "komponen",
    "pseudocode": "notasi langkah terstruktur",
    "flowchart": "diagram alur",
    "bagan alur": "diagram alur",
    "prompt engineering": "penerapan praktis",
    "prompt-engineering": "penerapan praktis",
    "prompt": "instruksi",
    "prompts": "instruksi",
    "dataset": "data",
    "data set": "data",
    "data-set": "data",
    "hallucination": "kekeliruan informasi",
    "halusinasi": "kesalahan",
    "bias": "keterbatasan",
    "bias ai": "keterbatasan",
    "asisten ai": "asisten cerdas",
    "asisten cerdas": "asisten cerdas",
    "teknologi cerdas": "teknologi cerdas",
    "model ai": "sistem cerdas",
    "router": "node penghubung",
    "switch": "perangkat hub",
    "ip address": "identitas koneksi",
    "alamat ip": "identitas koneksi",
    "topologi": "skema struktur",
    "spreadsheet": "aplikasi pengolah data",
    "phishing": "ancaman keamanan digital",
    "hoaks": "informasi palsu",
    "hoax": "informasi palsu"
  };
  return fallbacks[t] || term;
}
function replacePlaceholdersRecursive(obj, safeMateri, safeSubbab, safeBab) {
  if (typeof obj === "string") {
    let s = obj.replace(/{{MATERI_INTI}}/g, safeMateri).replace(/{{KONSEP_UTAMA}}/g, safeSubbab).replace(/{{BAB_UTAMA}}/g, safeBab).replace(/{{SUBBAB}}/g, safeSubbab);
    s = s.replace(/{{[A-Z0-9_]+}}/g, safeMateri);
    return s;
  } else if (Array.isArray(obj)) {
    return obj.map((item) => replacePlaceholdersRecursive(item, safeMateri, safeSubbab, safeBab));
  } else if (typeof obj === "object" && obj !== null) {
    const copy = {};
    for (const key of Object.keys(obj)) {
      copy[key] = replacePlaceholdersRecursive(obj[key], safeMateri, safeSubbab, safeBab);
    }
    return copy;
  }
  return obj;
}
function runSelfValidation(result, safeMateri, selectedJenis) {
  const vocab = deriveTopicVocabulary(safeMateri);
  const checkedFields = ["capaianPembelajaran", "tujuanPembelajaran", "pertanyaanPemantik", "kegiatanPembelajaran", "lkpd", "asesmen", "glosarium"];
  let scoredSections = 0;
  let successfulSections = 0;
  for (const field of checkedFields) {
    if (!result[field]) continue;
    scoredSections++;
    const valStr = String(result[field]).toLowerCase();
    let sectionHasTopic = false;
    for (const term of vocab.list) {
      if (valStr.includes(term.toLowerCase())) {
        sectionHasTopic = true;
      }
    }
    let sectionHasBias = false;
    const forbiddenDefaults = [
      "prompt engineering",
      "hallucination",
      "dataset",
      "bias ai",
      "fact-checking",
      "generative ai",
      "model ai",
      "syntax",
      "debugging",
      "if-else",
      "sintaks",
      "perulangan",
      "percabangan",
      "router",
      "switch",
      "ip address",
      "topologi",
      "alamat ip",
      "spreadsheet",
      "flowchart",
      "pseudocode",
      "tracing",
      "bagan alur",
      "phishing",
      "hoaks"
    ];
    for (const word of forbiddenDefaults) {
      if (!safeMateri.toLowerCase().includes(word) && valStr.includes(word)) {
        sectionHasBias = true;
      }
    }
    if (sectionHasTopic && !sectionHasBias) {
      successfulSections++;
    }
  }
  const topicDominance = scoredSections > 0 ? successfulSections / scoredSections * 100 : 100;
  let missingTerms = 0;
  for (const term of vocab.list) {
    let found = false;
    for (const field of checkedFields) {
      if (result[field] && String(result[field]).toLowerCase().includes(term.toLowerCase())) {
        found = true;
        break;
      }
    }
    if (!found) {
      missingTerms++;
    }
  }
  const topicDrift = vocab.list.length > 0 ? missingTerms / vocab.list.length * 100 : 0;
  let leakageCount = 0;
  const allForbiddens = {
    AI: ["router", "switch", "ip address", "syntax", "if-else", "flowchart", "pseudocode", "tracing"],
    KODING: ["router", "ip address", "topologi", "ping", "model ai", "prompt engineering", "kecerdasan artifisial", "kecerdasan buatan", "asisten cerdas", "teknologi cerdas", "sistem cerdas"],
    JARINGAN: ["syntax error", "prompt engineering", "model ai", "flowchart", "pseudocode", "kecerdasan artifisial", "kecerdasan buatan", "asisten cerdas", "teknologi cerdas", "sistem cerdas"],
    DATA: ["router", "ip address", "syntax", "debugging", "flowchart", "pseudocode", "prompt engineering", "kecerdasan artifisial", "kecerdasan buatan", "asisten cerdas", "teknologi cerdas", "sistem cerdas"],
    ALGORITMA: ["router", "ip address", "prompt engineering", "model ai", "phishing", "kecerdasan artifisial", "kecerdasan buatan", "asisten cerdas", "teknologi cerdas", "sistem cerdas"],
    ETIKA_DIGITAL: ["router", "ip address", "syntax", "debugging", "flowchart", "pseudocode", "kecerdasan artifisial", "kecerdasan buatan", "asisten cerdas", "teknologi cerdas", "sistem cerdas"],
    PROYEK: ["router", "ip address", "syntax", "debugging", "flowchart", "pseudocode", "kecerdasan artifisial", "kecerdasan buatan", "asisten cerdas", "teknologi cerdas", "sistem cerdas"],
    KONSEP: ["router", "ip address", "syntax", "debugging", "flowchart", "pseudocode", "prompt engineering", "kecerdasan artifisial", "kecerdasan buatan", "asisten cerdas", "teknologi cerdas", "sistem cerdas"]
  };
  const forbiddenList = allForbiddens[selectedJenis] || [];
  for (const word of forbiddenList) {
    if (safeMateri.toLowerCase().includes(word)) continue;
    for (const field of Object.keys(result)) {
      if (["kompetensiAwal", "profilPancasila", "saranaPrasarana", "targetPeserta", "selectedJenis"].includes(field)) continue;
      const valStr = String(result[field] || "").toLowerCase();
      let isLeaking = false;
      if (word === "ping") {
        isLeaking = /\bping\b/i.test(valStr);
      } else {
        isLeaking = valStr.includes(word);
      }
      if (isLeaking) {
        leakageCount++;
      }
    }
  }
  const domainLeakage = leakageCount;
  let defaultSubtopicOverride = 0;
  const allDefaults = [
    "prompt engineering",
    "hallucination",
    "dataset",
    "bias ai",
    "fact-checking",
    "generative ai",
    "model ai",
    "syntax",
    "debugging",
    "if-else",
    "sintaks",
    "perulangan",
    "percabangan",
    "router",
    "switch",
    "ip address",
    "topologi",
    "alamat ip",
    "spreadsheet",
    "flowchart",
    "pseudocode",
    "tracing",
    "bagan alur",
    "phishing",
    "hoaks"
  ];
  for (const word of allDefaults) {
    if (safeMateri.toLowerCase().includes(word)) continue;
    for (const field of Object.keys(result)) {
      if (["kompetensiAwal", "profilPancasila", "saranaPrasarana", "targetPeserta", "selectedJenis"].includes(field)) continue;
      const valStr = String(result[field] || "").toLowerCase();
      if (valStr.includes(word)) {
        defaultSubtopicOverride++;
      }
    }
  }
  const domainTemplateBias = defaultSubtopicOverride > 0;
  let unresolvedPlaceholder = 0;
  const placeholderRegex = /{{[A-Z0-9_]+}}/g;
  for (const field of Object.keys(result)) {
    const valStr = String(result[field] || "");
    const matches = valStr.match(placeholderRegex);
    if (matches) {
      unresolvedPlaceholder += matches.length;
    }
  }
  let irrelevantVocabulary = 0;
  const otherKeywords = [];
  const allKeys = ["AI", "KODING", "JARINGAN", "DATA", "ALGORITMA", "ETIKA_DIGITAL", "PROYEK", "KONSEP"];
  for (const k of allKeys) {
    if (k === selectedJenis) continue;
    const kw = rules_default.material_types[k]?.keywords || [];
    otherKeywords.push(...kw);
  }
  for (const word of otherKeywords) {
    if (safeMateri.toLowerCase().includes(word.toLowerCase())) continue;
    for (const field of Object.keys(result)) {
      if (["kompetensiAwal", "profilPancasila", "saranaPrasarana", "targetPeserta", "selectedJenis"].includes(field)) continue;
      const valStr = String(result[field] || "").toLowerCase();
      if (valStr.includes(word.toLowerCase())) {
        irrelevantVocabulary++;
      }
    }
  }
  return {
    topicDominance,
    topicDrift,
    domainLeakage,
    defaultSubtopicOverride,
    domainTemplateBias,
    unresolvedPlaceholder,
    irrelevantVocabulary
  };
}
var domainRefleksiStud = {
  AI: '1. Bagian mana dari materi "{{MATERI_INTI}}" yang paling menarik bagi kalian?\n2. Bagaimana cara kalian memastikan hasil atau informasi terkait "{{MATERI_INTI}}" dapat dipercaya dan terbebas dari bias?',
  DATA: '1. Pengalaman apa yang paling berkesan saat mengolah data dan membuat visualisasi terkait "{{MATERI_INTI}}"?\n2. Bagaimana data membantu kita mengambil keputusan secara objektif?',
  JARINGAN: '1. Tantangan apa yang kalian hadapi saat merancang koneksi atau memecahkan masalah terkait "{{MATERI_INTI}}"?\n2. Mengapa pemahaman tentang arsitektur dan sistem koneksi sangat penting di era digital?',
  ALGORITMA: '1. Bagaimana proses dekomposisi dan perancangan langkah logis membantu menyelesaikan masalah terkait "{{MATERI_INTI}}"?\n2. Mengapa penelusuran alur penting untuk membuktikan kebenaran logika?',
  KODING: '1. Pengalaman apa yang kalian peroleh saat menuliskan instruksi program dan memperbaiki error (debugging) terkait "{{MATERI_INTI}}"?\n2. Mengapa ketelitian dalam logika penulisan sangat menentukan keberhasilan program?',
  ETIKA_DIGITAL: '1. Pelajaran penting apa yang kalian dapatkan mengenai tanggung jawab siber dan privasi terkait "{{MATERI_INTI}}"?\n2. Bagaimana cara kalian menerapkan budaya siber yang santun dan aman dalam kehidupan sehari-hari?',
  PROYEK: '1. Pengalaman paling berharga apa yang kalian rasakan saat merancang prototipe produk "{{MATERI_INTI}}" bersama tim?\n2. Bagaimana cara kelompok menghadapi perbedaan pendapat dan umpan balik pengguna?',
  BAHASA: '1. Kesulitan apa yang paling dirasakan saat mempraktikkan kosakata atau ungkapan terkait "{{MATERI_INTI}}"?\n2. Bagaimana cara kalian mengatasi rasa gugup saat berbicara menggunakan bahasa tersebut di depan kelas?',
  KONSEP: '1. Bagaimana peta konsep membantu kalian memahami teori "{{MATERI_INTI}}" secara utuh?\n2. Contoh penerapan apa di sekitar kalian yang paling mencerminkan konsep yang dipelajari?'
};
var domainRefleksiTeach = {
  AI: '1. Apakah peserta didik mampu menguasai konsep dasar "{{MATERI_INTI}}" dengan aktif?\n2. Seberapa efektif pemahaman peserta didik mengenai etika dan verifikasi hasil terkait "{{MATERI_INTI}}"?',
  DATA: '1. Apakah peserta didik dapat memvisualisasikan data "{{MATERI_INTI}}" dengan tepat?\n2. Bagaimana pemahaman peserta didik dalam merumuskan kesimpulan berbasis analisis data?',
  JARINGAN: '1. Apakah peserta didik memahami skema koneksi atau sistem "{{MATERI_INTI}}" dengan baik?\n2. Seberapa efektif bimbingan dalam mengatasi kendala teknis peserta didik?',
  ALGORITMA: '1. Apakah peserta didik dapat menyusun alur logis "{{MATERI_INTI}}" secara runtut dan sistematis?\n2. Bagaimana efektivitas latihan desk-check dalam menemukan kesalahan logika?',
  KODING: '1. Apakah peserta didik dapat memahami instruksi program dan struktur logika "{{MATERI_INTI}}" dengan baik?\n2. Seberapa efektif proses bimbingan praktikum dalam membantu peserta didik melakukan debugging?',
  ETIKA_DIGITAL: '1. Apakah peserta didik mampu mengidentifikasi risiko keamanan siber atau hoaks terkait "{{MATERI_INTI}}" secara kritis?\n2. Bagaimana antusiasme peserta didik dalam menyusun kampanye etika digital?',
  PROYEK: '1. Apakah kolaborasi dan manajemen proyek dalam tim untuk "{{MATERI_INTI}}" berjalan dengan efektif?\n2. Seberapa baik kualitas prototipe dan presentasi karya yang dihasilkan peserta didik?',
  BAHASA: '1. Apakah peserta didik sudah mampu melafalkan kosakata "{{MATERI_INTI}}" dengan fasih dan tepat?\n2. Seberapa antusias peserta didik saat mempraktikkan dialog atau menyusun teks mandiri?',
  KONSEP: '1. Apakah peserta didik mampu menguasai definisi dan kerangka teoretis terkait "{{MATERI_INTI}}" dengan baik?\n2. Seberapa aktif peserta didik dalam menghubungkan konsep dengan penerapan materi nyata?'
};
function getDomainBahanAjar(type, safeSubject, safeMateri, safeSubbab) {
  const subj = (safeSubject || "").toLowerCase();
  if (subj.includes("arab") || subj.includes("inggris") || subj.includes("indonesia") || subj.includes("jerman") || subj.includes("prancis") || subj.includes("bahasa")) {
    return `Ringkasan Materi & Bahan Bacaan (${safeSubbab}):
Materi "${safeMateri}" merupakan fokus kajian kebahasaan dan komunikasi pada bab ini.
Konsep Utama: Pemahaman kosakata esensial, struktur tata bahasa (qawaid/grammar), serta ungkapan komunikasi aktif seputar "${safeMateri}".
Langkah Belajar: Cermati teks/dialog model, tirukan pelafalan yang benar, pelajari makna kata penting, dan gunakan dalam latihan percakapan mandiri atau berpasangan.`;
  }
  if (subj.includes("matematika") || subj.includes("math")) {
    return `Ringkasan Materi & Bahan Bacaan (${safeSubbab}):
Materi "${safeMateri}" merupakan fokus konsep perhitungan, pola, dan pemodelan matematis pada bab ini.
Konsep Utama: Prinsip, rumus, dan hubungan matematis yang mendasari penyelesaian masalah "${safeMateri}".
Langkah Belajar: Pahami definisi konsep, pelajari contoh soal langkah demi langkah, dan selesaikan latihan soal terstruktur mulai dari pemahaman dasar hingga pemecahan masalah (HOTS).`;
  }
  if (subj.includes("biologi") || subj.includes("fisika") || subj.includes("kimia") || subj.includes("ipa")) {
    return `Ringkasan Materi & Bahan Bacaan (${safeSubbab}):
Materi "${safeMateri}" merupakan fokus penyelidikan ilmiah dan telaah fenomena alam pada bab ini.
Konsep Utama: Struktur, fungsi, mekanisme, atau hukum ilmiah yang mendasari fenomena "${safeMateri}".
Langkah Belajar: Amati objek/gejala kontekstual, rumuskan pertanyaan penyelidikan ilmiah, lakukan analisis data observasi, dan simpulkan keteraturan ilmiah yang ditemukan.`;
  }
  if (subj.includes("sejarah") || subj.includes("geografi") || subj.includes("sosiologi") || subj.includes("ekonomi") || subj.includes("ips") || subj.includes("pkn")) {
    return `Ringkasan Materi & Bahan Bacaan (${safeSubbab}):
Materi "${safeMateri}" merupakan fokus kajian historis, spasial, sosial, atau kewarganegaraan pada bab ini.
Konsep Utama: Latar belakang peristiwa, dinamika interaksi, hubungan sebab-akibat, serta dampak sosial dari kajian "${safeMateri}".
Langkah Belajar: Telusuri sumber literatur terpercaya, analisis kronologi dan hubungan kausalitas, diskusikan perbedaan sudut pandang, dan rumuskan simpulan kritis.`;
  }
  if (subj.includes("pjok") || subj.includes("jasmani") || subj.includes("olahraga")) {
    return `Ringkasan Materi & Bahan Bacaan (${safeSubbab}):
Materi "${safeMateri}" merupakan fokus penguasaan gerak fisik dan keterampilan motorik pada bab ini.
Konsep Utama: Teknik dasar, efisiensi mekanika gerak, kebugaran, dan keselamatan dalam beraktivitas terkait "${safeMateri}".
Langkah Belajar: Lakukan pemanasan teratur, cermati demonstrasi teknik yang benar, lakukan latihan drill berulang secara bertahap, dan terapkan nilai sportivitas saat evaluasi.`;
  }
  return `Ringkasan Materi & Bahan Bacaan (${safeSubbab}):
Materi "${safeMateri}" merupakan fokus kajian utama pada bab ini.
Konsep Utama: Prinsip konseptual dan kerangka kerja dasar terkait "${safeMateri}" untuk pemecahan masalah kontekstual.
Langkah Belajar: Pelajari konsep esensial, diskusikan implementasi nyata, lakukan kajian analitis terstruktur, dan susun simpulan yang komprehensif.`;
}
function getDomainLKPD(type, safeSubject, safeMateri, safeGrade, safeSemester) {
  const subj = (safeSubject || "").toLowerCase();
  let cat = "KONSEP";
  if (subj.includes("arab") || subj.includes("inggris") || subj.includes("indonesia") || subj.includes("jerman") || subj.includes("prancis") || subj.includes("bahasa")) cat = "BAHASA";
  else if (subj.includes("matematika") || subj.includes("math")) cat = "MATEMATIKA";
  else if (subj.includes("biologi") || subj.includes("fisika") || subj.includes("kimia") || subj.includes("ipa")) cat = "ILMU_ALAM";
  else if (subj.includes("sejarah") || subj.includes("geografi") || subj.includes("sosiologi") || subj.includes("ekonomi") || subj.includes("ips") || subj.includes("pkn")) cat = "ILMU_SOSIAL";
  else if (subj.includes("pjok") || subj.includes("jasmani") || subj.includes("olahraga")) cat = "PJOK";
  const lkpdData = {
    BAHASA: {
      act1: `Pemahaman Kosakata & Teks "${safeMateri}"`,
      act1_desc: `1. Baca dan cermati teks/dialog berbahasa terkait "${safeMateri}".
2. Identifikasi kosakata baru dan carilah maknanya secara mandiri.`,
      act2: `Latihan Tata Bahasa & Struktur "${safeMateri}"`,
      act2_desc: `1. Perhatikan pola kalimat yang digunakan dalam ungkapan "${safeMateri}".
2. Lengkapilah bagian rumpang pada latihan soal dengan kata/ungkapan yang tepat.`,
      act3: `Praktik & Unjuk Kerja "${safeMateri}"`,
      act3_desc: `1. Susunlah percakapan atau teks pendek orisinal terkait topik "${safeMateri}".
2. Praktikkan bersama rekan kelompok dengan memperhatikan pelafalan dan intonasi yang benar.`
    },
    MATEMATIKA: {
      act1: `Eksplorasi Konsep Dasar "${safeMateri}"`,
      act1_desc: `1. Amati masalah kontekstual yang disajikan terkait "${safeMateri}".
2. Rumuskan informasi apa yang diketahui dan apa yang ditanyakan.`,
      act2: `Latihan Prosedural "${safeMateri}"`,
      act2_desc: `1. Gunakan rumus atau langkah penyelesaian yang tepat untuk memecahkan persoalan "${safeMateri}".
2. Selesaikan serangkaian soal latihan secara cermat dan sistematis.`,
      act3: `Penerapan & Pemecahan Masalah "${safeMateri}"`,
      act3_desc: `1. Diskusikan penyelesaian soal cerita (Higher Order Thinking) yang melibatkan prinsip "${safeMateri}".
2. Sajikan langkah penyelesaian kalian dan lakukan verifikasi kebenaran hasil akhir.`
    },
    ILMU_ALAM: {
      act1: `Observasi Fenomena "${safeMateri}"`,
      act1_desc: `1. Amati bahan/objek simulasi terkait "${safeMateri}" dengan teliti.
2. Catat temuan awal dan rumuskan pertanyaan penyelidikan ilmiah.`,
      act2: `Pengumpulan Data & Analisis "${safeMateri}"`,
      act2_desc: `1. Lakukan eksperimen/pengamatan terstruktur mengenai "${safeMateri}".
2. Catat data hasil percobaan ke dalam tabel observasi yang rapi.`,
      act3: `Menarik Kesimpulan "${safeMateri}"`,
      act3_desc: `1. Diskusikan keterkaitan antara hasil data percobaan "${safeMateri}" dengan landasan teori.
2. Rumuskan kesimpulan akhir dan sampaikan di depan kelas.`
    },
    ILMU_SOSIAL: {
      act1: `Identifikasi Isu/Latar Belakang "${safeMateri}"`,
      act1_desc: `1. Kaji sumber literatur terkait latar belakang historis/spasial/sosial dari "${safeMateri}".
2. Tuliskan poin-poin utama dan fakta-fakta relevan yang kalian temukan.`,
      act2: `Analisis Hubungan & Dinamika "${safeMateri}"`,
      act2_desc: `1. Diskusikan hubungan sebab-akibat atau dinamika yang terjadi pada fenomena "${safeMateri}".
2. Gunakan berbagai sudut pandang untuk menganalisis dampaknya.`,
      act3: `Evaluasi & Sintesis "${safeMateri}"`,
      act3_desc: `1. Rangkum argumen utama dari diskusi tentang isu "${safeMateri}".
2. Susun laporan analisis akhir yang memuat simpulan kritis dan rekomendasi tindak lanjut.`
    },
    PJOK: {
      act1: `Pemahaman Gerak Dasar "${safeMateri}"`,
      act1_desc: `1. Amati demonstrasi atau panduan visual mengenai teknik "${safeMateri}".
2. Catat tahapan pelaksanaan gerak secara berurutan dan bagian tubuh yang dominan digunakan.`,
      act2: `Latihan Mandiri/Berpasangan "${safeMateri}"`,
      act2_desc: `1. Praktikkan gerakan "${safeMateri}" sesuai tahapan yang benar (awalan, pelaksanaan, akhir).
2. Lakukan pengamatan (peer observation) terhadap teknik rekan kalian.`,
      act3: `Penerapan & Evaluasi Fisik "${safeMateri}"`,
      act3_desc: `1. Terapkan keterampilan "${safeMateri}" ke dalam situasi bermain sederhana atau latihan terukur.
2. Lakukan evaluasi terhadap keselamatan dan keefektifan gerak.`
    },
    KONSEP: {
      act1: `Identifikasi Konsep Dasar "${safeMateri}"`,
      act1_desc: `1. Pelajari karakteristik utama dari konsep "${safeMateri}" secara mandiri.
2. Tuliskan deskripsi ringkas mengenai hakikat dan tujuan "${safeMateri}".`,
      act2: `Pemahaman Lanjutan "${safeMateri}"`,
      act2_desc: `1. Diskusikan bersama kelompok mengenai penerapan prinsip "${safeMateri}" dalam berbagai skenario.
2. Kategorikan bagian-bagian pendukung dari "${safeMateri}" secara terstruktur.`,
      act3: `Analisis Kritis & Penerapan "${safeMateri}"`,
      act3_desc: `1. Lakukan kajian mendalam terhadap penyelesaian masalah kontekstual menggunakan prinsip "${safeMateri}".
2. Susun laporan hasil diskusi secara komprehensif.`
    }
  };
  const sel = lkpdData[cat] || lkpdData["KONSEP"];
  return `13. LEMBAR KERJA PESERTA DIDIK (LKPD)
Mata Pelajaran : ${safeSubject}
Topik / Materi Inti : "${safeMateri}"
Kelas / Semester : ${safeGrade} / ${safeSemester}

Aktivitas 1: ${sel.act1}
${sel.act1_desc}

Aktivitas 2: ${sel.act2}
${sel.act2_desc}

Aktivitas 3: ${sel.act3}
${sel.act3_desc}`;
}
function sanitizeOutputForStrictTopicLock(value, safeMateri, domain) {
  if (typeof value !== "string") return value;
  const lowerMateri = safeMateri.toLowerCase();
  let result = value;
  const inMateri = (pattern) => lowerMateri.includes(pattern.toLowerCase());
  const containsAI = /\b(ai|artificial intelligence|generative ai|kecerdasan buatan|kecerdasan artifisial|prompt|rekayasa prompt|prompt-engineering|prompt engineering)\b/i.test(safeMateri);
  if (!containsAI) {
    let replacementDomainName = "Sistem / Konsep";
    let replacementPerspektif = "secara sistematis";
    let replacementLatihan = "Latihan Praktik Terstruktur";
    let replacementSistem = "sistem terstruktur";
    let replacementAsisten = "media/alat bantu pendukung";
    if (domain === "KODING") {
      replacementDomainName = "Koding & Pemrograman";
      replacementPerspektif = "secara logis dan terstruktur";
      replacementLatihan = "Latihan Praktik Pemrograman";
      replacementSistem = "struktur logika program";
      replacementAsisten = "media pemrograman";
    } else if (domain === "JARINGAN") {
      replacementDomainName = "Jaringan Komputer";
      replacementPerspektif = "berbasis skema jaringan";
      replacementLatihan = "Latihan Praktik Jaringan";
      replacementSistem = "sistem konektivitas";
      replacementAsisten = "alat bantu simulasi";
    } else if (domain === "DATA") {
      replacementDomainName = "Analisis Data";
      replacementPerspektif = "secara analitis";
      replacementLatihan = "Latihan Praktik Analisis Data";
      replacementSistem = "sistem pengolahan data";
      replacementAsisten = "aplikasi pengolah data";
    } else if (domain === "ALGORITMA") {
      replacementDomainName = "Algoritma & Alur Logika";
      replacementPerspektif = "secara logis";
      replacementLatihan = "Latihan Praktik Algoritma";
      replacementSistem = "bagan alur logika";
      replacementAsisten = "media perancangan";
    }
    result = result.replace(/Latihan Praktik Berbasis Kecerdasan Artifisial \(AI\)/gi, replacementLatihan);
    result = result.replace(/Latihan Praktik Berbasis Kecerdasan Artifisial/gi, replacementLatihan);
    result = result.replace(/Kecerdasan Artifisial \(AI\)/g, replacementDomainName);
    result = result.replace(/Kecerdasan Artifisial/g, replacementDomainName);
    result = result.replace(/Kecerdasan buatan/gi, replacementDomainName);
    result = result.replace(/perspektif Kecerdasan Artifisial/gi, replacementPerspektif);
    result = result.replace(/perspektif cerdas/gi, replacementPerspektif);
    result = result.replace(/menggunakan perspektif cerdas/gi, "secara logis dan kritis");
    result = result.replace(/menggunakan perspektif sistem/gi, "secara logis");
    result = result.replace(/teknologi cerdas/gi, "pendekatan sistematis");
    result = result.replace(/sistem cerdas/gi, replacementSistem);
    result = result.replace(/asisten\/perangkat bantu/gi, "media pembelajaran");
    result = result.replace(/dengan bantuan perangkat bantu/gi, "secara mandiri");
    result = result.replace(/asisten cerdas/gi, replacementAsisten);
    result = result.replace(/asisten ai/gi, replacementAsisten);
    result = result.replace(/model ai/gi, replacementSistem);
    result = result.replace(/model-ai/gi, replacementSistem);
    result = result.replace(/\bmodel ai\b/gi, replacementSistem);
    result = result.replace(/\bAI\b/g, "Sistem");
    result = result.replace(/\bai\b/g, "sistem");
  }
  if (!inMateri("prompt engineering") && !inMateri("prompt-engineering")) {
    result = result.replace(/\bprompt engineering\b/gi, "penerapan praktis");
    result = result.replace(/\bprompt-engineering\b/gi, "penerapan praktis");
    result = result.replace(/\brekayasa prompt\b/gi, "penerapan praktis");
  }
  if (!inMateri("generative ai") && !inMateri("ai generatif") && !inMateri("kecerdasan buatan") && !inMateri("kecerdasan artifisial")) {
    result = result.replace(/\bgenerative ai\b/gi, "konsep tingkat lanjut");
    result = result.replace(/\bgenerative-ai\b/gi, "konsep tingkat lanjut");
    result = result.replace(/\bai generatif\b/gi, "konsep tingkat lanjut");
  }
  if (!inMateri("model ai") && !inMateri("model-ai")) {
    result = result.replace(/\bmodel ai\b/gi, "sistem cerdas");
    result = result.replace(/\bmodel-ai\b/gi, "sistem cerdas");
  }
  if (!inMateri("dataset") && !inMateri("data set") && !inMateri("data-set")) {
    result = result.replace(/\bdataset\b/gi, "data");
    result = result.replace(/\bdata-set\b/gi, "data");
    result = result.replace(/\bdata set\b/gi, "data");
  }
  if (!inMateri("hallucination") && !inMateri("halusinasi")) {
    result = result.replace(/\bhallucination\b/gi, "kekeliruan informasi");
    result = result.replace(/\bhalusinasi\b/gi, "kesalahan");
  }
  if (!inMateri("bias")) {
    result = result.replace(/\bbias ai\b/gi, "ketidakakuratan");
    result = result.replace(/\bbias\b/gi, "keterbatasan");
  }
  if (!inMateri("fact-checking") && !inMateri("fact checking") && !inMateri("fact-check") && !inMateri("fact check")) {
    result = result.replace(/\bfact-checking\b/gi, "verifikasi fakta");
    result = result.replace(/\bfact checking\b/gi, "verifikasi fakta");
    result = result.replace(/\bfact-check\b/gi, "verifikasi");
    result = result.replace(/\bfact check\b/gi, "verifikasi");
  }
  if (!inMateri("prompt") && !inMateri("prompts")) {
    result = result.replace(/\bprompt\b/gi, "instruksi");
    result = result.replace(/\bprompts\b/gi, "instruksi");
  }
  if (!inMateri("asisten ai") && !inMateri("asisten-ai")) {
    result = result.replace(/\basisten ai\b/gi, "asisten cerdas");
    result = result.replace(/\basisten-ai\b/gi, "asisten cerdas");
  }
  if (!inMateri("asisten cerdas")) {
    result = result.replace(/\basisten cerdas\b/gi, "perangkat bantu");
  }
  if (!inMateri("tools ai") && !inMateri("tools-ai")) {
    result = result.replace(/\btools ai\b/gi, "media pendukung");
    result = result.replace(/\btools-ai\b/gi, "media pendukung");
  }
  if (!inMateri("manusia sebagai model ai")) {
    result = result.replace(/\bmanusia sebagai model ai\b/gi, "peran manusia dalam proses ini");
  }
  if (!inMateri("sistem otomatis") && !inMateri("otomatisasi") && !inMateri("otomatis")) {
    result = result.replace(/\bsistem otomatis\b/gi, "sistem terstruktur");
    result = result.replace(/\botomatisasi\b/gi, "proses sistematis");
    result = result.replace(/\botomatis\b/gi, "sistematis");
  }
  if (!inMateri("teknologi cerdas")) {
    result = result.replace(/\bteknologi cerdas\b/gi, "metode pendukung");
  }
  if (!inMateri("router")) {
    result = result.replace(/\brouter\b/gi, "node penghubung");
  }
  if (!inMateri("switch")) {
    result = result.replace(/\bswitch\b/gi, "perangkat jaringan");
  }
  if (!inMateri("ip address") && !inMateri("alamat ip") && !inMateri("ip")) {
    result = result.replace(/\bip address\b/gi, "identitas koneksi");
    result = result.replace(/\balamat ip\b/gi, "alamat jaringan");
    result = result.replace(/\balamat ip address\b/gi, "alamat identitas koneksi");
  }
  if (!inMateri("topologi")) {
    result = result.replace(/\btopologi\b/gi, "skema struktur");
  }
  if (!inMateri("syntax") && !inMateri("sintaks")) {
    result = result.replace(/\bsyntax\b/gi, "struktur aturan");
    result = result.replace(/\bsintaks\b/gi, "aturan penulisan");
  }
  if (!inMateri("debugging") && !inMateri("debug")) {
    result = result.replace(/\bdebugging\b/gi, "pengujian hasil");
    result = result.replace(/\bdebug\b/gi, "perbaikan");
  }
  if (!inMateri("if-else") && !inMateri("percabangan")) {
    result = result.replace(/\bif-else\b/gi, "logika keputusan");
    result = result.replace(/\bif else\b/gi, "logika keputusan");
    result = result.replace(/\bpercabangan\b/gi, "alur keputusan");
  }
  if (!inMateri("loop") && !inMateri("perulangan")) {
    result = result.replace(/\bloop\b/gi, "proses berulang");
    result = result.replace(/\bperulangan\b/gi, "langkah berulang");
  }
  if (!inMateri("fungsi")) {
    result = result.replace(/fungsionalitasnya/gi, "kegunaan dan perannya");
    result = result.replace(/fungsionalitas/gi, "kegunaan dan peran");
    result = result.replace(/fungsional/gi, "fungsional");
    result = result.replace(/\bfungsi\b/gi, "kegunaan/peran");
  }
  if (!inMateri("objek")) {
    result = result.replace(/\bobjek\b/gi, "komponen");
  }
  if (!inMateri("variabel")) {
    result = result.replace(/\bvariabel\b/gi, "parameter");
  }
  if (!inMateri("flowchart") && !inMateri("bagan alur")) {
    result = result.replace(/\bflowchart\b/gi, "diagram alur");
    result = result.replace(/\bbagan alur\b/gi, "diagram alur");
  }
  if (!inMateri("pseudocode")) {
    result = result.replace(/\bpseudocode\b/gi, "notasi langkah terstruktur");
  }
  if (!inMateri("tracing") && !inMateri("penelusuran")) {
    result = result.replace(/\btracing\b/gi, "pemeriksaan");
    result = result.replace(/\bpenelusuran\b/gi, "pemeriksaan alur");
  }
  if (!inMateri("spreadsheet") && !inMateri("spread sheet")) {
    result = result.replace(/\bspreadsheet\b/gi, "aplikasi pengolah data");
    result = result.replace(/\bspread sheet\b/gi, "lembar kerja digital");
  }
  if (!inMateri("phishing")) {
    result = result.replace(/\bphishing\b/gi, "ancaman keamanan digital");
  }
  if (!inMateri("hoaks") && !inMateri("hoax")) {
    result = result.replace(/\bhoaks\b/gi, "informasi palsu");
    result = result.replace(/\bhoax\b/gi, "informasi tidak akurat");
  }
  if (!inMateri("mind map") && !inMateri("mindmap")) {
    result = result.replace(/\bmind map\b/gi, "peta analisis");
    result = result.replace(/\bmindmap\b/gi, "peta analisis");
  }
  if (!inMateri("peta konsep")) {
    result = result.replace(/\bpeta konsep\b/gi, "skema keterhubungan");
  }
  return result;
}
function sanitizeObject(obj, safeMateri, domain) {
  if (typeof obj === "string") {
    return sanitizeOutputForStrictTopicLock(obj, safeMateri, domain);
  } else if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, safeMateri, domain));
  } else if (typeof obj === "object" && obj !== null) {
    const copy = {};
    for (const key of Object.keys(obj)) {
      if (key === "selectedJenis") {
        copy[key] = obj[key];
      } else {
        copy[key] = sanitizeObject(obj[key], safeMateri, domain);
      }
    }
    return copy;
  }
  return obj;
}
function generateMasterV2ModulAjar(inputs = {}) {
  const defaultTopic = inputs.topic || inputs.materiInti || inputs.subbab || inputs.babUtama || "Materi Pokok";
  const {
    schoolName = "Nama Sekolah",
    teacherName = "Tim Guru Mata Pelajaran",
    subjectName = "Mata Pelajaran",
    phase = "D",
    grade = "VIII",
    semester = "1",
    babUtama = defaultTopic,
    subbab = defaultTopic,
    materiInti = defaultTopic,
    alokasiWaktu = "4 JP",
    jenisMateri = "OTOMATIS",
    modelPembelajaran = "Deep Learning",
    variationNonce
  } = inputs;
  const nonce = variationNonce !== void 0 && variationNonce !== null ? variationNonce : Math.floor(Math.random() * 1e5);
  const totalJP = parseAlokasiJP(alokasiWaktu);
  const jumlahPertemuan = Math.max(1, Math.ceil(totalJP / 2));
  const formattedAlokasi = `${totalJP} JP (${jumlahPertemuan} Pertemuan @ 2 JP)`;
  let finalPhase = phase;
  const upperGrade = (grade || "").toUpperCase();
  if (upperGrade.includes("XII") || upperGrade.includes("XI") || upperGrade.includes("12") || upperGrade.includes("11")) {
    finalPhase = "F";
  } else if (upperGrade.includes("X") || upperGrade.includes("10")) {
    finalPhase = "E";
  } else if (upperGrade.includes("IX") || upperGrade.includes("VIII") || upperGrade.includes("VII") || upperGrade.includes("9") || upperGrade.includes("8") || upperGrade.includes("7")) {
    finalPhase = "D";
  }
  const selectedJenis = jenisMateri && jenisMateri !== "OTOMATIS" && jenisMateri.trim() !== "" ? jenisMateri.toUpperCase() : autoDetectMaterialType(subjectName, babUtama, subbab, materiInti);
  const matRules = rules_default.material_types[selectedJenis] || rules_default.material_types["KONSEP"];
  const seed = `${subjectName}_${babUtama}_${subbab}_${materiInti}_${grade}_${selectedJenis}`;
  const domainContext = {
    type: selectedJenis,
    rules: matRules,
    subject: subjectName || "Mata Pelajaran",
    phase: finalPhase || "D",
    grade: grade || "VIII",
    semester: semester || "1",
    bab: babUtama || "Materi Utama",
    subbab: subbab || "Topik Pokok",
    materi: materiInti || "Konsep Dasar",
    selectedJenis
  };
  const safeSchool = schoolName || "MTs / SMA Negeri 1";
  const safeTeacher = teacherName || "Tim Guru Mata Pelajaran";
  const safeSubject = domainContext.subject;
  const safePhase = domainContext.phase;
  const safeGrade = domainContext.grade;
  const safeSemester = domainContext.semester;
  const safeBab = domainContext.bab;
  const safeSubbab = domainContext.subbab;
  const safeMateri = domainContext.materi;
  const karIndex = getPatternIndex(seed + "_kar", sentence_bank_default.karakteristik_materi.length, nonce);
  const rawKarakteristik = sentence_bank_default.karakteristik_materi[karIndex];
  const karakteristikFormatted = rawKarakteristik.replace(/{{MATERI_INTI}}/g, safeMateri).replace(/{{KONSEP_UTAMA}}/g, safeSubbab).replace(/{{BAB_UTAMA}}/g, safeBab).replace(/{{SUBBAB}}/g, safeSubbab);
  const domainCaps = {
    AI: `Peserta didik mampu memahami, menganalisis, dan mengevaluasi penerapan "${safeMateri}" menggunakan perspektif ${resolveTerm("asisten cerdas", safeMateri)} secara kritis, kreatif, dan beretika.`,
    DATA: `Peserta didik mampu mengumpulkan, mengolah, menganalisis, dan memvisualisasikan data terkait "${safeMateri}" untuk menarik kesimpulan dan rekomendasi keputusan berbasis bukti data.`,
    JARINGAN: `Peserta didik mampu memahami arsitektur, konektivitas, konfigurasi, dan pemecahan masalah (troubleshooting) sistem/node yang berkaitan dengan penerapan "${safeMateri}".`,
    ALGORITMA: `Peserta didik mampu melakukan dekomposisi, merancang alur logika, ${resolveTerm("flowchart", safeMateri)}, dan menyusun langkah sistematis (${resolveTerm("pseudocode", safeMateri)}) dalam memecahkan masalah terkait "${safeMateri}".`,
    KODING: `Peserta didik mampu memodelkan, menuliskan struktur logika/instruksi program, melakukan pengujian, dan melakukan perbaikan kesalahan (${resolveTerm("debugging", safeMateri)}) dalam implementasi praktis terkait "${safeMateri}".`,
    ETIKA_DIGITAL: `Peserta didik mampu menganalisis implikasi, keamanan informasi, hak cipta, perlindungan data pribadi, dan etika komunikasi dalam konteks materi "${safeMateri}".`,
    PROYEK: `Peserta didik mampu merencanakan, merancang prototipe, melakukan kolaborasi tim, mengumpulkan umpan balik, dan mempresentasikan karya inovasi digital terkait "${safeMateri}".`,
    BAHASA: `Peserta didik mampu menguasai keterampilan berbahasa, menganalisis struktur/kosakata, serta menggunakan ungkapan yang relevan terkait "${safeMateri}" dalam konteks komunikasi aktif.`,
    MATEMATIKA: `Peserta didik mampu memahami konsep matematis, memodelkan masalah, merumuskan prosedur perhitungan, dan mengomunikasikan logika penyelesaian terkait "${safeMateri}".`,
    ILMU_ALAM: `Peserta didik mampu melakukan observasi ilmiah, mengumpulkan data eksperimen, menganalisis hubungan konsep, dan menarik kesimpulan berbasis fakta empiris terkait "${safeMateri}".`,
    ILMU_SOSIAL: `Peserta didik mampu mengidentifikasi fakta historis/sosial/geografis, menelaah sebab-akibat, membedah sudut pandang, dan menyusun sintesis pemikiran kritis terkait "${safeMateri}".`,
    PJOK: `Peserta didik mampu mempraktikkan keterampilan gerak, mengevaluasi efektivitas gerakan fisik, dan menerapkan nilai sportivitas/kerja sama dalam aktivitas terkait "${safeMateri}".`,
    KONSEP: `Peserta didik mampu mengkaji secara mendalam definisi teoretis, ruang lingkup, hakikat, dan klasifikasi konseptual terkait "${safeMateri}" serta relevansinya di dunia nyata.`
  };
  const domainTps = {
    AI: {
      C1_C2: `Peserta didik mampu menjelaskan konsep dasar, definisi esensial, dan istilah teknis terkait "${safeMateri}" secara kritis menggunakan perspektif cerdas.`,
      C3_C4: `Peserta didik mampu merancang langkah praktis, mensimulasikan alur kerja, dan menganalisis penerapan "${safeMateri}" dengan bantuan ${resolveTerm("asisten ai", safeMateri)} secara sistematis.`,
      C5_C6: `Peserta didik mampu mengevaluasi akurasi, meminimalkan potensi ${resolveTerm("bias", safeMateri)}/kesalahan, serta merumuskan panduan etis pemanfaatan ${resolveTerm("asisten ai", safeMateri)} pada materi "${safeMateri}".`
    },
    DATA: {
      C1_C2: `Peserta didik mampu mengidentifikasi tipe ${resolveTerm("variabel", safeMateri)}, parameter, dan kebutuhan ${resolveTerm("dataset", safeMateri)} dasar terkait "${safeMateri}".`,
      C3_C4: `Peserta didik mampu mengolah data, membuat visualisasi grafik, dan menganalisis tren informasi terkait "${safeMateri}".`,
      C5_C6: `Peserta didik mampu menarik kesimpulan analitis, menyusun laporan, dan merekomendasikan keputusan berbasis data terkait "${safeMateri}".`
    },
    JARINGAN: {
      C1_C2: `Peserta didik mampu menjelaskan fungsi perangkat jaringan, ${resolveTerm("topologi", safeMateri)}, dan alur komunikasi data terkait "${safeMateri}".`,
      C3_C4: `Peserta didik mampu mengonfigurasi skema pengalamatan, ${resolveTerm("ip address", safeMateri)}, dan menguji konektivitas sistem pada penerapan "${safeMateri}".`,
      C5_C6: `Peserta didik mampu menganalisis kesalahan (troubleshooting), menguji keamanan node, dan menyempurnakan keandalan koneksi "${safeMateri}".`
    },
    ALGORITMA: {
      C1_C2: `Peserta didik mampu menjelaskan dekomposisi masalah, langkah logis, dan fungsi simbol-simbol ${resolveTerm("bagan alur", safeMateri)} terkait "${safeMateri}".`,
      C3_C4: `Peserta didik mampu merancang ${resolveTerm("flowchart", safeMateri)} dan ${resolveTerm("pseudocode", safeMateri)} sistematis untuk merumuskan alur keputusan terkait "${safeMateri}".`,
      C5_C6: `Peserta didik mampu mengevaluasi tingkat efisiensi, merampingkan logika langkah, dan menguji kasus batas (edge cases) pada penerapan "${safeMateri}".`
    },
    KODING: {
      C1_C2: `Peserta didik mampu mengenali aturan penulisan dasar, struktur parameter data, dan inisialisasi tipe data untuk mengimplementasikan "${safeMateri}".`,
      C3_C4: `Peserta didik mampu menuliskan baris kode program menggunakan struktur alur keputusan atau proses berulang terkait "${safeMateri}".`,
      C5_C6: `Peserta didik mampu mendeteksi kesalahan (error), melakukan pengujian hasil secara mandiri, dan menguji kegunaan program "${safeMateri}".`
    },
    ETIKA_DIGITAL: {
      C1_C2: `Peserta didik mampu menyebutkan regulasi, prinsip keamanan, dan aturan perlindungan informasi terkait aktivitas "${safeMateri}".`,
      C3_C4: `Peserta didik mampu membedakan jenis pelanggaran etika dan menerapkan standar hak cipta/privasi yang benar dalam kasus "${safeMateri}".`,
      C5_C6: `Peserta didik mampu menyusun panduan perilaku digital yang positif, aman, dan etis dalam lingkungan interaksi seputar "${safeMateri}".`
    },
    PROYEK: {
      C1_C2: `Peserta didik mampu mengumpulkan kebutuhan pengguna dan menyusun daftar spesifikasi untuk merancang produk inovasi/karya terkait "${safeMateri}".`,
      C3_C4: `Peserta didik mampu membangun sketsa, mendemonstrasikan kerangka (wireframe), dan mengembangkan prototipe/karya seputar "${safeMateri}".`,
      C5_C6: `Peserta didik mampu menyempurnakan karya, mengumpulkan umpan balik pengguna, dan mempresentasikan hasil rancangan akhir "${safeMateri}".`
    },
    BAHASA: {
      C1_C2: `Peserta didik mampu mengenali kosakata baru (mufradat/vocabulary), melafalkan dengan benar, dan mengartikan istilah terkait "${safeMateri}".`,
      C3_C4: `Peserta didik mampu mengaplikasikan tata bahasa/struktur kalimat dalam percakapan atau penyusunan teks terkait "${safeMateri}".`,
      C5_C6: `Peserta didik mampu menyusun naskah orisinal, berdialog secara spontan, serta mengapresiasi teks berbahasa dalam konteks "${safeMateri}".`
    },
    MATEMATIKA: {
      C1_C2: `Peserta didik mampu memahami rumusan dasar, membedakan variabel, dan mengidentifikasi informasi dari masalah kontekstual "${safeMateri}".`,
      C3_C4: `Peserta didik mampu menyusun model matematika dan menerapkan prosedur operasional perhitungan yang tepat terkait "${safeMateri}".`,
      C5_C6: `Peserta didik mampu memecahkan masalah tingkat tinggi (HOTS), melakukan pembuktian matematis, dan mengevaluasi kebenaran hasil akhir "${safeMateri}".`
    },
    ILMU_ALAM: {
      C1_C2: `Peserta didik mampu mengidentifikasi gejala, menyebutkan komponen penyusun, dan mendeskripsikan fenomena alam terkait "${safeMateri}".`,
      C3_C4: `Peserta didik mampu merancang prosedur pengamatan, melaksanakan eksperimen, dan mengelompokkan data hasil percobaan "${safeMateri}".`,
      C5_C6: `Peserta didik mampu menganalisis hubungan sebab-akibat fenomena, menyusun simpulan ilmiah, dan mengkritisi anomali hasil eksperimen "${safeMateri}".`
    },
    ILMU_SOSIAL: {
      C1_C2: `Peserta didik mampu mendeskripsikan fakta, tokoh, latar waktu/tempat, serta karakteristik fenomena sosial-historis terkait "${safeMateri}".`,
      C3_C4: `Peserta didik mampu mengklasifikasikan data literatur, menghubungkan peristiwa kausalitas, dan menafsirkan dinamika terkait "${safeMateri}".`,
      C5_C6: `Peserta didik mampu melakukan sintesis dari berbagai sudut pandang, merumuskan argumentasi kritis, dan mengevaluasi dampak "${safeMateri}".`
    },
    PJOK: {
      C1_C2: `Peserta didik mampu menyebutkan bagian-bagian gerakan dasar dan memahami pentingnya keselamatan dalam melakukan aktivitas "${safeMateri}".`,
      C3_C4: `Peserta didik mampu mempraktikkan rangkaian teknik secara berkesinambungan dan mengaplikasikannya dalam simulasi permainan "${safeMateri}".`,
      C5_C6: `Peserta didik mampu menganalisis keefektifan mekanika gerak, memperbaiki kesalahan rekan (peer-correction), dan merancang strategi pada situasi nyata terkait "${safeMateri}".`
    },
    KONSEP: {
      C1_C2: `Peserta didik mampu menjelaskan definisi, pengertian esensial, dan ruang lingkup konseptual dari "${safeMateri}".`,
      C3_C4: `Peserta didik mampu menguraikan komponen utama dan memetakan keterkaitan unsur-unsur teoretis terkait "${safeMateri}".`,
      C5_C6: `Peserta didik mampu mengevaluasi penerapan teori, menarik kesimpulan yang komprehensif, dan mengaitkan konsep "${safeMateri}" dengan penerapan materi nyata.`
    }
  };
  const activeTP = domainTps[domainContext.type] || domainTps["KONSEP"];
  const tp1 = activeTP.C1_C2;
  const tp2 = activeTP.C3_C4;
  const tp3 = activeTP.C5_C6;
  const pemantikFenomena = `Bagaimana fenomena terkait "${safeMateri}" diimplementasikan dalam ${domainContext.rules.name} untuk mempermudah aktivitas manusia sehari-hari?`;
  const pemantikMasalah = `Apa masalah atau batasan utama yang harus diantisipasi saat kita merancang solusi berbasis "${safeMateri}"?`;
  const pemantikPrediksi = `Bagaimana dampak jangka panjang dari penerapan "${safeMateri}" terhadap efisiensi dan keilmuan ini?`;
  const pemantikPerbandingan = `Bagaimana perbandingan efektivitas antara metode konvensional dengan metode modern yang menerapkan konsep "${safeMateri}"?`;
  const pemantikProblemSolving = `Langkah strategis apa yang dapat diambil untuk memecahkan kendala atau kegagalan sistem dalam penerapan "${safeMateri}"?`;
  const kbcAllahIdx = getPatternIndex(seed + "_kbc_allah", sentence_bank_default.kbc.cinta_allah.length, nonce);
  const kbcIlmuIdx = getPatternIndex(seed + "_kbc_ilmu", sentence_bank_default.kbc.cinta_ilmu.length, nonce);
  const kbcDiriIdx = getPatternIndex(seed + "_kbc_diri", sentence_bank_default.kbc.cinta_diri.length, nonce);
  const kbcSesamaIdx = getPatternIndex(seed + "_kbc_sesama", sentence_bank_default.kbc.cinta_sesama.length, nonce);
  const kbcLingkunganIdx = getPatternIndex(seed + "_kbc_lingkungan", sentence_bank_default.kbc.cinta_lingkungan.length, nonce);
  const kbcTanahAirIdx = getPatternIndex(seed + "_kbc_tanahair", sentence_bank_default.kbc.cinta_tanah_air.length, nonce);
  const kbcAllah = sentence_bank_default.kbc.cinta_allah[kbcAllahIdx].replace(/{{MATERI_INTI}}/g, safeMateri);
  const kbcIlmu = sentence_bank_default.kbc.cinta_ilmu[kbcIlmuIdx].replace(/{{MATERI_INTI}}/g, safeMateri);
  const kbcDiri = sentence_bank_default.kbc.cinta_diri[kbcDiriIdx].replace(/{{MATERI_INTI}}/g, safeMateri);
  const kbcSesama = sentence_bank_default.kbc.cinta_sesama[kbcSesamaIdx].replace(/{{BAB_UTAMA}}/g, safeBab).replace(/{{MATERI_INTI}}/g, safeMateri);
  const kbcLingkungan = sentence_bank_default.kbc.cinta_lingkungan[kbcLingkunganIdx].replace(/{{MATERI_INTI}}/g, safeMateri);
  const kbcTanahAir = sentence_bank_default.kbc.cinta_tanah_air[kbcTanahAirIdx].replace(/{{MATERI_INTI}}/g, safeMateri);
  let kegiatanPembelajaranText = `08. KEGIATAN PEMBELAJARAN (${jumlahPertemuan} PERTEMUAN - ALOKASI ${totalJP} JP)
`;
  const getDynamicActivities = (domain, safeMateri2) => {
    const fallbacks = {
      BAHASA: {
        pTunggal: `Guru melakukan apersepsi dan mengenalkan materi "${safeMateri2}". Peserta didik menyimak, menirukan pelafalan, membaca teks/dialog terkait, dan mempraktikkannya secara berpasangan atau mandiri.`,
        p1: `Guru mengenalkan kosakata (mufradat/vocabulary) dan ungkapan dasar terkait "${safeMateri2}". Peserta didik menyimak, menirukan pelafalan, dan mencocokkan makna.`,
        p2: `Peserta didik mengamati pola tata bahasa (qawaid/grammar) pada ungkapan "${safeMateri2}". Peserta didik berlatih melengkapi teks/dialog rumpang dan menyusun kalimat sederhana.`,
        p3: `Peserta didik berlatih mempraktikkan percakapan (hiwar/dialog) terkait "${safeMateri2}" secara berpasangan dengan memperhatikan intonasi dan pelafalan.`,
        p4: `Peserta didik mempresentasikan teks atau dialog orisinal terkait "${safeMateri2}" di depan kelas, disusul umpan balik dari guru dan rekan.`
      },
      MATEMATIKA: {
        pTunggal: `Guru mengenalkan konsep "${safeMateri2}". Peserta didik mengamati masalah kontekstual, merumuskan model matematika, dan menyelesaikan masalah melalui latihan terbimbing.`,
        p1: `Guru memaparkan konsep dasar "${safeMateri2}". Peserta didik melakukan eksplorasi untuk menemukan pola atau rumus matematika yang relevan.`,
        p2: `Peserta didik berlatih menggunakan rumus/prosedur "${safeMateri2}" melalui serangkaian soal bertahap (dari mudah ke sulit).`,
        p3: `Peserta didik mendiskusikan masalah kontekstual/soal cerita yang berkaitan dengan "${safeMateri2}", dan bekerja sama mencari solusi.`,
        p4: `Peserta didik mempresentasikan langkah penyelesaian masalah "${safeMateri2}" dan melakukan evaluasi/verifikasi atas kebenaran hasil.`
      },
      ILMU_ALAM: {
        // Biologi, Fisika, Kimia
        pTunggal: `Guru mengenalkan fenomena terkait "${safeMateri2}". Peserta didik melakukan observasi/eksperimen, mengumpulkan data, dan merumuskan kesimpulan ilmiah.`,
        p1: `Guru menyajikan fenomena alam terkait "${safeMateri2}". Peserta didik merumuskan pertanyaan penyelidikan dan mengkaji dasar teori.`,
        p2: `Peserta didik melakukan percobaan, observasi, atau simulasi untuk menyelidiki karakteristik "${safeMateri2}" secara terstruktur.`,
        p3: `Peserta didik menganalisis data hasil observasi/eksperimen tentang "${safeMateri2}" dan membandingkannya dengan teori.`,
        p4: `Peserta didik menyusun laporan ilmiah tentang "${safeMateri2}" dan mempresentasikannya di depan kelas.`
      },
      ILMU_SOSIAL: {
        // Sejarah, Geografi, Sosiologi
        pTunggal: `Guru menyajikan isu/kasus terkait "${safeMateri2}". Peserta didik mengkaji sumber literatur, menganalisis hubungan sebab-akibat, dan menyajikan laporan hasil analisis.`,
        p1: `Guru memaparkan latar belakang "${safeMateri2}". Peserta didik mengkaji sumber-sumber literatur dan mengidentifikasi fakta-fakta penting.`,
        p2: `Peserta didik menganalisis hubungan sebab-akibat, kronologi, atau dinamika sosial/spasial dari "${safeMateri2}" dalam kelompok diskusi.`,
        p3: `Peserta didik mengkaji berbagai sudut pandang/interpretasi mengenai fenomena "${safeMateri2}" secara kritis.`,
        p4: `Peserta didik mempresentasikan hasil analisis dan interpretasi mengenai "${safeMateri2}" dan merumuskan kesimpulan akhir.`
      },
      PJOK: {
        pTunggal: `Guru memandu pemanasan. Guru mendemonstrasikan gerakan/teknik "${safeMateri2}". Peserta didik mempraktikkan teknik tersebut, diikuti pendinginan dan evaluasi.`,
        p1: `Guru memandu pemanasan. Guru menjelaskan konsep dan mendemonstrasikan gerak dasar "${safeMateri2}". Peserta didik mencoba gerak dasar secara bertahap.`,
        p2: `Peserta didik mempraktikkan teknik "${safeMateri2}" dalam bentuk latihan berpasangan atau kelompok kecil, dengan saling mengamati (peer observation).`,
        p3: `Peserta didik menerapkan gerak/teknik "${safeMateri2}" dalam situasi permainan yang dimodifikasi atau simulasi nyata.`,
        p4: `Evaluasi performa gerak "${safeMateri2}". Peserta didik melakukan unjuk kerja secara bergantian, diikuti dengan refleksi dan pendinginan.`
      },
      KONSEP: {
        pTunggal: `Guru memaparkan materi konseptual utama. Peserta didik mengkaji literatur, berdiskusi, merumuskan pemahaman terkait "${safeMateri2}", serta berpartisipasi aktif dalam kegiatan.`,
        p1: `Guru menyajikan pengantar materi. Peserta didik mengeksplorasi definisi, ruang lingkup, dan prinsip dasar dari "${safeMateri2}".`,
        p2: `Peserta didik berdiskusi kelompok untuk membedah unsur-unsur penting, karakteristik, dan hubungan antar bagian dalam "${safeMateri2}".`,
        p3: `Peserta didik mendiskusikan implementasi, studi kasus, atau contoh nyata dari teori "${safeMateri2}" dalam kehidupan sehari-hari.`,
        p4: `Peserta didik menyajikan hasil analisis, merangkum kesimpulan tentang "${safeMateri2}", dan mengevaluasi pemahaman mereka.`
      }
    };
    let cat = "KONSEP";
    const subj = (safeSubject || "").toLowerCase();
    if (subj.includes("arab") || subj.includes("inggris") || subj.includes("indonesia") || subj.includes("jerman") || subj.includes("prancis") || subj.includes("bahasa")) cat = "BAHASA";
    else if (subj.includes("matematika") || subj.includes("math")) cat = "MATEMATIKA";
    else if (subj.includes("biologi") || subj.includes("fisika") || subj.includes("kimia") || subj.includes("ipa")) cat = "ILMU_ALAM";
    else if (subj.includes("sejarah") || subj.includes("geografi") || subj.includes("sosiologi") || subj.includes("ekonomi") || subj.includes("ips") || subj.includes("pkn")) cat = "ILMU_SOSIAL";
    else if (subj.includes("pjok") || subj.includes("jasmani") || subj.includes("olahraga")) cat = "PJOK";
    return fallbacks[cat] || fallbacks["KONSEP"];
  };
  const activeKegiatan = getDynamicActivities(domainContext.type, safeMateri) || getDynamicActivities("KONSEP", safeMateri);
  for (let p = 1; p <= jumlahPertemuan; p++) {
    let pTitle = "";
    let pKegiatan = "";
    const subjLower = (safeSubject || "").toLowerCase();
    let pTunggalTitle = `PERTEMUAN TUNGGAL (2 JP): EKSPLORASI & PENDALAMAN MATERI`;
    let p1Title = `PERTEMUAN KE-1 (2 JP): EKSPLORASI KONSEP & PEMAHAMAN AWAL`;
    let p2Title = `PERTEMUAN KE-2 (2 JP): PENERAPAN PRAKTIS & ANALISIS TERSTRUKTUR`;
    let p3Title = `PERTEMUAN KE-3 (2 JP): PENDALAMAN MATERI & DISKUSI KELOMPOK`;
    let p4Title = `PERTEMUAN KE-${p} (2 JP): UNJUK KERJA, PRESENTASI & EVALUASI AKHIR`;
    if (subjLower.includes("arab") || subjLower.includes("inggris") || subjLower.includes("indonesia") || subjLower.includes("bahasa")) {
      pTunggalTitle = `PERTEMUAN TUNGGAL (2 JP): EKSPLORASI KOSAKATA & PRAKTIK KOMUNIKASI`;
      p1Title = `PERTEMUAN KE-1 (2 JP): KOSAKATA (MUFRADAT/VOCABULARY) & MEMBACA`;
      p2Title = `PERTEMUAN KE-2 (2 JP): STRUKTUR KALIMAT (QAWAID/GRAMMAR) & LATIHAN`;
      p3Title = `PERTEMUAN KE-3 (2 JP): PRAKTIK PERCAKAPAN (HIWAR/DIALOG) & MENULIS`;
      p4Title = `PERTEMUAN KE-${p} (2 JP): UNJUK KERJA KOMUNIKATIF & EVALUASI AKHIR`;
    } else if (subjLower.includes("matematika") || subjLower.includes("math")) {
      pTunggalTitle = `PERTEMUAN TUNGGAL (2 JP): PEMAHAMAN KONSEP & PEMECAHAN MASALAH`;
      p1Title = `PERTEMUAN KE-1 (2 JP): PEMAHAMAN KONSEP & PEMODELAN MATEMATIKA`;
      p2Title = `PERTEMUAN KE-2 (2 JP): LATIHAN PROSEDURAL & PENERAPAN RUMUS`;
      p3Title = `PERTEMUAN KE-3 (2 JP): PEMECAHAN MASALAH KONTEKSTUAL & SOAL HOTS`;
      p4Title = `PERTEMUAN KE-${p} (2 JP): VERIFIKASI HASIL, PRESENTASI & EVALUASI AKHIR`;
    } else if (subjLower.includes("biologi") || subjLower.includes("fisika") || subjLower.includes("kimia") || subjLower.includes("ipa")) {
      pTunggalTitle = `PERTEMUAN TUNGGAL (2 JP): OBSERVASI FENOMENA & ANALISIS ILMIAH`;
      p1Title = `PERTEMUAN KE-1 (2 JP): OBSERVASI FENOMENA & PERUMUSAN HIPOTESIS`;
      p2Title = `PERTEMUAN KE-2 (2 JP): EKSPERIMEN & PENGUMPULAN DATA ILMIAH`;
      p3Title = `PERTEMUAN KE-3 (2 JP): ANALISIS DATA & PEMBUKTIAN KONSEP`;
      p4Title = `PERTEMUAN KE-${p} (2 JP): PRESENTASI LAPORAN ILMIAH & EVALUASI AKHIR`;
    } else if (subjLower.includes("sejarah") || subjLower.includes("geografi") || subjLower.includes("sosiologi") || subjLower.includes("ekonomi") || subjLower.includes("ips") || subjLower.includes("pkn")) {
      pTunggalTitle = `PERTEMUAN TUNGGAL (2 JP): KAJIAN LITERATUR & ANALISIS SOSIAL/HISTORIS`;
      p1Title = `PERTEMUAN KE-1 (2 JP): IDENTIFIKASI FAKTA & LATAR BELAKANG MATERI`;
      p2Title = `PERTEMUAN KE-2 (2 JP): ANALISIS DINAMIKA, HUBUNGAN SEBAB-AKIBAT & DISKUSI`;
      p3Title = `PERTEMUAN KE-3 (2 JP): KAJIAN KRITIS BERBAGAI PERSPEKTIF`;
      p4Title = `PERTEMUAN KE-${p} (2 JP): SINTESIS HASIL ANALISIS & PRESENTASI KELOMPOK`;
    } else if (subjLower.includes("pjok") || subjLower.includes("jasmani") || subjLower.includes("olahraga")) {
      pTunggalTitle = `PERTEMUAN TUNGGAL (2 JP): DEMONSTRASI & PRAKTIK KETERAMPILAN GERAK`;
      p1Title = `PERTEMUAN KE-1 (2 JP): PENGENALAN TEKNIK & PEMAHAMAN GERAK DASAR`;
      p2Title = `PERTEMUAN KE-2 (2 JP): LATIHAN KETERAMPILAN GERAK SECARA BERTAHAP`;
      p3Title = `PERTEMUAN KE-3 (2 JP): APLIKASI GERAK DALAM SIMULASI PERMAINAN`;
      p4Title = `PERTEMUAN KE-${p} (2 JP): UJI UNJUK KERJA FISIK & EVALUASI REFLEKTIF`;
    }
    if (jumlahPertemuan === 1) {
      pTitle = pTunggalTitle;
      pKegiatan = activeKegiatan.pTunggal;
    } else if (p === 1) {
      pTitle = p1Title;
      pKegiatan = activeKegiatan.p1;
    } else if (p === 2) {
      pTitle = p2Title;
      pKegiatan = activeKegiatan.p2;
    } else if (p === 3) {
      pTitle = p3Title;
      pKegiatan = activeKegiatan.p3;
    } else {
      pTitle = p4Title;
      pKegiatan = activeKegiatan.p4;
    }
    kegiatanPembelajaranText += `
${pTitle}
- Pendahuluan (15 Menit): Guru membuka dengan doa bersama, cek presensi, apersepsi interaktif, dan menyampaikan pertanyaan pemantik.
- Kegiatan Inti (60 Menit): ${pKegiatan}
- Penutup (15 Menit): Refleksi singkat, penguatan nilai PPP, menyimpulkan poin utama, dan instruksi pertemuan selanjutnya.
`;
  }
  let mod14_ProyekOrTugas = "";
  if (domainContext.type === "PROYEK") {
    mod14_ProyekOrTugas = `14. TUGAS / PROYEK UTAMA
Implementasi & Penugasan Kontekstual:
1. Pembentukan kelompok kerja (3-4 siswa) terkait topik "${safeMateri}".
2. Eksplorasi materi dan penyusunan instrumen penyelesaian tugas "${safeMateri}".
3. Presentasi dan diskusi pemecahan masalah.
4. Penyerahan laporan akhir tugas/proyek.`;
  } else if (totalJP >= 6) {
    mod14_ProyekOrTugas = `14. PENUGASAN KOMPREHENSIF
Tantangan Terpadu Pembelajaran (Alokasi Waktu Mencukupi):
1. Kerjakan dalam kelompok kecil untuk menyusun gagasan terpadu berbasis ${safeSubbab}.
2. Terapkan materi "${safeMateri}" pada skenario kasus yang disajikan.
3. Lakukan pengkajian hasil, perumusan kesimpulan, dan presentasikan di depan kelas.`;
  } else {
    mod14_ProyekOrTugas = `14. PENUGASAN SINGKAT (MINI CHALLENGE)
Latihan Terstruktur berbasis Topik Utama (Alokasi ${totalJP} JP):
1. Kerjakan penugasan mandiri/berpasangan terkait subbab ${safeSubbab}.
2. Selesaikan evaluasi singkat terkait "${safeMateri}" pada Lembar Kerja.
3. Lakukan tukar hasil karya untuk verifikasi antar-rekan sebaya (peer review).`;
  }
  const refleksiPesertaDidikRaw = domainRefleksiStud[domainContext.type] || domainRefleksiStud["KONSEP"];
  const refleksiPesertaDidikFormatted = refleksiPesertaDidikRaw.replace(/prompt engineering/gi, safeMateri).replace(/membasmi hoaks/gi, safeMateri).replace(/menuliskan sintaks kode/gi, safeMateri).replace(/konfigurasi IP address/gi, safeMateri).replace(/membuat visualisasi grafik/gi, safeMateri).replace(/dekomposisi dan pembuatan flowchart/gi, safeMateri).replace(/peta konsep/gi, safeMateri).replace(/merancang prototipe produk/gi, safeMateri);
  const refleksiGuruRaw = domainRefleksiTeach[domainContext.type] || domainRefleksiTeach["KONSEP"];
  const refleksiGuruFormatted = refleksiGuruRaw.replace(/menyusun prompt terstruktur/gi, `memahami dan menerapkan konsep ${safeMateri}`).replace(/memilih jenis grafik/gi, `memahami dan menerapkan konsep ${safeMateri}`).replace(/memahami fungsi setiap perangkat jaringan/gi, `memahami dan menerapkan konsep ${safeMateri}`).replace(/menyusun alur flowchart/gi, `memahami dan menerapkan konsep ${safeMateri}`).replace(/memahami struktur percabangan atau perulangan/gi, `memahami dan menerapkan konsep ${safeMateri}`).replace(/mengidentifikasi risiko siber dan hoaks/gi, `memahami dan menerapkan konsep ${safeMateri}`).replace(/kualitas prototipe dan presentasi karya/gi, `memahami dan menerapkan konsep ${safeMateri}`).replace(/menguasai definisi dan kerangka teoretis/gi, `memahami dan menerapkan konsep ${safeMateri}`);
  const mod01_Identitas = `01. IDENTITAS MODUL
- Nama Instansi : ${safeSchool}
- Penyusun : ${safeTeacher}
- Mata Pelajaran : ${safeSubject}
- Fase / Kelas / Semester : Fase ${safePhase} - Kelas ${safeGrade} / Semester ${safeSemester}
- Bab Utama : ${safeBab}
- Subbab / Topik : ${safeSubbab}
- Materi Inti : ${safeMateri}
- Alokasi Waktu : ${formattedAlokasi}
- Kategori / Jenis Materi : ${domainContext.rules.name}`;
  const mod02_Identifikasi = `02. KOMPETENSI AWAL & PROFIL PESERTA DIDIK
- Kompetensi Awal: Peserta didik memiliki pemahaman dasar pendukung yang relevan sebelum mempelajari "${safeMateri}" dalam lingkup ${domainContext.rules.name}.
- Kesiapan Belajar : Tingkat pemahaman awal dan keterampilan prosedural yang beragam terkait "${safeMateri}".
- Karakteristik Utama : Membutuhkan visualisasi konseptual, bimbingan bertahap (scaffolding), serta latihan praktik langsung terkait "${safeMateri}".`;
  const mod02_ProfilPancasila = `Profil Pelajar Pancasila:
1. Bernalar Kritis: Peserta didik mampu menguraikan, menganalisis, dan memecahkan tantangan logis terkait "${safeMateri}".
2. Mandiri: Peserta didik menunjukkan kemandirian dan tanggung jawab dalam mengeksplorasi konsep "${safeMateri}".
3. Gotong Royong: Berkolaborasi secara harmonis dalam merumuskan penyelesaian terkait "${safeMateri}" bersama kelompok.

Sinergi Nilai Karakter:
- Ketaatan Keilmuan: Menghayati keteraturan ciptaan Tuhan melalui penguasaan materi "${safeMateri}".`;
  const mod02_SaranaPrasarana = `Sarana & Prasarana:
- Perangkat keras: Ruang kelas, perangkat penunjang yang relevan, atau lembar kerja (cetak) yang disesuaikan untuk materi "${safeMateri}".
- Perangkat lunak / media: Media interaktif, slide presentasi, papan tulis, atau media pendukung ${domainContext.rules.name}.
- Media belajar: Buku teks utama, draf artikel rujukan, dan panduan praktis terkait "${safeMateri}".`;
  const mod02_TargetPeserta = `Target Peserta Didik:
1. Reguler / Tipikal: Mampu memahami secara umum, merancang, dan menganalisis penerapan "${safeMateri}".
2. Kesulitan Belajar: Memerlukan pendampingan bertahap (scaffolding) dan visualisasi konseptual mendasar tentang "${safeMateri}".
3. Pencapaian Tinggi: Mampu memecahkan tantangan penerapan materi HOTS tingkat lanjut dan mengkreasi solusi inovatif seputar "${safeMateri}".`;
  const mod03_Karakteristik = `03. KARAKTERISTIK MATERI
${karakteristikFormatted}

Kata Kunci Topik:
${domainContext.rules.keywords.join(", ")}`;
  let bloomAlignmentText = `04. TUJUAN PEMBELAJARAN (BLOOM REVISED C1 - C6 & SELARAS INDIKATOR)
1. [Kognitif C1-C2 / Pemahaman Konsep]
   ${tp1}
   \u2192 Indikator: Memahami dan menjelaskan komponen atau konsep dasar.
   \u2192 Aktivitas: Pengamatan contoh & diskusi kelompok.
   \u2192 Asesmen: Tes tulis / Tanya jawab diagnostik-formatif.
 
2. [Kognitif C3-C4 / Penerapan & Analisis]
   ${tp2}
   \u2192 Indikator: Menerapkan konsep pada kasus atau soal latihan.
   \u2192 Aktivitas: Praktik penugasan atau pengerjaan LKPD.
   \u2192 Asesmen: Penilaian unjuk kerja & verifikasi hasil.`;
  if (totalJP >= 4) {
    bloomAlignmentText += `

3. [Kognitif C5-C6 / Evaluasi & Inovasi]
   ${tp3}
   \u2192 Indikator: Menganalisis masalah yang lebih kompleks dan mempresentasikan hasil.
   \u2192 Aktivitas: Evaluasi kritis / Analisis mendalam / Presentasi hasil.
   \u2192 Asesmen: Rubrik produk & lembar observasi HOTS.`;
  }
  bloomAlignmentText += `

4. [Sikap & Komunikasi]
   Peserta didik mampu mendokumentasikan dan mempresentasikan hasil pemahaman serta karya/analisis terkait "${safeMateri}" secara komunikatif, jujur, dan bertanggung jawab.`;
  const mod05_PPP = `05. PENGUATAN PROFIL PELAJAR PANCASILA
1. Cinta Allah & Ketaatan Keilmuan:
   ${kbcAllah}
2. Cinta Ilmu & Rasa Ingin Tahu:
   ${kbcIlmu}
3. Cinta Diri & Digital Hygiene:
   ${kbcDiri}
4. Cinta Sesama & Kolaborasi:
   ${kbcSesama}
5. Cinta Lingkungan & Efisiensi Sumber Daya:
   ${kbcLingkungan}
6. Cinta Tanah Air & Kemandirian Belajar:
   ${kbcTanahAir}`;
  const mod06_PembelajaranMendalam = `06. PEMBELAJARAN MENDALAM (DEEP LEARNING DOMAIN-SPECIFIC)
- Berkesadaran (Mindful Learning):
  ${domainContext.rules.deep_learning.mindful}
- Bermakna (Meaningful Learning):
  ${domainContext.rules.deep_learning.meaningful}
- Menggembirakan (Joyful Learning):
  ${domainContext.rules.deep_learning.joyful}`;
  const mod07_PertanyaanPemantik = `07. PERTANYAAN PEMANTIK
1. Bagaimana penerapan atau fungsi utama dari "${safeMateri}" dalam konteks ${safeSubject}?
2. Mengapa kita perlu mempelajari "${safeMateri}", dan apa dampaknya jika kita tidak memahaminya?
3. Bisakah kalian memberikan contoh nyata penggunaan "${safeMateri}" di kehidupan sehari-hari?`;
  const safePersiapanRaw = domainContext.rules.persiapan_guru || "Menyiapkan bahan ajar dan lembar kerja.";
  const safePersiapanFormatted = safePersiapanRaw.replace(/IDE\/Code Editor \(Scratch\/Python\/C\+\+\/UnoArduSim\)/gi, `perangkat lunak atau media simulasi pendukung "${safeMateri}"`).replace(/Cisco Packet Tracer \/ Simulator Web/gi, `alat peraga atau media pendukung "${safeMateri}"`).replace(/Draw\.io \/ Lucidchart \/ Papan Tulis/gi, `media perancangan diagram/skema "${safeMateri}"`).replace(/Google Sheets\/Excel\/LibreOffice Calc/gi, `perangkat lunak pengolahan data atau tabel cetak "${safeMateri}"`).replace(/kejahatan siber \(phishing\/hoaks\)/gi, `kasus/isu siber terkait "${safeMateri}"`).replace(/Kanban board \/ Gantt chart/gi, `lembar kontrol rencana kerja proyek "${safeMateri}"`).replace(/akun\/platform AI Generatif/gi, `asisten cerdas atau bahan bacaan terkait "${safeMateri}"`);
  const mod08_PersiapanDanLangkah = `08. PERSIAPAN GURU & KEGIATAN PEMBELAJARAN

A. PERSIAPAN GURU :
${safePersiapanFormatted}

B. STRUKTUR KEGIATAN PEMBELAJARAN:
${kegiatanPembelajaranText}`;
  const diagnostikQuestion = `1. Apa yang Anda ketahui tentang konsep dasar "${safeMateri}"?
2. Bagaimana pemahaman mendalam terkait "${safeMateri}" dapat membantu memecahkan masalah dalam kehidupan sehari-hari?`;
  const rubrikFormatted = `1. Penguasaan Konsep "${safeMateri}" (30%): Mampu menjelaskan definisi, prinsip dasar, dan elemen materi secara akurat.
2. Penerapan & Praktik (35%): Ketepatan dalam mengaplikasikan "${safeMateri}" pada latihan, soal, atau studi kasus terkait.
3. Analisis & Evaluasi (20%): Mampu menganalisis masalah, memeriksa ketepatan hasil, dan memberikan evaluasi kritis.
4. Komunikasi & Kolaborasi (15%): Penyampaian hasil kerja yang jelas, partisipasi aktif dalam kelompok, dan presentasi yang komunikatif.`;
  const mod09_Asesmen = `09. ASESMEN DAN PENILAIAN SPESIFIK

1. Asesmen Diagnostik (Awal Pembelajaran):
${diagnostikQuestion}

2. Asesmen Formatif (Proses Pembelajaran):
- Observasi unjuk kerja dan keterlibatan aktif peserta didik dalam materi "${safeMateri}".
- Penilaian keaktifan diskusi dan pengisian LKPD terkait "${safeMateri}".

3. Asesmen Sumatif (Akhir Pembelajaran):
- Evaluasi pencapaian kompetensi melalui tes tertulis/praktik terkait "${safeMateri}".
- Penilaian produk/praktik menggunakan Rubrik Khusus "${safeMateri}".

4. Rubrik Penilaian Khusus:
${rubrikFormatted}`;
  const mod10_Diferensiasi = `10. DIFERENSIASI PEMBELAJARAN 
- Diferensiasi Konten : Menyediakan bahan bacaan dengan tingkat kerumitan bervariasi, peta konsep, serta daftar istilah penting terkait "${safeMateri}".
- Diferensiasi Proses : Memberikan bimbingan terarah (scaffolding) bagi kelompok awal, pendampingan praktis terstruktur, serta tantangan analisis penerapan materi mandiri terkait "${safeMateri}" bagi kelompok mahir.
- Diferensiasi Produk : Menyelesaikan tugas/karya dasar sesuai standar (reguler) vs menghasilkan karya/analisis mendalam dengan pengayaan terkait "${safeMateri}" (mahir).`;
  const mod11_Remedial = `11. PROGRAM REMEDIAL
- Sasaran : Peserta didik dengan pencapaian Kriteria Ketercapaian (KKTP < 75) pada materi "${safeMateri}".
- Bentuk Kegiatan : Penjelasan ulang konsep dasar ${safeSubbab}, pendampingan individual (scaffolding), serta latihan soal adaptif dalam ${domainContext.rules.name}.`;
  const mod12_Pengayaan = `12. PROGRAM PENGAYAAN
- Sasaran : Peserta didik dengan pencapaian tinggi (KKTP \u2265 75) pada materi "${safeMateri}".
- Bentuk Kegiatan : Pemecahan penerapan materi HOTS yang lebih mendalam, eksplorasi fitur/metode tingkat lanjut, atau menjadi tutor sebaya dalam memandu konsep "${safeMateri}".`;
  const mod13_LKPD = getDomainLKPD(domainContext.type, safeSubject, safeMateri, safeGrade, safeSemester);
  const mod15_Refleksi = `15. REFLEKSI GURU DAN PESERTA DIDIK

Refleksi Peserta Didik:
${refleksiPesertaDidikFormatted}

Refleksi Guru:
${refleksiGuruFormatted}`;
  const glosVocabulary = deriveTopicVocabulary(safeMateri);
  const glosTerms = glosVocabulary.list;
  const glosEntries = [];
  const getSubstantiveDefinition = (term, safeMateri2, subj) => {
    const lowerTerm = term.toLowerCase();
    if (subj.includes("arab") || subj.includes("inggris")) return `Kosakata atau ungkapan penting yang digunakan dalam konteks "${safeMateri2}".`;
    if (subj.includes("matematika")) return `Konsep, rumus, atau prinsip matematis dasar terkait "${safeMateri2}".`;
    return `Konsep atau elemen penting yang menjadi bagian dari materi "${safeMateri2}".`;
  };
  for (let i = 0; i < glosTerms.length; i++) {
    const term = glosTerms[i];
    glosEntries.push(`${i + 1}. ${term} : ${getSubstantiveDefinition(term, safeMateri, safeSubject.toLowerCase())}`);
  }
  const finalGlosariumText = glosEntries.slice(0, 6).join("\n");
  const mod16_Lampiran = `16. LAMPIRAN: GLOSARIUM DAN DAFTAR PUSTAKA

A. GLOSARIUM TOPIK:
${finalGlosariumText}

B. DAFTAR PUSTAKA:
1. Kemendikbudristek. 2024. Buku Teks Utama ${safeSubject} Kelas ${safeGrade}.
2. Tim Pengembang Kurikulum. 2024. Panduan Pembelajaran ${domainContext.rules.name}.
3. Buku pengayaan atau referensi tambahan yang relevan dengan materi "${safeMateri}" pada mata pelajaran ${safeSubject}.`;
  const finalOutput = {
    selectedJenis: domainContext.type,
    identitasModul: mod01_Identitas,
    capaianPembelajaran: domainCaps[domainContext.type] || domainCaps["KONSEP"],
    karakteristikMateri: `${karakteristikFormatted}

Fokus Materi Inti Utama:
"${safeMateri}"

Kata Kunci Topik:
${domainContext.rules.keywords.map((kw) => resolveTerm(kw, safeMateri)).join(", ")}`,
    kbc: `1. Cinta Allah & Ketaatan Keilmuan:
${kbcAllah}

2. Cinta Ilmu & Rasa Ingin Tahu:
${kbcIlmu}

3. Cinta Diri & Perawatan Pribadi:
${kbcDiri}

4. Cinta Sesama & Kolaborasi:
${kbcSesama}

5. Cinta Lingkungan & Efisiensi Sumber Daya:
${kbcLingkungan}

6. Cinta Tanah Air & Kemandirian Belajar:
${kbcTanahAir}`,
    pembelajaranMendalam: `- Berkesadaran (Mindful Learning):
  ${domainContext.rules.deep_learning.mindful}
- Bermakna (Meaningful Learning):
  ${domainContext.rules.deep_learning.meaningful}
- Menggembirakan (Joyful Learning):
  ${domainContext.rules.deep_learning.joyful}`,
    tujuanPembelajaran: `${bloomAlignmentText}`,
    pemahamanBermakna: `Penguasaan terhadap "${safeMateri}" dalam ${domainContext.rules.name} membekali peserta didik dengan kecakapan berpikir analitis, pemecahan masalah secara terstruktur, and keterampilan aplikatif yang dapat dipertanggungjawabkan.`,
    pertanyaanPemantik: `${mod07_PertanyaanPemantik}`,
    praktikPedagogis: `- Pendekatan Pembelajaran : Student-Centered Learning & Subject-Based Inquiry (${domainContext.rules.name})
- Model Pembelajaran : ${modelPembelajaran}
- Metode Pembelajaran : Eksplorasi Terbimbing, Diskusi Kelompok, Pemecahan Masalah, & Penugasan Kontekstual terkait "${safeMateri}".
- Alasan Pemilihan Pendekatan : Mendukung pemahaman konseptual dan keterampilan prosedural secara langsung melalui pengalaman belajar bermakna.`,
    mitraPembelajaran: `- Guru Mata Pelajaran : Fasilitator dan mentor utama proses pembelajaran "${safeMateri}".
- Teman Sebaya : Kolaborator dalam diskusi kelompok, perancangan, dan peer review.
- Sumber Belajar : Modul ajar, lembar kerja peserta didik, dan dokumentasi terkait penerapan materi "${safeMateri}".`,
    lingkunganPembelajaran: `- Lingkungan Fisik : Ruang kelas atau laboratorium ruang praktik yang tertata kondusif.
- Lingkungan Belajar : Media penunjang simulasi atau penerapan materi terkait "${safeMateri}".
- Pengaturan Kelompok : Kerja mandiri dan kolaborasi kelompok kecil (3-4 orang).
- Alternatif Pembelajaran : Lembar kerja cetak dan diskusi kelompok terbimbing.`,
    pemanfaatanDigital: `- Perangkat : Media fisik pendukung atau Lembar Kerja Cetak.
- Fasilitas Pendukung : Alat bantu pembelajaran yang relevan untuk mengeksplorasi dan memverifikasi "${safeMateri}".
- Aktivitas Kelas : Eksplorasi interaktif, simulasi alur, dan verifikasi hasil secara nyata.`,
    kegiatanPembelajaran: kegiatanPembelajaranText,
    asesmen: `${mod09_Asesmen}`,
    diferensiasiPembelajaran: `- Diferensiasi Konten : Menyediakan bahan bacaan dengan tingkat kerumitan bervariasi, peta konsep, serta daftar istilah penting terkait "${safeMateri}".
- Diferensiasi Proses : Memberikan bimbingan terarah (scaffolding) bagi kelompok awal, pendampingan praktis terstruktur, serta tantangan analisis penerapan materi mandiri terkait "${safeMateri}" bagi kelompok mahir.
- Diferensiasi Produk : Menyelesaikan tugas/karya dasar sesuai standar (reguler) vs menghasilkan karya/analisis mendalam dengan pengayaan terkait "${safeMateri}" (mahir).`,
    remedial: mod11_Remedial,
    pengayaan: mod12_Pengayaan,
    lkpd: mod13_LKPD,
    miniChallengeProyek: mod14_ProyekOrTugas,
    refleksi: mod15_Refleksi,
    bahanAjar: getDomainBahanAjar(domainContext.type, safeSubject, safeMateri, safeSubbab),
    glosarium: finalGlosariumText,
    daftarPustaka: `1. Kemendikbudristek. 2024. Buku Teks Utama ${safeSubject} Kelas ${safeGrade}.
2. Tim Pengembang Kurikulum. 2024. Panduan Pembelajaran ${domainContext.rules.name}.
3. Buku pengayaan atau referensi tambahan yang relevan dengan materi "${safeMateri}" pada mata pelajaran ${safeSubject}.`,
    // Legacy compatibility fields:
    kompetensiAwal: mod02_Identifikasi,
    profilPancasila: mod02_ProfilPancasila,
    saranaPrasarana: mod02_SaranaPrasarana,
    targetPeserta: mod02_TargetPeserta,
    modelPembelajaran: `Model : ${modelPembelajaran} | Metode : Problem Solving, Praktik Hands-On`,
    persiapanPembelajaran: safePersiapanFormatted,
    pengayaanRemedial: `${mod11_Remedial}

${mod12_Pengayaan}`,
    lembarKerja: `${mod14_ProyekOrTugas}

${refleksiPesertaDidikFormatted}`
  };
  const resolvedOutput = replacePlaceholdersRecursive(finalOutput, safeMateri, safeSubbab, safeBab);
  const sanitizedOutput = sanitizeObject(resolvedOutput, safeMateri, domainContext.type);
  const validationSummary = runSelfValidation(sanitizedOutput, safeMateri, domainContext.type);
  sanitizedOutput.validationSummary = validationSummary;
  sanitizedOutput.DOMAIN_TEMPLATE_BIAS = validationSummary.domainTemplateBias;
  sanitizedOutput.topicDominanceScore = validationSummary.topicDominance;
  sanitizedOutput.topicDriftScore = validationSummary.topicDrift;
  sanitizedOutput.domainLeakageCount = validationSummary.domainLeakage;
  sanitizedOutput.defaultSubtopicOverrideCount = validationSummary.defaultSubtopicOverride;
  sanitizedOutput.unresolvedPlaceholderCount = validationSummary.unresolvedPlaceholder;
  sanitizedOutput.irrelevantVocabularyCount = validationSummary.irrelevantVocabulary;
  return sanitizedOutput;
}

// server.ts
var import_pg = __toESM(require("pg"), 1);
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception caught:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection caught:", reason);
});
var db = null;
var isTrustedCloudRunRuntime = Boolean(
  process.env.K_SERVICE && (process.env.K_REVISION || process.env.K_CONFIGURATION)
);
var isLocalRuntime = !isTrustedCloudRunRuntime;
var requestedAppMode = String(process.env.APP_MODE || "").trim().toLowerCase();
var storageMode = requestedAppMode === "online" ? "online" : requestedAppMode === "offline" ? "offline" : isTrustedCloudRunRuntime ? "online" : "offline";
var isOfflineMode = storageMode === "offline";
var isOnlineMode = storageMode === "online";
console.log(`[Runtime] ${isTrustedCloudRunRuntime ? "TRUSTED_CLOUD_RUN" : "LOCAL"} runtime; storage=${storageMode.toUpperCase()}${requestedAppMode ? " (APP_MODE)" : " (auto)"}.`);
console.log(`[Storage] ${isOnlineMode ? "Cloud SQL + Cloudinary are authoritative" : "PostgreSQL/local_store.json + uploads are authoritative; Cloudinary is optional backup"}.`);
if (process.env.CLOUDINARY_CLOUD_NAME) {
  import_cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log("Cloudinary initialized.");
}
var LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAkC2mnT3XDQyfAtZcZsC3
rvhVo2GprD62ChrbHoerkteg6FomXN3Q+TOgUE21uCVK2x95IBPqe/+1nWEx/njN
WJcKPZW2e/GeZXtJyOQPzDQ1YnkleNa7Oqc2wP0R5/KJSf4tv1GuRkb/+5+WY510
6sqlU8IsVaOZOsG9D5jTwfdcnRTUdBJsV8emwZZjFiFWA1jgbtTKBwmaPuYPrO1j
voBA6IjuzuM+WL2BafqWYrWYrLGBhXk5pKZMwo/mp+oA92L2VUYmAfjp1eTFR6aa
uAJ6LamIeKcWgKWHyaymUuxrQ0s8QULeHawdRZG2N75VqaNnRaCqrYLH1PrPy9JL
ND5WhgpVKkTbAz/hIorH4v66a+7pc2NMQ/eO1NzjJwUCmGSh0H0aqQjp7Q4YrOi3
pnAVfJlSqiisvhGcbc2hTmPmJOA/+Nupdel3yfy1IItiSuVvke0iPszvsqSip+pC
4t1lhRhtKdujUsMLNFCnBPARfipvDYsuAeyDAhRoLq8DAgMBAAE=
-----END PUBLIC KEY-----`;
function formatPrivateKeyPem(raw) {
  if (!raw) return "";
  let key = raw.replace(/\\n/g, "\n").trim();
  if (key.startsWith('"') && key.endsWith('"') || key.startsWith("'") && key.endsWith("'")) {
    key = key.slice(1, -1).replace(/\\n/g, "\n").trim();
  }
  if (!key.includes("-----BEGIN")) {
    const chunks = key.match(/.{1,64}/g) || [key];
    key = `-----BEGIN PRIVATE KEY-----
${chunks.join("\n")}
-----END PRIVATE KEY-----`;
  }
  return key;
}
function formatPublicKeyPem(raw) {
  if (!raw) return "";
  let key = raw.replace(/\\n/g, "\n").trim();
  if (key.startsWith('"') && key.endsWith('"') || key.startsWith("'") && key.endsWith("'")) {
    key = key.slice(1, -1).replace(/\\n/g, "\n").trim();
  }
  if (!key.includes("-----BEGIN")) {
    const chunks = key.match(/.{1,64}/g) || [key];
    key = `-----BEGIN PUBLIC KEY-----
${chunks.join("\n")}
-----END PUBLIC KEY-----`;
  }
  return key;
}
var cachedKeyPair = null;
function getServerKeyPair() {
  if (cachedKeyPair) return cachedKeyPair;
  const envPrivate = process.env.LICENSE_PRIVATE_KEY;
  const envPublic = process.env.LICENSE_PUBLIC_KEY || LICENSE_PUBLIC_KEY;
  if (envPrivate) {
    const formattedPrivate = formatPrivateKeyPem(envPrivate);
    const formattedPublic = formatPublicKeyPem(envPublic);
    try {
      const sign = import_crypto.default.createSign("SHA256");
      sign.write("test");
      sign.end();
      sign.sign(formattedPrivate, "base64");
      cachedKeyPair = { privateKey: formattedPrivate, publicKey: formattedPublic };
      return cachedKeyPair;
    } catch {
    }
  }
  try {
    const { privateKey, publicKey } = import_crypto.default.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "pkcs1", format: "pem" },
      privateKeyEncoding: { type: "pkcs1", format: "pem" }
    });
    cachedKeyPair = { privateKey, publicKey };
  } catch (err) {
  }
  return cachedKeyPair;
}
var LEGACY_TOKEN_LOCK_SECRET = "***REMOVED***";
var TOKEN_LOCK_SECRET = process.env.TOKEN_LOCK_SECRET;
if (!TOKEN_LOCK_SECRET) {
  console.warn("WARNING: TOKEN_LOCK_SECRET environment variable is not set! Using legacy fallback (INSECURE).");
}
function calculateTokenSignature(madrasahId, balance, useLegacy = false) {
  const secret = useLegacy || !TOKEN_LOCK_SECRET ? LEGACY_TOKEN_LOCK_SECRET : TOKEN_LOCK_SECRET;
  return import_crypto.default.createHmac("sha256", secret).update(`${madrasahId}:${balance}`).digest("hex");
}
var LEGACY_ENCRYPTION_SECRET = "***REMOVED***";
var LOCAL_STORE_SECRET = process.env.LOCAL_STORE_SECRET;
if (!LOCAL_STORE_SECRET) {
  console.warn("WARNING: LOCAL_STORE_SECRET environment variable is not set! Using legacy fallback (INSECURE).");
}
var ENCRYPTION_KEY = import_crypto.default.createHash("sha256").update(LOCAL_STORE_SECRET || LEGACY_ENCRYPTION_SECRET).digest();
var LEGACY_ENCRYPTION_KEY = import_crypto.default.createHash("sha256").update(LEGACY_ENCRYPTION_SECRET).digest();
function encryptLocalStore(text) {
  const iv = import_crypto.default.randomBytes(16);
  const cipher = import_crypto.default.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}
function decryptLocalStore(encryptedText) {
  try {
    const trimmed = encryptedText.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return encryptedText;
    }
    const parts = trimmed.split(":");
    if (parts.length !== 2) {
      throw new Error("Invalid encryption format (no IV separator found)");
    }
    const iv = Buffer.from(parts[0], "hex");
    const encryptedTextData = parts[1];
    try {
      const decipher = import_crypto.default.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
      let decrypted = decipher.update(encryptedTextData, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch (e) {
      const legacyDecipher = import_crypto.default.createDecipheriv("aes-256-cbc", LEGACY_ENCRYPTION_KEY, iv);
      let legacyDecrypted = legacyDecipher.update(encryptedTextData, "hex", "utf8");
      legacyDecrypted += legacyDecipher.final("utf8");
      return legacyDecrypted;
    }
  } catch (err) {
    console.error("Gagal melakukan dekripsi local_store.json:", err.message);
    throw err;
  }
}
function verifyAndLockMadrasahTokens() {
  if (!Array.isArray(madrasahs)) return;
  let tampered = false;
  for (const m of madrasahs) {
    const currentBalance = m.cbtTokenBalance || 0;
    const expectedSig = calculateTokenSignature(m.id, currentBalance);
    const expectedLegacySig = calculateTokenSignature(m.id, currentBalance, true);
    if (!m.tokenSignature) {
      if (isLocalRuntime && currentBalance > 1) {
        m.tokenSignatureInvalid = true;
        console.error(`[TOKEN SIGNATURE INVALID] Madrasah "${m.name}" (${m.id}) has balance ${currentBalance} without a valid signature. Balance preserved; token use is blocked until resealed.`);
      } else {
        m.tokenSignature = expectedSig;
        delete m.tokenSignatureInvalid;
        tampered = true;
      }
    } else if (TOKEN_LOCK_SECRET && m.tokenSignature === expectedLegacySig) {
      m.tokenSignature = expectedSig;
      delete m.tokenSignatureInvalid;
      tampered = true;
    } else if (m.tokenSignature !== expectedSig && m.tokenSignature !== expectedLegacySig) {
      m.tokenSignatureInvalid = true;
      console.error(`[TOKEN SIGNATURE INVALID] Madrasah "${m.name}" (${m.id}) signature mismatch. Balance ${currentBalance} preserved; token use is blocked until resealed.`);
    } else {
      delete m.tokenSignatureInvalid;
    }
  }
  if (tampered) {
    saveData("madrasahs", madrasahs).catch((e) => console.error("Failed to save after tamper recovery:", e));
  }
}
var firestorePendingValues = /* @__PURE__ */ new Map();
var firestorePendingKeysQueue = /* @__PURE__ */ new Set();
var isFirestoreQueueRunning = false;
var firestoreQueueTimer = null;
async function saveKeyToFirestore(key, value) {
  if (!db) return;
  if (key === "studentLivecamFrames" || key === "examMessages" || key.includes("__chunk_")) return;
  firestorePendingValues.set(key, value);
  firestorePendingKeysQueue.add(key);
  triggerFirestoreQueueRunner();
}
function triggerFirestoreQueueRunner() {
  if (firestoreQueueTimer) return;
  firestoreQueueTimer = setTimeout(() => {
    firestoreQueueTimer = null;
    runFirestoreQueueWorker().catch((err) => {
      console.warn("[Firestore Queue Worker Error]:", err);
    });
  }, 1500);
}
async function runFirestoreQueueWorker() {
  if (isFirestoreQueueRunning || !db) return;
  isFirestoreQueueRunning = true;
  try {
    while (firestorePendingKeysQueue.size > 0) {
      const key = firestorePendingKeysQueue.values().next().value;
      if (!key) break;
      firestorePendingKeysQueue.delete(key);
      const value = firestorePendingValues.get(key);
      if (value === void 0) continue;
      firestorePendingValues.delete(key);
      try {
        const jsonStr = JSON.stringify(value);
        const MAX_DOC_SIZE = 75e4;
        const batch = (0, import_firestore.writeBatch)(db);
        if (jsonStr.length <= MAX_DOC_SIZE) {
          batch.set((0, import_firestore.doc)(db, "app_store", key), {
            value: jsonStr,
            updatedAt: Date.now()
          });
        } else {
          const chunkCount = Math.ceil(jsonStr.length / MAX_DOC_SIZE);
          for (let i = 0; i < chunkCount; i++) {
            const slice = jsonStr.slice(i * MAX_DOC_SIZE, (i + 1) * MAX_DOC_SIZE);
            batch.set((0, import_firestore.doc)(db, "app_store", `${key}__chunk_${i}`), {
              chunkText: slice,
              updatedAt: Date.now()
            });
          }
          batch.set((0, import_firestore.doc)(db, "app_store", key), {
            _isChunkedString: true,
            chunkCount,
            updatedAt: Date.now()
          });
        }
        await batch.commit();
      } catch (err) {
        console.warn(`[Firestore Backup] Failed to back up key "${key}" to Firestore:`, err?.message || err);
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  } finally {
    isFirestoreQueueRunning = false;
    if (firestorePendingKeysQueue.size > 0) {
      triggerFirestoreQueueRunner();
    }
  }
}
async function loadStoreFromFirestore() {
  const store = {};
  if (db) {
    try {
      console.log("[Firestore Sync] Hydrating state from persistent Firestore 'app_store' collection...");
      const querySnapshot = await (0, import_firestore.getDocs)((0, import_firestore.collection)(db, "app_store"));
      const docsMap = {};
      querySnapshot.forEach((document) => {
        docsMap[document.id] = document.data();
      });
      const primaryKeys = Object.keys(docsMap).filter((k) => !k.includes("__chunk_"));
      for (const pKey of primaryKeys) {
        const data = docsMap[pKey];
        if (!data) continue;
        if (data._isChunkedString && typeof data.chunkCount === "number") {
          let str = "";
          for (let i = 0; i < data.chunkCount; i++) {
            const chunkDoc = docsMap[`${pKey}__chunk_${i}`];
            if (chunkDoc && typeof chunkDoc.chunkText === "string") {
              str += chunkDoc.chunkText;
            }
          }
          if (str) {
            try {
              store[pKey] = JSON.parse(str);
            } catch (e) {
              store[pKey] = str;
            }
          }
        } else if (data._isChunkedArray && typeof data.chunkCount === "number") {
          const arr = [];
          for (let i = 0; i < data.chunkCount; i++) {
            const chunkDoc = docsMap[`${pKey}__chunk_${i}`];
            if (chunkDoc && typeof chunkDoc.value === "string") {
              try {
                const parsed = JSON.parse(chunkDoc.value);
                if (Array.isArray(parsed)) arr.push(...parsed);
              } catch (e) {
              }
            }
          }
          store[pKey] = arr;
        } else if (data._isChunkedObject && typeof data.chunkCount === "number") {
          let obj = {};
          for (let i = 0; i < data.chunkCount; i++) {
            const chunkDoc = docsMap[`${pKey}__chunk_${i}`];
            if (chunkDoc && typeof chunkDoc.value === "string") {
              try {
                const parsed = JSON.parse(chunkDoc.value);
                if (typeof parsed === "object" && parsed !== null) {
                  obj = { ...obj, ...parsed };
                }
              } catch (e) {
              }
            }
          }
          store[pKey] = obj;
        } else if (typeof data.value === "string") {
          try {
            store[pKey] = JSON.parse(data.value);
          } catch (e) {
            store[pKey] = data.value;
          }
        }
      }
      console.log(`[Firestore Sync] Successfully loaded ${Object.keys(store).length} keys from Firestore.`);
    } catch (err) {
      console.warn("[Firestore Sync] Failed to load store from Firestore:", err);
    }
  }
  return store;
}
var uploadsDir = import_path.default.join(process.cwd(), "uploads");
var photosDir = import_path.default.join(uploadsDir, "attendance_photos");
if (isOfflineMode) {
  if (!import_fs.default.existsSync(uploadsDir)) {
    import_fs.default.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!import_fs.default.existsSync(photosDir)) {
    import_fs.default.mkdirSync(photosDir, { recursive: true });
  }
}
var photoCloudinaryMap = {};
async function uploadToCloudinary(base64OrPath, publicId) {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    return null;
  }
  if (publicId && photoCloudinaryMap[publicId]) {
    console.log(`[Cloudinary Deduplication Skip] Photo ${publicId} is already uploaded to Cloudinary: ${photoCloudinaryMap[publicId]}`);
    return photoCloudinaryMap[publicId];
  }
  try {
    const uploadOptions = {
      folder: "madrasah_photos",
      resource_type: "image"
    };
    if (publicId) {
      uploadOptions.public_id = publicId.replace(/[^a-zA-Z0-9_\-]/g, "_");
    }
    const result = await new Promise((resolve, reject) => {
      import_cloudinary.v2.uploader.upload(base64OrPath, uploadOptions, (error, result2) => {
        if (error) reject(error);
        else resolve(result2);
      });
    });
    if (result && (result.secure_url || result.url)) {
      const url = result.secure_url || result.url;
      console.log(`[Cloudinary Dual Storage] Saved photo ${publicId || ""} to Cloudinary: ${url}`);
      return url;
    }
  } catch (err) {
    console.warn(`[Cloudinary Dual Storage Warning] Cloudinary upload failed: ${err?.message || err}`);
  }
  return null;
}
function normalizeCloudinaryPhotoId(photoId) {
  return String(photoId || "").replace(/^madrasah_photos\//, "").replace(/[^a-zA-Z0-9_\-]/g, "_");
}
function collectReferencedPhotoIds() {
  const candidates = /* @__PURE__ */ new Set();
  const addPhotoId = (value) => {
    if (typeof value !== "string") return;
    let photoId = value.trim();
    if (!photoId || photoId.startsWith("http") || photoId.startsWith("data:image/")) return;
    if (photoId.startsWith("/api/photos/")) {
      photoId = photoId.replace("/api/photos/", "").split("?")[0].trim();
    }
    if (photoId) candidates.add(photoId);
  };
  const addHistory = (history) => {
    if (!Array.isArray(history)) return;
    for (const entry of history) {
      addPhotoId(typeof entry === "string" ? entry : entry?.photo);
    }
  };
  (students || []).forEach((student) => {
    addPhotoId(student?.photo);
    addHistory(student?.photoHistory || student?.photo_history);
  });
  (teachers || []).forEach((teacher) => {
    addPhotoId(teacher?.photo);
    addHistory(teacher?.photoHistory || teacher?.photo_history);
  });
  (attendance || []).forEach((item) => addPhotoId(item?.photo));
  (teacherAttendance || []).forEach((item) => addPhotoId(item?.photo));
  (questions || []).forEach((item) => {
    addPhotoId(item?.imageUrl);
    addPhotoId(item?.image);
  });
  addPhotoId(appSettings?.schoolLogo);
  addPhotoId(appSettings?.schoolLogoUrl);
  return candidates;
}
async function listActualCloudinaryPhotos() {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error("Cloudinary belum dikonfigurasi.");
  }
  const cloudByCleanId = /* @__PURE__ */ new Map();
  let nextCursor = null;
  do {
    const response = await import_cloudinary.v2.api.resources({
      type: "upload",
      resource_type: "image",
      prefix: "madrasah_photos",
      max_results: 500,
      next_cursor: nextCursor || void 0
    });
    const resources = Array.isArray(response?.resources) ? response.resources : [];
    for (const item of resources) {
      if (!item?.public_id || !(item.secure_url || item.url)) continue;
      const url = item.secure_url || item.url;
      const fullId = String(item.public_id);
      const cleanId = fullId.replace(/^madrasah_photos\//, "");
      cloudByCleanId.set(cleanId, { url, fullId });
    }
    nextCursor = response?.next_cursor || null;
  } while (nextCursor);
  return cloudByCleanId;
}
async function syncAllPhotosToCloudinary() {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    console.log("[Cloudinary Sync] Cloudinary is not configured. Skipping sync.");
    return { totalCloudinary: 0, synced: 0, mapped: 0 };
  }
  console.log(`[Cloudinary Sync] Rebuilding mapping from actual Cloudinary assets (storage=${storageMode}).`);
  const cloudByCleanId = await listActualCloudinaryPhotos();
  const rebuiltMap = {};
  for (const [cleanId, remote] of cloudByCleanId.entries()) {
    rebuiltMap[cleanId] = remote.url;
    rebuiltMap[remote.fullId] = remote.url;
  }
  photoCloudinaryMap = rebuiltMap;
  let uploaded = 0;
  let skipped = 0;
  if (isOfflineMode) {
    const photoCandidates = collectReferencedPhotoIds();
    try {
      if (import_fs.default.existsSync(uploadsDir)) {
        for (const name of import_fs.default.readdirSync(uploadsDir)) {
          if (!name || name.startsWith(".")) continue;
          const filePath = import_path.default.join(uploadsDir, name);
          try {
            if (import_fs.default.statSync(filePath).isFile()) photoCandidates.add(name);
          } catch (_) {
          }
        }
      }
    } catch (e) {
      console.warn("[Cloudinary Sync] Could not scan offline uploads directory:", e);
    }
    for (const photoId of photoCandidates) {
      const normalizedId = normalizeCloudinaryPhotoId(photoId);
      const remote = cloudByCleanId.get(normalizedId) || cloudByCleanId.get(photoId);
      if (remote) {
        photoCloudinaryMap[photoId] = remote.url;
        photoCloudinaryMap[normalizedId] = remote.url;
        photoCloudinaryMap[remote.fullId] = remote.url;
        skipped++;
        continue;
      }
      const localFile = import_path.default.join(uploadsDir, photoId);
      if (!import_fs.default.existsSync(localFile)) continue;
      const cloudUrl = await uploadToCloudinary(localFile, photoId);
      if (cloudUrl) {
        photoCloudinaryMap[photoId] = cloudUrl;
        photoCloudinaryMap[normalizedId] = cloudUrl;
        photoCloudinaryMap[`madrasah_photos/${normalizedId}`] = cloudUrl;
        uploaded++;
      }
    }
  }
  await saveData("photoCloudinaryMap", photoCloudinaryMap, true);
  console.log(`[Cloudinary Sync] Finished. Remote assets=${cloudByCleanId.size}; uploaded=${uploaded}; mapped=${Object.keys(photoCloudinaryMap).length}.`);
  return {
    totalCloudinary: cloudByCleanId.size,
    synced: uploaded,
    mapped: Object.keys(photoCloudinaryMap).length
  };
}
async function repairMissingCloudinaryPhotos() {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error("Cloudinary belum dikonfigurasi.");
  }
  const cloudByCleanId = await listActualCloudinaryPhotos();
  const candidates = collectReferencedPhotoIds();
  if (isOfflineMode) {
    try {
      if (import_fs.default.existsSync(uploadsDir)) {
        for (const name of import_fs.default.readdirSync(uploadsDir)) {
          if (!name || name.startsWith(".")) continue;
          const filePath = import_path.default.join(uploadsDir, name);
          try {
            if (import_fs.default.statSync(filePath).isFile()) candidates.add(name);
          } catch (_) {
          }
        }
      }
    } catch (err) {
      console.warn("[Cloudinary Repair] Could not scan uploads directory:", err?.message || err);
    }
  }
  const rebuiltMap = {};
  for (const [cleanId, remote] of cloudByCleanId.entries()) {
    rebuiltMap[cleanId] = remote.url;
    rebuiltMap[remote.fullId] = remote.url;
  }
  photoCloudinaryMap = rebuiltMap;
  let alreadyExists = 0;
  let uploaded = 0;
  let missingSource = 0;
  let failed = 0;
  for (const photoId of candidates) {
    const normalizedId = normalizeCloudinaryPhotoId(photoId);
    const remote = cloudByCleanId.get(normalizedId) || cloudByCleanId.get(photoId);
    if (remote) {
      photoCloudinaryMap[photoId] = remote.url;
      photoCloudinaryMap[normalizedId] = remote.url;
      photoCloudinaryMap[remote.fullId] = remote.url;
      alreadyExists++;
      continue;
    }
    if (isOnlineMode) {
      missingSource++;
      console.warn(`[Cloudinary Repair] Remote asset missing for ${photoId}; online mode has no local photo store.`);
      continue;
    }
    const localFile = import_path.default.join(uploadsDir, photoId);
    let hasLocalFile = false;
    try {
      hasLocalFile = import_fs.default.existsSync(localFile) && import_fs.default.statSync(localFile).isFile();
    } catch (_) {
    }
    if (!hasLocalFile) {
      missingSource++;
      console.warn(`[Cloudinary Repair] Remote asset missing and no offline local source available for ${photoId}.`);
      continue;
    }
    try {
      const cloudUrl = await uploadToCloudinary(localFile, photoId);
      if (cloudUrl) {
        photoCloudinaryMap[photoId] = cloudUrl;
        photoCloudinaryMap[normalizedId] = cloudUrl;
        photoCloudinaryMap[`madrasah_photos/${normalizedId}`] = cloudUrl;
        uploaded++;
      } else {
        failed++;
      }
    } catch (err) {
      failed++;
      console.warn(`[Cloudinary Repair] Upload failed for ${photoId}:`, err?.message || err);
    }
  }
  await saveData("photoCloudinaryMap", photoCloudinaryMap, true);
  console.log(`[Cloudinary Repair] Checked ${candidates.size}; exists ${alreadyExists}; uploaded ${uploaded}; missing source ${missingSource}; failed ${failed}.`);
  return {
    checked: candidates.size,
    alreadyExists,
    uploaded,
    missingSource,
    failed,
    mapped: Object.keys(photoCloudinaryMap).length
  };
}
async function saveBase64ToFirestore(base64Str) {
  if (!base64Str || !base64Str.startsWith("data:image/")) return base64Str;
  const photoId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  if (isOfflineMode) {
    try {
      if (!import_fs.default.existsSync(uploadsDir)) import_fs.default.mkdirSync(uploadsDir, { recursive: true });
      const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        import_fs.default.writeFileSync(import_path.default.join(uploadsDir, photoId), Buffer.from(matches[2], "base64"));
      } else {
        import_fs.default.writeFileSync(import_path.default.join(uploadsDir, photoId), base64Str);
      }
    } catch (err) {
      console.error("[Photo Storage] Failed to save offline photo to uploads/:", err);
      throw new Error("Foto gagal disimpan ke penyimpanan lokal.");
    }
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      uploadToCloudinary(base64Str, photoId).then((cUrl) => {
        if (!cUrl) return;
        photoCloudinaryMap[photoId] = cUrl;
        photoCloudinaryMap[`madrasah_photos/${normalizeCloudinaryPhotoId(photoId)}`] = cUrl;
        saveData("photoCloudinaryMap", photoCloudinaryMap, false).catch(() => {
        });
      }).catch((e) => console.warn("[Photo Storage] Optional offline Cloudinary backup failed:", e));
    }
    return `/api/photos/${photoId}`;
  }
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary wajib dikonfigurasi pada mode online.");
  }
  const cloudUrl = await uploadToCloudinary(base64Str, photoId);
  if (!cloudUrl) {
    throw new Error("Upload foto ke Cloudinary gagal. Foto tidak dianggap tersimpan.");
  }
  const normalizedId = normalizeCloudinaryPhotoId(photoId);
  photoCloudinaryMap[photoId] = cloudUrl;
  photoCloudinaryMap[normalizedId] = cloudUrl;
  photoCloudinaryMap[`madrasah_photos/${normalizedId}`] = cloudUrl;
  await saveData("photoCloudinaryMap", photoCloudinaryMap, true);
  return `/api/photos/${photoId}`;
}
async function persistRestoredImageData(value) {
  if (typeof value === "string") {
    return value.startsWith("data:image/") ? await saveBase64ToFirestore(value) : value;
  }
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) out.push(await persistRestoredImageData(item));
    return out;
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = await persistRestoredImageData(item);
    }
    return out;
  }
  return value;
}
function cleanDashedLines(text) {
  if (typeof text !== "string") return text;
  let cleaned = text.replace(/^[\-\—\–\―\=\_]{3,}\s*$/gm, "");
  cleaned = cleaned.replace(/[\-\—\–\―\=\_]{4,}/g, "");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  return cleaned;
}
function sanitizeGeneratedData(data) {
  if (data === null || data === void 0) return data;
  if (typeof data === "string") {
    return cleanDashedLines(data);
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeGeneratedData(item));
  }
  if (typeof data === "object") {
    const res = {};
    for (const key of Object.keys(data)) {
      res[key] = sanitizeGeneratedData(data[key]);
    }
    return res;
  }
  return data;
}
var NO_DASHES_PROMPT = `
PERATURAN FORMAT DILARANG:
1. DILARANG SANGAT menggunakan garis pembatas berupa karakter dash/strip/sama dengan/underscore (seperti -------------------- atau ==================== atau ---). Gunakan spasi antar paragraf, penomoran terstruktur, atau tabel HTML/Markdown biasa.
2. DUKUNGAN SPESIFIK BAHASA & SAINS:
   - BAHASA ARAB / AL-QUR'AN / HADIS / FIKIH / AGAMA: Tuliskan teks Bahasa Arab berharakat/fathah/kasrah/dammah yang shahih dan lengkap.
   - BAHASA INGGRIS: Gunakan teks/dialog/soal Bahasa Inggris yang alami, gramatikal, dan komunikatif.
   - MATEMATIKA & SAINS (FISIKA/KIMIA/BIOLOGI): Tuliskan rumus-rumus matematika, persamaan fisika/kimia, dan notasi sains dengan format KaTeX/LaTeX yang presisi (seperti $f(x) = ax^2 + bx + c$, $\\frac{a}{b}$, $\\sqrt{x}$, $\\int f(x)dx$, $\\text{H}_2\\text{O}$) agar ter-render sempurna.
`;
function safeParseGeminiJSON(rawText, fallback = null) {
  if (!rawText || typeof rawText !== "string") return fallback;
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (err1) {
  }
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  let isObject = true;
  let startIdx = -1;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    isObject = true;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    isObject = false;
  }
  if (startIdx !== -1) {
    const endChar = isObject ? "}" : "]";
    const lastIdx = cleaned.lastIndexOf(endChar);
    if (lastIdx > startIdx) {
      const candidate = cleaned.slice(startIdx, lastIdx + 1);
      try {
        return JSON.parse(candidate);
      } catch (err2) {
        try {
          const sanitized = candidate.replace(/,\s*([}\]])/g, "$1");
          return JSON.parse(sanitized);
        } catch (err3) {
        }
      }
    }
  }
  return fallback;
}
async function generateGeminiContent(ai, params) {
  const primaryModel = params.model || "gemini-3.7-flash";
  const fallbackModels = ["gemini-3.7-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  const modelsToTry = [primaryModel, ...fallbackModels.filter((m) => m !== primaryModel)];
  let lastError = null;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  for (const model of modelsToTry) {
    let retries = 2;
    while (retries >= 0) {
      try {
        console.log(`[Gemini API] Attempting generateContent with model: ${model} (Retries left: ${retries})`);
        const response = await ai.models.generateContent({
          ...params,
          model
        });
        if (params.config?.responseMimeType === "application/json") {
          const text = response.text || "";
          if (text.trim() === "{" || text.trim() === "}") {
            throw new Error("Invalid/Truncated JSON response from model");
          }
        }
        return response;
      } catch (error) {
        lastError = error;
        const errMsg = typeof error === "string" ? error : error?.message || JSON.stringify(error) || "";
        console.warn(`[Gemini API] Model ${model} failed. Error:`, errMsg);
        const isTemporary = error?.status === "RESOURCE_EXHAUSTED" || error?.statusCode === 429 || errMsg.includes("429") || errMsg.includes("Quota") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota") || errMsg.includes("exhausted") || error?.status === "UNAVAILABLE" || error?.statusCode === 503 || errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("overloaded");
        const isModelNotAvailable = error?.status === "NOT_FOUND" || error?.statusCode === 404 || errMsg.includes("404") || errMsg.includes("no longer available") || errMsg.includes("not available") || errMsg.includes("NOT_FOUND");
        if (isTemporary && retries > 0) {
          console.warn(`[Gemini API] Temporary issue detected with ${model}. Waiting 2 seconds before retry...`);
          await sleep(2e3);
          retries--;
          continue;
        }
        if (isTemporary || isModelNotAvailable) {
          console.warn(`[Gemini API] Model ${model} hit rate limit or availability issue. Moving to next fallback model...`);
          break;
        }
        console.warn(`[Gemini API] Model ${model} encountered error. Trying next fallback model just in case...`);
        break;
      }
    }
  }
  throw lastError;
}
var { Pool } = import_pg.default;
var pool = null;
var activeDbSource = "NONE";
var dbConnectionErrorMsg = null;
var dbInitPromise = null;
var isRecreatingPool = false;
function triggerPoolRecreation() {
  if (isRecreatingPool) return;
  isRecreatingPool = true;
  console.log("[Database Recovery] Re-establishing database pool connection...");
  setTimeout(async () => {
    try {
      if (pool) {
        const oldPool = pool;
        pool = null;
        try {
          await oldPool.end();
        } catch (e) {
        }
      }
      dbInitPromise = determineAndInitPool();
      await dbInitPromise;
      console.log("[Database Recovery] Database pool re-established successfully!");
    } catch (recreateErr) {
      console.log("[Database Recovery] Pool re-establishment note:", recreateErr?.message || recreateErr);
    } finally {
      isRecreatingPool = false;
    }
  }, 100);
}
async function determineAndInitPool() {
  if (pool) {
    try {
      await pool.query("SELECT 1");
      console.log("Database Probe: Existing pool is active and healthy.");
      return;
    } catch (e) {
      console.warn("Database Probe: Existing pool check failed, recreating connection...");
      pool = null;
    }
  }
  const connectionTimeoutMillis = 1e4;
  const candidateConfigs = [];
  const socketHosts = /* @__PURE__ */ new Set();
  if (process.env.SQL_HOST) {
    socketHosts.add(process.env.SQL_HOST);
    if (process.env.SQL_HOST.startsWith("/app/cloudsql/")) {
      socketHosts.add(process.env.SQL_HOST.replace("/app/cloudsql/", "/cloudsql/"));
    } else if (process.env.SQL_HOST.startsWith("/cloudsql/")) {
      socketHosts.add("/app" + process.env.SQL_HOST);
    }
  }
  for (const baseDir of ["/cloudsql", "/app/cloudsql"]) {
    try {
      if (import_fs.default.existsSync(baseDir)) {
        const entries = import_fs.default.readdirSync(baseDir);
        for (const entry of entries) {
          socketHosts.add(import_path.default.join(baseDir, entry));
        }
      }
    } catch (e) {
    }
  }
  const dbNamesToTry = Array.from(new Set([
    process.env.SQL_DB_NAME,
    "cloud_sql_development_database",
    "cloud_sql_production_database"
  ].filter(Boolean)));
  for (const hostPath of socketHosts) {
    if (!hostPath.startsWith("/") || import_fs.default.existsSync(hostPath)) {
      for (const dbName of dbNamesToTry) {
        candidateConfigs.push({
          name: `SQL_HOST (${hostPath} -> ${dbName})`,
          config: {
            host: hostPath,
            user: process.env.SQL_USER || process.env.PGUSER,
            password: process.env.SQL_PASSWORD,
            database: dbName,
            max: 10,
            connectionTimeoutMillis,
            keepAlive: true,
            idleTimeoutMillis: 15e3
          }
        });
      }
    }
  }
  if (process.env.DATABASE_URL) {
    candidateConfigs.push({
      name: "DATABASE_URL",
      config: {
        connectionString: process.env.DATABASE_URL,
        max: 10,
        connectionTimeoutMillis,
        keepAlive: true,
        idleTimeoutMillis: 15e3
      }
    });
  }
  candidateConfigs.push({
    name: "Localhost TCP PostgreSQL",
    config: {
      host: "localhost",
      port: 5432,
      user: process.env.SQL_USER || process.env.PGUSER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME || "cloud_sql_production_database",
      max: 10,
      connectionTimeoutMillis: 2e3,
      keepAlive: true,
      idleTimeoutMillis: 15e3
    }
  });
  for (const candidate of candidateConfigs) {
    console.log(`Database Probe: Attempting connection via ${candidate.name}...`);
    const testPool = new Pool(candidate.config);
    testPool.on("error", (err) => {
      const msg = err?.message || String(err);
      if (msg.includes("terminated") || msg.includes("closed") || msg.includes("ECONNRESET") || msg.includes("socket") || msg.includes("EPIPE")) {
        console.log("[Database Notice] Idle connection reset by server:", msg);
        triggerPoolRecreation();
      } else {
        console.log("Idle pool notice:", msg);
      }
    });
    try {
      const testPromise = testPool.query("SELECT 1");
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("DB Timeout")), connectionTimeoutMillis));
      await Promise.race([testPromise, timeoutPromise]);
      pool = testPool;
      activeDbSource = candidate.name.startsWith("SQL_HOST") ? "SQL_HOST" : candidate.name;
      if (activeDbSource === "SQL_HOST") {
        isDbQuotaExceeded = false;
      }
      console.log(`Database Probe: Connection succeeded! Using ${candidate.name} as the exclusive cloud database.`);
      break;
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes("quota") || msg.includes("data transfer quota") || msg.includes("exceeded")) {
        isDbQuotaExceeded = true;
        console.warn(`Database Probe: Quota limit hit on ${candidate.name}. Switching seamlessly to local storage fallback.`);
      } else {
        console.warn(`Database Probe via ${candidate.name}: ${msg}`);
      }
      dbConnectionErrorMsg = `${candidate.name}: ${msg}`;
      try {
        await testPool.end();
      } catch (e) {
      }
    }
  }
  if (!pool) {
    activeDbSource = "NONE";
    if (isOnlineMode) {
      console.error("[Database Required] Cloud SQL/PostgreSQL is unavailable in ONLINE mode. Persistent writes will be blocked until the database reconnects.");
      return;
    }
    console.log("[Database Fallback Active] PostgreSQL unavailable. OFFLINE mode continues with local_store.json.");
    await ensureHydrated();
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_store (
        key VARCHAR(255) PRIMARY KEY,
        value JSONB
      );
    `);
    console.log(`PostgreSQL app_store table ready on ${activeDbSource}.`);
  } catch (err) {
    if (err.code === "42501") {
      console.log("No permission to create table, assuming it exists or will be created by migrations.");
    } else {
      console.error("PostgreSQL table init error:", err);
    }
  }
}
dbInitPromise = determineAndInitPool();
var LOCAL_STORE_FILE = import_path.default.join(process.cwd(), "local_store.json");
var localStoreCache = null;
var lastDbFetchTime = 0;
var isRestoring = false;
var isDbQuotaExceeded = false;
function handleDbError(context, err) {
  const msg = err?.message || String(err);
  if (msg.includes("quota") || msg.includes("data transfer quota") || msg.includes("exceeded")) {
    if (activeDbSource === "SQL_HOST") {
      console.warn(`[Database Quota Alert] Quota warning ignored because active DB source is Google Cloud SQL socket (${msg}).`);
      isDbQuotaExceeded = false;
    } else {
      if (!isDbQuotaExceeded) {
        isDbQuotaExceeded = true;
        console.warn(`[Database Quota Alert] PostgreSQL quota exceeded (${msg}). Switching to local store (local_store.json) seamlessly.`);
      }
    }
  } else {
    const isTransient = msg.includes("terminated") || msg.includes("closed") || msg.includes("ECONNRESET") || msg.includes("socket") || msg.includes("protocol") || msg.includes("timeout");
    if (isTransient) {
      console.warn(`[Database Connection Warning] ${context}: ${msg}. Recovering connection pool...`);
    } else {
      console.error(`${context}:`, err);
    }
    if (isTransient) {
      triggerPoolRecreation();
    }
  }
}
function autoRestoreFromBackup() {
  const backupFile = LOCAL_STORE_FILE + ".backup";
  if (import_fs.default.existsSync(backupFile)) {
    try {
      const rawBackup = import_fs.default.readFileSync(backupFile, "utf-8");
      const backupData = JSON.parse(decryptLocalStore(rawBackup));
      const hasData = backupData && (Array.isArray(backupData.students) && backupData.students.length > 0 || Array.isArray(backupData.teachers) && backupData.teachers.length > 0 || Array.isArray(backupData.classes) && backupData.classes.length > 0);
      if (hasData) {
        console.log("[Auto-Backup-Restore] Found healthy local_store.json.backup. Restoring to local_store.json.");
        import_fs.default.writeFileSync(LOCAL_STORE_FILE, rawBackup, "utf-8");
        localStoreCache = backupData;
        return true;
      }
    } catch (err) {
      console.error("[Auto-Backup-Restore] Failed to restore backup:", err.message);
      try {
        const corruptBackupFile = backupFile + ".corrupt_" + Date.now();
        import_fs.default.renameSync(backupFile, corruptBackupFile);
        console.warn(`[Auto-Backup-Restore] Corrupt backup file has been moved to ${corruptBackupFile} to prevent constant parse errors.`);
      } catch (renameErr) {
        console.error("[Auto-Backup-Restore] Failed to rename corrupt backup file:", renameErr.message);
      }
    }
  }
  return false;
}
function readLocalStore() {
  if (isOnlineMode) {
    if (!localStoreCache) localStoreCache = {};
    return localStoreCache;
  }
  if (localStoreCache) {
    return localStoreCache;
  }
  const backupFile = LOCAL_STORE_FILE + ".backup";
  if (import_fs.default.existsSync(LOCAL_STORE_FILE)) {
    try {
      const stats = import_fs.default.statSync(LOCAL_STORE_FILE);
      if (stats.size > 100) {
        const rawCheck = import_fs.default.readFileSync(LOCAL_STORE_FILE, "utf-8");
        const parsedCheck = JSON.parse(decryptLocalStore(rawCheck));
        const hasRichData = parsedCheck && (Array.isArray(parsedCheck.students) && parsedCheck.students.length > 0 || Array.isArray(parsedCheck.teachers) && parsedCheck.teachers.length > 0 || Array.isArray(parsedCheck.classes) && parsedCheck.classes.length > 0);
        if (hasRichData) {
          let shouldWriteBackup = false;
          if (!import_fs.default.existsSync(backupFile)) {
            shouldWriteBackup = true;
          } else {
            const bStats = import_fs.default.statSync(backupFile);
            if (bStats.size < stats.size - 100) {
              shouldWriteBackup = true;
            }
          }
          if (shouldWriteBackup) {
            console.log("[Auto-Backup] Creating safe local_store.json.backup from active local_store.json.");
            import_fs.default.copyFileSync(LOCAL_STORE_FILE, backupFile);
          }
        }
      }
    } catch (e) {
      console.error("[Auto-Backup] Failed to pre-check or create backup:", e.message);
    }
  }
  try {
    if (import_fs.default.existsSync(LOCAL_STORE_FILE)) {
      const raw = import_fs.default.readFileSync(LOCAL_STORE_FILE, "utf-8");
      if (raw.trim() === "") {
        if (autoRestoreFromBackup()) {
          return localStoreCache;
        }
        localStoreCache = {};
        return localStoreCache;
      }
      try {
        const parsed = JSON.parse(decryptLocalStore(raw));
        const hasData = parsed && (Array.isArray(parsed.students) && parsed.students.length > 0 || Array.isArray(parsed.teachers) && parsed.teachers.length > 0 || Array.isArray(parsed.classes) && parsed.classes.length > 0);
        if (!hasData) {
          if (autoRestoreFromBackup()) {
            return localStoreCache;
          }
        }
        localStoreCache = parsed;
        return localStoreCache;
      } catch (parseError) {
        console.error("CRITICAL ERROR: Failed to parse local_store.json:", parseError.message);
        try {
          const corruptBackup = LOCAL_STORE_FILE + ".corrupt";
          import_fs.default.renameSync(LOCAL_STORE_FILE, corruptBackup);
          console.warn(`Corrupt local_store.json has been backed up to ${corruptBackup} and reset.`);
        } catch (backupError) {
          console.error("Failed to backup corrupt local_store.json:", backupError.message);
        }
        if (autoRestoreFromBackup()) {
          return localStoreCache;
        }
        localStoreCache = {};
        return localStoreCache;
      }
    } else {
      if (autoRestoreFromBackup()) {
        return localStoreCache;
      }
    }
  } catch (e) {
    console.error("Error reading local store:", e);
    if (autoRestoreFromBackup()) {
      return localStoreCache;
    }
    localStoreCache = {};
    return localStoreCache;
  }
  localStoreCache = {};
  return localStoreCache;
}
var writeTimeout = null;
var lastWriteTime = 0;
var DISK_WRITE_THROTTLE_INTERVAL = 3e3;
function sanitizeStoreForDisk(store) {
  if (!store) return store;
  const safeStore = { ...store };
  delete safeStore["studentLivecamFrames"];
  return safeStore;
}
function executeWrite() {
  lastWriteTime = Date.now();
  const store = localStoreCache;
  if (!store) return;
  const cacheDir = import_path.default.join(process.cwd(), "node_modules", ".cache");
  if (!import_fs.default.existsSync(cacheDir)) {
    try {
      import_fs.default.mkdirSync(cacheDir, { recursive: true });
    } catch (_) {
    }
  }
  const tempFile = import_path.default.join(cacheDir, "local_store.json.tmp");
  const backupFile = LOCAL_STORE_FILE + ".backup";
  const hasData = store && (Array.isArray(store.students) && store.students.length > 0 || Array.isArray(store.teachers) && store.teachers.length > 0 || Array.isArray(store.classes) && store.classes.length > 0);
  try {
    const dataString = JSON.stringify(sanitizeStoreForDisk(store), null, 2);
    const encryptedData = encryptLocalStore(dataString);
    import_fs.default.writeFile(tempFile, encryptedData, "utf-8", (err) => {
      if (err) {
        console.error("[Disk-Write] Error writing temp local store:", err);
        return;
      }
      import_fs.default.rename(tempFile, LOCAL_STORE_FILE, (renameErr) => {
        if (renameErr) {
          console.error("[Disk-Write] Error renaming temp to active local store:", renameErr);
          return;
        }
        if (hasData) {
          import_fs.default.writeFile(backupFile, encryptedData, "utf-8", (backupErr) => {
            if (backupErr) {
              console.error("[Disk-Write] Failed to save backup copy:", backupErr.message);
            }
          });
        }
      });
    });
  } catch (e) {
    console.error("[Disk-Write] Error stringifying store in background:", e);
  }
}
function writeLocalStore(store) {
  localStoreCache = store;
  if (isOnlineMode) return;
  if (writeTimeout) {
    return;
  }
  const now = Date.now();
  const timeSinceLastWrite = now - lastWriteTime;
  if (timeSinceLastWrite >= DISK_WRITE_THROTTLE_INTERVAL) {
    executeWrite();
  } else {
    const delay = DISK_WRITE_THROTTLE_INTERVAL - timeSinceLastWrite;
    writeTimeout = setTimeout(() => {
      writeTimeout = null;
      executeWrite();
    }, delay);
  }
}
function flushAllPendingWrites() {
  if (isOnlineMode) return;
  console.log("[Shutdown] Flushing all pending writes to disk...");
  if (writeTimeout) {
    clearTimeout(writeTimeout);
    writeTimeout = null;
  }
  executeWriteSync();
}
function executeWriteSync() {
  if (isOnlineMode) return;
  const store = localStoreCache;
  if (!store) return;
  const cacheDir = import_path.default.join(process.cwd(), "node_modules", ".cache");
  if (!import_fs.default.existsSync(cacheDir)) {
    try {
      import_fs.default.mkdirSync(cacheDir, { recursive: true });
    } catch (_) {
    }
  }
  const tempFile = import_path.default.join(cacheDir, "local_store.json.tmp");
  const backupFile = LOCAL_STORE_FILE + ".backup";
  const hasData = store && (Array.isArray(store.students) && store.students.length > 0 || Array.isArray(store.teachers) && store.teachers.length > 0 || Array.isArray(store.classes) && store.classes.length > 0);
  try {
    const dataString = JSON.stringify(sanitizeStoreForDisk(store), null, 2);
    const encryptedData = encryptLocalStore(dataString);
    import_fs.default.writeFileSync(tempFile, encryptedData, "utf-8");
    import_fs.default.renameSync(tempFile, LOCAL_STORE_FILE);
    if (hasData) {
      import_fs.default.writeFileSync(backupFile, encryptedData, "utf-8");
    }
    console.log("[Shutdown] Successfully flushed all pending writes.");
  } catch (e) {
    console.error("[Shutdown] Error flushing pending writes:", e);
  }
}
var sseClients = [];
var wsClients = /* @__PURE__ */ new Map();
function broadcastStateUpdate(key, senderClientId) {
  const payload = JSON.stringify({ type: "state-update", key, senderClientId });
  sseClients = sseClients.filter((client) => {
    const res = client.res;
    try {
      if (res.writableEnded || res.destroyed || res.finished) return false;
      res.write(`data: ${payload}

`);
      if (typeof res.flush === "function") res.flush();
      return true;
    } catch {
      return false;
    }
  });
}
function broadcastExamEvent(event) {
  const eventTenant = (() => {
    if (event?.madrasahId) return String(event.madrasahId);
    if (event?.examId) {
      const ex = (exams || []).find((item) => String(item.id) === String(event.examId));
      if (ex?.madrasahId || ex?.tenant) return String(ex.madrasahId || ex.tenant);
    }
    if (event?.studentId) {
      const st = (students || []).find((item) => String(item.id) === String(event.studentId));
      if (st?.madrasahId || st?.tenant) return String(st.madrasahId || st.tenant);
    }
    return "";
  })();
  const payload = JSON.stringify(event);
  sseClients = sseClients.filter((client) => {
    const res = client.res;
    const user = client.user || {};
    try {
      if (res.writableEnded || res.destroyed || res.finished) return false;
      const role = String(user.role || "").toLowerCase();
      const isBoss = role === "bos" || role === "superadmin";
      const isStudent = ["student", "siswa", "class_leader", "ketua_kelas"].includes(role);
      if (!isBoss && eventTenant && String(user.madrasahId || "default") !== eventTenant) return true;
      if (!isBoss && !eventTenant && !isStudent) return true;
      if (isStudent && String(event?.studentId || "") !== String(user.id || "")) return true;
      res.write(`data: ${payload}

`);
      if (typeof res.flush === "function") res.flush();
      return true;
    } catch {
      return false;
    }
  });
}
function getJakartaTodayDateStr() {
  const d = /* @__PURE__ */ new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 6e4;
  const jakartaTime = new Date(utc + 36e5 * 7);
  const year = jakartaTime.getFullYear();
  const month = String(jakartaTime.getMonth() + 1).padStart(2, "0");
  const day = String(jakartaTime.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function getJakartaIsoString() {
  const d = /* @__PURE__ */ new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 6e4;
  const jakartaTime = new Date(utc + 36e5 * 7);
  return jakartaTime.toISOString();
}
function mergeArrays(existing, incoming, key) {
  if (!Array.isArray(existing)) return incoming;
  if (!Array.isArray(incoming)) return incoming;
  let idField = "id";
  if (key === "students") idField = "nis";
  else if (key === "teachers") idField = "nip";
  const existingMap = /* @__PURE__ */ new Map();
  existing.forEach((item) => {
    if (item && typeof item === "object") {
      const idVal = item[idField] || item["id"];
      if (idVal !== void 0) {
        existingMap.set(String(idVal), item);
      }
    }
  });
  incoming.forEach((item) => {
    if (item && typeof item === "object") {
      const idVal = item[idField] || item["id"];
      if (idVal !== void 0) {
        existingMap.set(String(idVal), item);
      }
    }
  });
  return Array.from(existingMap.values());
}
function partitionAndSaveKey(key, value) {
  const active = [];
  const archives = {};
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1e3;
  for (const item of value) {
    if (!item) continue;
    let itemDateMs = Date.now();
    let itemYearMonth = "";
    try {
      if (key === "attendance" || key === "teacherAttendance") {
        if (item.date) {
          const d = new Date(item.date);
          itemDateMs = d.getTime();
          if (!isNaN(itemDateMs)) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, "0");
            itemYearMonth = `${year}_${month}`;
          }
        }
      } else if (key === "chats") {
        if (item.timestamp) {
          const d = new Date(typeof item.timestamp === "number" ? item.timestamp : item.timestamp);
          itemDateMs = d.getTime();
          if (!isNaN(itemDateMs)) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, "0");
            itemYearMonth = `${year}_${month}`;
          }
        }
      }
    } catch (e) {
    }
    if (itemDateMs < ninetyDaysAgo && itemYearMonth) {
      const archiveKey = `${key}_archive_${itemYearMonth}`;
      if (!archives[archiveKey]) {
        archives[archiveKey] = [];
      }
      archives[archiveKey].push(item);
    } else {
      active.push(item);
    }
  }
  return { active, archives };
}
async function writeKeyToPostgresDirect(key) {
  if (dbWriteTimeouts.has(key)) {
    const timeout = dbWriteTimeouts.get(key);
    if (timeout) clearTimeout(timeout);
    dbWriteTimeouts.delete(key);
  }
  lastDbWriteTimes.set(key, Date.now());
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let client = null;
    let clientError = null;
    try {
      if (dbInitPromise) await dbInitPromise;
      if (!pool || isDbQuotaExceeded) return;
      const freshValue = getMemoryKeyValue(key);
      if (freshValue === void 0) return;
      try {
        client = await pool.connect();
        await client.query("BEGIN");
        if (Array.isArray(freshValue) && (key === "attendance" || key === "teacherAttendance" || key === "chats")) {
          const { active, archives } = partitionAndSaveKey(key, freshValue);
          await client.query(`
            INSERT INTO app_store (key, value) VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
          `, [key, JSON.stringify(active)]);
          for (const [archiveKey, archiveItems] of Object.entries(archives)) {
            await client.query(`
              INSERT INTO app_store (key, value) VALUES ($1, $2)
              ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
            `, [archiveKey, JSON.stringify(archiveItems)]);
          }
        } else {
          await client.query(`
            INSERT INTO app_store (key, value) VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
          `, [key, JSON.stringify(freshValue)]);
        }
        await client.query("COMMIT");
        return;
      } catch (err) {
        clientError = err;
        if (client) {
          try {
            await client.query("ROLLBACK");
          } catch (rb) {
          }
        }
        throw err;
      } finally {
        if (client) {
          try {
            client.release(clientError);
          } catch (rel) {
          }
        }
      }
    } catch (e) {
      const msg = e?.message || String(e);
      const isTransient = msg.includes("terminated") || msg.includes("closed") || msg.includes("timeout") || msg.includes("ECONNRESET") || msg.includes("socket");
      if (isTransient && attempt < maxAttempts) {
        console.log(`[Database Auto-Retry] Re-establishing connection pool for "${key}" (Attempt ${attempt}/${maxAttempts}: ${msg})...`);
        triggerPoolRecreation();
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
      handleDbError(`Save data error for ${key}`, e);
      if (isOnlineMode) throw e;
      break;
    }
  }
}
function scheduleDbWrite(key) {
  if (dbWriteTimeouts.has(key)) {
    return;
  }
  const now = Date.now();
  const lastWrite = lastDbWriteTimes.get(key) || 0;
  const timeSinceLastWrite = now - lastWrite;
  if (timeSinceLastWrite >= DB_WRITE_THROTTLE_INTERVAL) {
    void writeKeyToPostgresDirect(key).catch((err) => console.error(`[Database Scheduled Write] ${key}:`, err));
  } else {
    const delay = DB_WRITE_THROTTLE_INTERVAL - timeSinceLastWrite;
    const timeout = setTimeout(() => {
      void writeKeyToPostgresDirect(key).catch((err) => console.error(`[Database Scheduled Write] ${key}:`, err));
    }, delay);
    dbWriteTimeouts.set(key, timeout);
  }
}
async function saveData(key, value, immediate = true) {
  if (isOnlineMode && !isRestoring) {
    if (dbInitPromise) await dbInitPromise;
    if (!pool || isDbQuotaExceeded) {
      throw new Error(`ONLINE_DATABASE_UNAVAILABLE: cannot persist ${key}`);
    }
  }
  if (key === "madrasahs" && Array.isArray(value)) {
    for (const m of value) {
      if (m.tokenSignatureInvalid) continue;
      m.tokenSignature = calculateTokenSignature(m.id, m.cbtTokenBalance || 0);
    }
  }
  updateMemoryKey(key, value);
  try {
    const store = readLocalStore();
    store[key] = value;
    if (key === "madrasahs") writeLocalStore(store);
  } catch (e) {
  }
  if (isRestoring) {
    return;
  }
  lastDbFetchTime = Date.now();
  try {
    broadcastStateUpdate(key);
  } catch (e) {
    console.error(`Broadcast state update error for ${key}:`, e);
  }
  if (db) {
    saveKeyToFirestore(key, value).catch((err) => {
      console.error(`[Firestore Backup] Error backing up "${key}" to Firestore:`, err);
    });
  }
  if (pool && !isDbQuotaExceeded) {
    if (immediate) {
      await writeKeyToPostgresDirect(key);
    } else {
      scheduleDbWrite(key);
    }
  }
}
async function saveDataBatch(items, immediate = true) {
  if (isOnlineMode && !isRestoring) {
    if (dbInitPromise) await dbInitPromise;
    if (!pool || isDbQuotaExceeded) {
      throw new Error("ONLINE_DATABASE_UNAVAILABLE: cannot persist batch");
    }
  }
  for (const item of items) {
    updateMemoryKey(item.key, item.value);
  }
  try {
    const store = readLocalStore();
    for (const item of items) {
      store[item.key] = item.value;
    }
    writeLocalStore(store);
  } catch (e) {
    console.error("Skipping write to local_store.json for batch update:", e);
  }
  lastDbFetchTime = Date.now();
  try {
    items.forEach((item) => {
      broadcastStateUpdate(item.key);
    });
  } catch (e) {
    console.error("Broadcast state batch update error:", e);
  }
  if (db) {
    for (const item of items) {
      saveKeyToFirestore(item.key, item.value).catch((err) => {
        console.error(`[Firestore Backup] Batch error backing up "${item.key}" to Firestore:`, err);
      });
    }
  }
  if (pool && !isDbQuotaExceeded) {
    if (immediate) {
      for (const item of items) {
        await writeKeyToPostgresDirect(item.key);
      }
    } else {
      for (const item of items) {
        scheduleDbWrite(item.key);
      }
    }
  }
}
async function flushPendingDbWrites() {
  console.log("[Graceful Shutdown] Flushing all pending database writes...");
  const keys = Array.from(dbWriteTimeouts.keys());
  const writePromises = keys.map(async (key) => {
    const timeout = dbWriteTimeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
    }
    dbWriteTimeouts.delete(key);
    try {
      if (!pool || isDbQuotaExceeded) return;
      const freshValue = getMemoryKeyValue(key);
      if (freshValue === void 0) return;
      let client = await pool.connect();
      try {
        await client.query("BEGIN");
        if (Array.isArray(freshValue) && (key === "attendance" || key === "teacherAttendance" || key === "chats")) {
          const { active, archives } = partitionAndSaveKey(key, freshValue);
          await client.query(`
            INSERT INTO app_store (key, value) VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
          `, [key, JSON.stringify(active)]);
          for (const [archiveKey, archiveItems] of Object.entries(archives)) {
            await client.query(`
              INSERT INTO app_store (key, value) VALUES ($1, $2)
              ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
            `, [archiveKey, JSON.stringify(archiveItems)]);
          }
        } else {
          await client.query(`
            INSERT INTO app_store (key, value) VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
          `, [key, JSON.stringify(freshValue)]);
        }
        await client.query("COMMIT");
        console.log(`[Graceful Shutdown] Flushed key "${key}" to PostgreSQL.`);
      } catch (err) {
        if (client) {
          try {
            await client.query("ROLLBACK");
          } catch (rb) {
          }
        }
        console.error(`[Graceful Shutdown] Failed to flush key "${key}":`, err);
      } finally {
        if (client) {
          try {
            client.release();
          } catch (rel) {
          }
        }
      }
    } catch (e) {
      console.error(`[Graceful Shutdown] Error writing ${key} during shutdown:`, e);
    }
  });
  await Promise.all(writePromises);
  console.log("[Graceful Shutdown] All pending database writes flushed successfully.");
}
var isShuttingDown = false;
async function handleGracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[Graceful Shutdown] Received ${signal}. Preparing to shut down server...`);
  if (isOfflineMode) flushAllPendingWrites();
  await flushPendingDbWrites();
  if (pool) {
    try {
      await pool.end();
      console.log("[Graceful Shutdown] PostgreSQL pool ended.");
    } catch (e) {
      console.error("[Graceful Shutdown] Error ending pool:", e);
    }
  }
  console.log("[Graceful Shutdown] Server is safe to exit.");
  process.exit(0);
}
process.on("SIGTERM", () => handleGracefulShutdown("SIGTERM"));
process.on("SIGINT", () => handleGracefulShutdown("SIGINT"));
function updateMemoryKey(key, value) {
  if (key === "schoolLocationSettings") schoolLocationSettings = value;
  else if (key === "classes") classes = value;
  else if (key === "subjects") subjects = value;
  else if (key === "teachers") teachers = value;
  else if (key === "students") students = value;
  else if (key === "attendance") attendance = value;
  else if (key === "teacherAttendance") teacherAttendance = value;
  else if (key === "questionBankGroups") questionBankGroups = value;
  else if (key === "questions") questions = value;
  else if (key === "grades") grades = value;
  else if (key === "chats") chats = value;
  else if (key === "exams") exams = value;
  else if (key === "lkpdList") lkpdList = value;
  else if (key === "rooms") rooms = value;
  else if (key === "schedules") schedules = value;
  else if (key === "savedRosters") savedRosters = value;
  else if (key === "timeSlots") timeSlots = value;
  else if (key === "kbmDuration") kbmDuration = value;
  else if (key === "journals") journals = value;
  else if (key === "gradeCategories") gradeCategories = value;
  else if (key === "customGradeColumns") customGradeColumns = value;
  else if (key === "calendarEvents") calendarEvents = value;
  else if (key === "generatedExams") generatedExams = value;
  else if (key === "lessonPlans") lessonPlans = value;
  else if (key === "activeExamSessions") activeExamSessions = value;
  else if (key === "completedExams") completedExams = value;
  else if (key === "forceFinishedExams") forceFinishedExams = value;
  else if (key === "studentExamAnswers") studentExamAnswers = value;
  else if (key === "studentExamQuestions") studentExamQuestions = value;
  else if (key === "studentExamMasterQuestions") studentExamMasterQuestions = value;
  else if (key === "studentExamGrades") studentExamGrades = value;
  else if (key === "studentTabSwitches") studentTabSwitches = value;
  else if (key === "studentOutOfTab") studentOutOfTab = value;
  else if (key === "blockedStudents") blockedStudents = value;
  else if (key === "examMessages") examMessages = value;
  else if (key === "examViolationLogs") examViolationLogs = value;
  else if (key === "settings") appSettings = value;
  else if (key === "childguardRules") childguardRules = value;
  else if (key === "childguardLogs") childguardLogs = value;
  else if (key === "childguardLocations") childguardLocations = value;
  else if (key === "childguardStatus") childguardStatus = value;
  else if (key === "importGroups") importGroups = value;
  else if (key === "photoCloudinaryMap") photoCloudinaryMap = value;
  else if (key === "eduGames") eduGames = value;
  else if (key === "gameAttempts") gameAttempts = value;
  else if (key === "madrasahs") madrasahs = value;
  else if (key === "tokenRequests") tokenRequests = value;
  else if (key === "usedActivationKeys") usedActivationKeys = value;
}
function getMemoryKeyValue(key) {
  if (key === "schoolLocationSettings") return schoolLocationSettings;
  if (key === "classes") return classes;
  if (key === "subjects") return subjects;
  if (key === "teachers") return teachers;
  if (key === "students") return students;
  if (key === "attendance") return attendance;
  if (key === "teacherAttendance") return teacherAttendance;
  if (key === "questionBankGroups") return questionBankGroups;
  if (key === "questions") return questions;
  if (key === "grades") return grades;
  if (key === "chats") return chats;
  if (key === "exams") return exams;
  if (key === "lkpdList") return lkpdList;
  if (key === "rooms") return rooms;
  if (key === "schedules") return schedules;
  if (key === "savedRosters") return savedRosters;
  if (key === "timeSlots") return timeSlots;
  if (key === "kbmDuration") return kbmDuration;
  if (key === "journals") return journals;
  if (key === "gradeCategories") return gradeCategories;
  if (key === "customGradeColumns") return customGradeColumns;
  if (key === "calendarEvents") return calendarEvents;
  if (key === "generatedExams") return generatedExams;
  if (key === "lessonPlans") return lessonPlans;
  if (key === "activeExamSessions") return activeExamSessions;
  if (key === "completedExams") return completedExams;
  if (key === "forceFinishedExams") return forceFinishedExams;
  if (key === "studentExamAnswers") return studentExamAnswers;
  if (key === "studentExamQuestions") return studentExamQuestions;
  if (key === "studentExamMasterQuestions") return studentExamMasterQuestions;
  if (key === "studentExamGrades") return studentExamGrades;
  if (key === "studentTabSwitches") return studentTabSwitches;
  if (key === "studentOutOfTab") return studentOutOfTab;
  if (key === "blockedStudents") return blockedStudents;
  if (key === "examMessages") return examMessages;
  if (key === "examViolationLogs") return examViolationLogs;
  if (key === "settings") return appSettings;
  if (key === "childguardRules") return childguardRules;
  if (key === "childguardLogs") return childguardLogs;
  if (key === "childguardLocations") return childguardLocations;
  if (key === "childguardStatus") return childguardStatus;
  if (key === "importGroups") return importGroups;
  if (key === "photoCloudinaryMap") return photoCloudinaryMap;
  if (key === "eduGames") return eduGames;
  if (key === "gameAttempts") return gameAttempts;
  if (key === "madrasahs") return madrasahs;
  if (key === "tokenRequests") return tokenRequests;
  if (key === "usedActivationKeys") return usedActivationKeys;
  return void 0;
}
async function updateStoreKeyWithLock(key, updateFn) {
  if (isOnlineMode) {
    if (dbInitPromise) await dbInitPromise;
    if (!pool || isDbQuotaExceeded) {
      throw new Error(`ONLINE_DATABASE_UNAVAILABLE: cannot persist ${key}`);
    }
  }
  let currentVal = getMemoryKeyValue(key);
  if (currentVal === void 0) {
    try {
      const store = readLocalStore();
      currentVal = store[key];
    } catch (e) {
    }
  }
  if (currentVal === void 0) {
    currentVal = [];
  }
  const newVal = updateFn(currentVal);
  updateMemoryKey(key, newVal);
  try {
    const store = readLocalStore();
    store[key] = newVal;
    writeLocalStore(store);
  } catch (e) {
  }
  try {
    broadcastStateUpdate(key);
  } catch (e) {
  }
  if (pool && !isDbQuotaExceeded) {
    scheduleDbWrite(key);
  }
  return newVal;
}
var app = (0, import_express.default)();
var appExport = app;
var server_default = app;
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
if (isOnlineMode) app.set("trust proxy", 1);
app.use(async (req, res, next) => {
  if (!isOnlineMode || !req.path.startsWith("/api/")) return next();
  const method = String(req.method || "GET").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return next();
  const allowedWithoutDb = /* @__PURE__ */ new Set([
    "/api/login",
    "/api/check-connection",
    "/api/db-test-connection"
  ]);
  if (allowedWithoutDb.has(req.path)) return next();
  try {
    if (dbInitPromise) await dbInitPromise;
  } catch (_) {
  }
  if (!pool || isDbQuotaExceeded) {
    return res.status(503).json({
      success: false,
      code: "ONLINE_DATABASE_UNAVAILABLE",
      message: "Cloud SQL sedang tidak tersedia. Data tidak disimpan ke filesystem sementara Cloud Run; silakan coba lagi setelah koneksi database pulih."
    });
  }
  next();
});
app.use((0, import_compression.default)({
  threshold: 512,
  filter: (req, res) => {
    if (req.headers["x-no-compression"]) {
      return false;
    }
    return import_compression.default.filter(req, res);
  }
}));
var configuredAllowedOrigins = new Set(
  String(process.env.ALLOWED_ORIGINS || "").split(",").map((v) => v.trim()).filter(Boolean)
);
app.use((req, res, next) => {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const effectiveProto = forwardedProto || req.protocol || (isOnlineMode ? "https" : "http");
  const selfOrigin = req.headers.host ? `${effectiveProto}://${req.headers.host}` : "";
  const originAllowed = !origin || origin === selfOrigin || configuredAllowedOrigins.has(origin);
  if (isOnlineMode) {
    if (origin && originAllowed) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Auth-Token, X-Madrasah-Id, X-User-Id, X-User-Role");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(self)");
  if (isOnlineMode) {
    const frameAncestors = String(process.env.ALLOWED_FRAME_ANCESTORS || "'self'").trim();
    res.setHeader("Content-Security-Policy", `frame-ancestors ${frameAncestors}`);
    if (!process.env.ALLOWED_FRAME_ANCESTORS) {
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
    } else {
      res.removeHeader("X-Frame-Options");
    }
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  } else {
    res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
  }
  if (req.method === "OPTIONS") {
    if (isOnlineMode && origin && !originAllowed) {
      return res.status(403).end();
    }
    return res.status(204).end();
  }
  next();
});
var requestBodyLimit = isOnlineMode ? "25mb" : "50mb";
app.use(import_express.default.json({ limit: requestBodyLimit }));
app.use(import_express.default.urlencoded({ extended: true, limit: requestBodyLimit }));
var apiRateBuckets = /* @__PURE__ */ new Map();
function enforceApiRateLimit(req, res, bucket, limit, windowMs) {
  const now = Date.now();
  const ip = String(req.ip || req.socket?.remoteAddress || "unknown");
  const key = `${bucket}:${ip}`;
  let item = apiRateBuckets.get(key);
  if (!item || item.resetAt <= now) {
    item = { count: 0, resetAt: now + windowMs };
    apiRateBuckets.set(key, item);
  }
  item.count += 1;
  if (item.count > limit) {
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil((item.resetAt - now) / 1e3))));
    res.status(429).json({ success: false, message: "Terlalu banyak permintaan. Silakan coba lagi beberapa saat." });
    return false;
  }
  return true;
}
var staffRoles = /* @__PURE__ */ new Set(["teacher", "guru", "admin", "bos", "superadmin"]);
var adminRoles = /* @__PURE__ */ new Set(["admin", "bos", "superadmin"]);
var bossRoles = /* @__PURE__ */ new Set(["bos", "superadmin"]);
var staffWritePrefixes = [
  "/api/teachers",
  "/api/students",
  "/api/classes",
  "/api/subjects",
  "/api/teacher-attendance",
  "/api/question-bank-groups",
  "/api/questions",
  "/api/grades",
  "/api/time-slots",
  "/api/grade-categories",
  "/api/system-settings",
  "/api/lesson-plans",
  "/api/schedules",
  "/api/rooms",
  "/api/journals",
  "/api/calendar-events",
  "/api/generated-exams"
];
var staffOnlyPrefixes = [
  "/api/teacher-attendance",
  "/api/question-bank-groups",
  "/api/journals",
  "/api/lesson-plans",
  "/api/generated-exams"
];
app.use((req, res, next) => {
  if (!req.path.startsWith("/api/")) return next();
  const method = String(req.method || "GET").toUpperCase();
  const p = String(req.path || "");
  if (method === "OPTIONS") return next();
  const publicApi = method === "POST" && p === "/api/login" || method === "POST" && p === "/api/register-madrasah" || method === "GET" && p === "/api/settings" || method === "GET" && p === "/api/health" || method === "GET" && p.startsWith("/api/madrasah-by-slug/") || method === "GET" && p.startsWith("/api/photos/");
  if (publicApi) {
    if (method === "POST" && p === "/api/login") {
      const username = String(req.body?.username || "").trim().toLowerCase().slice(0, 128) || "unknown";
      const limit = isOnlineMode ? 12 : 120;
      if (!enforceApiRateLimit(req, res, `login:${username}`, limit, 10 * 60 * 1e3)) return;
    }
    if (method === "POST" && p === "/api/register-madrasah") {
      const limit = isOnlineMode ? 8 : 80;
      if (!enforceApiRateLimit(req, res, "register", limit, 60 * 60 * 1e3)) return;
    }
    return next();
  }
  if (p === "/api/realtime-stream") {
    const realtimeUser = verifyRealtimeToken(String(req.query?.rt || ""));
    if (!realtimeUser) {
      return res.status(401).json({ success: false, message: "Realtime access ticket tidak sah atau kedaluwarsa." });
    }
    req.user = realtimeUser;
    return next();
  }
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  req.user = authUser;
  const role = String(authUser.role || "").toLowerCase();
  if (p.startsWith("/api/boss/") && !bossRoles.has(role)) {
    return res.status(403).json({ success: false, message: "Akses khusus BOSS." });
  }
  const adminOnly = p === "/api/db-status" || p.startsWith("/api/system/backup") || p.startsWith("/api/system/restore") || p === "/api/settings" && method !== "GET";
  if (adminOnly && !adminRoles.has(role)) {
    return res.status(403).json({ success: false, message: "Akses hanya untuk administrator." });
  }
  if (staffOnlyPrefixes.some((prefix) => p.startsWith(prefix)) && !staffRoles.has(role)) {
    return res.status(403).json({ success: false, message: "Akses hanya untuk guru atau administrator." });
  }
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const exactStaffWrite = p === "/api/exams" || p === "/api/lkpds" || p === "/api/games";
  if (isMutation && (exactStaffWrite || staffWritePrefixes.some((prefix) => p.startsWith(prefix))) && !staffRoles.has(role)) {
    return res.status(403).json({ success: false, message: "Aksi ini hanya dapat dilakukan guru atau administrator." });
  }
  if (p === "/api/realtime-token") {
    if (!enforceApiRateLimit(req, res, `realtime:${authUser.id}`, 120, 10 * 60 * 1e3)) return;
  }
  if (p === "/api/boss/generate-activation-key") {
    if (!enforceApiRateLimit(req, res, `activation:${authUser.id}`, 60, 60 * 1e3)) return;
  }
  next();
});
app.get("/api/realtime-token", (req, res) => {
  const authUser = req.user || getAuthUser(req);
  if (!authUser) return res.status(401).json({ success: false, message: "Belum login." });
  res.setHeader("Cache-Control", "no-store");
  res.json({ success: true, token: createRealtimeToken(authUser), expiresIn: 600 });
});
if (isOfflineMode) app.use("/uploads", import_express.default.static(uploadsDir));
app.get("/update_offline.zip", (req, res) => {
  const filePath = import_path.default.join(process.cwd(), "update_offline.zip");
  if (import_fs.default.existsSync(filePath)) {
    res.setHeader("Content-Disposition", "attachment; filename=update_offline.zip");
    res.setHeader("Content-Type", "application/zip");
    return res.sendFile(filePath);
  } else {
    return res.status(404).send("File update_offline.zip belum dibuat atau masih dalam proses pembuatan. Silakan coba sesaat lagi.");
  }
});
app.get("/api/photos/:id", async (req, res) => {
  const photoId = req.params.id;
  const localFile = import_path.default.join(uploadsDir, photoId);
  if (isOfflineMode && import_fs.default.existsSync(localFile)) {
    try {
      const fileBuf = import_fs.default.readFileSync(localFile);
      const strHeader = fileBuf.subarray(0, 50).toString("utf8");
      if (strHeader.startsWith("data:image/")) {
        const fullStr = fileBuf.toString("utf8");
        const matches = fullStr.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          res.setHeader("Content-Type", matches[1]);
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          return res.send(Buffer.from(matches[2], "base64"));
        }
      }
      if (fileBuf[0] === 255 && fileBuf[1] === 216) res.setHeader("Content-Type", "image/jpeg");
      else if (fileBuf[0] === 137 && fileBuf[1] === 80 && fileBuf[2] === 78 && fileBuf[3] === 71) res.setHeader("Content-Type", "image/png");
      else if (fileBuf[0] === 82 && fileBuf[1] === 73 && fileBuf[2] === 70 && fileBuf[3] === 70) res.setHeader("Content-Type", "image/webp");
      else res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.send(fileBuf);
    } catch (_) {
    }
  }
  if (isOfflineMode && db) {
    try {
      const snap = await (0, import_firestore.getDoc)((0, import_firestore.doc)(db, "photos", photoId));
      if (snap.exists()) {
        const data = snap.data().data;
        const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) return res.send(data);
        const buffer = Buffer.from(matches[2], "base64");
        res.setHeader("Content-Type", matches[1]);
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return res.send(buffer);
      }
    } catch (err) {
      console.warn(`[Photo Storage] Firestore fallback read error for ${photoId}:`, err?.message || err);
    }
  }
  const normalizedId = normalizeCloudinaryPhotoId(photoId);
  let cUrl = photoCloudinaryMap[photoId] || photoCloudinaryMap[normalizedId] || photoCloudinaryMap[`madrasah_photos/${normalizedId}`];
  if (!cUrl && process.env.CLOUDINARY_CLOUD_NAME) {
    try {
      const remote = await import_cloudinary.v2.api.resource(`madrasah_photos/${normalizedId}`, { resource_type: "image" });
      cUrl = remote?.secure_url || remote?.url || null;
      if (cUrl) {
        photoCloudinaryMap[photoId] = cUrl;
        photoCloudinaryMap[normalizedId] = cUrl;
        photoCloudinaryMap[`madrasah_photos/${normalizedId}`] = cUrl;
        saveData("photoCloudinaryMap", photoCloudinaryMap, false).catch(() => {
        });
      }
    } catch (_) {
      cUrl = null;
      delete photoCloudinaryMap[photoId];
      delete photoCloudinaryMap[normalizedId];
      delete photoCloudinaryMap[`madrasah_photos/${normalizedId}`];
    }
  }
  if (cUrl) {
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.redirect(302, cUrl);
  }
  const svgPlaceholder = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f1f5f9"/><path d="M50 42a12 12 0 1 0 0-24 12 12 0 0 0 0 24zm0 8c-16 0-28 10-28 22v2h56v-2c0-12-12-22-28-22z" fill="#cbd5e1"/></svg>`;
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.status(200).send(svgPlaceholder);
});
var bootStore = isOnlineMode ? {} : readLocalStore();
photoCloudinaryMap = bootStore["photoCloudinaryMap"] || {};
var schoolLocationSettings = bootStore["schoolLocationSettings"] || {
  schoolLatitude: -6.2,
  schoolLongitude: 106.8166,
  geofenceRadius: 100
};
var classes = bootStore["classes"] || [];
var subjects = bootStore["subjects"] || [];
var teachers = bootStore["teachers"] || [];
var students = bootStore["students"] || [];
var attendance = bootStore["attendance"] || [];
var teacherAttendance = bootStore["teacherAttendance"] || [];
var questionBankGroups = bootStore["questionBankGroups"] || [];
var questions = bootStore["questions"] || [];
var grades = bootStore["grades"] || [];
var chats = bootStore["chats"] || [];
var exams = bootStore["exams"] || [];
var lkpdList = bootStore["lkpdList"] || [];
var rooms = bootStore["rooms"] || [];
var schedules = bootStore["schedules"] || [];
var savedRosters = bootStore["savedRosters"] || [];
var timeSlots = bootStore["timeSlots"] || [];
var kbmDuration = bootStore["kbmDuration"] || 40;
var journals = bootStore["journals"] || [];
var gradeCategories = bootStore["gradeCategories"] || [];
var customGradeColumns = bootStore["customGradeColumns"] || {};
var calendarEvents = bootStore["calendarEvents"] || [];
var generatedExams = bootStore["generatedExams"] || [];
var activeExamSessions = bootStore["activeExamSessions"] || {};
var completedExams = bootStore["completedExams"] || {};
var forceFinishedExams = bootStore["forceFinishedExams"] || {};
var studentExamAnswers = bootStore["studentExamAnswers"] || {};
var studentExamQuestions = bootStore["studentExamQuestions"] || {};
var studentExamMasterQuestions = bootStore["studentExamMasterQuestions"] || {};
var studentTabSwitches = bootStore["studentTabSwitches"] || {};
var studentOutOfTab = bootStore["studentOutOfTab"] || {};
var blockedStudents = bootStore["blockedStudents"] || {};
var studentLivecamFrames = bootStore["studentLivecamFrames"] || {};
var studentExamGrades = bootStore["studentExamGrades"] || {};
var examMessages = bootStore["examMessages"] || {};
var examViolationLogs = bootStore["examViolationLogs"] || {};
var importGroups = bootStore["importGroups"] || [];
var eduGames = bootStore["eduGames"] || [];
var gameAttempts = bootStore["gameAttempts"] || [];
var childguardRules = bootStore["childguardRules"] || {};
var childguardLogs = bootStore["childguardLogs"] || [];
var childguardLocations = bootStore["childguardLocations"] || {};
var childguardStatus = bootStore["childguardStatus"] || {};
var appSettings = bootStore["settings"] || {
  schoolName: "Madrasah Bisa",
  adminName: "Administrator",
  adminUser: "admin",
  adminPass: "admin123",
  radius: 100,
  accuracy: 10,
  theme: "emerald",
  showDemo: true,
  useHttps: false,
  paymentAccounts: [
    { id: "1", name: "ShopeePay", number: "081234567890", owner: "BOS PLATFORM" },
    { id: "2", name: "DANA", number: "081234567890", owner: "BOS PLATFORM" },
    { id: "3", name: "Bank BRI", number: "0123-01-098765-50-1", owner: "BOS PLATFORM" },
    { id: "4", name: "Bank Mandiri", number: "130-00-9876543-2", owner: "BOS PLATFORM" }
  ]
};
if (!appSettings.paymentAccounts) {
  appSettings.paymentAccounts = [
    { id: "1", name: "ShopeePay", number: "081234567890", owner: "BOS PLATFORM" },
    { id: "2", name: "DANA", number: "081234567890", owner: "BOS PLATFORM" },
    { id: "3", name: "Bank BRI", number: "0123-01-098765-50-1", owner: "BOS PLATFORM" },
    { id: "4", name: "Bank Mandiri", number: "130-00-9876543-2", owner: "BOS PLATFORM" }
  ];
}
var madrasahs = bootStore["madrasahs"] || [
  {
    id: "default",
    name: bootStore["settings"] && bootStore["settings"].schoolName || "Madrasah Utama",
    slug: "default",
    level: "MA",
    adminName: bootStore["settings"] && bootStore["settings"].adminName || "Administrator",
    adminUser: bootStore["settings"] && bootStore["settings"].adminUser || "admin",
    adminPass: "",
    phone: "081234567890",
    cbtTokenBalance: 0,
    isActive: false,
    requiresSetup: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  }
];
var tokenRequests = bootStore["tokenRequests"] || [];
var usedActivationKeys = bootStore["usedActivationKeys"] || [];
var cbtTokenPrice = bootStore["settings"] && bootStore["settings"].cbtTokenPrice || 5e3;
async function runOneTimeMigrations() {
  let studentsChanged = false;
  let madrasahsChanged = false;
  let settingsChanged = false;
  if (Array.isArray(students)) {
    students.forEach((s) => {
      if (s && Object.prototype.hasOwnProperty.call(s, "passwordRaw")) {
        delete s.passwordRaw;
        studentsChanged = true;
      }
    });
  }
  if (Array.isArray(madrasahs)) {
    madrasahs.forEach((m) => {
      if (m?.adminPass && !String(m.adminPass).startsWith("scrypt$") && !String(m.adminPass).startsWith("sha256$")) {
        m.adminPass = hashPassword(String(m.adminPass));
        madrasahsChanged = true;
      }
    });
  }
  if (appSettings?.adminPass && !String(appSettings.adminPass).startsWith("scrypt$") && !String(appSettings.adminPass).startsWith("sha256$")) {
    appSettings.adminPass = hashPassword(String(appSettings.adminPass));
    settingsChanged = true;
  }
  if (studentsChanged) await saveData("students", students);
  if (madrasahsChanged) await saveData("madrasahs", madrasahs);
  if (settingsChanged) await saveData("settings", appSettings);
}
function parseDbRows(rows) {
  const dbData = {};
  const parsedDeltas = {
    studentExamAnswers: {},
    studentExamQuestions: {},
    studentExamMasterQuestions: {},
    studentTabSwitches: {},
    studentOutOfTab: {},
    completedExams: {},
    forceFinishedExams: {},
    blockedStudents: {},
    activeExamSessions: {},
    studentExamGrades: {},
    examViolationLogs: {}
  };
  for (const row of rows) {
    let isDelta = false;
    for (const deltaKey of Object.keys(parsedDeltas)) {
      if (row.key.startsWith(`delta::${deltaKey}::`)) {
        const itemKey = row.key.substring(`delta::${deltaKey}::`.length);
        parsedDeltas[deltaKey][itemKey] = row.value;
        isDelta = true;
        break;
      }
    }
    if (!isDelta) {
      dbData[row.key] = row.value;
    }
  }
  for (const deltaKey of Object.keys(parsedDeltas)) {
    dbData[deltaKey] = { ...dbData[deltaKey] || {}, ...parsedDeltas[deltaKey] };
  }
  return dbData;
}
function applyExtendedDbState(dbData) {
  if (dbData["customGradeColumns"] !== void 0) customGradeColumns = dbData["customGradeColumns"];
  if (dbData["calendarEvents"] !== void 0) calendarEvents = dbData["calendarEvents"];
  if (dbData["studentExamMasterQuestions"] !== void 0) studentExamMasterQuestions = dbData["studentExamMasterQuestions"];
  if (dbData["examMessages"] !== void 0) examMessages = dbData["examMessages"];
  if (dbData["examViolationLogs"] !== void 0) examViolationLogs = dbData["examViolationLogs"];
  if (dbData["importGroups"] !== void 0) importGroups = dbData["importGroups"];
  if (dbData["eduGames"] !== void 0) eduGames = dbData["eduGames"];
  if (dbData["gameAttempts"] !== void 0) gameAttempts = dbData["gameAttempts"];
  if (dbData["photoCloudinaryMap"] !== void 0) photoCloudinaryMap = dbData["photoCloudinaryMap"] || {};
  if (dbData["madrasahs"] !== void 0) {
    madrasahs = dbData["madrasahs"];
    verifyAndLockMadrasahTokens();
  }
  if (dbData["tokenRequests"] !== void 0) tokenRequests = dbData["tokenRequests"];
  if (dbData["usedActivationKeys"] !== void 0) usedActivationKeys = dbData["usedActivationKeys"];
}
async function hydrate() {
  let store = {};
  if (isOfflineMode) {
    try {
      store = readLocalStore();
    } catch (e) {
      console.error("Failed to parse local_store.json during offline hydration. Falling back to clean memory state:", e);
      localStoreCache = {};
    }
  } else {
    localStoreCache = {};
  }
  if (db) {
    try {
      const firestoreStore = await loadStoreFromFirestore();
      if (Object.keys(firestoreStore).length > 0) {
        console.log(`[Firestore Restore] Restoring ${Object.keys(firestoreStore).length} keys to active local store...`);
        for (const [fKey, fVal] of Object.entries(firestoreStore)) {
          if (fKey === "attendance" && Array.isArray(fVal) && Array.isArray(store.attendance)) {
            const aMap = /* @__PURE__ */ new Map();
            store.attendance.forEach((a) => {
              if (a && (a.id || a.studentId)) aMap.set(String(a.id || `${a.studentId}_${a.date}_${a.subjectId || ""}`), a);
            });
            fVal.forEach((a) => {
              if (a && (a.id || a.studentId)) aMap.set(String(a.id || `${a.studentId}_${a.date}_${a.subjectId || ""}`), a);
            });
            store.attendance = Array.from(aMap.values());
          } else if (fKey === "studentExamGrades" && typeof fVal === "object" && fVal !== null) {
            store.studentExamGrades = { ...store.studentExamGrades || {}, ...fVal };
          } else if (fKey === "completedExams" && typeof fVal === "object" && fVal !== null) {
            store.completedExams = { ...store.completedExams || {}, ...fVal };
          } else if (fKey === "studentExamAnswers" && typeof fVal === "object" && fVal !== null) {
            store.studentExamAnswers = { ...store.studentExamAnswers || {}, ...fVal };
          } else {
            store[fKey] = fVal;
          }
        }
        writeLocalStore(store);
      }
    } catch (e) {
      console.error("[Firestore Restore] Failed to restore from Firestore:", e);
    }
  }
  if (store["schoolLocationSettings"] !== void 0) schoolLocationSettings = store["schoolLocationSettings"];
  if (store["classes"] !== void 0) classes = store["classes"];
  if (store["subjects"] !== void 0) subjects = store["subjects"];
  if (store["teachers"] !== void 0) teachers = store["teachers"];
  if (store["students"] !== void 0) students = store["students"];
  if (store["attendance"] !== void 0) attendance = store["attendance"];
  if (store["questionBankGroups"] !== void 0) questionBankGroups = store["questionBankGroups"];
  if (store["questions"] !== void 0) questions = store["questions"];
  if (store["grades"] !== void 0) grades = store["grades"];
  if (store["chats"] !== void 0) chats = store["chats"];
  if (store["exams"] !== void 0) exams = store["exams"];
  if (store["rooms"] !== void 0) rooms = store["rooms"];
  if (store["schedules"] !== void 0) schedules = store["schedules"];
  if (store["savedRosters"] !== void 0) savedRosters = store["savedRosters"];
  if (store["timeSlots"] !== void 0) timeSlots = store["timeSlots"];
  if (store["kbmDuration"] !== void 0) kbmDuration = store["kbmDuration"];
  if (store["journals"] !== void 0) journals = store["journals"];
  if (store["gradeCategories"] !== void 0) gradeCategories = store["gradeCategories"];
  if (store["calendarEvents"] !== void 0) calendarEvents = store["calendarEvents"];
  if (store["generatedExams"] !== void 0) generatedExams = store["generatedExams"];
  if (store["activeExamSessions"] !== void 0) activeExamSessions = store["activeExamSessions"];
  if (store["completedExams"] !== void 0) completedExams = store["completedExams"];
  if (store["forceFinishedExams"] !== void 0) forceFinishedExams = store["forceFinishedExams"];
  if (store["studentExamAnswers"] !== void 0) studentExamAnswers = store["studentExamAnswers"];
  if (store["studentExamQuestions"] !== void 0) studentExamQuestions = store["studentExamQuestions"];
  if (store["studentExamGrades"] !== void 0) studentExamGrades = store["studentExamGrades"];
  if (store["studentTabSwitches"] !== void 0) studentTabSwitches = store["studentTabSwitches"];
  if (store["studentOutOfTab"] !== void 0) studentOutOfTab = store["studentOutOfTab"];
  if (store["blockedStudents"] !== void 0) blockedStudents = store["blockedStudents"];
  if (store["settings"] !== void 0) appSettings = store["settings"];
  if (store["lessonPlans"] !== void 0) lessonPlans = store["lessonPlans"];
  if (store["teacherAttendance"] !== void 0) teacherAttendance = store["teacherAttendance"];
  if (store["childguardRules"] !== void 0) childguardRules = store["childguardRules"];
  if (store["childguardLogs"] !== void 0) childguardLogs = store["childguardLogs"];
  if (store["childguardLocations"] !== void 0) childguardLocations = store["childguardLocations"];
  if (store["childguardStatus"] !== void 0) childguardStatus = store["childguardStatus"];
  if (store["madrasahs"] !== void 0) {
    madrasahs = store["madrasahs"];
    verifyAndLockMadrasahTokens();
  }
  if (store["tokenRequests"] !== void 0) tokenRequests = store["tokenRequests"];
  if (store["usedActivationKeys"] !== void 0) usedActivationKeys = store["usedActivationKeys"];
  if (dbInitPromise) {
    await dbInitPromise;
  }
  if (!pool) {
    if (isOnlineMode) {
      console.error("[Hydration] Cloud SQL unavailable in ONLINE mode; local_store.json is not used as persistent fallback.");
      return;
    }
    await runOneTimeMigrations();
    console.log("Database URL / SQL_HOST not set. Using local JSON store.");
    return;
  }
  try {
    const testPromise = pool.query("SELECT 1");
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("DB Timeout")), 4e3));
    await Promise.race([testPromise, timeoutPromise]);
    const res = await pool.query("SELECT key, value FROM app_store");
    const dbData = parseDbRows(res.rows);
    console.log("Hydrate fetched rows count from Cloud SQL:", res.rows.length, "Teachers count:", Array.isArray(dbData["teachers"]) ? dbData["teachers"].length : "none", "Students count:", Array.isArray(dbData["students"]) ? dbData["students"].length : "none");
    if (isOfflineMode && res.rows.length === 0 && Object.keys(store).length > 0) {
      console.log("Database is empty. Migrating from local_store.json...");
      try {
        const queries = Object.entries(store).map(([k, v]) => {
          return pool.query(`
            INSERT INTO app_store (key, value) VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
          `, [k, JSON.stringify(v)]);
        });
        await Promise.all(queries);
        console.log("Migration completed.");
        for (const [k, v] of Object.entries(store)) {
          dbData[k] = v;
        }
      } catch (e) {
        console.error("Migration error:", e);
      }
    }
    if (dbData["schoolLocationSettings"] !== void 0) schoolLocationSettings = dbData["schoolLocationSettings"];
    if (dbData["classes"] !== void 0) classes = dbData["classes"];
    if (dbData["subjects"] !== void 0) subjects = dbData["subjects"];
    if (dbData["teachers"] !== void 0) teachers = dbData["teachers"];
    if (dbData["students"] !== void 0) students = dbData["students"];
    const seenNis = /* @__PURE__ */ new Set();
    students = (students || []).filter((s) => {
      const nis = String(s.nis || "").trim();
      if (!nis) return true;
      if (seenNis.has(nis)) return false;
      seenNis.add(nis);
      return true;
    });
    if (dbData["attendance"] !== void 0) {
      let activeAttendance = dbData["attendance"] || [];
      const attendanceArchives = [];
      Object.keys(dbData).forEach((k) => {
        if (k.startsWith("attendance_archive_") && Array.isArray(dbData[k])) {
          attendanceArchives.push(...dbData[k]);
        }
      });
      attendance = mergeArrays(activeAttendance, attendanceArchives, "attendance");
    }
    if (dbData["questionBankGroups"] !== void 0) questionBankGroups = dbData["questionBankGroups"];
    if (dbData["questions"] !== void 0) questions = dbData["questions"];
    if (dbData["grades"] !== void 0) grades = dbData["grades"];
    if (dbData["chats"] !== void 0) {
      let activeChats = dbData["chats"] || [];
      const chatsArchives = [];
      Object.keys(dbData).forEach((k) => {
        if (k.startsWith("chats_archive_") && Array.isArray(dbData[k])) {
          chatsArchives.push(...dbData[k]);
        }
      });
      chats = mergeArrays(activeChats, chatsArchives, "chats");
    }
    if (dbData["lkpdList"] !== void 0) lkpdList = dbData["lkpdList"];
    if (dbData["exams"] !== void 0) exams = dbData["exams"];
    if (dbData["rooms"] !== void 0) rooms = dbData["rooms"];
    if (dbData["schedules"] !== void 0) schedules = dbData["schedules"];
    if (dbData["savedRosters"] !== void 0) savedRosters = dbData["savedRosters"];
    if (dbData["timeSlots"] !== void 0) timeSlots = dbData["timeSlots"];
    if (dbData["kbmDuration"] !== void 0) kbmDuration = dbData["kbmDuration"];
    if (dbData["journals"] !== void 0) journals = dbData["journals"];
    if (dbData["gradeCategories"] !== void 0) gradeCategories = dbData["gradeCategories"];
    if (dbData["generatedExams"] !== void 0) generatedExams = dbData["generatedExams"];
    if (dbData["activeExamSessions"] !== void 0) activeExamSessions = dbData["activeExamSessions"];
    if (dbData["completedExams"] !== void 0) completedExams = dbData["completedExams"];
    if (dbData["forceFinishedExams"] !== void 0) forceFinishedExams = dbData["forceFinishedExams"];
    if (dbData["studentExamAnswers"] !== void 0) studentExamAnswers = dbData["studentExamAnswers"];
    if (dbData["studentExamQuestions"] !== void 0) studentExamQuestions = dbData["studentExamQuestions"];
    if (dbData["studentExamMasterQuestions"] !== void 0) studentExamMasterQuestions = dbData["studentExamMasterQuestions"];
    if (dbData["studentExamGrades"] !== void 0) studentExamGrades = dbData["studentExamGrades"];
    if (dbData["studentTabSwitches"] !== void 0) studentTabSwitches = dbData["studentTabSwitches"];
    if (dbData["studentOutOfTab"] !== void 0) studentOutOfTab = dbData["studentOutOfTab"];
    if (dbData["blockedStudents"] !== void 0) blockedStudents = dbData["blockedStudents"];
    if (dbData["settings"] !== void 0) appSettings = dbData["settings"];
    if (dbData["lessonPlans"] !== void 0) lessonPlans = dbData["lessonPlans"];
    let activeTeacherAttendance = dbData["teacherAttendance"] || [];
    const teacherAttendanceArchives = [];
    Object.keys(dbData).forEach((k) => {
      if (k.startsWith("teacherAttendance_archive_") && Array.isArray(dbData[k])) {
        teacherAttendanceArchives.push(...dbData[k]);
      }
    });
    teacherAttendance = mergeArrays(activeTeacherAttendance, teacherAttendanceArchives, "teacherAttendance");
    if (dbData["childguardRules"] !== void 0) childguardRules = dbData["childguardRules"];
    if (dbData["childguardLogs"] !== void 0) childguardLogs = dbData["childguardLogs"];
    if (dbData["childguardLocations"] !== void 0) childguardLocations = dbData["childguardLocations"];
    if (dbData["childguardStatus"] !== void 0) childguardStatus = dbData["childguardStatus"];
    applyExtendedDbState(dbData);
    await runOneTimeMigrations();
    console.log("All data hydrated successfully from PostgreSQL.");
    try {
      const mergedStore = {
        ...readLocalStore(),
        ...dbData
      };
      writeLocalStore(mergedStore);
      console.log("Local JSON store cache successfully reconstructed from PostgreSQL.");
    } catch (writeErr) {
      console.error("Failed to reconstruct local JSON store cache from PostgreSQL:", writeErr.message);
    }
  } catch (err) {
    console.error(isOnlineMode ? "PostgreSQL hydration failed in ONLINE mode; local JSON fallback is disabled:" : "PostgreSQL hydration warning / timeout (falling back to local JSON store):", err);
  }
}
var hydratePromise = null;
function ensureHydrated() {
  if (!hydratePromise) {
    hydratePromise = hydrate();
  }
  return hydratePromise;
}
var DB_CACHE_TTL_MS = 9e5;
var dbFetchPromise = null;
async function refreshInmemoryState(force = false) {
  if (dbInitPromise) await dbInitPromise;
  if (!pool || isDbQuotaExceeded) {
    if (isOfflineMode) await ensureHydrated();
    return;
  }
  const now = Date.now();
  if (!force && now - lastDbFetchTime < DB_CACHE_TTL_MS) {
    return;
  }
  if (!dbFetchPromise) {
    dbFetchPromise = (async () => {
      try {
        const resDb = await pool.query("SELECT key, value FROM app_store");
        const dbData = parseDbRows(resDb.rows);
        if (dbData["schoolLocationSettings"] !== void 0) schoolLocationSettings = dbData["schoolLocationSettings"];
        if (dbData["classes"] !== void 0) classes = dbData["classes"];
        if (dbData["subjects"] !== void 0) subjects = dbData["subjects"];
        if (dbData["teachers"] !== void 0) teachers = dbData["teachers"];
        if (dbData["students"] !== void 0) {
          const seenNis = /* @__PURE__ */ new Set();
          students = (dbData["students"] || []).filter((s) => {
            const nis = String(s.nis || "").trim();
            if (!nis) return true;
            if (seenNis.has(nis)) return false;
            seenNis.add(nis);
            return true;
          });
        }
        if (dbData["attendance"] !== void 0) {
          const archives = [];
          Object.keys(dbData).forEach((k) => {
            if (k.startsWith("attendance_archive_") && Array.isArray(dbData[k])) archives.push(...dbData[k]);
          });
          attendance = mergeArrays(dbData["attendance"] || [], archives, "attendance");
        }
        if (dbData["questionBankGroups"] !== void 0) questionBankGroups = dbData["questionBankGroups"];
        if (dbData["questions"] !== void 0) questions = dbData["questions"];
        if (dbData["grades"] !== void 0) grades = dbData["grades"];
        if (dbData["chats"] !== void 0) {
          const archives = [];
          Object.keys(dbData).forEach((k) => {
            if (k.startsWith("chats_archive_") && Array.isArray(dbData[k])) archives.push(...dbData[k]);
          });
          chats = mergeArrays(dbData["chats"] || [], archives, "chats");
        }
        if (dbData["lkpdList"] !== void 0) lkpdList = dbData["lkpdList"];
        if (dbData["exams"] !== void 0) exams = dbData["exams"];
        if (dbData["rooms"] !== void 0) rooms = dbData["rooms"];
        if (dbData["schedules"] !== void 0) schedules = dbData["schedules"];
        if (dbData["savedRosters"] !== void 0) savedRosters = dbData["savedRosters"];
        if (dbData["timeSlots"] !== void 0) timeSlots = dbData["timeSlots"];
        if (dbData["kbmDuration"] !== void 0) kbmDuration = dbData["kbmDuration"];
        if (dbData["journals"] !== void 0) journals = dbData["journals"];
        if (dbData["gradeCategories"] !== void 0) gradeCategories = dbData["gradeCategories"];
        if (dbData["generatedExams"] !== void 0) generatedExams = dbData["generatedExams"];
        if (dbData["activeExamSessions"] !== void 0) activeExamSessions = dbData["activeExamSessions"];
        if (dbData["completedExams"] !== void 0) completedExams = dbData["completedExams"];
        if (dbData["forceFinishedExams"] !== void 0) forceFinishedExams = dbData["forceFinishedExams"];
        if (dbData["studentExamAnswers"] !== void 0) studentExamAnswers = dbData["studentExamAnswers"];
        if (dbData["studentExamQuestions"] !== void 0) studentExamQuestions = dbData["studentExamQuestions"];
        if (dbData["studentExamGrades"] !== void 0) studentExamGrades = dbData["studentExamGrades"];
        if (dbData["studentTabSwitches"] !== void 0) studentTabSwitches = dbData["studentTabSwitches"];
        if (dbData["studentOutOfTab"] !== void 0) studentOutOfTab = dbData["studentOutOfTab"];
        if (dbData["blockedStudents"] !== void 0) blockedStudents = dbData["blockedStudents"];
        if (dbData["settings"] !== void 0) appSettings = dbData["settings"];
        if (dbData["lessonPlans"] !== void 0) lessonPlans = dbData["lessonPlans"];
        if (dbData["teacherAttendance"] !== void 0) {
          const archives = [];
          Object.keys(dbData).forEach((k) => {
            if (k.startsWith("teacherAttendance_archive_") && Array.isArray(dbData[k])) archives.push(...dbData[k]);
          });
          teacherAttendance = mergeArrays(dbData["teacherAttendance"] || [], archives, "teacherAttendance");
        }
        if (dbData["childguardRules"] !== void 0) childguardRules = dbData["childguardRules"];
        if (dbData["childguardLogs"] !== void 0) childguardLogs = dbData["childguardLogs"];
        if (dbData["childguardLocations"] !== void 0) childguardLocations = dbData["childguardLocations"];
        if (dbData["childguardStatus"] !== void 0) childguardStatus = dbData["childguardStatus"];
        applyExtendedDbState(dbData);
        lastDbFetchTime = Date.now();
        try {
          const mergedStore = {
            ...readLocalStore(),
            ...dbData
          };
          writeLocalStore(mergedStore);
          console.log("[refreshInmemoryState] Local JSON store cache successfully reconstructed from PostgreSQL.");
        } catch (writeErr) {
          console.error("[refreshInmemoryState] Failed to reconstruct local JSON store cache from PostgreSQL:", writeErr.message);
        }
      } catch (err) {
        handleDbError("PostgreSQL refreshInmemoryState error", err);
        await ensureHydrated();
      } finally {
        dbFetchPromise = null;
      }
    })();
  }
  return dbFetchPromise;
}
app.use(async (req, res, next) => {
  try {
    if (req.path.startsWith("/api/") && req.path !== "/api/sync-state") {
      await refreshInmemoryState();
    } else {
      await ensureHydrated();
    }
  } catch (e) {
    console.error("Hydration middleware error:", e);
  }
  next();
});
app.get("/health", (req, res) => res.status(200).send("OK"));
app.get("/healthz", (req, res) => res.status(200).send("OK"));
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});
app.get("/api/check-connection", async (req, res) => {
  const status = {
    firestore: false,
    cloudinary: false,
    error: null
  };
  if (db) {
    try {
      await (0, import_firestore.getDoc)((0, import_firestore.doc)(db, "app_store", "health_check_dummy"));
      status.firestore = true;
    } catch (e) {
      status.error = `Firestore: ${e.message}`;
    }
  }
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    try {
      await import_cloudinary.v2.api.ping();
      status.cloudinary = true;
    } catch (e) {
      status.error = (status.error ? status.error + " | " : "") + `Cloudinary: ${e.message}`;
    }
  }
  res.json(status);
});
var JWT_SECRET = process.env.JWT_SECRET || "";
if (!JWT_SECRET) {
  console.error("======================================================================================");
  console.error("\u26A0\uFE0F  CRITICAL WARNING: JWT_SECRET is not set in the environment variables!");
  console.error("\u26A0\uFE0F  Any requests requiring authentication will fail until JWT_SECRET is configured.");
  console.error("======================================================================================");
}
var requestedJwtTtl = Number(process.env.JWT_TTL_SECONDS || "");
var JWT_TTL_SECONDS = Number.isFinite(requestedJwtTtl) && requestedJwtTtl >= 900 && requestedJwtTtl <= 90 * 24 * 3600 ? Math.floor(requestedJwtTtl) : isOnlineMode ? 12 * 3600 : 30 * 24 * 3600;
function createRealtimeToken(user) {
  if (!JWT_SECRET) throw new Error("JWT_SECRET is required for realtime authentication.");
  const payload = {
    id: String(user.id || ""),
    role: String(user.role || "").toLowerCase(),
    madrasahId: String(user.madrasahId || "default"),
    scope: "realtime",
    exp: Math.floor(Date.now() / 1e3) + 600
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = import_crypto.default.createHmac("sha256", JWT_SECRET).update(`realtime.${encoded}`).digest("base64url");
  return `${encoded}.${signature}`;
}
function verifyRealtimeToken(token) {
  if (!JWT_SECRET || !token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  const expected = import_crypto.default.createHmac("sha256", JWT_SECRET).update(`realtime.${encoded}`).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !import_crypto.default.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (payload.scope !== "realtime") return null;
    if (!payload.exp || Number(payload.exp) < Math.floor(Date.now() / 1e3)) return null;
    return payload;
  } catch {
    return null;
  }
}
function createAuthToken(user) {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is required but not configured in the environment variables.");
  }
  const header = { alg: "HS256", typ: "JWT" };
  const role = String(user.role || (user.nip ? "teacher" : user.nis ? "student" : "admin")).toLowerCase();
  const payload = {
    id: String(user.id),
    role,
    username: String(user.username || user.nis || user.nip || ""),
    name: user.name || "",
    classId: user.classId || user.class_id || "",
    madrasahId: user.madrasahId || "default",
    exp: Math.floor(Date.now() / 1e3) + JWT_TTL_SECONDS
  };
  const b64Header = Buffer.from(JSON.stringify(header)).toString("base64url");
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = import_crypto.default.createHmac("sha256", JWT_SECRET).update(`${b64Header}.${b64Payload}`).digest("base64url");
  return `${b64Header}.${b64Payload}.${signature}`;
}
function verifyAuthToken(token) {
  if (!JWT_SECRET) {
    console.error("verifyAuthToken failed: JWT_SECRET is not configured in the environment.");
    return null;
  }
  if (!token || typeof token !== "string") return null;
  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;
  const [b64Header, b64Payload, signature] = parts;
  const expectedSig = import_crypto.default.createHmac("sha256", JWT_SECRET).update(`${b64Header}.${b64Payload}`).digest("base64url");
  if (signature !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(b64Payload, "base64url").toString("utf-8"));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1e3)) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}
function hashPassword(plainText) {
  if (!plainText) return "";
  const str = String(plainText).trim();
  if (str.startsWith("scrypt$") && str.split("$").length === 6) {
    return str;
  }
  if (str.startsWith("sha256$") && str.split("$").length === 3) {
    return str;
  }
  const salt = import_crypto.default.randomBytes(16).toString("hex");
  const derivedKey = import_crypto.default.scryptSync(str, salt, 64, { N: 16384, r: 8, p: 1 });
  const hash = derivedKey.toString("hex");
  return `scrypt$16384$8$1$${salt}$${hash}`;
}
function verifyPassword(plainText, hashedPassword) {
  if (!plainText || !hashedPassword) return false;
  const pStr = String(plainText).trim();
  const hStr = String(hashedPassword).trim();
  if (hStr.startsWith("scrypt$")) {
    const parts = hStr.split("$");
    if (parts.length !== 6) return false;
    const N = parseInt(parts[1], 10);
    const r = parseInt(parts[2], 10);
    const p = parseInt(parts[3], 10);
    const salt = parts[4];
    const expectedHash = parts[5];
    const derivedKey = import_crypto.default.scryptSync(
      pStr,
      salt,
      64,
      { N, r, p }
    );
    const actualHash = derivedKey.toString("hex");
    return import_crypto.default.timingSafeEqual(
      Buffer.from(actualHash, "hex"),
      Buffer.from(expectedHash, "hex")
    );
  }
  if (hStr.startsWith("sha256$")) {
    const parts = hStr.split("$");
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const hash = parts[2];
    const computedHash = import_crypto.default.createHmac("sha256", salt).update(pStr).digest("hex");
    return computedHash === hash;
  }
  return pStr === hStr;
}
async function verifyPasswordAsync(plainText, hashedPassword) {
  if (!plainText || !hashedPassword) return false;
  const pStr = String(plainText).trim();
  const hStr = String(hashedPassword).trim();
  if (!hStr.startsWith("scrypt$")) return verifyPassword(pStr, hStr);
  const parts = hStr.split("$");
  if (parts.length !== 6) return false;
  const N = parseInt(parts[1], 10);
  const r = parseInt(parts[2], 10);
  const p = parseInt(parts[3], 10);
  const salt = parts[4];
  const expectedHash = parts[5];
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p) || !salt || !expectedHash) return false;
  let derivedKey;
  try {
    derivedKey = await new Promise((resolve, reject) => {
      import_crypto.default.scrypt(pStr, salt, 64, { N, r, p }, (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });
  } catch {
    return false;
  }
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  if (derivedKey.length !== expectedBuffer.length) return false;
  return import_crypto.default.timingSafeEqual(derivedKey, expectedBuffer);
}
function getAuthUser(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const verified = verifyAuthToken(token);
    if (verified) return verified;
  }
  const xAuthToken = req.headers ? req.headers["x-auth-token"] || req.headers["X-Auth-Token"] : null;
  if (xAuthToken && typeof xAuthToken === "string") {
    const verified = verifyAuthToken(xAuthToken.trim());
    if (verified) return verified;
  }
  return null;
}
function requireAuth(req, res, next) {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  req.user = authUser;
  next();
}
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      const authUser = getAuthUser(req);
      if (!authUser) {
        return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
      }
      req.user = authUser;
    }
    const role = String(req.user.role || "").toLowerCase();
    if (!allowedRoles.map((r) => r.toLowerCase()).includes(role)) {
      return res.status(403).json({ success: false, message: `Akses ditolak: Role Anda (${role}) tidak diizinkan.` });
    }
    next();
  };
}
function resolveStudentId(req, authUser) {
  if (!authUser) {
    return null;
  }
  const role = String(authUser.role || "").toLowerCase();
  if (role === "student" || role === "siswa" || role === "class_leader" || role === "ketua_kelas") {
    return String(authUser.id);
  }
  if (role === "teacher" || role === "guru" || role === "admin" || role === "bos" || role === "superadmin") {
    const candidate = req.body?.studentId || req.query?.studentId;
    return candidate ? String(candidate) : String(authUser.id);
  }
  return null;
}
function sanitizeQuestionForStudent(q) {
  if (!q) return null;
  return {
    id: q.id,
    code: q.code || q.bankCode || q.groupCode || "",
    subjectId: q.subjectId || q.subject || "",
    classId: q.classId || q.className || "",
    type: q.type || (q.options ? "mc" : "essay"),
    question: q.question,
    options: Array.isArray(q.options) ? q.options : [],
    imageUrl: q.imageUrl || q.image || ""
  };
}
app.get("/api/all-data", requireAuth, (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  const authUser = req.user;
  const mId = getRequestMadrasahId(req);
  const isTeacherOrAdmin = Boolean(authUser && (authUser.role === "teacher" || authUser.role === "guru" || authUser.role === "admin" || authUser.role === "bos" || authUser.role === "superadmin"));
  const isStudent = !isTeacherOrAdmin;
  let filteredTeachers = teachers;
  let filteredStudents = students;
  let filteredClasses = classes;
  let filteredSubjects = subjects;
  let filteredAttendance = attendance;
  let filteredQGroups = questionBankGroups;
  let filteredQuestions = questions;
  let filteredSchedules = schedules;
  let filteredExams = exams;
  let filteredLkpds = lkpdList;
  let filteredGrades = grades;
  let filteredRooms = rooms;
  let filteredJournals = journals;
  let filteredLessonPlans = lessonPlans;
  let filteredGeneratedExams = generatedExams;
  if (mId && mId !== "default" && mId !== "BOSS") {
    const matchM = madrasahs.find((m) => String(m.id) === mId || String(m.slug) === mId);
    const targetId = matchM ? matchM.id : mId;
    const targetSlug = matchM ? matchM.slug : mId;
    const matchesFilter = (item) => {
      const imId = String(item.madrasahId || "").trim();
      const imSlug = String(item.madrasahSlug || "").trim();
      if (!imId && !imSlug) {
        return false;
      }
      return imId === targetId || imSlug === targetSlug || imId === targetSlug || imSlug === targetId;
    };
    filteredTeachers = teachers.filter(matchesFilter);
    filteredStudents = students.filter(matchesFilter);
    filteredClasses = classes.filter(matchesFilter);
    filteredSubjects = subjects.filter(matchesFilter);
    filteredAttendance = attendance.filter(matchesFilter);
    filteredQGroups = questionBankGroups.filter(matchesFilter);
    filteredQuestions = questions.filter(matchesFilter);
    filteredSchedules = schedules.filter(matchesFilter);
    filteredExams = exams.filter(matchesFilter);
    filteredLkpds = lkpdList.filter(matchesFilter);
    filteredGrades = grades.filter(matchesFilter);
    filteredRooms = rooms.filter(matchesFilter);
    filteredJournals = journals.filter(matchesFilter);
    filteredLessonPlans = lessonPlans.filter(matchesFilter);
    filteredGeneratedExams = generatedExams.filter(matchesFilter);
  } else {
    const defaultM = madrasahs.find((m) => m.id === "default" || m.slug === "default") || madrasahs[0];
    const defId = defaultM ? defaultM.id : "default";
    const defSlug = defaultM ? defaultM.slug : "default";
    const defaultFilter = (item) => {
      const imId = String(item.madrasahId || "default").trim();
      const imSlug = String(item.madrasahSlug || "default").trim();
      return imId === "default" || imId === defId || imId === defSlug || imSlug === "default" || imSlug === defSlug || imSlug === defId || !item.madrasahId && !item.madrasahSlug;
    };
    filteredTeachers = teachers.filter(defaultFilter);
    filteredStudents = students.filter(defaultFilter);
    filteredClasses = classes.filter(defaultFilter);
    filteredSubjects = subjects.filter(defaultFilter);
    filteredAttendance = attendance.filter(defaultFilter);
    filteredQGroups = questionBankGroups.filter(defaultFilter);
    filteredQuestions = questions.filter(defaultFilter);
    filteredSchedules = schedules.filter(defaultFilter);
    filteredExams = exams.filter(defaultFilter);
    filteredLkpds = lkpdList.filter(defaultFilter);
    filteredGrades = grades.filter(defaultFilter);
    filteredRooms = rooms.filter(defaultFilter);
    filteredJournals = journals.filter(defaultFilter);
    filteredLessonPlans = lessonPlans.filter(defaultFilter);
    filteredGeneratedExams = generatedExams.filter(defaultFilter);
  }
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    const nameA = String(a.name || "").trim().toLowerCase();
    const nameB = String(b.name || "").trim().toLowerCase();
    if (nameA !== nameB) {
      return nameA.localeCompare(nameB, "id", { sensitivity: "base" });
    }
    const nisA = String(a.nis || a.no_urut || a.id || "").trim();
    const nisB = String(b.nis || b.no_urut || b.id || "").trim();
    return nisA.localeCompare(nisB, void 0, { numeric: true, sensitivity: "base" });
  });
  if (isStudent) {
    filteredQuestions = filteredQuestions.map(sanitizeQuestionForStudent).filter(Boolean);
    filteredExams = filteredExams.map((ex) => {
      if (Array.isArray(ex.questions)) {
        return {
          ...ex,
          questions: ex.questions.map(sanitizeQuestionForStudent).filter(Boolean)
        };
      }
      return ex;
    });
  }
  const sanitizedTeachers = filteredTeachers.map(({ password, ...rest }) => rest);
  const sanitizedStudents = sortedStudents.map((st) => {
    const { password, passwordRaw, ...rest } = st;
    return rest;
  });
  const sanitizedMadrasahs = madrasahs.map(({ adminPass, ...rest }) => rest);
  let sanitizedSettings = null;
  if (appSettings) {
    const { adminPass, ...restSettings } = appSettings;
    sanitizedSettings = restSettings;
  }
  res.json({
    success: true,
    teachers: sanitizedTeachers,
    students: sanitizedStudents,
    classes: filteredClasses,
    subjects: filteredSubjects,
    attendance: filteredAttendance,
    questionBankGroups: filteredQGroups,
    questions: filteredQuestions,
    schedules: filteredSchedules,
    savedRosters,
    timeSlots,
    kbmDuration,
    exams: filteredExams,
    lkpdList: filteredLkpds,
    rooms: filteredRooms,
    journals: filteredJournals,
    gradeCategories,
    calendarEvents,
    generatedExams: filteredGeneratedExams,
    settings: sanitizedSettings,
    lessonPlans: filteredLessonPlans,
    grades: filteredGrades,
    teacherAttendance,
    customGradeColumns,
    childguardRules,
    childguardLogs,
    childguardLocations,
    childguardStatus,
    madrasahs: sanitizedMadrasahs,
    tokenRequests,
    cbtTokenPrice,
    eduGames,
    gameAttempts
  });
});
var DEFAULT_SERVER_SEED_GAMES = [
  {
    id: "GAME_SEED_1",
    title: "Tebak Perangkat Komputer",
    gameType: "tebak_kata",
    subjectId: "Informatika",
    classId: "Semua Kelas",
    difficulty: "Mudah",
    timeLimit: 120,
    rewardXp: 100,
    status: "active",
    prompt: "Perangkat keras komputer yang digunakan untuk mengetik huruf, angka, dan simbol.",
    answerKey: "KEYBOARD",
    hints: ["Mempunyai tombol QWERTY", "Merupakan perangkat input utama"],
    imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: "GAME_SEED_2",
    title: "Teka-Teki Silang Informatika Dasar",
    gameType: "crossword",
    subjectId: "Informatika",
    classId: "Semua Kelas",
    difficulty: "Sedang",
    timeLimit: 300,
    rewardXp: 150,
    status: "active",
    prompt: "Lengkapi Teka-Teki Silang berikut mengenai dasar-dasar komputer.",
    answerKey: "CPU, RAM, PRINTER",
    crosswordData: {
      gridSize: { rows: 8, cols: 8 },
      clues: [
        { number: 1, direction: "across", row: 1, col: 1, clue: "Otak pemroses utama pada komputer", answer: "CPU" },
        { number: 2, direction: "across", row: 3, col: 1, clue: "Memori penyimpanan sementara acak", answer: "RAM" },
        { number: 3, direction: "down", row: 1, col: 1, clue: "Perangkat pencetak dokumen di kertas", answer: "PRINTER" }
      ]
    }
  },
  {
    id: "GAME_SEED_3",
    title: "Cari Kata - Komponen Hardware",
    gameType: "word_search",
    subjectId: "Informatika",
    classId: "Semua Kelas",
    difficulty: "Mudah",
    timeLimit: 180,
    rewardXp: 120,
    status: "active",
    prompt: "Temukan 4 kata hardware komputer dalam kumpulan huruf!",
    wordsToFind: ["MONITOR", "MOUSE", "MODEM", "PRINTER"]
  },
  {
    id: "GAME_SEED_4",
    title: "Memory Match - Istilah TIK",
    gameType: "memory_match",
    subjectId: "Informatika",
    classId: "Semua Kelas",
    difficulty: "Sedang",
    timeLimit: 150,
    rewardXp: 130,
    status: "active",
    prompt: "Buka kartu dan cocokkan perangkat komputer dengan fungsinya!",
    pairs: [
      { term: "CPU", match: "Otak Komputer" },
      { term: "PRINTER", match: "Mencetak Dokumen" },
      { term: "KEYBOARD", match: "Alat Mengetik" },
      { term: "MONITOR", match: "Menampilkan Gambar" }
    ]
  },
  {
    id: "GAME_SEED_5",
    title: "Benar atau Salah - Keamanan Siber",
    gameType: "true_false",
    subjectId: "Informatika",
    classId: "Semua Kelas",
    difficulty: "Mudah",
    timeLimit: 60,
    rewardXp: 80,
    status: "active",
    prompt: "Password yang kuat sebaiknya terdiri dari kombinasi huruf besar, huruf kecil, angka, dan simbol khusus.",
    correctAnswer: "BENAR",
    explanation: "Kombinasi Karakter Acak membuat password sangat sulit diretas oleh serangan brute-force."
  }
];
app.get("/api/games", (req, res) => {
  const list = eduGames && eduGames.length > 0 ? eduGames : DEFAULT_SERVER_SEED_GAMES;
  res.json({ success: true, games: list });
});
app.post("/api/games", async (req, res) => {
  try {
    const game = req.body;
    if (!game || !game.title) {
      return res.status(400).json({ success: false, message: "Judul game wajib diisi" });
    }
    if (!game.id) game.id = "GAME_" + Date.now();
    if (!Array.isArray(eduGames) || eduGames.length === 0) {
      eduGames = [...DEFAULT_SERVER_SEED_GAMES];
    }
    const idx = eduGames.findIndex((g) => g.id === game.id);
    if (idx >= 0) {
      eduGames[idx] = game;
    } else {
      eduGames.push(game);
    }
    saveData("eduGames", eduGames);
    res.json({ success: true, game });
  } catch (err) {
    res.status(500).json({ success: false, message: err?.message || "Gagal menyimpan game" });
  }
});
app.put("/api/games/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const game = req.body;
    if (!Array.isArray(eduGames) || eduGames.length === 0) {
      eduGames = [...DEFAULT_SERVER_SEED_GAMES];
    }
    const idx = eduGames.findIndex((g) => g.id === id);
    if (idx < 0) {
      return res.status(404).json({ success: false, message: "Game tidak ditemukan" });
    }
    eduGames[idx] = { ...eduGames[idx], ...game };
    saveData("eduGames", eduGames);
    res.json({ success: true, game: eduGames[idx] });
  } catch (err) {
    res.status(500).json({ success: false, message: err?.message || "Gagal memperbarui game" });
  }
});
app.delete("/api/games/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!Array.isArray(eduGames) || eduGames.length === 0) {
      eduGames = [...DEFAULT_SERVER_SEED_GAMES];
    }
    eduGames = eduGames.filter((g) => g.id !== id);
    saveData("eduGames", eduGames);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err?.message || "Gagal menghapus game" });
  }
});
function normalizeGameText(text) {
  if (text === null || text === void 0) return "";
  return String(text).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}
app.post("/api/games/:id/submit", async (req, res) => {
  try {
    const { id } = req.params;
    const { submittedAnswer, studentId, isPreview, passed } = req.body;
    const allGames = Array.isArray(eduGames) && eduGames.length > 0 ? eduGames : DEFAULT_SERVER_SEED_GAMES;
    let game = allGames.find((g) => g.id === id);
    if (!game) {
      game = DEFAULT_SERVER_SEED_GAMES.find((g) => g.id === id);
    }
    if (!game) {
      return res.status(404).json({ success: false, message: "Game tidak ditemukan" });
    }
    const normSubmitted = normalizeGameText(submittedAnswer);
    let isCorrect = false;
    if (passed === true || normSubmitted === "completed" || normSubmitted === "success" || normSubmitted === "passed") {
      isCorrect = true;
    } else if (game.gameType === "true_false") {
      const normCorrectTF = normalizeGameText(game.correctAnswer || "BENAR");
      isCorrect = normSubmitted === normCorrectTF;
    } else if (["memory_match", "match_pairs", "word_search", "spot_difference", "image_puzzle", "escape_room", "learning_adventure"].includes(game.gameType)) {
      isCorrect = passed === true || normSubmitted === "completed" || normSubmitted === "success" || normSubmitted === normalizeGameText(game.answerKey);
    } else {
      const normTarget = normalizeGameText(game.answerKey);
      if (normTarget) {
        isCorrect = normSubmitted === normTarget;
        if (!isCorrect && normSubmitted.length > 2 && normTarget.length > 2) {
          if (normSubmitted.includes(normTarget) || normTarget.includes(normSubmitted)) {
            isCorrect = true;
          }
        }
      } else {
        isCorrect = true;
      }
    }
    const rewardXp = isCorrect ? game.rewardXp || 100 : 0;
    let student = students.find((s) => s.id === studentId || s.nis === studentId);
    let newTotalXp = 0;
    let dailyStreak = 1;
    if (student && !isPreview && isCorrect) {
      student.gameXp = (student.gameXp || 0) + rewardXp;
      const todayStr = getJakartaTodayDateStr();
      if (student.lastGameDate === todayStr) {
        dailyStreak = student.dailyStreak || 1;
      } else {
        const yesterday = /* @__PURE__ */ new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().split("T")[0];
        if (student.lastGameDate === yStr) {
          dailyStreak = (student.dailyStreak || 1) + 1;
        } else {
          dailyStreak = 1;
        }
        student.lastGameDate = todayStr;
        student.dailyStreak = dailyStreak;
      }
      newTotalXp = student.gameXp;
      saveData("students", students);
    }
    const attemptLog = {
      id: "ATTEMPT_" + Date.now(),
      gameId: id,
      studentId,
      submittedAnswer,
      isCorrect,
      earnedXp: rewardXp,
      timestamp: getJakartaIsoString()
    };
    gameAttempts.push(attemptLog);
    saveData("gameAttempts", gameAttempts);
    res.json({
      success: true,
      isCorrect,
      earnedXp: rewardXp,
      newTotalXp,
      dailyStreak
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err?.message || "Gagal memproses jawaban" });
  }
});
app.get("/api/games/leaderboard", (req, res) => {
  const classFilter = String(req.query.classId || "").trim();
  let list = students || [];
  if (classFilter && classFilter !== "all" && classFilter !== "Semua Kelas") {
    list = list.filter((s) => String(s.classId) === classFilter || String(s.className) === classFilter || String(s.kelas) === classFilter);
  }
  const rankings = list.map((s) => {
    const xp = s.gameXp || 0;
    return {
      id: s.id || s.nis,
      name: s.name,
      nis: s.nis || s.id,
      classId: s.classId || "",
      className: s.className || s.kelas || "Siswa",
      photo: s.photo || s.avatar || "",
      xp,
      level: Math.floor(xp / 250) + 1,
      dailyStreak: s.dailyStreak || 1
    };
  }).sort((a, b) => b.xp - a.xp).slice(0, 100);
  res.json({ success: true, rankings });
});
var gameMessages = {};
var activeGameSessionsServer = {};
app.get("/api/game/active-sessions", (req, res) => {
  res.json({ success: true, sessions: activeGameSessionsServer });
});
app.post("/api/game/active-sessions", (req, res) => {
  try {
    const { studentId, sessionData } = req.body;
    if (studentId) {
      if (sessionData === null) {
        delete activeGameSessionsServer[studentId];
      } else {
        activeGameSessionsServer[studentId] = {
          ...sessionData,
          updatedAt: Date.now()
        };
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.get("/api/game/messages", (req, res) => {
  const studentId = String(req.query.studentId || "");
  if (studentId) {
    const msgs = gameMessages[studentId] || [];
    const broadcastMsgs = gameMessages["BROADCAST"] || [];
    res.json({ success: true, messages: [...msgs, ...broadcastMsgs] });
  } else {
    res.json({ success: true, messages: gameMessages });
  }
});
app.post("/api/game/messages", (req, res) => {
  try {
    const { recipientId, senderName, message, type } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: "Pesan tidak boleh kosong" });
    }
    const msgObj = {
      id: "GMSG_" + Date.now() + "_" + Math.floor(Math.random() * 1e3),
      recipientId: recipientId || "BROADCAST",
      senderName: senderName || "Guru / Admin Game",
      message: String(message),
      type: type || "direct",
      timestamp: Date.now()
    };
    if (recipientId && recipientId !== "BROADCAST") {
      if (!gameMessages[recipientId]) gameMessages[recipientId] = [];
      gameMessages[recipientId].push(msgObj);
    } else {
      if (!gameMessages["BROADCAST"]) gameMessages["BROADCAST"] = [];
      gameMessages["BROADCAST"].push(msgObj);
    }
    res.json({ success: true, message: msgObj });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.post("/api/game/messages/dismiss", (req, res) => {
  try {
    const { studentId, messageId } = req.body;
    if (studentId && gameMessages[studentId]) {
      gameMessages[studentId] = gameMessages[studentId].filter((m) => m.id !== messageId);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.get("/api/db-status", async (req, res) => {
  const status = {
    connected: false,
    sql: {
      connected: false,
      configured: false,
      message: "Belum diperiksa.",
      details: ""
    },
    firebase: {
      connected: false,
      configured: false,
      message: "Belum diperiksa.",
      details: ""
    },
    json: {
      connected: false,
      configured: false,
      message: "Belum diperiksa.",
      details: ""
    },
    cloudinary: {
      connected: false,
      configured: false,
      message: "Belum diperiksa.",
      details: ""
    }
  };
  try {
    const hasEnv = !!process.env.SQL_HOST || !!process.env.DATABASE_URL;
    if (!hasEnv) {
      status.sql.message = "Variabel lingkungan SQL_HOST atau DATABASE_URL tidak ditemukan.";
    } else {
      status.sql.configured = true;
      if (dbInitPromise) {
        await dbInitPromise;
      }
      if (!pool || activeDbSource === "NONE" || isDbQuotaExceeded) {
        isDbQuotaExceeded = false;
        dbInitPromise = determineAndInitPool();
        await dbInitPromise;
      }
      if (!pool) {
        status.sql.message = "Gagal menginisialisasi database pool.";
      } else {
        const queryPromise = pool.query("SELECT 1");
        const timeoutPromise = new Promise(
          (_, reject) => setTimeout(() => reject(new Error("Koneksi SQL timeout (3 detik).")), 3e3)
        );
        await Promise.race([queryPromise, timeoutPromise]);
        let keysCount = 0;
        try {
          const testResult = await pool.query("SELECT COUNT(*) FROM app_store");
          keysCount = parseInt(testResult.rows[0].count, 10);
          status.sql.details = `Tabel app_store aktif dengan ${keysCount} baris record.`;
        } catch (e) {
          status.sql.details = "Koneksi berhasil, tetapi tabel app_store belum terbentuk atau tidak terbaca.";
        }
        status.sql.connected = true;
        status.sql.message = `Terhubung sukses ke ${activeDbSource}!`;
      }
    }
  } catch (err) {
    status.sql.connected = false;
    status.sql.message = "Gagal terhubung ke PostgreSQL / Cloud SQL.";
    status.sql.details = err.message || String(err);
  }
  try {
    const configPath = "./firebase-applet-config.json";
    if (!import_fs.default.existsSync(configPath)) {
      status.firebase.message = "File konfigurasi firebase-applet-config.json tidak ditemukan.";
    } else if (!db) {
      status.firebase.message = "Koneksi Firebase dinonaktifkan sengaja (Aman dari limit kuota).";
      status.firebase.connected = true;
      status.firebase.details = "Sistem berjalan penuh menggunakan Cloudinary & File Backup.";
      status.firebase.configured = true;
    } else {
      status.firebase.configured = true;
      const testDoc = (0, import_firestore.doc)(db, "photos", "connection_test_id");
      const getDocPromise = (0, import_firestore.getDoc)(testDoc);
      const timeoutPromise = new Promise(
        (_, reject) => setTimeout(() => reject(new Error("Koneksi Firebase Firestore timeout (3 detik).")), 3e3)
      );
      await Promise.race([getDocPromise, timeoutPromise]);
      status.firebase.connected = true;
      status.firebase.message = "Terhubung sukses ke Firebase Firestore!";
      status.firebase.details = "Koneksi baca/tulis dokumen media/foto aktif.";
    }
  } catch (err) {
    status.firebase.connected = false;
    status.firebase.message = "Gagal terhubung ke Firebase Firestore.";
    status.firebase.details = err.message || String(err);
  }
  try {
    const exists = import_fs.default.existsSync(LOCAL_STORE_FILE);
    if (!exists) {
      status.json.message = "File local_store.json tidak ditemukan.";
    } else {
      status.json.configured = true;
      const raw = import_fs.default.readFileSync(LOCAL_STORE_FILE, "utf-8");
      const parsed = JSON.parse(decryptLocalStore(raw));
      const keysCount = Object.keys(parsed || {}).length;
      status.json.connected = true;
      status.json.message = "File lokal local_store.json terbaca dan valid!";
      status.json.details = `Memiliki ${keysCount} kategori modul data tersimpan.`;
    }
  } catch (err) {
    status.json.connected = false;
    status.json.message = "File lokal local_store.json rusak atau gagal dibaca.";
    status.json.details = err.message || String(err);
  }
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      status.cloudinary.message = "Variabel lingkungan CLOUDINARY_CLOUD_NAME tidak ditemukan.";
    } else {
      status.cloudinary.configured = true;
      const timeoutPromise = new Promise(
        (_, reject) => setTimeout(() => reject(new Error("Koneksi Cloudinary timeout (3 detik).")), 3e3)
      );
      await Promise.race([import_cloudinary.v2.api.ping(), timeoutPromise]);
      status.cloudinary.connected = true;
      status.cloudinary.message = "Terhubung sukses ke Cloudinary!";
      status.cloudinary.details = `Penyimpanan foto Cloudinary (${process.env.CLOUDINARY_CLOUD_NAME}) aktif. ${Object.keys(photoCloudinaryMap).length} foto terpetakan secara aman.`;
    }
  } catch (err) {
    status.cloudinary.connected = false;
    status.cloudinary.message = "Gagal terhubung ke Cloudinary.";
    status.cloudinary.details = err.message || String(err);
  }
  if (isOfflineMode) {
    if (status.sql.connected && status.json.connected) {
      status.connected = true;
      status.message = "Sistem Luring (Offline) Aktif: PostgreSQL dan Penyimpanan Foto Lokal (Uploads) terhubung sempurna!";
    } else {
      status.connected = false;
      status.message = "Sistem Offline bermasalah pada koneksi database PostgreSQL lokal.";
    }
  } else if (status.sql.connected && status.firebase.connected && status.json.connected && status.cloudinary.connected) {
    status.connected = true;
    status.message = "Semua sistem database (SQL, Firebase, JSON, dan Cloudinary) berhasil terhubung sempurna!";
  } else {
    status.connected = false;
    const failures = [];
    if (!status.sql.connected) failures.push("PostgreSQL/Cloud SQL");
    if (!status.firebase.connected) failures.push("Firebase Firestore");
    if (!status.json.connected) failures.push("Local JSON");
    if (!status.cloudinary.connected) failures.push("Cloudinary");
    status.message = `Sistem bermasalah pada: ${failures.join(", ")}.`;
  }
  res.json(status);
});
app.post("/api/cloudinary/sync", async (req, res) => {
  try {
    const result = await syncAllPhotosToCloudinary();
    res.json({
      success: true,
      message: `Sinkronisasi Cloudinary berhasil! Total foto terpetakan: ${result.mapped}`,
      result
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err?.message || String(err) });
  }
});
app.post("/api/cloudinary/repair-missing", requireAuth, requireRole(["admin", "bos", "superadmin"]), async (req, res) => {
  try {
    const result = await repairMissingCloudinaryPhotos();
    return res.json({
      success: true,
      message: `Pemeriksaan selesai. ${result.uploaded} foto yang belum ada berhasil di-upload ke Cloudinary.`,
      result
    });
  } catch (err) {
    console.error("[Cloudinary Repair Endpoint] Failed:", err?.message || err);
    return res.status(500).json({
      success: false,
      message: err?.message || "Gagal memeriksa dan memperbaiki foto Cloudinary."
    });
  }
});
app.post("/api/db-pull-cloud", async (req, res) => {
  const tryLocalBackupRestore = () => {
    const candidates = [LOCAL_STORE_FILE + ".backup", LOCAL_STORE_FILE];
    for (const filePath of candidates) {
      if (import_fs.default.existsSync(filePath)) {
        try {
          const rawBackup = import_fs.default.readFileSync(filePath, "utf-8");
          const backupData = JSON.parse(decryptLocalStore(rawBackup));
          const hasData = backupData && (Array.isArray(backupData.students) && backupData.students.length > 0 || Array.isArray(backupData.teachers) && backupData.teachers.length > 0 || Array.isArray(backupData.classes) && backupData.classes.length > 0);
          if (hasData) {
            localStoreCache = backupData;
            if (filePath.endsWith(".backup")) {
              import_fs.default.writeFileSync(LOCAL_STORE_FILE, rawBackup, "utf-8");
            }
            if (backupData["schoolLocationSettings"] !== void 0) schoolLocationSettings = backupData["schoolLocationSettings"];
            if (backupData["classes"] !== void 0) classes = backupData["classes"];
            if (backupData["subjects"] !== void 0) subjects = backupData["subjects"];
            if (backupData["teachers"] !== void 0) teachers = backupData["teachers"];
            if (backupData["students"] !== void 0) {
              const seenNis = /* @__PURE__ */ new Set();
              students = (backupData["students"] || []).filter((s) => {
                const nis = String(s.nis || "").trim();
                if (!nis) return true;
                if (seenNis.has(nis)) return false;
                seenNis.add(nis);
                return true;
              });
            }
            if (backupData["attendance"] !== void 0) attendance = backupData["attendance"];
            if (backupData["questionBankGroups"] !== void 0) questionBankGroups = backupData["questionBankGroups"];
            if (backupData["questions"] !== void 0) questions = backupData["questions"];
            if (backupData["grades"] !== void 0) grades = backupData["grades"];
            if (backupData["chats"] !== void 0) chats = backupData["chats"];
            if (backupData["exams"] !== void 0) exams = backupData["exams"];
            if (backupData["rooms"] !== void 0) rooms = backupData["rooms"];
            if (backupData["schedules"] !== void 0) schedules = backupData["schedules"];
            if (backupData["savedRosters"] !== void 0) savedRosters = backupData["savedRosters"];
            if (backupData["journals"] !== void 0) journals = backupData["journals"];
            if (backupData["gradeCategories"] !== void 0) gradeCategories = backupData["gradeCategories"];
            if (backupData["customGradeColumns"] !== void 0) customGradeColumns = backupData["customGradeColumns"];
            if (backupData["generatedExams"] !== void 0) generatedExams = backupData["generatedExams"];
            if (backupData["activeExamSessions"] !== void 0) activeExamSessions = backupData["activeExamSessions"];
            if (backupData["completedExams"] !== void 0) completedExams = backupData["completedExams"];
            if (backupData["studentExamAnswers"] !== void 0) studentExamAnswers = backupData["studentExamAnswers"];
            if (backupData["studentExamQuestions"] !== void 0) studentExamQuestions = backupData["studentExamQuestions"];
            if (backupData["studentTabSwitches"] !== void 0) studentTabSwitches = backupData["studentTabSwitches"];
            if (backupData["studentOutOfTab"] !== void 0) studentOutOfTab = backupData["studentOutOfTab"];
            if (backupData["blockedStudents"] !== void 0) blockedStudents = backupData["blockedStudents"];
            if (backupData["settings"] !== void 0) appSettings = backupData["settings"];
            if (backupData["lessonPlans"] !== void 0) lessonPlans = backupData["lessonPlans"];
            if (backupData["teacherAttendance"] !== void 0) teacherAttendance = backupData["teacherAttendance"];
            if (backupData["childguardRules"] !== void 0) childguardRules = backupData["childguardRules"];
            if (backupData["childguardLogs"] !== void 0) childguardLogs = backupData["childguardLogs"];
            if (backupData["childguardLocations"] !== void 0) childguardLocations = backupData["childguardLocations"];
            if (backupData["childguardStatus"] !== void 0) childguardStatus = backupData["childguardStatus"];
            lastDbFetchTime = Date.now();
            isDbQuotaExceeded = false;
            for (const key of Object.keys(backupData)) {
              try {
                broadcastStateUpdate(key);
              } catch (e) {
              }
            }
            return {
              success: true,
              message: `Sinkronisasi BERHASIL! Data berhasil dimuat dan disinkronkan (${filePath.endsWith(".backup") ? "dipulihkan dari cadangan otomatis" : "dari file data lokal"}).`,
              details: {
                teachersCount: Array.isArray(teachers) ? teachers.length : 0,
                studentsCount: Array.isArray(students) ? students.length : 0,
                classesCount: Array.isArray(classes) ? classes.length : 0,
                attendanceCount: Array.isArray(attendance) ? attendance.length : 0,
                questionsCount: Array.isArray(questions) ? questions.length : 0
              }
            };
          }
        } catch (e) {
          console.error(`[DB Pull Fallback] Read ${filePath} failed:`, e.message);
        }
      }
    }
    if (Array.isArray(students) && students.length > 0) {
      return {
        success: true,
        message: "Sinkronisasi BERHASIL! Seluruh data aktif di memori server berhasil dipertahankan.",
        details: {
          teachersCount: Array.isArray(teachers) ? teachers.length : 0,
          studentsCount: Array.isArray(students) ? students.length : 0,
          classesCount: Array.isArray(classes) ? classes.length : 0,
          attendanceCount: Array.isArray(attendance) ? attendance.length : 0,
          questionsCount: Array.isArray(questions) ? questions.length : 0
        }
      };
    }
    return null;
  };
  try {
    console.log("[DB Pull] Attempting manual reconnect & sync from Cloud SQL...");
    await determineAndInitPool();
    if (!pool) {
      const fallbackResult = tryLocalBackupRestore();
      if (fallbackResult) {
        return res.json(fallbackResult);
      }
      return res.status(500).json({
        success: false,
        message: "Gagal menghubungkan ke database Cloud SQL. Silakan periksa konfigurasi kredensial database Anda di AI Studio (Pengaturan) atau pastikan variabel lingkungan DATABASE_URL terisi."
      });
    }
    try {
      await pool.query("SELECT 1");
    } catch (dbErr) {
      const fallbackResult = tryLocalBackupRestore();
      if (fallbackResult) {
        return res.json(fallbackResult);
      }
      return res.status(500).json({
        success: false,
        message: "Gagal menghubungkan ke database Cloud SQL. Silakan periksa jaringan/kredensial database Anda: " + (dbErr.message || String(dbErr))
      });
    }
    let restoredFromBackup = false;
    let backupData = null;
    const backupPath = LOCAL_STORE_FILE + ".backup";
    if (import_fs.default.existsSync(backupPath)) {
      try {
        const rawBackup = import_fs.default.readFileSync(backupPath, "utf-8");
        backupData = JSON.parse(decryptLocalStore(rawBackup));
        const hasData = backupData && (Array.isArray(backupData.students) && backupData.students.length > 0 || Array.isArray(backupData.teachers) && backupData.teachers.length > 0 || Array.isArray(backupData.classes) && backupData.classes.length > 0);
        if (hasData) {
          localStoreCache = backupData;
          import_fs.default.writeFileSync(LOCAL_STORE_FILE, rawBackup, "utf-8");
          restoredFromBackup = true;
          console.log("[DB Pull] Healthy local_store.json.backup successfully recovered on reconnect.");
          console.log("[DB Pull] Syncing recovered backup data back to Cloud SQL app_store table...");
          const queries = Object.entries(backupData).map(([k, v]) => {
            return pool.query(`
              INSERT INTO app_store (key, value) VALUES ($1, $2)
              ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
            `, [k, JSON.stringify(v)]);
          });
          await Promise.all(queries);
        }
      } catch (err) {
        console.error("[DB Pull] Failed to parse local_store.json.backup file during reconnect:", err.message);
      }
    }
    const result = await pool.query("SELECT key, value FROM app_store");
    const store = readLocalStore();
    const dbData = parseDbRows(result.rows);
    for (const key of Object.keys(dbData)) {
      store[key] = dbData[key];
      updateMemoryKey(key, dbData[key]);
    }
    writeLocalStore(store);
    if (dbData["schoolLocationSettings"] !== void 0) schoolLocationSettings = dbData["schoolLocationSettings"];
    if (dbData["classes"] !== void 0) classes = dbData["classes"];
    if (dbData["subjects"] !== void 0) subjects = dbData["subjects"];
    if (dbData["teachers"] !== void 0) teachers = dbData["teachers"];
    if (dbData["students"] !== void 0) {
      const seenNis = /* @__PURE__ */ new Set();
      students = (dbData["students"] || []).filter((s) => {
        const nis = String(s.nis || "").trim();
        if (!nis) return true;
        if (seenNis.has(nis)) return false;
        seenNis.add(nis);
        return true;
      });
    }
    if (dbData["attendance"] !== void 0) attendance = dbData["attendance"];
    if (dbData["questionBankGroups"] !== void 0) questionBankGroups = dbData["questionBankGroups"];
    if (dbData["questions"] !== void 0) questions = dbData["questions"];
    if (dbData["grades"] !== void 0) grades = dbData["grades"];
    if (dbData["chats"] !== void 0) chats = dbData["chats"];
    if (dbData["lkpdList"] !== void 0) lkpdList = dbData["lkpdList"];
    if (dbData["exams"] !== void 0) exams = dbData["exams"];
    if (dbData["rooms"] !== void 0) rooms = dbData["rooms"];
    if (dbData["schedules"] !== void 0) schedules = dbData["schedules"];
    if (dbData["savedRosters"] !== void 0) savedRosters = dbData["savedRosters"];
    if (dbData["journals"] !== void 0) journals = dbData["journals"];
    if (dbData["gradeCategories"] !== void 0) gradeCategories = dbData["gradeCategories"];
    if (dbData["generatedExams"] !== void 0) generatedExams = dbData["generatedExams"];
    if (dbData["activeExamSessions"] !== void 0) activeExamSessions = dbData["activeExamSessions"];
    if (dbData["completedExams"] !== void 0) completedExams = dbData["completedExams"];
    if (dbData["forceFinishedExams"] !== void 0) forceFinishedExams = dbData["forceFinishedExams"];
    if (dbData["studentExamAnswers"] !== void 0) studentExamAnswers = dbData["studentExamAnswers"];
    if (dbData["studentExamQuestions"] !== void 0) studentExamQuestions = dbData["studentExamQuestions"];
    if (dbData["studentTabSwitches"] !== void 0) studentTabSwitches = dbData["studentTabSwitches"];
    if (dbData["studentOutOfTab"] !== void 0) studentOutOfTab = dbData["studentOutOfTab"];
    if (dbData["blockedStudents"] !== void 0) blockedStudents = dbData["blockedStudents"];
    if (dbData["settings"] !== void 0) appSettings = dbData["settings"];
    if (dbData["lessonPlans"] !== void 0) lessonPlans = dbData["lessonPlans"];
    if (dbData["teacherAttendance"] !== void 0) teacherAttendance = dbData["teacherAttendance"];
    if (dbData["childguardRules"] !== void 0) childguardRules = dbData["childguardRules"];
    if (dbData["childguardLogs"] !== void 0) childguardLogs = dbData["childguardLogs"];
    if (dbData["childguardLocations"] !== void 0) childguardLocations = dbData["childguardLocations"];
    if (dbData["childguardStatus"] !== void 0) childguardStatus = dbData["childguardStatus"];
    lastDbFetchTime = Date.now();
    isDbQuotaExceeded = false;
    for (const key of Object.keys(dbData)) {
      try {
        broadcastStateUpdate(key);
      } catch (e) {
      }
    }
    console.log("[DB Pull] Reconnection & Sync SUCCEEDED. Local server data synchronized with Cloud SQL database.");
    let successMessage = `Sinkronisasi BERHASIL! File JSON lokal dan SQL database sudah pulih sepenuhnya.`;
    if (restoredFromBackup) {
      successMessage = `Sinkronisasi BERHASIL! File JSON lokal dan SQL database sudah pulih sepenuhnya (dipulihkan menggunakan file cadangan otomatis local_store.json.backup).`;
    }
    res.json({
      success: true,
      message: successMessage,
      details: {
        teachersCount: Array.isArray(teachers) ? teachers.length : 0,
        studentsCount: Array.isArray(students) ? students.length : 0,
        classesCount: Array.isArray(classes) ? classes.length : 0,
        attendanceCount: Array.isArray(attendance) ? attendance.length : 0,
        questionsCount: Array.isArray(questions) ? questions.length : 0
      }
    });
  } catch (err) {
    console.error("DB Pull Error:", err);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat sinkronisasi: " + (err.message || String(err))
    });
  }
});
function isBossRuntimeEnabled() {
  return isTrustedCloudRunRuntime && Boolean(
    process.env.BOSS_USERNAME && process.env.BOSS_PASSWORD && process.env.LICENSE_PRIVATE_KEY && process.env.LICENSE_PUBLIC_KEY
  );
}
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username dan password wajib diisi." });
  }
  const u = String(username).trim();
  const p = String(password).trim();
  const uLower = u.toLowerCase();
  const bossUserEnv = process.env.BOSS_USERNAME;
  const bossPassEnv = process.env.BOSS_PASSWORD;
  const isBoss = isBossRuntimeEnabled() && Boolean(bossUserEnv && bossPassEnv) && uLower === String(bossUserEnv).toLowerCase() && p === String(bossPassEnv);
  if (isBoss) {
    const bossUser = {
      id: "BOSS",
      name: "Bos Platform (Super Admin)",
      username: uLower,
      role: "bos",
      madrasahId: "default",
      madrasahSlug: "default"
    };
    const token = createAuthToken(bossUser);
    return res.json({
      success: true,
      token,
      user: { ...bossUser, token }
    });
  }
  const foundMadrasah = madrasahs.find(
    (m) => (String(m.adminUser || "").toLowerCase() === uLower || String(m.slug || "").toLowerCase() === uLower) && verifyPassword(p, String(m.adminPass))
  );
  if (foundMadrasah) {
    if (foundMadrasah.isActive === false) {
      return res.status(403).json({ success: false, message: "Akses diblokir: Akun madrasah ini dinonaktifkan oleh Super Admin (Bos). Hubungi administrator platform." });
    }
    const adminUserObj = {
      id: "ADMIN_" + foundMadrasah.id,
      name: foundMadrasah.adminName || "Administrator",
      username: foundMadrasah.adminUser,
      role: "admin",
      madrasahId: foundMadrasah.id,
      madrasahSlug: foundMadrasah.slug,
      schoolName: foundMadrasah.name,
      cbtTokenBalance: foundMadrasah.cbtTokenBalance !== void 0 ? foundMadrasah.cbtTokenBalance : 0
    };
    const token = createAuthToken(adminUserObj);
    return res.json({
      success: true,
      token,
      user: { ...adminUserObj, token }
    });
  }
  const adminUserVal = appSettings?.adminUser ? String(appSettings.adminUser).toLowerCase() : "admin";
  const adminPassVal = appSettings?.adminPass ? String(appSettings.adminPass) : "";
  if (adminPassVal && (uLower === "admin" || uLower === "administrator" || uLower === adminUserVal) && verifyPassword(p, adminPassVal)) {
    const defaultM = madrasahs.find((m) => m.id === "default" || m.slug === "default") || madrasahs[0];
    if (defaultM && defaultM.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Akses diblokir: Akun madrasah ini belum aktif."
      });
    }
    const defAdminUser = {
      id: "ADMIN",
      name: appSettings?.adminName || "Administrator",
      username: adminUserVal,
      role: "admin",
      madrasahId: defaultM?.id || "default",
      madrasahSlug: defaultM?.slug || "default",
      schoolName: defaultM?.name || "Madrasah Utama",
      cbtTokenBalance: defaultM?.cbtTokenBalance || 0
    };
    const token = createAuthToken(defAdminUser);
    return res.json({
      success: true,
      token,
      user: {
        ...defAdminUser,
        token
      }
    });
  }
  const teacher = teachers.find((t) => (String(t.username || "").toLowerCase() === uLower || String(t.nip || "").toLowerCase() === uLower) && verifyPassword(p, String(t.password)));
  if (teacher) {
    const teacherUser = {
      id: teacher.id,
      name: teacher.name,
      username: teacher.username,
      nip: teacher.nip,
      role: "teacher",
      mapel: teacher.mapel,
      cbtTokenBalance: teacher.cbtTokenBalance !== void 0 ? teacher.cbtTokenBalance : 0
    };
    const token = createAuthToken(teacherUser);
    return res.json({
      success: true,
      token,
      user: { ...teacherUser, token }
    });
  }
  const studentCandidate = students.find(
    (s) => String(s.username || "").toLowerCase() === uLower || String(s.nis || "").toLowerCase() === uLower
  );
  const student = studentCandidate && await verifyPasswordAsync(p, String(studentCandidate.password)) ? studentCandidate : null;
  if (student) {
    const studentUser = {
      id: student.id,
      name: student.name,
      username: student.username,
      nis: student.nis,
      classId: student.classId,
      class_id: student.classId,
      role: student.role || "student",
      photo: student.photo,
      no_hp: student.no_hp
    };
    const token = createAuthToken(studentUser);
    return res.json({
      success: true,
      token,
      user: { ...studentUser, token }
    });
  }
  return res.status(401).json({ success: false, message: "Username atau password salah." });
});
app.get("/api/auth/me", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Belum login atau token kedaluwarsa" });
  }
  res.json({ success: true, user: authUser });
});
function sanitizeMadrasahPublic(m) {
  if (!m) return null;
  return {
    id: m.id,
    name: m.name,
    slug: m.slug,
    level: m.level,
    phone: m.phone,
    isActive: m.isActive
  };
}
app.get("/api/madrasahs", requireAuth, (req, res) => {
  const authUser = req.user;
  const isBos = authUser && (authUser.role === "bos" || authUser.role === "superadmin");
  if (isBos) {
    return res.json({ success: true, madrasahs: (madrasahs || []).map(({ adminPass, ...rest }) => rest) });
  }
  res.json({ success: true, madrasahs: (madrasahs || []).map(sanitizeMadrasahPublic) });
});
app.get("/api/madrasah-by-slug/:slug", (req, res) => {
  const { slug } = req.params;
  const m = madrasahs.find((item) => String(item.slug).toLowerCase() === String(slug).toLowerCase() || String(item.id) === String(slug));
  if (!m) {
    return res.status(404).json({ success: false, message: "Madrasah tidak ditemukan." });
  }
  const authUser = req.user;
  const isBos = authUser && (authUser.role === "bos" || authUser.role === "superadmin");
  if (isBos) {
    return res.json({ success: true, madrasah: m });
  }
  res.json({ success: true, madrasah: sanitizeMadrasahPublic(m) });
});
app.post("/api/register-madrasah", async (req, res) => {
  const { name, slug, level, adminName, adminUser, adminPass, phone } = req.body;
  if (!name || !slug || !adminName || !adminUser || !adminPass) {
    return res.status(400).json({ success: false, message: "Semua data pendaftaran wajib diisi." });
  }
  const cleanSlug = String(slug).toLowerCase().trim().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  const RESERVED_SLUGS = ["api", "admin", "login", "cbt", "boss-panel", "boss", "vendor", "src", "public", "dist", "node_modules", "m", "settings", "absensi", "chat"];
  if (RESERVED_SLUGS.includes(cleanSlug)) {
    return res.status(400).json({ success: false, message: "Slug URL tersebut digunakan oleh sistem. Silakan pilih slug lain." });
  }
  if (madrasahs.some((m) => String(m.slug).toLowerCase() === cleanSlug)) {
    return res.status(400).json({ success: false, message: "Slug URL madrasah sudah terdaftar oleh sekolah lain." });
  }
  const newMadrasahId = "MDR_" + Date.now();
  const newMadrasah = {
    id: newMadrasahId,
    name: String(name).trim(),
    slug: cleanSlug,
    level: level || "MA",
    adminName: String(adminName).trim(),
    adminUser: String(adminUser).trim(),
    adminPass: hashPassword(String(adminPass).trim()),
    phone: String(phone || "").trim(),
    cbtTokenBalance: 1,
    // Free welcome token
    tokenSignature: calculateTokenSignature(newMadrasahId, 1),
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  madrasahs.push(newMadrasah);
  await saveData("madrasahs", madrasahs);
  await saveData("madrasahs", madrasahs);
  return res.json({
    success: true,
    madrasah: newMadrasah,
    message: `Madrasah ${newMadrasah.name} berhasil didaftarkan! URL khusus: /m/${newMadrasah.slug}`
  });
});
app.get("/api/cbt-token-price", (req, res) => {
  res.json({ success: true, price: cbtTokenPrice });
});
app.get("/api/payment-settings", (req, res) => {
  res.json({ success: true, paymentAccounts: appSettings.paymentAccounts || [] });
});
app.post("/api/payment-settings", requireAuth, requireRole(["bos", "superadmin"]), async (req, res) => {
  const { paymentAccounts } = req.body;
  if (Array.isArray(paymentAccounts)) {
    appSettings.paymentAccounts = paymentAccounts;
    await saveData("settings", appSettings);
    return res.json({ success: true, paymentAccounts: appSettings.paymentAccounts, message: "Pengaturan rekening pembayaran berhasil diperbarui!" });
  }
  return res.status(400).json({ success: false, message: "Data rekening tidak valid." });
});
app.post("/api/cbt-token-price", requireAuth, requireRole(["bos", "superadmin"]), async (req, res) => {
  const { price } = req.body;
  const newPrice = parseInt(price, 10);
  if (isNaN(newPrice) || newPrice < 0) {
    return res.status(400).json({ success: false, message: "Harga token tidak valid." });
  }
  cbtTokenPrice = newPrice;
  appSettings.cbtTokenPrice = newPrice;
  await saveData("settings", appSettings);
  return res.json({
    success: true,
    price: cbtTokenPrice,
    message: `Harga Token Ujian berhasil diubah menjadi Rp ${cbtTokenPrice.toLocaleString("id-ID")} / token.`
  });
});
app.get("/api/token-requests", requireAuth, (req, res) => {
  const authUser = req.user;
  const isBos = authUser.role === "bos" || authUser.role === "superadmin";
  const { madrasahId } = req.query;
  let filtered = tokenRequests || [];
  if (!isBos) {
    const userMId = getRequestMadrasahId(req);
    filtered = filtered.filter((tr) => String(tr.madrasahId) === String(userMId));
  } else if (madrasahId) {
    filtered = filtered.filter((tr) => String(tr.madrasahId) === String(madrasahId));
  }
  res.json({ success: true, tokenRequests: filtered, cbtTokenPrice });
});
app.post("/api/token-requests", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  const authUser = req.user;
  const isBos = authUser.role === "bos" || authUser.role === "superadmin";
  const userMId = getRequestMadrasahId(req);
  const { madrasahId, quantity, proofNote, proofFile } = req.body;
  const targetMadrasahId = isBos ? madrasahId || userMId : userMId;
  const qty = parseInt(quantity, 10);
  if (!targetMadrasahId || isNaN(qty) || qty <= 0) {
    return res.status(400).json({ success: false, message: "Jumlah token harus lebih dari 0." });
  }
  const m = madrasahs.find((item) => String(item.id) === String(targetMadrasahId) || String(item.slug) === String(targetMadrasahId));
  if (!m) {
    return res.status(404).json({ success: false, message: "Madrasah tidak ditemukan." });
  }
  const newReq = {
    id: "TRQ_" + Date.now(),
    madrasahId: m.id,
    madrasahName: m.name,
    quantity: qty,
    pricePerToken: cbtTokenPrice,
    totalPrice: qty * cbtTokenPrice,
    proofNote: proofNote || "",
    proofFile: proofFile || "",
    status: "pending",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  tokenRequests.push(newReq);
  await saveData("tokenRequests", tokenRequests);
  return res.json({
    success: true,
    tokenRequest: newReq,
    message: "Permintaan Top-Up Token berhasil dikirim ke Akun Bos."
  });
});
app.post("/api/token-requests/:id/approve", requireAuth, requireRole(["bos", "superadmin"]), async (req, res) => {
  if (!isBossRuntimeEnabled()) {
    return res.status(403).json({ success: false, message: "Persetujuan top-up hanya tersedia pada runtime BOSS Cloud Run yang tepercaya." });
  }
  const { id } = req.params;
  const { approvedQuantity } = req.body;
  const reqItem = tokenRequests.find((tr) => String(tr.id) === String(id));
  if (!reqItem) {
    return res.status(404).json({ success: false, message: "Permintaan top-up tidak ditemukan." });
  }
  const addQty = parseInt(approvedQuantity, 10) || reqItem.quantity;
  reqItem.status = "approved";
  reqItem.approvedQuantity = addQty;
  reqItem.approvedAt = (/* @__PURE__ */ new Date()).toISOString();
  let targetM = madrasahs.find((m) => String(m.id) === String(reqItem.madrasahId) || m.name === reqItem.madrasahName);
  if (!targetM && madrasahs.length > 0) targetM = madrasahs[0];
  if (targetM) {
    targetM.cbtTokenBalance = (targetM.cbtTokenBalance || 0) + addQty;
    delete targetM.tokenSignatureInvalid;
    targetM.tokenSignature = calculateTokenSignature(targetM.id, targetM.cbtTokenBalance);
  }
  await saveData("tokenRequests", tokenRequests);
  await saveData("madrasahs", madrasahs);
  return res.json({
    success: true,
    message: `Permintaan Top-Up berhasil disetujui! +${addQty} Token telah ditambahkan ke ${reqItem.madrasahName}.`
  });
});
app.post("/api/token-requests/:id/reject", requireAuth, requireRole(["bos", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  const reqItem = tokenRequests.find((tr) => String(tr.id) === String(id));
  if (!reqItem) {
    return res.status(404).json({ success: false, message: "Permintaan top-up tidak ditemukan." });
  }
  reqItem.status = "rejected";
  reqItem.rejectedAt = (/* @__PURE__ */ new Date()).toISOString();
  await saveData("tokenRequests", tokenRequests);
  return res.json({
    success: true,
    message: "Permintaan Top-Up telah ditolak."
  });
});
app.post("/api/madrasahs/:id/update-tokens", requireAuth, requireRole(["bos", "superadmin"]), async (req, res) => {
  if (!isBossRuntimeEnabled()) {
    return res.status(403).json({ success: false, message: "Pembaruan saldo token hanya tersedia pada runtime BOSS Cloud Run yang tepercaya." });
  }
  const { id } = req.params;
  const { newBalance, deltaTokens } = req.body;
  let targetM = madrasahs.find((m) => String(m.id) === String(id) || String(m.slug) === String(id));
  if (!targetM && madrasahs.length > 0) {
    targetM = madrasahs[0];
  }
  if (!targetM) {
    return res.status(404).json({ success: false, message: "Madrasah tidak ditemukan." });
  }
  if (newBalance !== void 0) {
    targetM.cbtTokenBalance = Math.max(0, parseInt(newBalance, 10) || 0);
  } else if (deltaTokens !== void 0) {
    targetM.cbtTokenBalance = Math.max(0, (targetM.cbtTokenBalance || 0) + (parseInt(deltaTokens, 10) || 0));
  }
  delete targetM.tokenSignatureInvalid;
  targetM.tokenSignature = calculateTokenSignature(targetM.id, targetM.cbtTokenBalance || 0);
  await saveData("madrasahs", madrasahs);
  return res.json({
    success: true,
    madrasah: targetM,
    message: `Saldo Token ${targetM.name} diperbarui menjadi ${targetM.cbtTokenBalance} Token.`
  });
});
app.post("/api/boss/generate-activation-key", requireAuth, requireRole(["bos", "superadmin"]), async (req, res) => {
  if (!isBossRuntimeEnabled()) {
    return res.status(403).json({
      success: false,
      code: "BOSS_RUNTIME_DISABLED",
      message: "Generator token hanya tersedia pada runtime BOSS Cloud Run yang memiliki kredensial dan private key platform."
    });
  }
  const { quantity } = req.body;
  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ success: false, message: "Jumlah token yang valid diperlukan." });
  }
  try {
    if (!process.env.LICENSE_PRIVATE_KEY) {
      return res.status(503).json({
        success: false,
        code: "ACTIVATION_SIGNING_KEY_NOT_CONFIGURED",
        message: "Private key aktivasi BOSS belum dikonfigurasi. Isi LICENSE_PRIVATE_KEY dan LICENSE_PUBLIC_KEY pada environment server BOSS."
      });
    }
    const privateKey = formatPrivateKeyPem(process.env.LICENSE_PRIVATE_KEY);
    let pubRaw = process.env.LICENSE_PUBLIC_KEY || "";
    if (pubRaw.length < 50) pubRaw = LICENSE_PUBLIC_KEY;
    const publicKey = formatPublicKeyPem(pubRaw);
    const probe = `MADRASAH_ACTIVATION_KEYPAIR_CHECK:${Date.now()}`;
    const probeSigner = import_crypto.default.createSign("SHA256");
    probeSigner.update(probe);
    probeSigner.end();
    const probeSignature = probeSigner.sign(privateKey, "base64");
    const probeVerifier = import_crypto.default.createVerify("SHA256");
    probeVerifier.update(probe);
    probeVerifier.end();
    if (!probeVerifier.verify(publicKey, probeSignature, "base64")) {
      return res.status(503).json({
        success: false,
        code: "ACTIVATION_KEYPAIR_MISMATCH",
        message: "LICENSE_PRIVATE_KEY dan LICENSE_PUBLIC_KEY pada server BOSS bukan pasangan yang sama."
      });
    }
    const timestamp = Date.now();
    const nonce = import_crypto.default.randomBytes(8).toString("hex").toUpperCase();
    const activationId = `UNIVERSAL_RSA2_${nonce}`;
    const dataToSign = `${activationId}:${qty}:${timestamp}`;
    const signer = import_crypto.default.createSign("SHA256");
    signer.update(dataToSign);
    signer.end();
    const signature = signer.sign(privateKey, "base64");
    const activationKey = Buffer.from(`${dataToSign}:${signature}`).toString("base64");
    return res.json({ success: true, activationKey, signatureVersion: "RSA2" });
  } catch (err) {
    console.error("Failed to generate activation key:", err);
    return res.status(500).json({ success: false, message: "Gagal menghasilkan kunci: " + err.message });
  }
});
app.post("/api/madrasah/activate-offline-tokens", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  const { activationKey, teacherId } = req.body;
  if (!activationKey) {
    return res.status(400).json({ success: false, message: "Kode aktivasi tidak boleh kosong." });
  }
  try {
    const decoded = Buffer.from(activationKey, "base64").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length < 4) {
      return res.status(400).json({ success: false, message: "Format kode aktivasi tidak valid atau rusak." });
    }
    const madrasahId = parts[0];
    const qtyStr = parts[1];
    const timestampStr = parts[2];
    const signature = parts.slice(3).join(":");
    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: "Jumlah token tidak valid." });
    }
    const dataToVerify = `${madrasahId}:${qtyStr}:${timestampStr}`;
    let isValid = false;
    const secret = TOKEN_LOCK_SECRET || LEGACY_TOKEN_LOCK_SECRET;
    const expectedHmacPrimary = "HMAC_" + import_crypto.default.createHmac("sha256", secret).update(dataToVerify).digest("hex");
    const expectedHmacDefault = "HMAC_" + import_crypto.default.createHmac("sha256", LEGACY_TOKEN_LOCK_SECRET).update(dataToVerify).digest("hex");
    if (signature === expectedHmacPrimary || signature === expectedHmacDefault) {
      isValid = true;
    } else {
      const keysToTry = [];
      if (process.env.LICENSE_PUBLIC_KEY) {
        try {
          keysToTry.push(formatPublicKeyPem(process.env.LICENSE_PUBLIC_KEY));
        } catch (_) {
        }
      }
      if (LICENSE_PUBLIC_KEY) keysToTry.push(formatPublicKeyPem(LICENSE_PUBLIC_KEY));
      if (process.env.LICENSE_PRIVATE_KEY) {
        const keyPair = getServerKeyPair();
        if (keyPair?.publicKey) keysToTry.push(keyPair.publicKey);
      }
      const uniqueKeysToTry = Array.from(new Set(keysToTry.filter(Boolean)));
      for (const pubKey of uniqueKeysToTry) {
        try {
          const verify = import_crypto.default.createVerify("SHA256");
          verify.write(dataToVerify);
          verify.end();
          if (verify.verify(pubKey, signature, "base64")) {
            isValid = true;
            break;
          }
        } catch (e) {
        }
      }
    }
    if (!isValid) {
      return res.status(400).json({ success: false, message: "Kode aktivasi tidak sah! Tanda tangan digital tidak cocok." });
    }
    if (!usedActivationKeys) {
      usedActivationKeys = [];
    }
    if (usedActivationKeys.includes(signature)) {
      return res.status(400).json({ success: false, message: "Kode aktivasi ini sudah pernah digunakan sebelumnya!" });
    }
    if (teacherId) {
      let tch = teachers.find((t) => String(t.id) === String(teacherId) || String(t.username) === String(teacherId) || String(t.nip) === String(teacherId));
      if (!tch) {
        return res.status(404).json({ success: false, message: "Data guru tidak ditemukan." });
      }
      tch.cbtTokenBalance = (tch.cbtTokenBalance || 0) + qty;
      usedActivationKeys.push(signature);
      await saveData("usedActivationKeys", usedActivationKeys);
      await saveData("teachers", teachers);
      return res.json({
        success: true,
        remainingTokens: tch.cbtTokenBalance,
        isTeacher: true,
        message: `Berhasil diaktivasi! Ditambahkan +${qty} Token ke akun Guru ${tch.name}. Saldo terbaru: ${tch.cbtTokenBalance} Token.`
      });
    }
    let targetM = madrasahs.find((m) => String(m.id) === String(madrasahId) || String(m.slug) === String(madrasahId));
    if (!targetM && madrasahs.length > 0) {
      targetM = madrasahs[0];
    }
    if (!targetM) {
      return res.status(404).json({ success: false, message: "Data madrasah tidak ditemukan di server ini." });
    }
    targetM.cbtTokenBalance = (targetM.cbtTokenBalance || 0) + qty;
    delete targetM.tokenSignatureInvalid;
    targetM.tokenSignature = calculateTokenSignature(targetM.id, targetM.cbtTokenBalance);
    usedActivationKeys.push(signature);
    await saveData("usedActivationKeys", usedActivationKeys);
    await saveData("madrasahs", madrasahs);
    return res.json({
      success: true,
      remainingTokens: targetM.cbtTokenBalance,
      message: `Berhasil diaktivasi! Ditambahkan +${qty} Token ke ${targetM.name}. Saldo terbaru: ${targetM.cbtTokenBalance} Token.`
    });
  } catch (err) {
    console.error("Failed to verify activation key:", err);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan sistem saat verifikasi: " + err.message });
  }
});
app.post("/api/deduct-cbt-token", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  const authUser = req.user;
  if (authUser.role === "teacher" || authUser.role === "guru") {
    const teacherId = authUser.id;
    let tch = teachers.find((t) => String(t.id) === String(teacherId) || String(t.username) === String(teacherId) || String(t.nip) === String(teacherId));
    if (!tch) {
      return res.status(404).json({ success: false, message: "Data guru tidak ditemukan." });
    }
    if ((tch.cbtTokenBalance || 0) <= 0) {
      return res.status(400).json({
        success: false,
        message: `Saldo Token Ujian Anda (Guru) habis (0 Token). Harap lakukan isi ulang token menggunakan Kode Aktivasi Token dari Bos Platform.`
      });
    }
    tch.cbtTokenBalance -= 1;
    await saveData("teachers", teachers);
    return res.json({
      success: true,
      remainingTokens: tch.cbtTokenBalance,
      isTeacher: true,
      message: "1 Token Ujian Guru berhasil digunakan."
    });
  } else {
    const madrasahId = getRequestMadrasahId(req) || authUser.madrasahId;
    let targetM = madrasahs.find((m) => String(m.id) === String(madrasahId) || String(m.slug) === String(madrasahId));
    if (!targetM && madrasahs.length > 0) {
      targetM = madrasahs[0];
    }
    if (!targetM) {
      return res.status(404).json({ success: false, message: "Madrasah tidak ditemukan." });
    }
    if (targetM.tokenSignatureInvalid) {
      return res.status(409).json({
        success: false,
        code: "TOKEN_SIGNATURE_RESEAL_REQUIRED",
        message: "Saldo token tersimpan tetapi signature perlu diverifikasi ulang melalui jalur resmi BOSS/top-up sebelum digunakan."
      });
    }
    if ((targetM.cbtTokenBalance || 0) <= 0) {
      return res.status(400).json({
        success: false,
        message: `Saldo Token Ujian madrasah habis (0 Token). Harga token: Rp ${cbtTokenPrice.toLocaleString("id-ID")}/token.`
      });
    }
    targetM.cbtTokenBalance -= 1;
    delete targetM.tokenSignatureInvalid;
    targetM.tokenSignature = calculateTokenSignature(targetM.id, targetM.cbtTokenBalance);
    await saveData("madrasahs", madrasahs);
    return res.json({
      success: true,
      remainingTokens: targetM.cbtTokenBalance,
      message: "1 Token Ujian berhasil digunakan."
    });
  }
});
app.put("/api/teachers/:id/tokens", requireAuth, requireRole(["admin", "bos", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  const { cbtTokenBalance, deltaTokens } = req.body;
  const idx = teachers.findIndex((t) => String(t.id) === String(id));
  if (idx < 0) {
    return res.status(404).json({ success: false, message: "Guru tidak ditemukan." });
  }
  const authUser = req.user;
  const isBos = authUser.role === "bos" || authUser.role === "superadmin";
  if (!isBos) {
    const userMId = getRequestMadrasahId(req);
    const teacherMId = teachers[idx].madrasahId || "default";
    if (String(userMId) !== String(teacherMId)) {
      return res.status(403).json({ success: false, message: "Akses ditolak: Anda tidak memiliki akses ke guru madrasah ini." });
    }
  }
  if (cbtTokenBalance !== void 0) {
    teachers[idx].cbtTokenBalance = Math.max(0, parseInt(cbtTokenBalance, 10) || 0);
  } else if (deltaTokens !== void 0) {
    teachers[idx].cbtTokenBalance = Math.max(0, (teachers[idx].cbtTokenBalance || 0) + (parseInt(deltaTokens, 10) || 0));
  }
  await saveData("teachers", teachers);
  return res.json({
    success: true,
    cbtTokenBalance: teachers[idx].cbtTokenBalance,
    message: `Saldo Token Guru ${teachers[idx].name} diperbarui menjadi ${teachers[idx].cbtTokenBalance} Token.`
  });
});
app.post("/api/madrasahs/:id/toggle-status", requireAuth, requireRole(["bos", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  const targetM = madrasahs.find((m) => String(m.id) === String(id) || String(m.slug) === String(id));
  if (!targetM) {
    return res.status(404).json({ success: false, message: "Madrasah tidak ditemukan." });
  }
  targetM.isActive = targetM.isActive === false ? true : false;
  await saveData("madrasahs", madrasahs);
  return res.json({
    success: true,
    madrasah: targetM,
    isActive: targetM.isActive,
    message: `Status ${targetM.name} berhasil diubah menjadi ${targetM.isActive ? "AKTIF" : "NONAKTIF"}.`
  });
});
app.post("/api/madrasahs/:id/update", requireAuth, requireRole(["bos", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  const { name, level, adminName, adminUser, adminPass, phone, cbtTokenBalance, isActive } = req.body;
  const targetM = madrasahs.find((m) => String(m.id) === String(id) || String(m.slug) === String(id));
  if (!targetM) {
    return res.status(404).json({ success: false, message: "Madrasah tidak ditemukan." });
  }
  if (name) targetM.name = String(name).trim();
  if (level) targetM.level = String(level).trim();
  if (adminName) targetM.adminName = String(adminName).trim();
  if (adminUser) targetM.adminUser = String(adminUser).trim();
  if (adminPass && String(adminPass).trim().length > 0) targetM.adminPass = hashPassword(String(adminPass).trim());
  if (phone !== void 0) targetM.phone = String(phone).trim();
  if (cbtTokenBalance !== void 0) {
    if (!isBossRuntimeEnabled()) {
    } else {
      targetM.cbtTokenBalance = Math.max(0, parseInt(cbtTokenBalance, 10) || 0);
      delete targetM.tokenSignatureInvalid;
      targetM.tokenSignature = calculateTokenSignature(targetM.id, targetM.cbtTokenBalance);
    }
  }
  if (isActive !== void 0) targetM.isActive = Boolean(isActive);
  await saveData("madrasahs", madrasahs);
  return res.json({
    success: true,
    madrasah: targetM,
    message: `Data ${targetM.name} berhasil diperbarui.`
  });
});
app.delete("/api/madrasahs/:id", requireAuth, requireRole(["bos", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  const index = madrasahs.findIndex((m) => String(m.id) === String(id) || String(m.slug) === String(id));
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Madrasah tidak ditemukan." });
  }
  const deletedName = madrasahs[index].name;
  madrasahs.splice(index, 1);
  if (madrasahs.length === 0) {
    madrasahs.push({
      id: "default",
      name: appSettings?.schoolName || "Madrasah Utama",
      slug: "default",
      level: "MA",
      adminName: "Administrator",
      adminUser: "admin",
      adminPass: "",
      phone: "",
      cbtTokenBalance: 0,
      isActive: false,
      requiresSetup: true,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  await saveData("madrasahs", madrasahs);
  return res.json({
    success: true,
    message: `Madrasah "${deletedName}" berhasil dihapus.`
  });
});
function getRequestMadrasahId(req) {
  const authUser = req.user || getAuthUser(req);
  if (authUser) {
    const role = String(authUser.role || "").toLowerCase();
    if (role === "bos" || role === "superadmin") {
      const headerVal2 = req.headers["x-madrasah-id"];
      if (headerVal2) return String(headerVal2);
      if (req.query.madrasahId) return String(req.query.madrasahId);
      return authUser.madrasahId || "default";
    }
    return authUser.madrasahId || "default";
  }
  const headerVal = req.headers["x-madrasah-id"];
  if (headerVal) return String(headerVal);
  if (req.query.madrasahId) return String(req.query.madrasahId);
  return null;
}
function filterByMadrasah(list, req) {
  if (!Array.isArray(list)) return list;
  const mId = getRequestMadrasahId(req);
  if (mId && mId !== "default" && mId !== "BOSS") {
    const matchM = madrasahs.find((m) => String(m.id) === mId || String(m.slug) === mId);
    const targetId = matchM ? matchM.id : mId;
    const targetSlug = matchM ? matchM.slug : mId;
    const matched = list.filter((item) => {
      if (!item) return false;
      const imId = String(item.madrasahId || "").trim();
      const imSlug = String(item.madrasahSlug || "").trim();
      if (!imId && !imSlug) return true;
      return imId === targetId || imSlug === targetSlug || imId === targetSlug || imSlug === targetId || imId === "default" || imSlug === "default";
    });
    if (matched.length > 0) return matched;
  }
  const defaultM = madrasahs.find((m) => m.id === "default" || m.slug === "default") || madrasahs[0];
  const defId = defaultM ? defaultM.id : "default";
  const defSlug = defaultM ? defaultM.slug : "default";
  return list.filter((item) => {
    if (!item) return false;
    const imId = String(item.madrasahId || "default").trim();
    const imSlug = String(item.madrasahSlug || "default").trim();
    return imId === "default" || imId === defId || imId === defSlug || imSlug === "default" || imSlug === defSlug || imSlug === defId || !item.madrasahId && !item.madrasahSlug;
  });
}
function tagNewRecord(item, req) {
  const mId = getRequestMadrasahId(req);
  if (mId && mId !== "default" && mId !== "BOSS") {
    const matchM = madrasahs.find((m) => String(m.id) === mId || String(m.slug) === mId);
    item.madrasahId = matchM ? matchM.id : mId;
    item.madrasahSlug = matchM ? matchM.slug : mId;
  } else {
    item.madrasahId = "default";
    item.madrasahSlug = "default";
  }
  return item;
}
function isItemForCurrentMadrasah(item, req) {
  if (!item) return false;
  const mId = getRequestMadrasahId(req);
  const imId = String(item.madrasahId || "").trim();
  const imSlug = String(item.madrasahSlug || "").trim();
  if (mId && mId !== "default" && mId !== "BOSS") {
    const matchM = madrasahs.find((m) => String(m.id) === mId || String(m.slug) === mId);
    const targetId = matchM ? matchM.id : mId;
    const targetSlug = matchM ? matchM.slug : mId;
    return imId === targetId || imSlug === targetSlug || imId === targetSlug || imSlug === targetId || imId === "default" || imSlug === "default";
  }
  const defaultM = madrasahs.find((m) => m.id === "default" || m.slug === "default") || madrasahs[0];
  const defId = defaultM ? defaultM.id : "default";
  const defSlug = defaultM ? defaultM.slug : "default";
  return imId === "default" || imId === defId || imId === defSlug || imSlug === "default" || imSlug === defSlug || imSlug === defId || !item.madrasahId && !item.madrasahSlug;
}
function mergeTenantListData(globalList, incomingData, req) {
  if (!Array.isArray(incomingData)) return globalList;
  if (!Array.isArray(globalList)) globalList = [];
  const taggedIncoming = incomingData.map((item) => {
    if (item && (item.madrasahId || item.madrasahSlug)) {
      return item;
    }
    return tagNewRecord({ ...item }, req);
  });
  const otherItems = globalList.filter((item) => !isItemForCurrentMadrasah(item, req));
  return [...otherItems, ...taggedIncoming];
}
function mergeLkpdListDataSmart(globalList, incomingData, req) {
  if (!Array.isArray(incomingData)) return globalList;
  if (!Array.isArray(globalList)) globalList = [];
  const userRole = String(req.headers["x-user-role"] || "student").trim().toLowerCase();
  const isStudent = userRole === "student";
  const taggedIncoming = incomingData.map((item) => {
    if (item && (item.madrasahId || item.madrasahSlug)) {
      return item;
    }
    return tagNewRecord({ ...item }, req);
  });
  const otherItems = globalList.filter((item) => !isItemForCurrentMadrasah(item, req));
  const currentSchoolExisting = globalList.filter((item) => isItemForCurrentMadrasah(item, req));
  if (taggedIncoming.length === 0) {
    return globalList;
  }
  const mergedItemsMap = /* @__PURE__ */ new Map();
  currentSchoolExisting.forEach((existingItem) => {
    if (existingItem && existingItem.id) {
      mergedItemsMap.set(String(existingItem.id), { ...existingItem });
    }
  });
  taggedIncoming.forEach((incomingItem) => {
    if (!incomingItem || !incomingItem.id) return;
    const key = String(incomingItem.id);
    const existing = mergedItemsMap.get(key);
    if (!existing) {
      if (!isStudent) {
        mergedItemsMap.set(key, incomingItem);
      }
    } else {
      const mergedSubmissionsMap = /* @__PURE__ */ new Map();
      const existingSubs = Array.isArray(existing.submissions) ? existing.submissions : [];
      existingSubs.forEach((sub) => {
        if (sub && sub.studentId) {
          mergedSubmissionsMap.set(String(sub.studentId), sub);
        }
      });
      const incomingSubs = Array.isArray(incomingItem.submissions) ? incomingItem.submissions : [];
      incomingSubs.forEach((sub) => {
        if (sub && sub.studentId) {
          const existingSub = mergedSubmissionsMap.get(String(sub.studentId));
          if (!existingSub) {
            mergedSubmissionsMap.set(String(sub.studentId), sub);
          } else {
            mergedSubmissionsMap.set(String(sub.studentId), {
              ...existingSub,
              ...sub,
              answers: { ...existingSub.answers || {}, ...sub.answers || {} },
              scores: { ...existingSub.scores || {}, ...sub.scores || {} },
              feedback: { ...existingSub.feedback || {}, ...sub.feedback || {} }
            });
          }
        }
      });
      if (isStudent) {
        mergedItemsMap.set(key, {
          ...existing,
          submissions: Array.from(mergedSubmissionsMap.values())
        });
      } else {
        mergedItemsMap.set(key, {
          ...existing,
          ...incomingItem,
          submissions: Array.from(mergedSubmissionsMap.values())
        });
      }
    }
  });
  if (isStudent) {
    currentSchoolExisting.forEach((existingItem) => {
      if (existingItem && existingItem.id && !mergedItemsMap.has(String(existingItem.id))) {
        mergedItemsMap.set(String(existingItem.id), existingItem);
      }
    });
  }
  return [...otherItems, ...Array.from(mergedItemsMap.values())];
}
app.get("/api/teachers", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), (req, res) => {
  const list = filterByMadrasah(teachers, req);
  const sanitized = list.map(({ password, ...rest }) => rest);
  res.json({ success: true, teachers: sanitized });
});
app.post("/api/teachers", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  let { nip, name, username, password, mapel, homeroom_class_id, photo, phone, no_hp, email, address, alamat, gender, jenis_kelamin, nuptk, bio, photoHistory } = req.body;
  if (photo && photo.startsWith("data:image/")) {
    photo = await saveBase64ToFirestore(photo);
  }
  if (!nip || !name || !username) {
    return res.status(400).json({ success: false, message: "NIP, Nama, dan Username wajib diisi." });
  }
  const newId = "T" + Date.now();
  const rawPassword = password || "guru123";
  const hashed = hashPassword(rawPassword);
  const newTeacher = tagNewRecord({
    id: newId,
    nip,
    name,
    username,
    password: hashed,
    mapel: Array.isArray(mapel) ? mapel : [mapel],
    role: "teacher",
    cbtTokenBalance: 0,
    homeroom_class_id: homeroom_class_id || "",
    photo: photo || "",
    phone: phone || no_hp || "",
    no_hp: no_hp || phone || "",
    email: email || "",
    address: address || alamat || "",
    alamat: alamat || address || "",
    gender: gender || jenis_kelamin || "L",
    jenis_kelamin: jenis_kelamin || gender || "L",
    nuptk: nuptk || "",
    bio: bio || "",
    photoHistory: photoHistory || []
  }, req);
  teachers.push(newTeacher);
  await saveData("teachers", teachers);
  const { password: _, ...sanitizedNewTeacher } = newTeacher;
  res.json({ success: true, teacher: sanitizedNewTeacher });
});
app.put("/api/teachers/:id", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  const idx = teachers.findIndex((t2) => String(t2.id) === String(id));
  if (idx < 0) {
    return res.status(404).json({ success: false, message: "Guru tidak ditemukan." });
  }
  const t = teachers[idx];
  let updatedPassword = t.password;
  if (req.body.password && String(req.body.password).trim().length > 0) {
    updatedPassword = hashPassword(req.body.password);
  }
  teachers[idx] = {
    ...t,
    nip: req.body.nip ?? t.nip,
    name: req.body.name ?? t.name,
    username: req.body.username ?? t.username,
    password: updatedPassword,
    mapel: Array.isArray(req.body.mapel) ? req.body.mapel : req.body.mapel !== void 0 ? [req.body.mapel] : t.mapel,
    homeroom_class_id: req.body.homeroom_class_id ?? t.homeroom_class_id,
    phone: req.body.phone ?? req.body.no_hp ?? t.phone ?? t.no_hp ?? "",
    no_hp: req.body.no_hp ?? req.body.phone ?? t.no_hp ?? t.phone ?? "",
    email: req.body.email ?? t.email ?? "",
    address: req.body.address ?? req.body.alamat ?? t.address ?? t.alamat ?? "",
    alamat: req.body.alamat ?? req.body.address ?? t.alamat ?? t.address ?? "",
    gender: req.body.gender ?? req.body.jenis_kelamin ?? t.gender ?? t.jenis_kelamin ?? "L",
    jenis_kelamin: req.body.jenis_kelamin ?? req.body.gender ?? t.jenis_kelamin ?? t.gender ?? "L",
    nuptk: req.body.nuptk ?? t.nuptk ?? "",
    bio: req.body.bio ?? t.bio ?? "",
    photoHistory: req.body.photoHistory ?? t.photoHistory ?? [],
    photo: req.body.photo && req.body.photo.startsWith("data:image/") ? await saveBase64ToFirestore(req.body.photo) : req.body.photo !== void 0 ? req.body.photo : t.photo
  };
  await saveData("teachers", teachers);
  const { password: _, ...sanitizedUpdatedTeacher } = teachers[idx];
  res.json({ success: true, teacher: sanitizedUpdatedTeacher });
});
app.put("/api/teachers/:id/change-role", requireAuth, requireRole(["admin", "bos", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  const tIdx = teachers.findIndex((t2) => String(t2.id) === String(id));
  if (tIdx < 0) {
    return res.status(404).json({ success: false, message: "Guru tidak ditemukan." });
  }
  const t = teachers[tIdx];
  const authUser = getAuthUser(req);
  const isBos = authUser?.role === "bos" || authUser?.role === "superadmin";
  if (!isBos && !isItemForCurrentMadrasah(t, req)) {
    return res.status(403).json({ success: false, message: "Akses ditolak." });
  }
  teachers.splice(tIdx, 1);
  let convertedPassword = t.password;
  if (req.body.password && String(req.body.password).trim()) {
    convertedPassword = hashPassword(String(req.body.password).trim());
  }
  const newStudent = tagNewRecord({
    id: "ST_" + Date.now(),
    nis: req.body.nis || t.nip || "100" + Date.now(),
    name: req.body.name || t.name,
    classId: req.body.classId || classes[0]?.id || "C1",
    class_id: req.body.classId || classes[0]?.id || "C1",
    username: req.body.username || t.username,
    password: convertedPassword,
    photo: req.body.photo || "",
    no_hp: req.body.no_hp || "",
    role: req.body.role || "student"
  }, req);
  students.push(newStudent);
  await saveData("teachers", teachers);
  await saveData("students", students);
  const { password: _, ...sanitizedNewStudent } = newStudent;
  res.json({ success: true, student: sanitizedNewStudent });
});
app.delete("/api/teachers/:id", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  const teacherToDelete = (teachers || []).find((t) => String(t.id) === String(id));
  const photoUrlsToDelete = /* @__PURE__ */ new Set();
  if (teacherToDelete) {
    if (teacherToDelete.photo && typeof teacherToDelete.photo === "string") {
      photoUrlsToDelete.add(teacherToDelete.photo);
    }
    if (Array.isArray(teacherToDelete.photoHistory)) {
      teacherToDelete.photoHistory.forEach((p) => {
        if (typeof p === "string") photoUrlsToDelete.add(p);
        else if (p && p.photo) photoUrlsToDelete.add(p.photo);
      });
    }
    if (Array.isArray(teacherToDelete.photo_history)) {
      teacherToDelete.photo_history.forEach((p) => {
        if (typeof p === "string") photoUrlsToDelete.add(p);
        else if (p && p.photo) photoUrlsToDelete.add(p.photo);
      });
    }
  }
  await updateStoreKeyWithLock("teacherAttendance", (currentVal) => {
    const list = Array.isArray(currentVal) ? currentVal : [];
    list.forEach((record) => {
      if (record && String(record.teacherId) === String(id) && record.photo) {
        photoUrlsToDelete.add(record.photo);
        record.photo = "";
      }
    });
    return list;
  });
  if (db) {
    for (const url of photoUrlsToDelete) {
      if (url && url.startsWith("/api/photos/")) {
        const docId = url.replace("/api/photos/", "").trim();
        if (docId) {
          try {
            await (0, import_firestore.deleteDoc)((0, import_firestore.doc)(db, "photos", docId));
          } catch (e) {
            console.error(`Failed to delete teacher photo doc ${docId} on teacher deletion:`, e);
          }
        }
      }
    }
  }
  teachers = teachers.filter((t) => String(t.id) !== String(id));
  await saveData("teachers", teachers);
  res.json({ success: true, message: "Guru dan seluruh riwayat foto absensinya berhasil dihapus." });
});
app.get("/api/students", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), (req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  const filtered = filterByMadrasah(students, req);
  const sortedStudents = [...filtered].sort((a, b) => {
    const nameA = String(a.name || "").trim().toLowerCase();
    const nameB = String(b.name || "").trim().toLowerCase();
    if (nameA !== nameB) {
      return nameA.localeCompare(nameB, "id", { sensitivity: "base" });
    }
    const nisA = String(a.nis || a.no_urut || a.id || "").trim();
    const nisB = String(b.nis || b.no_urut || b.id || "").trim();
    return nisA.localeCompare(nisB, void 0, { numeric: true, sensitivity: "base" });
  });
  const sanitized = sortedStudents.map(({ password, passwordRaw, ...rest }) => rest);
  res.json({ success: true, students: sanitized });
});
app.post("/api/students", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  let { nis, name, classId, username, password, photo, no_hp } = req.body;
  if (photo && photo.startsWith("data:image/")) {
    photo = await saveBase64ToFirestore(photo);
  }
  if (!nis || !name || !username) {
    return res.status(400).json({ success: false, message: "NIS, Nama, dan Username wajib diisi." });
  }
  const trimmedNis = String(nis).trim();
  const tenantStudents = filterByMadrasah(students, req);
  const existing = tenantStudents.find((s) => String(s.nis || "").trim() === trimmedNis && String(s.id) !== String(req.body.id || ""));
  if (existing) {
    return res.status(400).json({ success: false, message: `NIS "${trimmedNis}" sudah digunakan oleh siswa lain (${existing.name}).` });
  }
  const newId = req.body.id || "ST_" + Date.now();
  const rawPassword = password || "123456";
  const hashed = hashPassword(rawPassword);
  const newStudent = tagNewRecord({
    id: newId,
    nis: trimmedNis,
    name,
    classId: classId || "C1",
    class_id: classId || "C1",
    username,
    password: hashed,
    photo: photo || "",
    no_hp: no_hp || "",
    role: req.body.role || "student"
  }, req);
  students.push(newStudent);
  await saveData("students", students);
  const credentials = [{
    studentId: newId,
    username,
    temporaryPassword: rawPassword
  }];
  const { password: _, passwordRaw: __, ...sanitizedNewStudent } = newStudent;
  res.json({ success: true, student: sanitizedNewStudent, credentials });
});
app.post("/api/students/import", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  const importedList = req.body.students || [];
  let count = 0;
  let skipped = 0;
  const tenantStudents = filterByMadrasah(students, req);
  const existingNisSet = new Set(tenantStudents.map((s) => String(s.nis || "").trim()));
  const batchNisSet = /* @__PURE__ */ new Set();
  const tenantClasses = filterByMadrasah(classes, req);
  const defaultClassId = tenantClasses[0]?.id || "C1";
  const credentials = [];
  for (const item of importedList) {
    const itemNis = String(item.nis || "").trim();
    if (!item.name || !itemNis) {
      skipped++;
      continue;
    }
    if (existingNisSet.has(itemNis) || batchNisSet.has(itemNis)) {
      skipped++;
      continue;
    }
    batchNisSet.add(itemNis);
    existingNisSet.add(itemNis);
    const rawPassword = item.password || "123456";
    const hashed = hashPassword(rawPassword);
    const newId = "ST_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);
    const newStudent = tagNewRecord({
      id: newId,
      nis: itemNis,
      name: String(item.name),
      classId: item.classId || defaultClassId,
      class_id: item.classId || defaultClassId,
      username: item.username || "siswa_" + itemNis,
      password: hashed,
      photo: item.photo || "",
      no_hp: item.no_hp || "",
      role: "student"
    }, req);
    students.push(newStudent);
    credentials.push({
      studentId: newId,
      username: item.username || "siswa_" + itemNis,
      temporaryPassword: rawPassword
    });
    count++;
  }
  await saveData("students", students);
  res.json({ success: true, imported: count, skipped, credentials, message: `Berhasil import ${count} siswa, ${skipped} dilewati (NIS sudah terdaftar).` });
});
app.post("/api/students/bulk-upload-photos", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  const photos = req.body.photos || [];
  let updatedCount = 0;
  for (const item of photos) {
    const itemNis = String(item.nis || "").trim();
    if (!itemNis || !item.photo) continue;
    if (item.photo && item.photo.startsWith("data:image/")) {
      item.photo = await saveBase64ToFirestore(item.photo);
    }
    const idx = students.findIndex(
      (s) => String(s.nis || "").trim() === itemNis || String(s.username || "").trim() === itemNis
    );
    if (idx >= 0) {
      students[idx].photo = item.photo;
      updatedCount++;
    }
  }
  if (updatedCount > 0) {
    await saveData("students", students);
  }
  res.json({
    success: true,
    updated: updatedCount,
    message: `Berhasil memperbarui ${updatedCount} foto siswa.`
  });
});
app.put("/api/students/:id", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  let { nis, name, classId, username, password, photo, no_hp, role, photoHistory, photo_history } = req.body;
  if (photo && photo.startsWith("data:image/")) {
    photo = await saveBase64ToFirestore(photo);
  }
  let historyArr = photoHistory !== void 0 ? photoHistory : photo_history !== void 0 ? photo_history : void 0;
  if (Array.isArray(historyArr)) {
    for (let i = 0; i < historyArr.length; i++) {
      if (historyArr[i] && typeof historyArr[i] === "object" && historyArr[i].photo && historyArr[i].photo.startsWith("data:image/")) {
        historyArr[i].photo = await saveBase64ToFirestore(historyArr[i].photo);
      } else if (typeof historyArr[i] === "string" && historyArr[i].startsWith("data:image/")) {
        historyArr[i] = await saveBase64ToFirestore(historyArr[i]);
      }
    }
  }
  if (nis) {
    const trimmedNis = String(nis).trim();
    const duplicate = students.find((s) => String(s.nis || "").trim() === trimmedNis && String(s.id) !== String(id));
    if (duplicate) {
      return res.status(400).json({ success: false, message: `NIS "${trimmedNis}" sudah digunakan oleh siswa lain (${duplicate.name}).` });
    }
  }
  const idx = students.findIndex((s) => String(s.id) === String(id));
  if (idx < 0) {
    return res.status(404).json({ success: false, message: "Siswa tidak ditemukan." });
  }
  const st = students[idx];
  const authUser = getAuthUser(req);
  const isBos = authUser?.role === "bos" || authUser?.role === "superadmin";
  if (!isBos && !isItemForCurrentMadrasah(st, req)) {
    return res.status(403).json({ success: false, message: "Akses ditolak." });
  }
  let updatedPassword = st.password;
  const credentials = [];
  if (password && String(password).trim().length > 0) {
    updatedPassword = hashPassword(password);
    credentials.push({
      studentId: String(id),
      username: req.body.username ?? st.username,
      temporaryPassword: String(password).trim()
    });
  }
  const updatedStudent = {
    ...st,
    nis: nis ? String(nis).trim() : st.nis,
    name: req.body.name ?? st.name,
    username: req.body.username ?? st.username,
    password: updatedPassword,
    classId: req.body.classId ?? st.classId,
    class_id: req.body.classId ?? st.class_id,
    photo: req.body.photo !== void 0 ? photo : st.photo,
    photoHistory: historyArr !== void 0 ? historyArr : st.photoHistory || [],
    no_hp: req.body.no_hp !== void 0 ? req.body.no_hp : st.no_hp,
    role: req.body.role ?? st.role
  };
  delete updatedStudent.passwordRaw;
  students[idx] = updatedStudent;
  await saveData("students", students);
  const { password: _, passwordRaw: __, ...sanitizedUpdatedStudent } = students[idx];
  res.json({ success: true, student: sanitizedUpdatedStudent, credentials });
});
app.post("/api/students/:id/set-profile-photo", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  let { photo, source, date, label } = req.body;
  if (!photo) {
    return res.status(400).json({ success: false, message: "Parameter photo wajib diisi." });
  }
  if (photo.startsWith("data:image/")) {
    photo = await saveBase64ToFirestore(photo);
  }
  const idx = students.findIndex((s) => String(s.id) === String(id));
  if (idx < 0) {
    return res.status(404).json({ success: false, message: "Siswa tidak ditemukan." });
  }
  const st = students[idx];
  const prevPhoto = st.photo || "";
  let history = Array.isArray(st.photoHistory) ? [...st.photoHistory] : [];
  if (prevPhoto && !history.some((h) => (typeof h === "string" ? h : h.photo) === prevPhoto)) {
    history.unshift({
      photo: prevPhoto,
      date: st.photoUpdated || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      type: "initial",
      label: "Foto Sebelumnya"
    });
  }
  if (!history.some((h) => (typeof h === "string" ? h : h.photo) === photo)) {
    history.unshift({
      photo,
      date: date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      type: source || "attendance",
      label: label || (source === "attendance" ? `Foto Absensi (${date || "Hari Ini"})` : "Foto Profil")
    });
  }
  students[idx] = {
    ...st,
    photo,
    photoHistory: history,
    photoUpdated: date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
  };
  await saveData("students", students);
  const { password: _, ...sanitizedStudent } = students[idx];
  res.json({ success: true, student: sanitizedStudent, message: "Foto profil berhasil diperbarui." });
});
app.delete("/api/students/:id/photo-history", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  const { photoUrl } = req.body;
  if (!photoUrl) {
    return res.status(400).json({ success: false, message: "Parameter photoUrl wajib diisi." });
  }
  const idx = students.findIndex((s) => String(s.id) === String(id));
  if (idx < 0) {
    return res.status(404).json({ success: false, message: "Siswa tidak ditemukan." });
  }
  const st = students[idx];
  let history = Array.isArray(st.photoHistory) ? [...st.photoHistory] : [];
  history = history.filter((h) => {
    const p = typeof h === "string" ? h : h.photo || "";
    return p !== photoUrl;
  });
  let deletedPhotos = Array.isArray(st.deletedPhotos) ? [...st.deletedPhotos] : [];
  if (!deletedPhotos.includes(photoUrl)) {
    deletedPhotos.push(photoUrl);
  }
  let currentPhoto = st.photo || "";
  if (currentPhoto === photoUrl) {
    const remainingValid = history.filter((h) => {
      const p = typeof h === "string" ? h : h.photo || "";
      return p && !deletedPhotos.includes(p);
    });
    if (remainingValid.length > 0) {
      const first = remainingValid[0];
      currentPhoto = typeof first === "string" ? first : first.photo || "";
    } else {
      currentPhoto = "";
    }
  }
  let attChanged = false;
  attendance.forEach((a) => {
    if ((String(a.studentId) === String(id) || st.nis && String(a.nis) === String(st.nis)) && a.photo === photoUrl) {
      delete a.photo;
      attChanged = true;
    }
  });
  if (attChanged) {
    await saveData("attendance", attendance);
  }
  try {
    const urlParts = photoUrl.split("/");
    const photoId = urlParts[urlParts.length - 1];
    if (photoId) {
      const localFilePath = import_path.default.join(uploadsDir, photoId);
      if (import_fs.default.existsSync(localFilePath)) {
        import_fs.default.unlinkSync(localFilePath);
      }
      if (db) {
        await (0, import_firestore.deleteDoc)((0, import_firestore.doc)(db, "photos", photoId));
      }
    }
  } catch (err) {
    console.warn("Failed to delete physical/Firestore photo asset:", err);
  }
  students[idx] = {
    ...st,
    photo: currentPhoto,
    photoHistory: history,
    deletedPhotos
  };
  await saveData("students", students);
  const { password: _, ...sanitizedStudent } = students[idx];
  res.json({ success: true, student: sanitizedStudent, message: "Foto riwayat berhasil dihapus." });
});
app.put("/api/students/:id/change-role", requireAuth, requireRole(["admin", "bos", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  const sIdx = students.findIndex((s) => String(s.id) === String(id));
  if (sIdx < 0) {
    return res.status(404).json({ success: false, message: "Siswa tidak ditemukan." });
  }
  const st = students[sIdx];
  const authUser = getAuthUser(req);
  const isBos = authUser?.role === "bos" || authUser?.role === "superadmin";
  if (!isBos && !isItemForCurrentMadrasah(st, req)) {
    return res.status(403).json({ success: false, message: "Akses ditolak." });
  }
  students.splice(sIdx, 1);
  let convertedPassword = st.password;
  if (req.body.password && String(req.body.password).trim()) {
    convertedPassword = hashPassword(String(req.body.password).trim());
  }
  const newTeacher = tagNewRecord({
    id: "T_" + Date.now(),
    nip: req.body.nip || st.nis || "199" + Date.now(),
    name: req.body.name || st.name,
    username: req.body.username || st.username,
    password: convertedPassword,
    mapel: req.body.mapel || ["Fikih"],
    role: "teacher",
    homeroom_class_id: req.body.homeroom_class_id || ""
  }, req);
  teachers.push(newTeacher);
  await saveData("teachers", teachers);
  await saveData("students", students);
  const { password: _, ...sanitizedNewTeacher } = newTeacher;
  res.json({ success: true, teacher: sanitizedNewTeacher });
});
app.put("/api/users/change-role", requireAuth, requireRole(["admin", "bos", "superadmin"]), async (req, res) => {
  const { userId, newRole } = req.body;
  if (!userId || !newRole) {
    return res.status(400).json({ success: false, message: "userId dan newRole wajib diisi." });
  }
  const sIdx = students.findIndex((s) => String(s.id) === String(userId));
  const tIdx = teachers.findIndex((t) => String(t.id) === String(userId));
  if (sIdx < 0 && tIdx < 0) {
    return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan." });
  }
  const targetUser = sIdx >= 0 ? students[sIdx] : teachers[tIdx];
  const authUser = getAuthUser(req);
  const isBos = authUser?.role === "bos" || authUser?.role === "superadmin";
  if (!isBos && !isItemForCurrentMadrasah(targetUser, req)) {
    return res.status(403).json({ success: false, message: "Akses ditolak." });
  }
  if (newRole === "teacher" || newRole === "guru") {
    if (tIdx >= 0) {
      teachers[tIdx].role = "teacher";
      await saveData("teachers", teachers);
      const { password: _, ...sanitizedTeacher } = teachers[tIdx];
      return res.json({ success: true, message: "Peran berhasil diubah menjadi Guru.", user: sanitizedTeacher, role: "teacher" });
    } else {
      const st = students[sIdx];
      students.splice(sIdx, 1);
      let convertedPassword = st.password;
      if (req.body.password && String(req.body.password).trim()) {
        convertedPassword = hashPassword(String(req.body.password).trim());
      }
      const newTeacher = tagNewRecord({
        id: st.id,
        nip: st.nis || "199" + Date.now(),
        name: st.name,
        username: st.username,
        password: convertedPassword,
        mapel: ["Fikih"],
        role: "teacher",
        homeroom_class_id: ""
      }, req);
      teachers.push(newTeacher);
      await saveData("teachers", teachers);
      await saveData("students", students);
      const { password: _, ...sanitizedNewTeacher } = newTeacher;
      return res.json({ success: true, message: "Peran berhasil diubah menjadi Guru.", user: sanitizedNewTeacher, role: "teacher" });
    }
  } else if (newRole === "student" || newRole === "class_leader" || newRole === "murid" || newRole === "ketua_kelas") {
    const roleValue = newRole === "class_leader" || newRole === "ketua_kelas" ? "class_leader" : "student";
    if (sIdx >= 0) {
      students[sIdx].role = roleValue;
      await saveData("students", students);
      const { password: _, ...sanitizedStudent } = students[sIdx];
      return res.json({ success: true, message: `Peran berhasil diubah menjadi ${roleValue === "class_leader" ? "Ketua Kelas" : "Murid"}.`, user: sanitizedStudent, role: roleValue });
    } else {
      const tch = teachers[tIdx];
      teachers.splice(tIdx, 1);
      classes.forEach((c) => {
        if (String(c.homeroomTeacherId) === String(userId)) {
          c.homeroomTeacherId = "";
        }
      });
      let convertedPassword = tch.password;
      if (req.body.password && String(req.body.password).trim()) {
        convertedPassword = hashPassword(String(req.body.password).trim());
      }
      const newStudent = tagNewRecord({
        id: tch.id,
        nis: tch.nip || "100" + Date.now().toString().substr(-3),
        name: tch.name,
        classId: classes[0]?.id || "C1",
        class_id: classes[0]?.id || "C1",
        username: tch.username,
        password: convertedPassword,
        photo: "",
        no_hp: "",
        role: roleValue
      }, req);
      students.push(newStudent);
      await saveData("teachers", teachers);
      await saveData("students", students);
      await saveData("classes", classes);
      const { password: _, ...sanitizedNewStudent } = newStudent;
      return res.json({ success: true, message: `Peran berhasil diubah menjadi ${roleValue === "class_leader" ? "Ketua Kelas" : "Murid"}.`, user: sanitizedNewStudent, role: roleValue });
    }
  }
  res.status(400).json({ success: false, message: "Role tidak valid." });
});
app.delete("/api/students/:id", requireAuth, requireRole(["admin", "bos", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  const targetStudent = students.find((s) => String(s.id) === String(id));
  if (!targetStudent) {
    return res.status(404).json({ success: false, message: "Siswa tidak ditemukan." });
  }
  const authUser = getAuthUser(req);
  const isBos = authUser?.role === "bos" || authUser?.role === "superadmin";
  if (!isBos && !isItemForCurrentMadrasah(targetStudent, req)) {
    return res.status(403).json({ success: false, message: "Akses ditolak." });
  }
  const targetNis = targetStudent ? String(targetStudent.nis || "").trim() : "";
  if (db && targetStudent && targetStudent.photo && targetStudent.photo.startsWith("/api/photos/")) {
    const docId = targetStudent.photo.replace("/api/photos/", "");
    if (docId) {
      try {
        await (0, import_firestore.deleteDoc)((0, import_firestore.doc)(db, "photos", docId));
      } catch (e) {
      }
    }
  }
  if (db) {
    const studentAttRecords = (attendance || []).filter((a) => String(a.studentId) === String(id) || targetNis && String(a.nis) === targetNis);
    for (const rec of studentAttRecords) {
      if (rec && rec.photo && rec.photo.startsWith("/api/photos/")) {
        const docId = rec.photo.replace("/api/photos/", "");
        if (docId) {
          try {
            await (0, import_firestore.deleteDoc)((0, import_firestore.doc)(db, "photos", docId));
          } catch (e) {
          }
        }
      }
    }
  }
  students = students.filter((s) => String(s.id) !== String(id));
  await saveData("students", students);
  if (Array.isArray(attendance)) {
    attendance = attendance.filter((a) => String(a.studentId) !== String(id) && (!targetNis || String(a.nis) !== targetNis));
    await saveData("attendance", attendance);
  }
  if (Array.isArray(grades)) {
    grades = grades.filter((g) => String(g.studentId) !== String(id) && (!targetNis || String(g.nis) !== targetNis));
    await saveData("grades", grades);
  }
  res.json({ success: true, message: "Siswa dan seluruh data terkait (foto, absensi, dan nilai) berhasil dihapus." });
});
app.post("/api/students/delete-bulk", requireAuth, requireRole(["admin", "bos", "superadmin"]), async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ success: false, message: "IDs harus berupa array." });
  }
  const authUser = getAuthUser(req);
  const isBos = authUser?.role === "bos" || authUser?.role === "superadmin";
  const requestedIds = new Set(ids.map((id) => String(id)));
  const targetStudents = students.filter((st) => {
    if (!requestedIds.has(String(st.id))) return false;
    if (isBos) return true;
    return isItemForCurrentMadrasah(st, req);
  });
  const allowedIdsSet = new Set(targetStudents.map((st) => String(st.id)));
  const allowedIdsArr = Array.from(allowedIdsSet);
  const targetNisSet = new Set(targetStudents.map((s) => String(s.nis || "").trim()).filter(Boolean));
  if (db) {
    for (const st of targetStudents) {
      if (st && st.photo && st.photo.startsWith("/api/photos/")) {
        const docId = st.photo.replace("/api/photos/", "");
        if (docId) {
          try {
            await (0, import_firestore.deleteDoc)((0, import_firestore.doc)(db, "photos", docId));
          } catch (e) {
          }
        }
      }
    }
    const studentAttRecords = (attendance || []).filter((a) => allowedIdsSet.has(String(a.studentId)) || a.nis && targetNisSet.has(String(a.nis)));
    for (const rec of studentAttRecords) {
      if (rec && rec.photo && rec.photo.startsWith("/api/photos/")) {
        const docId = rec.photo.replace("/api/photos/", "");
        if (docId) {
          try {
            await (0, import_firestore.deleteDoc)((0, import_firestore.doc)(db, "photos", docId));
          } catch (e) {
          }
        }
      }
    }
  }
  students = students.filter((s) => !allowedIdsSet.has(String(s.id)));
  await saveData("students", students);
  if (Array.isArray(attendance)) {
    attendance = attendance.filter((a) => !allowedIdsSet.has(String(a.studentId)) && (!a.nis || !targetNisSet.has(String(a.nis))));
    await saveData("attendance", attendance);
  }
  if (Array.isArray(grades)) {
    grades = grades.filter((g) => !allowedIdsSet.has(String(g.studentId)) && (!g.nis || !targetNisSet.has(String(g.nis))));
    await saveData("grades", grades);
  }
  res.json({ success: true, message: `${allowedIdsArr.length} siswa dan seluruh data terkait (foto, absensi, dan nilai) berhasil dihapus.` });
});
app.get("/api/classes", requireAuth, (req, res) => {
  res.json({ success: true, classes: filterByMadrasah(classes, req) });
});
app.post("/api/classes", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  const { name, grade, code, homeroomTeacherId } = req.body;
  let targetId = req.body.id;
  if (targetId) {
    const idx = classes.findIndex((c) => String(c.id) === String(targetId));
    if (idx >= 0) {
      classes[idx] = {
        ...classes[idx],
        name,
        grade,
        code: code || classes[idx].code,
        homeroomTeacherId: homeroomTeacherId || ""
      };
      teachers.forEach((t) => {
        if (String(t.id) === String(homeroomTeacherId)) {
          t.homeroom_class_id = String(targetId);
        } else if (String(t.homeroom_class_id) === String(targetId)) {
          t.homeroom_class_id = "";
        }
      });
      await saveData("classes", classes);
      await saveData("teachers", teachers);
      return res.json({ success: true, class: classes[idx] });
    }
  }
  const newId = "C" + (classes.length + 1);
  const newClass = tagNewRecord({ id: newId, code: code || newId, name, grade: grade || "X", homeroomTeacherId: homeroomTeacherId || "" }, req);
  classes.push(newClass);
  if (homeroomTeacherId) {
    teachers.forEach((t) => {
      if (String(t.id) === String(homeroomTeacherId)) {
        t.homeroom_class_id = newId;
      }
    });
  }
  await saveData("classes", classes);
  await saveData("teachers", teachers);
  res.json({ success: true, class: newClass });
});
app.delete("/api/classes/:id", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  classes = classes.filter((c) => String(c.id) !== String(id));
  await saveData("classes", classes);
  res.json({ success: true, message: "Kelas berhasil dihapus." });
});
app.get("/api/subjects", requireAuth, (req, res) => {
  res.json({ success: true, subjects: filterByMadrasah(subjects, req) });
});
app.post("/api/subjects", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  const { code, name } = req.body;
  if (!code || !name) {
    return res.status(400).json({ success: false, message: "Kode dan Nama mapel wajib diisi." });
  }
  const newId = "S" + (subjects.length + 1);
  const newSub = tagNewRecord({ id: newId, code, name }, req);
  subjects.push(newSub);
  await saveData("subjects", subjects);
  res.json({ success: true, subject: newSub });
});
app.delete("/api/subjects/:id", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  const { id } = req.params;
  subjects = subjects.filter((s) => String(s.id) !== String(id));
  await saveData("subjects", subjects);
  res.json({ success: true, message: "Mata pelajaran berhasil dihapus." });
});
function getRecordTimestamp(id, record) {
  if (record && typeof record.timestamp === "number") return record.timestamp;
  if (typeof id === "string") {
    const parts = id.split("_");
    if (parts.length >= 2) {
      const ts = parseInt(parts[1]);
      if (!isNaN(ts)) return ts;
    }
  }
  return 0;
}
app.get("/api/attendance", requireAuth, async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  const authUser = req.user || getAuthUser(req);
  const role = String(authUser?.role || "").toLowerCase();
  let list = filterByMadrasah(attendance || [], req);
  if (role === "student" || role === "siswa") {
    list = list.filter((item) => String(item.studentId || "") === String(authUser.id));
  } else if (role === "class_leader" || role === "ketua_kelas") {
    const selfStudent = (students || []).find((s) => String(s.id) === String(authUser.id));
    const classId = selfStudent?.classId || selfStudent?.class_id || authUser?.classId || "";
    list = list.filter((item) => String(item.classId || "") === String(classId));
  }
  res.json({ success: true, attendance: list });
});
app.post("/api/attendance", requireAuth, async (req, res) => {
  let { studentId, classId, date, status, location, photo, note, subjectId } = req.body;
  if (photo && photo.startsWith("data:image/")) {
    photo = await saveBase64ToFirestore(photo);
  }
  const today = date || getJakartaTodayDateStr();
  let resultItem = null;
  let isConflict = false;
  let isCooldown = false;
  let isUpdated = false;
  try {
    await updateStoreKeyWithLock("attendance", (currentVal) => {
      const attList = Array.isArray(currentVal) ? currentVal : [];
      const existingIndex = attList.findIndex(
        (a) => (String(a.studentId) === String(studentId) || a.studentId === studentId) && String(a.date).substring(0, 10) === today && (subjectId ? String(a.subjectId || "") === String(subjectId) : !a.subjectId || String(a.subjectId) === "ALL")
      );
      if (existingIndex !== -1) {
        const existingRecord = attList[existingIndex];
        const lastTapTime = getRecordTimestamp(existingRecord.id, existingRecord);
        const now = Date.now();
        if (note !== "Ketua Kelas" && note !== "Input Admin" && lastTapTime > 0 && now - lastTapTime < 5 * 60 * 1e3) {
          isCooldown = true;
          return attList;
        }
        if (note === "Ketua Kelas" || note === "Input Admin" || !attList[existingIndex].photo && photo) {
          attList[existingIndex].status = status || attList[existingIndex].status;
          if (location && location !== "Input Admin") {
            attList[existingIndex].location = location;
          } else if (!attList[existingIndex].location) {
            attList[existingIndex].location = location || "Input Admin";
          }
          if (photo) {
            attList[existingIndex].photo = photo;
          }
          if (note) attList[existingIndex].note = note;
          if (subjectId) attList[existingIndex].subjectId = subjectId;
          resultItem = attList[existingIndex];
          isUpdated = true;
          return attList;
        }
        isConflict = true;
        return attList;
      }
      const newAtt = tagNewRecord({
        id: "ATT_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        studentId,
        classId: classId || "",
        subjectId: subjectId || "",
        date: today,
        status: status || "HADIR",
        location: location || "",
        photo: photo || "",
        note: note || "",
        timestamp: Date.now()
      }, req);
      attList.push(newAtt);
      resultItem = newAtt;
      return attList;
    });
    if (isCooldown) {
      return res.status(429).json({
        success: false,
        cooldown: true,
        message: "Kartu baru saja di-tap. Harap tunggu 5 menit sebelum melakukan tap kembali."
      });
    }
    if (isConflict) {
      return res.status(409).json({
        success: false,
        already_attended: true,
        message: "Anda sudah melakukan absensi untuk mata pelajaran ini hari ini."
      });
    }
    res.json({ success: true, attendance: resultItem, updated: isUpdated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.post("/api/attendance/bulk", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ success: false, message: "Payload tidak valid." });
  }
  try {
    await updateStoreKeyWithLock("attendance", (currentVal) => {
      const attList = Array.isArray(currentVal) ? currentVal : [];
      items.forEach((item) => {
        const { studentId, classId, date, status, location, photo, note, subjectId } = item;
        const today = date || getJakartaTodayDateStr();
        const existingIndex = attList.findIndex(
          (a) => (String(a.studentId) === String(studentId) || a.studentId === studentId) && String(a.date).substring(0, 10) === today && (subjectId ? String(a.subjectId || "") === String(subjectId) : !a.subjectId || String(a.subjectId) === "ALL")
        );
        if (existingIndex !== -1) {
          attList[existingIndex].status = status || attList[existingIndex].status || "HADIR";
          if (location && location !== "Input Admin") {
            attList[existingIndex].location = location;
          } else if (!attList[existingIndex].location) {
            attList[existingIndex].location = location || "Input Admin";
          }
          if (photo) {
            attList[existingIndex].photo = photo;
          }
          if (note && !attList[existingIndex].note) {
            attList[existingIndex].note = note;
          }
          if (subjectId) attList[existingIndex].subjectId = subjectId;
        } else {
          attList.push(tagNewRecord({
            id: "ATT_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
            studentId,
            classId: classId || "",
            subjectId: subjectId || "",
            date: today,
            status: status || "HADIR",
            location: location || "Input Admin",
            photo: photo || "",
            note: note || "Input Admin"
          }, req));
        }
      });
      return attList;
    });
    res.json({ success: true, count: items.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.post("/api/attendance/reset", requireAuth, requireRole(["admin", "bos", "superadmin"]), async (req, res) => {
  const { classId, subjectId, date, studentIds } = req.body;
  if (!date || !Array.isArray(studentIds)) {
    return res.status(400).json({ success: false, message: "Date and studentIds are required." });
  }
  const dateStr = String(date).substring(0, 10);
  try {
    await updateStoreKeyWithLock("attendance", (currentVal) => {
      const attList = Array.isArray(currentVal) ? currentVal : [];
      const studentIdSet = new Set(studentIds.map((id) => String(id).toLowerCase().trim()));
      if (Array.isArray(students)) {
        for (const st of students) {
          const stId = String(st.id || "").toLowerCase().trim();
          const stNis = String(st.nis || "").toLowerCase().trim();
          const stName = String(st.name || "").toLowerCase().trim();
          const stUser = String(st.username || "").toLowerCase().trim();
          if (studentIdSet.has(stId) || studentIdSet.has(stNis) || studentIdSet.has(stName) || studentIdSet.has(stUser)) {
            if (stId) studentIdSet.add(stId);
            if (stNis) studentIdSet.add(stNis);
            if (stName) studentIdSet.add(stName);
            if (stUser) studentIdSet.add(stUser);
          }
        }
      }
      const filtered = attList.filter((a) => {
        const itemDate = String(a.date).substring(0, 10);
        if (itemDate !== dateStr) return true;
        let sameSubject = true;
        if (subjectId && subjectId !== "ALL") {
          sameSubject = String(a.subjectId || "") === String(subjectId) || !a.subjectId || String(a.subjectId) === "ALL";
        }
        if (!sameSubject) return true;
        const isTargetStudent = studentIdSet.has(String(a.studentId).toLowerCase().trim());
        return !isTargetStudent;
      });
      return filtered;
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.post("/api/attendance/clear-all", async (req, res) => {
  try {
    let deletedAttendanceCount = 0;
    let deletedPhotosCount = 0;
    await updateStoreKeyWithLock("attendance", (currentVal) => {
      const attList = Array.isArray(currentVal) ? currentVal : [];
      const grouped = /* @__PURE__ */ new Map();
      const sorted = [...attList].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const kept = [];
      for (const record of sorted) {
        if (!grouped.has(record.studentId)) {
          grouped.set(record.studentId, true);
          kept.push(record);
        }
      }
      deletedAttendanceCount += attList.length - kept.length;
      return kept;
    });
    await updateStoreKeyWithLock("teacherAttendance", (currentVal) => {
      const attList = Array.isArray(currentVal) ? currentVal : [];
      const grouped = /* @__PURE__ */ new Map();
      const sorted = [...attList].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const kept = [];
      for (const record of sorted) {
        if (!grouped.has(record.teacherId)) {
          grouped.set(record.teacherId, true);
          kept.push(record);
        }
      }
      deletedAttendanceCount += attList.length - kept.length;
      return kept;
    });
    const activePhotoIds = /* @__PURE__ */ new Set();
    if (pool) {
      const { rows: students2 } = await pool.query("SELECT photo FROM students WHERE photo IS NOT NULL");
      for (const s of students2) {
        if (s.photo && s.photo.startsWith("/api/photos/")) {
          activePhotoIds.add(s.photo.replace("/api/photos/", ""));
        }
      }
      const { rows: teachers2 } = await pool.query("SELECT photo FROM teachers WHERE photo IS NOT NULL");
      for (const t of teachers2) {
        if (t.photo && t.photo.startsWith("/api/photos/")) {
          activePhotoIds.add(t.photo.replace("/api/photos/", ""));
        }
      }
      const { rows: attRows } = await pool.query("SELECT value FROM app_store WHERE key = 'attendance'");
      if (attRows.length > 0 && attRows[0].value) {
        const keptAtt = typeof attRows[0].value === "string" ? JSON.parse(attRows[0].value) : attRows[0].value;
        for (const a of keptAtt) {
          if (a.photo && a.photo.startsWith("/api/photos/")) {
            activePhotoIds.add(a.photo.replace("/api/photos/", ""));
          }
        }
      }
      const { rows: tAttRows } = await pool.query("SELECT value FROM app_store WHERE key = 'teacherAttendance'");
      if (tAttRows.length > 0 && tAttRows[0].value) {
        const keptTAtt = typeof tAttRows[0].value === "string" ? JSON.parse(tAttRows[0].value) : tAttRows[0].value;
        for (const a of keptTAtt) {
          if (a.photo && a.photo.startsWith("/api/photos/")) {
            activePhotoIds.add(a.photo.replace("/api/photos/", ""));
          }
        }
      }
    }
    if (db) {
      try {
        const photosSnapshot = await (0, import_firestore.getDocs)((0, import_firestore.collection)(db, "photos"));
        for (const docSnap of photosSnapshot.docs) {
          if (!activePhotoIds.has(docSnap.id)) {
            await (0, import_firestore.deleteDoc)((0, import_firestore.doc)(db, "photos", docSnap.id)).catch((e) => console.error(e));
            deletedPhotosCount++;
          }
        }
      } catch (err) {
        console.error("Error GC Firestore photos:", err);
      }
    }
    res.json({ success: true, message: `Pembersihan berhasil! ${deletedAttendanceCount} data absensi lama dan ${deletedPhotosCount} foto sampah (absensi & profil) dihapus.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.get("/api/teacher-attendance", async (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.json({ success: true, teacherAttendance: filterByMadrasah(teacherAttendance || [], req) });
});
app.post("/api/teacher-attendance", async (req, res) => {
  let { teacherId, date, status, location, photo, note, type, time } = req.body;
  if (photo && photo.startsWith("data:image/")) {
    photo = await saveBase64ToFirestore(photo);
  }
  const today = date || getJakartaTodayDateStr();
  let resultItem = null;
  let isConflict = false;
  let isCooldown = false;
  try {
    await updateStoreKeyWithLock("teacherAttendance", (currentVal) => {
      const list = Array.isArray(currentVal) ? currentVal : [];
      const existing = list.find(
        (a) => String(a.teacherId) === String(teacherId) && String(a.date).substring(0, 10) === today && (a.type || "MASUK") === (type || "MASUK")
      );
      if (existing) {
        const lastTapTime = getRecordTimestamp(existing.id, existing);
        const now = Date.now();
        if (note !== "Input Admin" && lastTapTime > 0 && now - lastTapTime < 5 * 60 * 1e3) {
          isCooldown = true;
          return list;
        }
        isConflict = true;
        return list;
      }
      const newAtt = tagNewRecord({
        id: "T_ATT_" + Date.now(),
        teacherId,
        date: today,
        status: status || "HADIR",
        type: type || "MASUK",
        time: time || null,
        location: location || "",
        photo: photo || "",
        note: note || "",
        timestamp: Date.now()
      }, req);
      list.push(newAtt);
      resultItem = newAtt;
      return list;
    });
    if (isCooldown) {
      return res.status(429).json({
        success: false,
        cooldown: true,
        message: "Kartu baru saja di-tap. Harap tunggu 5 menit sebelum melakukan tap kembali."
      });
    }
    if (isConflict) {
      return res.status(409).json({
        success: false,
        already_attended: true,
        message: `Anda sudah melakukan absensi ${type === "PULANG" ? "pulang" : "masuk"} hari ini.`
      });
    }
    res.json({ success: true, teacherAttendance: resultItem });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.post("/api/teacher-attendance/update", async (req, res) => {
  const { teacherId, date, status, type } = req.body;
  const dateStr = String(date).substring(0, 10);
  const attType = type || "MASUK";
  try {
    await updateStoreKeyWithLock("teacherAttendance", (currentVal) => {
      let list = Array.isArray(currentVal) ? currentVal : [];
      if (status === "BELUM PRESENSI") {
        list = list.filter((a) => !(String(a.teacherId) === String(teacherId) && String(a.date).substring(0, 10) === dateStr && (a.type || "MASUK") === attType));
      } else {
        const existing = list.find((a) => String(a.teacherId) === String(teacherId) && String(a.date).substring(0, 10) === dateStr && (a.type || "MASUK") === attType);
        if (existing) {
          existing.status = status;
        } else {
          list.push({
            id: "TATT_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
            teacherId,
            date: dateStr,
            status,
            type: attType,
            location: "Input Admin",
            photo: "",
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      }
      return list;
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.post("/api/admin/cleanup-photos", async (req, res) => {
  if (!db) {
    return res.status(400).json({ success: false, message: "Firebase is not configured." });
  }
  let deletedCount = 0;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1e3;
  const docIdsToDelete = [];
  try {
    const protectedPhotoUrls = /* @__PURE__ */ new Set();
    const protectedDocIds = /* @__PURE__ */ new Set();
    const markProtected = (url) => {
      if (!url) return;
      const str = typeof url === "string" ? url : url.photo || "";
      if (str && typeof str === "string") {
        protectedPhotoUrls.add(str);
        if (str.startsWith("/api/photos/")) {
          const docId = str.replace("/api/photos/", "").trim();
          if (docId) protectedDocIds.add(docId);
        }
      }
    };
    (students || []).forEach((s) => {
      if (s) {
        markProtected(s.photo);
        if (Array.isArray(s.photoHistory)) s.photoHistory.forEach(markProtected);
        if (Array.isArray(s.photo_history)) s.photo_history.forEach(markProtected);
      }
    });
    (teachers || []).forEach((t) => {
      if (t) {
        markProtected(t.photo);
        if (Array.isArray(t.photoHistory)) t.photoHistory.forEach(markProtected);
        if (Array.isArray(t.photo_history)) t.photo_history.forEach(markProtected);
      }
    });
    await updateStoreKeyWithLock("attendance", (currentVal) => {
      const list = Array.isArray(currentVal) ? currentVal : [];
      const studentGroups = {};
      list.forEach((record) => {
        if (record && record.studentId && record.photo && record.photo.startsWith("/api/photos/")) {
          const sId = String(record.studentId);
          if (!studentGroups[sId]) studentGroups[sId] = [];
          studentGroups[sId].push(record);
        }
      });
      for (const sId in studentGroups) {
        const records = studentGroups[sId];
        records.sort((a, b) => {
          const tsA = getRecordTimestamp(a.id, a);
          const tsB = getRecordTimestamp(b.id, b);
          return tsB - tsA;
        });
        for (let i = 1; i < records.length; i++) {
          const rec = records[i];
          const ts = getRecordTimestamp(rec.id, rec);
          if (ts > 0 && ts < thirtyDaysAgo) {
            const photoUrl = rec.photo;
            const docId = photoUrl.replace("/api/photos/", "").trim();
            if (docId && !protectedDocIds.has(docId) && !protectedPhotoUrls.has(photoUrl)) {
              docIdsToDelete.push(docId);
            }
            rec.photo = "";
          }
        }
      }
      return list;
    });
    for (const docId of docIdsToDelete) {
      if (protectedDocIds.has(docId)) continue;
      try {
        await (0, import_firestore.deleteDoc)((0, import_firestore.doc)(db, "photos", docId));
        deletedCount++;
      } catch (e) {
        console.error(`Failed to delete old photo doc ${docId}:`, e);
      }
    }
    const studentProfilePhotos = (students || []).filter((s) => s && s.photo && String(s.photo).trim() !== "").length;
    const teacherProfilePhotos = (teachers || []).filter((t) => t && t.photo && String(t.photo).trim() !== "").length;
    const studentAttendancePhotos = (attendance || []).filter((a) => a && a.photo && String(a.photo).trim() !== "").length;
    const teacherAttendancePhotos = (teacherAttendance || []).filter((a) => a && a.photo && String(a.photo).trim() !== "").length;
    const remainingCount = studentProfilePhotos + teacherProfilePhotos + studentAttendancePhotos + teacherAttendancePhotos;
    res.json({
      success: true,
      message: deletedCount > 0 ? `Pembersihan berhasil! Sebanyak ${deletedCount} foto usang berhasil dihapus. ${remainingCount} foto penting tetap aman tersimpan.` : `Semua data foto sudah bersih dan optimal! Tidak ada foto usang (>30 hari) yang perlu dihapus. ${remainingCount} foto penting tetap aktif tersimpan.`,
      deletedCount,
      remainingCount,
      details: {
        studentProfilePhotos,
        teacherProfilePhotos,
        studentAttendancePhotos,
        teacherAttendancePhotos
      }
    });
  } catch (err) {
    console.error("Cleanup error:", err);
    res.status(500).json({ success: false, message: "Terjadi kesalahan sistem saat melakukan pembersihan." });
  }
});
app.post("/api/admin/cleanup-teacher-photos", async (req, res) => {
  if (!db) {
    return res.status(400).json({ success: false, message: "Firebase is not configured." });
  }
  let deletedCount = 0;
  const docIdsToDelete = [];
  try {
    const protectedPhotoUrls = /* @__PURE__ */ new Set();
    const protectedDocIds = /* @__PURE__ */ new Set();
    (teachers || []).forEach((t) => {
      if (t) {
        if (t.photo && typeof t.photo === "string") {
          protectedPhotoUrls.add(t.photo);
          if (t.photo.startsWith("/api/photos/")) {
            const docId = t.photo.replace("/api/photos/", "").trim();
            if (docId) protectedDocIds.add(docId);
          }
        }
        if (Array.isArray(t.photoHistory)) {
          t.photoHistory.forEach((p) => {
            const str = typeof p === "string" ? p : p.photo || "";
            if (str && typeof str === "string") {
              protectedPhotoUrls.add(str);
              if (str.startsWith("/api/photos/")) {
                const docId = str.replace("/api/photos/", "").trim();
                if (docId) protectedDocIds.add(docId);
              }
            }
          });
        }
        if (Array.isArray(t.photo_history)) {
          t.photo_history.forEach((p) => {
            const str = typeof p === "string" ? p : p.photo || "";
            if (str && typeof str === "string") {
              protectedPhotoUrls.add(str);
              if (str.startsWith("/api/photos/")) {
                const docId = str.replace("/api/photos/", "").trim();
                if (docId) protectedDocIds.add(docId);
              }
            }
          });
        }
      }
    });
    await updateStoreKeyWithLock("teacherAttendance", (currentVal) => {
      const list = Array.isArray(currentVal) ? currentVal : [];
      list.forEach((record) => {
        if (record && record.photo && record.photo.startsWith("/api/photos/")) {
          const photoUrl = record.photo;
          const docId = photoUrl.replace("/api/photos/", "").trim();
          if (docId && !protectedDocIds.has(docId) && !protectedPhotoUrls.has(photoUrl)) {
            docIdsToDelete.push(docId);
          }
          record.photo = "";
        }
      });
      return list;
    });
    for (const docId of docIdsToDelete) {
      try {
        await (0, import_firestore.deleteDoc)((0, import_firestore.doc)(db, "photos", docId));
        deletedCount++;
      } catch (e) {
        console.error(`Failed to delete teacher attendance photo doc ${docId}:`, e);
      }
    }
    res.json({
      success: true,
      message: `Berhasil menghapus ${deletedCount} foto absensi guru dari penyimpanan.`
    });
  } catch (err) {
    console.error("Teacher cleanup error:", err);
    res.status(500).json({ success: false, message: "Terjadi kesalahan sistem saat membersihkan foto guru." });
  }
});
app.get("/api/question-bank-groups", (req, res) => {
  res.json({ success: true, groups: filterByMadrasah(questionBankGroups, req) });
});
app.post("/api/question-bank-groups", async (req, res) => {
  const { code, subjectId, classId } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, message: "Kode bank soal wajib diisi." });
  }
  const newGrp = tagNewRecord({
    id: req.body.id || "BG_" + Date.now(),
    code,
    subjectId: subjectId || "",
    classId: classId || ""
  }, req);
  questionBankGroups.push(newGrp);
  await saveData("questionBankGroups", questionBankGroups);
  res.json({ success: true, group: newGrp });
});
app.delete("/api/question-bank-groups/:id", async (req, res) => {
  const { id } = req.params;
  questionBankGroups = questionBankGroups.filter((bg) => String(bg.id) !== String(id));
  await saveData("questionBankGroups", questionBankGroups);
  res.json({ success: true, message: "Bank soal berhasil dihapus!" });
});
app.get("/api/questions", (req, res) => {
  const authUser = getAuthUser(req);
  const isTeacherOrAdmin = Boolean(authUser && (authUser.role === "teacher" || authUser.role === "guru" || authUser.role === "admin" || authUser.role === "bos" || authUser.role === "superadmin"));
  let filtered = filterByMadrasah(questions, req);
  if (!isTeacherOrAdmin) {
    filtered = filtered.map(sanitizeQuestionForStudent).filter(Boolean);
  }
  res.json({ success: true, questions: filtered });
});
app.post("/api/questions/batch", async (req, res) => {
  const authUser = getAuthUser(req);
  const isTeacherOrAdmin = Boolean(authUser && (authUser.role === "teacher" || authUser.role === "guru" || authUser.role === "admin" || authUser.role === "bos" || authUser.role === "superadmin"));
  if (!isTeacherOrAdmin) {
    return res.status(403).json({ success: false, message: "Akses ditolak: Hanya guru dan admin yang dapat mengelola bank soal." });
  }
  if (Array.isArray(req.body)) {
    const taggedIncoming = req.body.map((q) => tagNewRecord(q, req));
    const mId = getRequestMadrasahId(req);
    let otherQuestions = [];
    if (mId && mId !== "default" && mId !== "BOSS") {
      const matchM = madrasahs.find((m) => String(m.id) === mId || String(m.slug) === mId);
      const targetId = matchM ? matchM.id : mId;
      const targetSlug = matchM ? matchM.slug : mId;
      otherQuestions = questions.filter((q) => {
        const imId = String(q.madrasahId || "").trim();
        const imSlug = String(q.madrasahSlug || "").trim();
        if (!imId && !imSlug) return true;
        return imId !== targetId && imSlug !== targetSlug && imId !== targetSlug && imSlug !== targetId;
      });
    } else {
      const defaultM = madrasahs.find((m) => m.id === "default" || m.slug === "default") || madrasahs[0];
      const defId = defaultM ? defaultM.id : "default";
      const defSlug = defaultM ? defaultM.slug : "default";
      otherQuestions = questions.filter((q) => {
        const imId = String(q.madrasahId || "default").trim();
        const imSlug = String(q.madrasahSlug || "default").trim();
        const isDefault = imId === "default" || imId === defId || imId === defSlug || imSlug === "default" || imSlug === defSlug || imSlug === defId || !q.madrasahId && !q.madrasahSlug;
        return !isDefault;
      });
    }
    questions = [...otherQuestions, ...taggedIncoming];
    await saveData("questions", questions);
    res.json({ success: true, questions: taggedIncoming });
  } else {
    res.status(400).json({ success: false, message: "Invalid payload, expected an array." });
  }
});
app.post("/api/questions", async (req, res) => {
  const authUser = getAuthUser(req);
  const isTeacherOrAdmin = Boolean(authUser && (authUser.role === "teacher" || authUser.role === "guru" || authUser.role === "admin" || authUser.role === "bos" || authUser.role === "superadmin"));
  if (!isTeacherOrAdmin) {
    return res.status(403).json({ success: false, message: "Akses ditolak: Hanya guru dan admin yang dapat membuat soal." });
  }
  let { question, options, optionA, optionB, optionC, optionD, optionE, answer, subjectId, classId, code, type, explanation, imageUrl } = req.body;
  if (imageUrl && imageUrl.startsWith("data:image/")) {
    imageUrl = await saveBase64ToFirestore(imageUrl);
  }
  const newQ = tagNewRecord({
    id: "Q_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    code: code || req.body.category || "",
    subjectId: subjectId || req.body.subject || "",
    classId: classId || "",
    type: type || (options ? "mc" : optionA ? "mc" : "essay"),
    question,
    options: options || [optionA, optionB, optionC, optionD, optionE].filter(Boolean),
    answer,
    explanation: explanation || "",
    imageUrl: imageUrl || ""
  }, req);
  questions.push(newQ);
  await saveData("questions", questions);
  res.json({ success: true, question: newQ });
});
app.put("/api/questions/:id", async (req, res) => {
  const authUser = getAuthUser(req);
  const isTeacherOrAdmin = Boolean(authUser && (authUser.role === "teacher" || authUser.role === "guru" || authUser.role === "admin" || authUser.role === "bos" || authUser.role === "superadmin"));
  if (!isTeacherOrAdmin) {
    return res.status(403).json({ success: false, message: "Akses ditolak: Hanya guru dan admin yang dapat mengedit soal." });
  }
  const { id } = req.params;
  const idx = questions.findIndex((q) => String(q.id) === String(id));
  if (idx < 0) {
    return res.status(404).json({ success: false, message: "Soal tidak ditemukan." });
  }
  questions[idx] = {
    ...questions[idx],
    ...req.body
  };
  await saveData("questions", questions);
  res.json({ success: true, question: questions[idx] });
});
app.delete("/api/questions/:id", async (req, res) => {
  const authUser = getAuthUser(req);
  const isTeacherOrAdmin = Boolean(authUser && (authUser.role === "teacher" || authUser.role === "guru" || authUser.role === "admin" || authUser.role === "bos" || authUser.role === "superadmin"));
  if (!isTeacherOrAdmin) {
    return res.status(403).json({ success: false, message: "Akses ditolak: Hanya guru dan admin yang dapat menghapus soal." });
  }
  const { id } = req.params;
  questions = questions.filter((q) => String(q.id) !== String(id));
  await saveData("questions", questions);
  res.json({ success: true, message: "Soal berhasil dihapus!" });
});
app.get("/api/exam-monitoring-state", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), (req, res) => {
  const authUser = req.user;
  const isBos = authUser.role === "bos" || authUser.role === "superadmin";
  const userMadrasahId = getRequestMadrasahId(req);
  if (isBos) {
    return res.json({
      success: true,
      activeExamSessions,
      completedExams,
      forceFinishedExams,
      studentExamAnswers,
      studentExamQuestions,
      studentTabSwitches,
      studentOutOfTab,
      blockedStudents,
      studentLivecamFrames,
      studentExamGrades,
      examMessages,
      exams: getMemoryKeyValue("exams") || exams
    });
  }
  const studentList = getMemoryKeyValue("students") || students || [];
  const tenantStudentIds = new Set(
    studentList.filter((s) => String(s.madrasahId || "default").trim() === String(userMadrasahId).trim()).map((s) => String(s.id))
  );
  const tenantExams = (getMemoryKeyValue("exams") || exams || []).filter(
    (e) => String(e.madrasahId || "default").trim() === String(userMadrasahId).trim()
  );
  const tenantExamIds = new Set(tenantExams.map((e) => String(e.id)));
  const filterMap = (mapObj) => {
    const filtered = {};
    if (!mapObj) return filtered;
    for (const key of Object.keys(mapObj)) {
      if (key.startsWith("broadcast_")) {
        const eId = key.replace("broadcast_", "");
        if (tenantExamIds.has(eId)) {
          filtered[key] = mapObj[key];
        }
        continue;
      }
      let matchedStudentId = null;
      for (const sId of tenantStudentIds) {
        if (key.startsWith(sId + "_") || key === sId) {
          matchedStudentId = sId;
          break;
        }
      }
      if (matchedStudentId) {
        const remainder = key.replace(matchedStudentId + "_", "");
        if (remainder === matchedStudentId || tenantExamIds.has(remainder) || tenantExamIds.has(key.split("_").slice(1).join("_")) || !key.includes("_")) {
          filtered[key] = mapObj[key];
        }
      }
    }
    return filtered;
  };
  res.json({
    success: true,
    activeExamSessions: filterMap(activeExamSessions),
    completedExams: filterMap(completedExams),
    forceFinishedExams: filterMap(forceFinishedExams),
    studentExamAnswers: filterMap(studentExamAnswers),
    studentExamQuestions: filterMap(studentExamQuestions),
    studentTabSwitches: filterMap(studentTabSwitches),
    studentOutOfTab: filterMap(studentOutOfTab),
    blockedStudents: filterMap(blockedStudents),
    studentLivecamFrames: filterMap(studentLivecamFrames),
    studentExamGrades: filterMap(studentExamGrades),
    examMessages: filterMap(examMessages),
    exams: tenantExams
  });
});
app.get("/api/exam/my-summary", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const sId = resolveStudentId(req, authUser);
  if (!sId) {
    return res.status(400).json({ success: false, message: "studentId query param is required" });
  }
  const allExams = getMemoryKeyValue("exams") || exams || [];
  const completedList = [];
  const completedMap = {};
  const activeSessionsMap = {};
  const studentGrades = {};
  allExams.forEach((ex) => {
    const eId = String(ex.id);
    const key = sId + "_" + eId;
    if (completedExams[key]) {
      completedList.push(eId);
      completedMap[key] = completedExams[key];
    }
    if (studentExamGrades[key]) {
      studentGrades[key] = studentExamGrades[key];
    }
    const session = activeExamSessions[key];
    if (session && !completedExams[key]) {
      let remainingTime = session.timeLeft;
      if (session.endsAt) {
        remainingTime = Math.max(0, Math.floor((session.endsAt - Date.now()) / 1e3));
      }
      activeSessionsMap[key] = {
        ...session,
        timeLeft: remainingTime,
        blocked: Boolean(blockedStudents[key]),
        forceFinished: Boolean(forceFinishedExams[key])
      };
    }
  });
  res.json({
    success: true,
    studentId: sId,
    completedExams: completedList,
    completedMap,
    activeSessions: activeSessionsMap,
    grades: studentGrades
  });
});
app.get("/api/exam/my-state", (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const sId = resolveStudentId(req, authUser);
  const examId = req.query.examId;
  if (!sId || !examId) {
    return res.status(400).json({ success: false, message: "studentId and examId query params are required" });
  }
  const eId = String(examId);
  const key1 = sId + "_" + eId;
  const key2 = String(sId) + "_" + String(eId);
  const session = activeExamSessions[key1] || activeExamSessions[key2] || null;
  const isCompleted = Boolean(completedExams[key1] || completedExams[key2]);
  const isForceDone = Boolean(forceFinishedExams[key1] || forceFinishedExams[key2] || completedExams[key1] === "force_finish" || completedExams[key2] === "force_finish");
  const isBlocked = Boolean(blockedStudents[key1] || blockedStudents[key2]);
  const outOfTab = Boolean(studentOutOfTab[key1] || studentOutOfTab[key2]);
  const tabSwitches = studentTabSwitches[key1] || studentTabSwitches[key2] || 0;
  const savedAnswers = session && session.answers || studentExamAnswers[key1] || studentExamAnswers[key2] || {};
  const msgBroadcast = examMessages["broadcast_" + eId] || null;
  const msgPersonal = examMessages[key1] || examMessages[key2] || null;
  const latestMessage = msgPersonal || msgBroadcast || null;
  const allExams = getMemoryKeyValue("exams") || exams || [];
  const matchedExam = allExams.find((e) => String(e.id) === eId) || null;
  let remainingTime = null;
  if (session) {
    if (session.endsAt) {
      remainingTime = Math.max(0, Math.floor((session.endsAt - Date.now()) / 1e3));
      session.timeLeft = remainingTime;
    } else if (session.timeLeft !== void 0) {
      remainingTime = session.timeLeft;
    } else {
      remainingTime = session.durationSec || (matchedExam ? parseInt(matchedExam.duration || 60, 10) * 60 : 3600);
    }
  }
  res.json({
    success: true,
    examId: eId,
    studentId: sId,
    status: isForceDone ? "force_finished" : isCompleted ? "completed" : session ? "in_progress" : "not_started",
    currentIndex: session ? session.currentIndex || 0 : 0,
    answers: savedAnswers,
    answeredCount: session ? session.answeredCount || Object.keys(savedAnswers).length : Object.keys(savedAnswers).length,
    totalQuestions: session ? session.totalQuestions || 0 : 0,
    blocked: isBlocked,
    outOfTab,
    tabSwitches,
    forceFinished: isForceDone,
    completed: isCompleted,
    remainingTime,
    startedAt: session ? session.startedAt : null,
    endsAt: session ? session.endsAt : null,
    serverDuration: matchedExam ? parseInt(matchedExam.duration || 60, 10) : null,
    message: latestMessage,
    messageBroadcast: msgBroadcast,
    messagePersonal: msgPersonal
  });
});
app.post("/api/exam/attempt/start", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const sId = resolveStudentId(req, authUser);
  const { examId, totalQuestions } = req.body;
  if (!sId || !examId) {
    return res.status(400).json({ success: false, message: "studentId and examId required" });
  }
  const eId = String(examId);
  const key = sId + "_" + eId;
  const allExams = getMemoryKeyValue("exams") || exams || [];
  const matchedExam = allExams.find((e) => String(e.id) === eId);
  const durationMin = matchedExam ? parseInt(matchedExam.duration || 60, 10) : 60;
  const durationSec = durationMin * 60;
  let session = activeExamSessions[key];
  const now = Date.now();
  if (!session) {
    session = {
      startTime: now,
      startedAt: now,
      endsAt: now + durationSec * 1e3,
      durationSec,
      duration: durationMin,
      status: "active",
      answers: {},
      currentIndex: 0,
      totalQuestions: totalQuestions || 0,
      answeredCount: 0,
      timeLeft: durationSec,
      lastSeenAt: now
    };
    activeExamSessions[key] = session;
    await saveDeltaDb("activeExamSessions", key, session);
  } else {
    if (!session.endsAt) {
      const remainingSec = session.timeLeft !== void 0 ? session.timeLeft : durationSec;
      session.endsAt = now + remainingSec * 1e3;
      session.startedAt = session.startTime || now - (durationSec - remainingSec) * 1e3;
    }
    session.lastSeenAt = now;
    session.timeLeft = Math.max(0, Math.floor((session.endsAt - now) / 1e3));
    if (totalQuestions && (!session.totalQuestions || session.totalQuestions <= 0)) {
      session.totalQuestions = totalQuestions;
    }
    if (!session.answers) session.answers = {};
    if (studentExamAnswers[key]) {
      session.answers = { ...studentExamAnswers[key], ...session.answers };
      session.answeredCount = Object.keys(session.answers).length;
    }
    activeExamSessions[key] = session;
    await saveDeltaDb("activeExamSessions", key, session);
  }
  broadcastExamEvent({
    type: "exam_started",
    examId: eId,
    studentId: sId,
    answered: session.answeredCount || 0,
    total: session.totalQuestions || totalQuestions || 0,
    lastSeenAt: Date.now()
  });
  res.json({
    success: true,
    session: {
      startedAt: session.startedAt,
      endsAt: session.endsAt,
      remainingTime: session.timeLeft,
      currentIndex: session.currentIndex || 0,
      answers: session.answers || studentExamAnswers[key] || {},
      answeredCount: session.answeredCount || (session.answers ? Object.keys(session.answers).length : 0),
      totalQuestions: session.totalQuestions || 0
    }
  });
});
function shuffleArray(arr) {
  if (!Array.isArray(arr)) return [];
  const array = [...arr];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
app.post("/api/exam/attempt/start-questions", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const sId = resolveStudentId(req, authUser);
  const { examId } = req.body;
  if (!sId || !examId) {
    return res.status(400).json({ success: false, message: "studentId and examId are required" });
  }
  const eId = String(examId);
  const key = sId + "_" + eId;
  if (studentExamQuestions[key] && Array.isArray(studentExamQuestions[key]) && studentExamQuestions[key].length > 0) {
    return res.json({
      success: true,
      questions: studentExamQuestions[key],
      isResumed: true
    });
  }
  const allExams = getMemoryKeyValue("exams") || exams || [];
  const matchedExam = allExams.find((e) => String(e.id) === eId) || {};
  let rawQuestions = matchedExam.questions || [];
  if (!rawQuestions || rawQuestions.length === 0) {
    const allQuestions = getMemoryKeyValue("questions") || questions || [];
    const exCode = String(matchedExam.bankCode || matchedExam.groupCode || "").trim().toLowerCase();
    const exSub = String(matchedExam.subject || matchedExam.subjectId || "").trim().toLowerCase();
    const exClass = String(matchedExam.class || matchedExam.className || matchedExam.classId || "").trim().toLowerCase();
    const mId = String(matchedExam.madrasahId || matchedExam.madrasahSlug || "").trim();
    rawQuestions = allQuestions.filter((q) => {
      if (!q) return false;
      if (mId && mId !== "default" && mId !== "BOSS") {
        const qmId = String(q.madrasahId || q.madrasahSlug || "").trim();
        if (qmId && qmId !== mId) return false;
      }
      const qCode = String(q.code || q.bankCode || q.groupCode || "").trim().toLowerCase();
      const qSub = String(q.subjectId || q.subject || "").trim().toLowerCase();
      const qClass = String(q.classId || q.className || q.class || "").trim().toLowerCase();
      if (exCode && qCode && qCode === exCode) return true;
      if (exSub && qSub && (qSub === exSub || qSub.includes(exSub) || exSub.includes(qSub))) {
        if (exClass && qClass && !exClass.includes("all") && !qClass.includes("all")) {
          return qClass === exClass || exClass.includes(qClass);
        }
        return true;
      }
      return false;
    });
  }
  if (!rawQuestions || rawQuestions.length === 0) {
    return res.status(404).json({
      success: false,
      message: "Tidak ada soal yang tersedia untuk ujian ini. Hubungi guru mata pelajaran atau administrator ujian."
    });
  }
  const shouldShuffleQ = matchedExam.shuffleQ !== false;
  const shouldShuffleOpt = matchedExam.shuffleOpt !== false;
  let selectedQuestions = [];
  if (matchedExam.type === "pilihan_dan_esay") {
    const pgQs = rawQuestions.filter((q) => q.type !== "esay" && q.type !== "essay");
    const essayQs = rawQuestions.filter((q) => q.type === "esay" || q.type === "essay");
    let targetPgCount = parseInt(matchedExam.questionCount || matchedExam.qCount, 10);
    if (isNaN(targetPgCount) || targetPgCount <= 0) targetPgCount = pgQs.length;
    let targetEssayCount = parseInt(matchedExam.essayCount, 10);
    if (isNaN(targetEssayCount) || targetEssayCount <= 0) targetEssayCount = essayQs.length;
    const selectedPg = shouldShuffleQ ? shuffleArray(pgQs).slice(0, targetPgCount) : pgQs.slice(0, targetPgCount);
    const selectedEssay = shouldShuffleQ ? shuffleArray(essayQs).slice(0, targetEssayCount) : essayQs.slice(0, targetEssayCount);
    selectedQuestions = [...selectedPg, ...selectedEssay];
  } else {
    let filteredQuestions = rawQuestions;
    if (matchedExam.type === "pilihan_ganda") {
      filteredQuestions = rawQuestions.filter((q) => q.type !== "esay" && q.type !== "essay");
    } else if (matchedExam.type === "esay_saja") {
      filteredQuestions = rawQuestions.filter((q) => q.type === "esay" || q.type === "essay");
    }
    let targetCount = parseInt(matchedExam.questionCount || matchedExam.qCount, 10);
    if (isNaN(targetCount) || targetCount <= 0) targetCount = filteredQuestions.length;
    if (shouldShuffleQ) {
      selectedQuestions = shuffleArray(filteredQuestions).slice(0, targetCount);
    } else {
      selectedQuestions = filteredQuestions.slice(0, targetCount);
    }
  }
  const masterQuestions = [];
  const sanitizedQuestions = [];
  selectedQuestions.forEach((q, idx) => {
    const qId = q.id || "Q_" + idx + "_" + eId;
    let options = Array.isArray(q.options) ? [...q.options] : [];
    let correctText = q.correctOptionText || "";
    if (!correctText) {
      const rawKey = String(q.answer || "").trim();
      const letterIdx = ["a", "b", "c", "d", "e"].indexOf(rawKey.toLowerCase().replace(".", ""));
      if (letterIdx !== -1 && options[letterIdx] !== void 0) {
        correctText = String(options[letterIdx]).trim();
      } else {
        correctText = rawKey;
      }
    }
    let shuffledOptions = options;
    if (shouldShuffleOpt && options.length > 0 && q.type !== "esay" && q.type !== "essay") {
      shuffledOptions = shuffleArray(options);
    }
    const masterItem = {
      ...q,
      id: qId,
      options: shuffledOptions,
      originalOptions: options,
      correctOptionText: correctText,
      answer: q.answer || correctText
    };
    masterQuestions.push(masterItem);
    const sanitizedItem = {
      id: qId,
      number: idx + 1,
      question: q.question,
      options: shuffledOptions,
      type: q.type || "mc",
      imageUrl: q.imageUrl || q.image || null,
      image: q.image || q.imageUrl || null
    };
    sanitizedQuestions.push(sanitizedItem);
  });
  studentExamMasterQuestions[key] = masterQuestions;
  studentExamQuestions[key] = sanitizedQuestions;
  await Promise.all([
    saveDeltaDb("studentExamMasterQuestions", key, masterQuestions),
    saveDeltaDb("studentExamQuestions", key, sanitizedQuestions)
  ]);
  res.json({
    success: true,
    questions: sanitizedQuestions,
    isResumed: false
  });
});
app.post("/api/exam/attempt/answer", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const sId = resolveStudentId(req, authUser);
  const { examId, questionId, answer, currentIndex } = req.body;
  if (!sId || !examId || !questionId) {
    return res.status(400).json({ success: false, message: "studentId, examId, and questionId are required" });
  }
  const eId = String(examId);
  const key = sId + "_" + eId;
  const now = Date.now();
  if (!studentExamAnswers[key]) studentExamAnswers[key] = {};
  studentExamAnswers[key][questionId] = answer;
  let session = activeExamSessions[key];
  if (!session) {
    session = {
      startTime: now,
      startedAt: now,
      endsAt: now + 3600 * 1e3,
      status: "active",
      answers: { [questionId]: answer },
      currentIndex: currentIndex !== void 0 ? currentIndex : 0,
      totalQuestions: 0,
      answeredCount: 1,
      timeLeft: 3600,
      lastSeenAt: now
    };
  } else {
    if (!session.answers) session.answers = {};
    session.answers[questionId] = answer;
    session.answeredCount = Object.keys(session.answers).length;
    if (currentIndex !== void 0) session.currentIndex = currentIndex;
    session.lastSeenAt = now;
    if (session.endsAt) {
      session.timeLeft = Math.max(0, Math.floor((session.endsAt - now) / 1e3));
    }
  }
  activeExamSessions[key] = session;
  await Promise.all([
    saveDeltaDb("studentExamAnswers", key, studentExamAnswers[key]),
    saveDeltaDb("activeExamSessions", key, session)
  ]);
  broadcastExamEvent({
    type: "exam_progress",
    examId: eId,
    studentId: sId,
    answered: session.answeredCount,
    total: session.totalQuestions,
    currentIndex: session.currentIndex,
    lastSeenAt: now
  });
  res.json({
    success: true,
    questionId,
    answeredCount: session.answeredCount,
    remainingTime: session.timeLeft
  });
});
app.post("/api/exam/student-state", requireAuth, async (req, res) => {
  const authUser = req.user || getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const sId = resolveStudentId(req, authUser);
  const { examId, currentIndex, livecamFrame } = req.body;
  if (!sId || !examId) {
    return res.status(400).json({ success: false, message: "studentId and examId required" });
  }
  const eId = String(examId);
  const key = sId + "_" + eId;
  const now = Date.now();
  const session = activeExamSessions[key];
  if (session) {
    session.lastSeenAt = now;
    if (currentIndex !== void 0) session.currentIndex = currentIndex;
    if (session.endsAt) {
      session.timeLeft = Math.max(0, Math.floor((session.endsAt - now) / 1e3));
    }
  }
  broadcastExamEvent({
    type: "student_heartbeat",
    examId: eId,
    studentId: sId,
    lastSeenAt: now
  });
  if (livecamFrame) {
    studentLivecamFrames[key] = String(livecamFrame);
    broadcastStateUpdate("studentLivecamFrames");
  }
  const isBlocked = Boolean(blockedStudents[key]);
  const isForceDone = Boolean(forceFinishedExams[key] || completedExams[key] === "force_finish");
  const bMsg = examMessages["broadcast_" + eId] || null;
  const pMsg = examMessages[key] || null;
  res.json({
    success: true,
    serverTime: now,
    blocked: isBlocked,
    forceFinished: isForceDone,
    remainingTime: session ? session.timeLeft : null,
    messageBroadcast: bMsg,
    messagePersonal: pMsg
  });
});
app.post("/api/exam/presence", requireAuth, async (req, res) => {
  const authUser = req.user || getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const { examId, outOfTab } = req.body;
  if (!examId) {
    return res.status(400).json({ success: false, message: "examId required" });
  }
  const sId = resolveStudentId(req, authUser);
  if (!sId) {
    return res.status(400).json({ success: false, message: "Student ID required" });
  }
  const eId = String(examId);
  const key = sId + "_" + eId;
  studentOutOfTab[key] = outOfTab === true;
  await saveDeltaDb("studentOutOfTab", key, outOfTab === true);
  broadcastExamEvent({
    type: "exam_presence",
    examId: eId,
    studentId: sId,
    outOfTab: outOfTab === true
  });
  res.json({ success: true });
});
app.post("/api/exam/livecam/snapshot", requireAuth, async (req, res) => {
  const authUser = req.user || getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const { examId, livecamFrame } = req.body;
  if (!examId || !livecamFrame) {
    return res.status(400).json({ success: false, message: "examId and livecamFrame are required" });
  }
  const sId = resolveStudentId(req, authUser);
  if (!sId) {
    return res.status(400).json({ success: false, message: "Student ID required" });
  }
  const eId = String(examId);
  const key = sId + "_" + eId;
  studentLivecamFrames[key] = String(livecamFrame);
  broadcastStateUpdate("studentLivecamFrames");
  res.json({ success: true });
});
app.post("/api/exam/heartbeat", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const sId = resolveStudentId(req, authUser);
  const { examId, currentIndex } = req.body;
  if (!sId || !examId) {
    return res.status(400).json({ success: false, message: "studentId and examId required" });
  }
  const eId = String(examId);
  const key = sId + "_" + eId;
  const now = Date.now();
  const session = activeExamSessions[key];
  if (session) {
    session.lastSeenAt = now;
    if (currentIndex !== void 0) session.currentIndex = currentIndex;
    if (session.endsAt) {
      session.timeLeft = Math.max(0, Math.floor((session.endsAt - now) / 1e3));
    }
  }
  broadcastExamEvent({
    type: "student_heartbeat",
    examId: eId,
    studentId: sId,
    lastSeenAt: now
  });
  const isBlocked = Boolean(blockedStudents[key]);
  const isForceDone = Boolean(forceFinishedExams[key] || completedExams[key] === "force_finish");
  const bMsg = examMessages["broadcast_" + eId] || null;
  const pMsg = examMessages[key] || null;
  res.json({
    success: true,
    serverTime: now,
    blocked: isBlocked,
    forceFinished: isForceDone,
    remainingTime: session ? session.timeLeft : null,
    messageBroadcast: bMsg,
    messagePersonal: pMsg
  });
});
app.post("/api/exam/violation", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const sId = resolveStudentId(req, authUser);
  const { examId, reason, clientTimestamp } = req.body;
  if (!sId || !examId) {
    return res.status(400).json({ success: false, message: "studentId and examId required" });
  }
  const eId = String(examId);
  const key = sId + "_" + eId;
  const now = Date.now();
  studentTabSwitches[key] = (studentTabSwitches[key] || 0) + 1;
  studentOutOfTab[key] = true;
  const allExams = getMemoryKeyValue("exams") || exams || [];
  const matchedExam = allExams.find((e) => String(e.id) === eId);
  const autoBlockLimit = matchedExam ? parseInt(matchedExam.autoBlock || 0, 10) : 0;
  let autoBlocked = false;
  if (autoBlockLimit > 0 && studentTabSwitches[key] >= autoBlockLimit) {
    blockedStudents[key] = true;
    blockedStudents[eId + "_" + sId] = true;
    autoBlocked = true;
    await saveDeltaDb("blockedStudents", key, true);
    await saveDeltaDb("blockedStudents", eId + "_" + sId, true);
    broadcastStateUpdate("blockedStudents");
  }
  if (!examViolationLogs[eId]) examViolationLogs[eId] = [];
  const targetStudent = (getMemoryKeyValue("students") || students || []).find((s) => String(s.id) === sId);
  const violationItem = {
    id: "viol_" + now + "_" + Math.random().toString(36).substring(2, 7),
    studentId: sId,
    studentName: targetStudent ? targetStudent.name : sId,
    nis: targetStudent ? targetStudent.nis : "",
    className: targetStudent ? targetStudent.classId || targetStudent.className || "" : "",
    examId: eId,
    reason: reason || "Keluar Tab / Split Screen",
    timestamp: now,
    tabSwitches: studentTabSwitches[key],
    autoBlocked
  };
  examViolationLogs[eId].unshift(violationItem);
  if (examViolationLogs[eId].length > 500) examViolationLogs[eId].pop();
  await Promise.all([
    saveDeltaDb("studentTabSwitches", key, studentTabSwitches[key]),
    saveDeltaDb("studentOutOfTab", key, true),
    saveDeltaDb("examViolationLogs", eId, examViolationLogs[eId])
  ]);
  broadcastExamEvent({
    type: "exam_violation",
    examId: eId,
    studentId: sId,
    tabSwitches: studentTabSwitches[key],
    autoBlocked,
    reason: reason || "Keluar Tab / Split Screen",
    timestamp: now
  });
  res.json({
    success: true,
    tabSwitches: studentTabSwitches[key],
    autoBlocked,
    reason: reason || "Keluar Tab / Split Screen",
    violation: violationItem
  });
});
app.get("/api/exams/:examId/violations", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), (req, res) => {
  const { examId } = req.params;
  const list = examViolationLogs[String(examId)] || [];
  res.json({
    success: true,
    examId: String(examId),
    totalViolations: list.length,
    violations: list
  });
});
app.post("/api/exam/attempt/finish", async (req, res) => {
  const authUser = getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const sId = resolveStudentId(req, authUser);
  const { examId, answers, clientGrade } = req.body;
  if (!sId || !examId) {
    return res.status(400).json({ success: false, message: "studentId and examId required" });
  }
  const eId = String(examId);
  const key = sId + "_" + eId;
  completedExams[key] = true;
  await saveDeltaDb("completedExams", key, true);
  if (answers && typeof answers === "object") {
    studentExamAnswers[key] = { ...studentExamAnswers[key] || {}, ...answers };
  }
  await saveDeltaDb("studentExamAnswers", key, studentExamAnswers[key] || {});
  delete activeExamSessions[key];
  await saveDeltaDb("activeExamSessions", key, null);
  const allExams = getMemoryKeyValue("exams") || exams || [];
  const matchedExam = allExams.find((e) => String(e.id) === eId);
  const questions2 = studentExamMasterQuestions[key] || matchedExam && matchedExam.questions;
  let finalGrade = clientGrade;
  if (Array.isArray(questions2) && questions2.length > 0) {
    const finalAns = studentExamAnswers[key] || {};
    let correctPGCount = 0;
    const pgQuestions = questions2.filter((q) => q.type !== "esay" && q.type !== "essay");
    const essayQuestions = questions2.filter((q) => q.type === "esay" || q.type === "essay");
    pgQuestions.forEach((q) => {
      const uAns = finalAns[q.id] !== void 0 ? finalAns[q.id] : finalAns[String(q.id)];
      if (uAns !== void 0 && uAns !== null) {
        const normUAns = String(uAns).trim().toLowerCase();
        const normKey = String(q.answer || q.correctOptionText || "").trim().toLowerCase();
        if (normUAns === normKey) {
          correctPGCount++;
        } else if (Array.isArray(q.options) && /^[a-d]$/i.test(normUAns)) {
          const charCode = normUAns.toUpperCase().charCodeAt(0) - 65;
          if (q.options[charCode] && String(q.options[charCode]).trim().toLowerCase() === normKey) {
            correctPGCount++;
          }
        }
      }
    });
    const pgScore = pgQuestions.length > 0 ? Math.round(correctPGCount / pgQuestions.length * 100) : 100;
    finalGrade = {
      pgScore,
      essayScore: 0,
      finalScore: essayQuestions.length === 0 ? pgScore : null,
      isGraded: essayQuestions.length === 0,
      correctPGCount,
      totalPGCount: pgQuestions.length,
      essayGrades: {}
    };
  } else if (!finalGrade) {
    finalGrade = {
      pgScore: 100,
      essayScore: 0,
      finalScore: 100,
      isGraded: true,
      correctPGCount: 0,
      totalPGCount: 0,
      essayGrades: {}
    };
  }
  studentExamGrades[key] = finalGrade;
  await saveDeltaDb("studentExamGrades", key, finalGrade);
  broadcastExamEvent({
    type: "exam_finish",
    examId: eId,
    studentId: sId,
    grade: finalGrade
  });
  res.json({
    success: true,
    message: "Ujian berhasil diselesaikan dan dinilai secara aman",
    grade: finalGrade
  });
});
app.get("/api/exams/:examId/monitor", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), (req, res) => {
  const { examId } = req.params;
  const eId = String(examId);
  const authUser = req.user;
  const isBos = authUser.role === "bos" || authUser.role === "superadmin";
  const userMadrasahId = getRequestMadrasahId(req);
  const activeExam = (getMemoryKeyValue("exams") || exams || []).find((e) => String(e.id) === eId);
  if (!isBos && activeExam) {
    const examMId = String(activeExam.madrasahId || "default").trim();
    if (examMId !== String(userMadrasahId).trim()) {
      return res.status(403).json({ success: false, message: "Akses ditolak: Anda tidak memiliki wewenang memantau ujian dari madrasah lain." });
    }
  }
  let studentList = getMemoryKeyValue("students") || students || [];
  if (!isBos) {
    studentList = studentList.filter((s) => String(s.madrasahId || "default").trim() === String(userMadrasahId).trim());
  }
  const activeExamInMem = (getMemoryKeyValue("exams") || exams || []).find((e) => String(e.id) === eId);
  let targetStudents = studentList;
  if (activeExamInMem && activeExamInMem.classes && activeExamInMem.classes.length > 0 && !activeExamInMem.classes.includes("ALL")) {
    targetStudents = studentList.filter((s) => activeExamInMem.classes.includes(String(s.classId || s.className || s.class)));
  }
  const summary = targetStudents.map((st) => {
    const sId = String(st.id);
    const key = sId + "_" + eId;
    const session = activeExamSessions[key] || null;
    const isCompleted = Boolean(completedExams[key]);
    const isForceDone = Boolean(forceFinishedExams[key] || completedExams[key] === "force_finish");
    const isBlocked = Boolean(blockedStudents[key]);
    const isOutOfTab = Boolean(studentOutOfTab[key]);
    const tabSwitches = studentTabSwitches[key] || 0;
    const grade = studentExamGrades[key] || null;
    let status = "not_started";
    if (isBlocked) status = "blocked";
    else if (isForceDone) status = "force_finished";
    else if (isCompleted) status = "completed";
    else if (session) status = "in_progress";
    const isOnline = Boolean(session && Date.now() - (session.lastSeenAt || 0) < 3e4);
    return {
      studentId: sId,
      name: st.name || "",
      nis: st.nis || "",
      classId: st.classId || st.className || "",
      roomId: st.roomId || "",
      photo: st.photo || st.facePhoto || st.avatar || null,
      status,
      online: isOnline,
      answeredCount: session ? session.answeredCount || (session.answers ? Object.keys(session.answers).length : 0) : 0,
      totalQuestions: session ? session.totalQuestions || 0 : 0,
      progressPct: session && session.totalQuestions > 0 ? Math.round((session.answeredCount || 0) / session.totalQuestions * 100) : isCompleted ? 100 : 0,
      tabSwitches,
      outOfTab: isOutOfTab,
      blocked: isBlocked,
      forceFinished: isForceDone,
      score: grade ? grade.finalScore !== null && grade.finalScore !== void 0 ? grade.finalScore : grade.pgScore : null,
      remainingTime: session ? session.timeLeft : null
    };
  });
  res.json({
    success: true,
    examId: eId,
    totalStudents: targetStudents.length,
    activeCount: summary.filter((s) => s.status === "in_progress").length,
    completedCount: summary.filter((s) => s.status === "completed" || s.status === "force_finished").length,
    blockedCount: summary.filter((s) => s.blocked).length,
    students: summary
  });
});
async function saveDeltaDb(deltaType, itemKey, value) {
  if (isOnlineMode) {
    if (dbInitPromise) await dbInitPromise;
    if (!pool || isDbQuotaExceeded) {
      throw new Error(`ONLINE_DATABASE_UNAVAILABLE: cannot persist delta ${deltaType}`);
    }
  }
  if (pool && !isDbQuotaExceeded) {
    const dbKey = `delta::${deltaType}::${itemKey}`;
    try {
      if (value === null || value === void 0) {
        await pool.query("DELETE FROM app_store WHERE key = $1", [dbKey]);
      } else {
        await pool.query(`
          INSERT INTO app_store (key, value) VALUES ($1, $2)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        `, [dbKey, JSON.stringify(value)]);
      }
    } catch (e) {
      console.error("Delta write error:", e);
      if (isOnlineMode) throw e;
    }
  }
}
app.post("/api/exam-monitoring-state", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  const { sessionKey, sessionData, activeExamSessionsBatch, completed, answers, studentQuestions, tabSwitches, outOfTab, blocked, livecamFrame, gradesObj, messages, forceFinished } = req.body;
  const promises = [];
  const authUser = req.user;
  const isBos = authUser.role === "bos" || authUser.role === "superadmin";
  const userMadrasahId = getRequestMadrasahId(req);
  if (!isBos) {
    const studentList = getMemoryKeyValue("students") || students || [];
    const tenantStudentIds = new Set(
      studentList.filter((s) => String(s.madrasahId || "default").trim() === String(userMadrasahId).trim()).map((s) => String(s.id))
    );
    const tenantExams = (getMemoryKeyValue("exams") || exams || []).filter(
      (e) => String(e.madrasahId || "default").trim() === String(userMadrasahId).trim()
    );
    const tenantExamIds = new Set(tenantExams.map((e) => String(e.id)));
    const validateKey = (key) => {
      if (!key) return true;
      if (key.startsWith("broadcast_")) {
        const eId = key.replace("broadcast_", "");
        return tenantExamIds.has(eId);
      }
      let matchedStudentId = null;
      for (const sId of tenantStudentIds) {
        if (key.startsWith(sId + "_") || key === sId) {
          matchedStudentId = sId;
          break;
        }
      }
      if (matchedStudentId) {
        const remainder = key.replace(matchedStudentId + "_", "");
        return remainder === matchedStudentId || tenantExamIds.has(remainder) || tenantExamIds.has(key.split("_").slice(1).join("_")) || !key.includes("_");
      }
      return false;
    };
    const testKeys = [
      sessionKey,
      ...activeExamSessionsBatch ? Object.keys(activeExamSessionsBatch) : [],
      ...completed ? Object.keys(completed) : [],
      ...answers ? Object.keys(answers) : [],
      ...studentQuestions ? Object.keys(studentQuestions) : [],
      ...tabSwitches ? Object.keys(tabSwitches) : [],
      ...outOfTab ? Object.keys(outOfTab) : [],
      ...blocked ? Object.keys(blocked) : [],
      ...gradesObj ? Object.keys(gradesObj) : [],
      ...messages ? Object.keys(messages) : [],
      ...forceFinished ? Object.keys(forceFinished) : []
    ].filter(Boolean);
    for (const tk of testKeys) {
      if (!validateKey(tk)) {
        return res.status(403).json({ success: false, message: "Akses ditolak: Anda tidak memiliki wewenang mengubah state siswa madrasah lain." });
      }
    }
  }
  if (sessionKey) {
    if (sessionData === null || sessionData === void 0) {
      delete activeExamSessions[sessionKey];
      promises.push(saveDeltaDb("activeExamSessions", sessionKey, null));
    } else {
      activeExamSessions[sessionKey] = sessionData;
      promises.push(saveDeltaDb("activeExamSessions", sessionKey, sessionData));
    }
    broadcastStateUpdate("activeExamSessions");
  }
  if (activeExamSessionsBatch) {
    for (const key of Object.keys(activeExamSessionsBatch)) {
      const bData = activeExamSessionsBatch[key];
      if (bData === null || bData === void 0) {
        delete activeExamSessions[key];
        promises.push(saveDeltaDb("activeExamSessions", key, null));
      } else {
        activeExamSessions[key] = bData;
        promises.push(saveDeltaDb("activeExamSessions", key, bData));
      }
    }
    broadcastStateUpdate("activeExamSessions");
  }
  if (completed) {
    for (const key of Object.keys(completed)) {
      completedExams[key] = completed[key];
      promises.push(saveDeltaDb("completedExams", key, completed[key]));
      if (completed[key] === "force_finish") {
        forceFinishedExams[key] = true;
        promises.push(saveDeltaDb("forceFinishedExams", key, true));
      }
    }
    broadcastStateUpdate("completedExams");
    if (Object.values(completed).includes("force_finish")) {
      broadcastStateUpdate("forceFinishedExams");
    }
  }
  if (forceFinished) {
    for (const key of Object.keys(forceFinished)) {
      forceFinishedExams[key] = forceFinished[key];
      promises.push(saveDeltaDb("forceFinishedExams", key, forceFinished[key]));
    }
    broadcastStateUpdate("forceFinishedExams");
  }
  if (answers) {
    for (const key of Object.keys(answers)) {
      const incomingVal = answers[key];
      const existingVal = studentExamAnswers[key];
      if (existingVal && Object.keys(existingVal).length > 0) {
        if (!incomingVal || Object.keys(incomingVal).length === 0) continue;
        studentExamAnswers[key] = { ...existingVal, ...incomingVal };
      } else {
        studentExamAnswers[key] = incomingVal;
      }
      promises.push(saveDeltaDb("studentExamAnswers", key, studentExamAnswers[key]));
    }
    broadcastStateUpdate("studentExamAnswers");
  }
  if (studentQuestions) {
    for (const key of Object.keys(studentQuestions)) {
      studentExamQuestions[key] = studentQuestions[key];
      promises.push(saveDeltaDb("studentExamQuestions", key, studentQuestions[key]));
    }
    broadcastStateUpdate("studentExamQuestions");
  }
  if (tabSwitches) {
    for (const key of Object.keys(tabSwitches)) {
      studentTabSwitches[key] = tabSwitches[key];
      promises.push(saveDeltaDb("studentTabSwitches", key, tabSwitches[key]));
    }
    broadcastStateUpdate("studentTabSwitches");
  }
  if (outOfTab) {
    for (const key of Object.keys(outOfTab)) {
      studentOutOfTab[key] = outOfTab[key];
      promises.push(saveDeltaDb("studentOutOfTab", key, outOfTab[key]));
    }
    broadcastStateUpdate("studentOutOfTab");
  }
  if (gradesObj) {
    for (const key of Object.keys(gradesObj)) {
      studentExamGrades[key] = gradesObj[key];
      promises.push(saveDeltaDb("studentExamGrades", key, gradesObj[key]));
    }
    broadcastStateUpdate("studentExamGrades");
    await saveData("studentExamGrades", studentExamGrades);
  }
  if (blocked !== void 0) {
    for (const key of Object.keys(blocked)) {
      blockedStudents[key] = blocked[key];
      promises.push(saveDeltaDb("blockedStudents", key, blocked[key]));
    }
    broadcastStateUpdate("blockedStudents");
  }
  if (messages) {
    if (req.body.replaceMessages) {
      examMessages = messages;
    } else {
      examMessages = { ...examMessages, ...messages };
    }
    await saveData("examMessages", examMessages);
  }
  if (livecamFrame && livecamFrame.key && livecamFrame.frame) {
    studentLivecamFrames[livecamFrame.key] = livecamFrame.frame;
  }
  await Promise.all(promises);
  res.json({ success: true });
});
app.post("/api/reset-student-exam", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  const { studentId, examId } = req.body;
  if (!studentId || !examId) {
    return res.status(400).json({ success: false, message: "studentId and examId required" });
  }
  const key = studentId + "_" + examId;
  delete activeExamSessions[key];
  delete completedExams[key];
  delete forceFinishedExams[key];
  delete studentExamAnswers[key];
  delete studentExamQuestions[key];
  delete studentTabSwitches[key];
  delete studentOutOfTab[key];
  delete blockedStudents[key];
  delete studentLivecamFrames[key];
  delete studentExamGrades[key];
  const promises = [
    saveDeltaDb("activeExamSessions", key, null),
    saveDeltaDb("completedExams", key, null),
    saveDeltaDb("forceFinishedExams", key, null),
    saveDeltaDb("studentExamAnswers", key, null),
    saveDeltaDb("studentExamQuestions", key, null),
    saveDeltaDb("studentTabSwitches", key, null),
    saveDeltaDb("studentOutOfTab", key, null),
    saveDeltaDb("blockedStudents", key, null)
  ];
  await Promise.all(promises);
  broadcastStateUpdate("activeExamSessions");
  broadcastStateUpdate("completedExams");
  broadcastStateUpdate("forceFinishedExams");
  broadcastStateUpdate("studentExamAnswers");
  broadcastStateUpdate("studentExamQuestions");
  broadcastStateUpdate("studentTabSwitches");
  broadcastStateUpdate("studentOutOfTab");
  broadcastStateUpdate("blockedStudents");
  await saveData("studentLivecamFrames", studentLivecamFrames);
  await saveData("studentExamGrades", studentExamGrades);
  res.json({ success: true, message: "Sesi ujian siswa berhasil direset!" });
});
var examSignalingMessages = {};
app.post("/api/exam/signaling", requireAuth, (req, res) => {
  const authUser = req.user || getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const { recipientId, signal } = req.body;
  if (!recipientId || !signal) {
    return res.status(400).json({ success: false, message: "recipientId and signal required" });
  }
  if (!examSignalingMessages[recipientId]) {
    examSignalingMessages[recipientId] = {};
  }
  const sId = authUser.id;
  if (!examSignalingMessages[recipientId][sId]) {
    examSignalingMessages[recipientId][sId] = [];
  }
  examSignalingMessages[recipientId][sId].push({ senderId: sId, signal, timestamp: Date.now() });
  if (examSignalingMessages[recipientId][sId].length > 25) {
    examSignalingMessages[recipientId][sId].shift();
  }
  res.json({ success: true });
});
app.get("/api/exam/signaling", requireAuth, (req, res) => {
  const authUser = req.user || getAuthUser(req);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
  }
  const recipientId = String(req.query.recipientId || "");
  const senderId = String(req.query.senderId || "");
  if (!recipientId) {
    return res.json({ success: true, signals: [] });
  }
  const recipientData = examSignalingMessages[recipientId];
  if (!recipientData) {
    return res.json({ success: true, signals: [] });
  }
  let allSignals = [];
  if (senderId && recipientData[senderId]) {
    allSignals = [...recipientData[senderId]];
    recipientData[senderId] = [];
  } else if (!senderId) {
    for (const sId of Object.keys(recipientData)) {
      if (Array.isArray(recipientData[sId])) {
        allSignals.push(...recipientData[sId]);
      }
    }
    examSignalingMessages[recipientId] = {};
  } else {
    allSignals = [];
  }
  res.json({ success: true, signals: allSignals });
});
app.post("/api/exam/livekit-token", requireAuth, async (req, res) => {
  try {
    const authUser = req.user || getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Akses ditolak: Silakan login terlebih dahulu." });
    }
    const { roomName, isPublisher } = req.body;
    if (!roomName) {
      return res.status(400).json({ success: false, message: "roomName is required" });
    }
    const secureIdentity = authUser.id + "_" + (authUser.name || authUser.username || "student");
    const apiKey = appSettings.livekitApiKey || process.env.LIVEKIT_API_KEY || "devkey";
    const apiSecret = appSettings.livekitApiSecret || process.env.LIVEKIT_API_SECRET || "secret";
    const serverUrl = appSettings.livekitUrl || process.env.LIVEKIT_URL || "ws://localhost:7880";
    const at = new import_livekit_server_sdk.AccessToken(apiKey, apiSecret, {
      identity: secureIdentity,
      ttl: "2h"
    });
    at.addGrant({
      room: String(roomName),
      roomJoin: true,
      canPublish: isPublisher === true,
      canSubscribe: isPublisher !== true
      // Student only publishes, Admin only subscribes
    });
    const token = await at.toJwt();
    res.json({ success: true, token, serverUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.get("/api/chats", requireAuth, async (req, res) => {
  const userMId = getRequestMadrasahId(req);
  let chatList = chats;
  if (pool) {
    try {
      const dbRes = await pool.query("SELECT value FROM app_store WHERE key = 'chats'");
      if (dbRes.rows.length > 0) {
        let val = dbRes.rows[0].value;
        if (typeof val === "string") {
          try {
            val = JSON.parse(val);
          } catch (e) {
          }
        }
        if (Array.isArray(val)) {
          chatList = val;
        }
      }
    } catch (e) {
    }
  }
  const filtered = chatList.filter((c) => String(c.madrasahId || "default").trim() === String(userMId).trim());
  res.json({ success: true, data: filtered });
});
app.post("/api/chats", requireAuth, async (req, res) => {
  try {
    const userMId = getRequestMadrasahId(req);
    const newChat = {
      ...req.body,
      id: req.body.id || Date.now().toString(),
      timestamp: req.body.timestamp || Date.now(),
      madrasahId: userMId
    };
    await updateStoreKeyWithLock("chats", (currentVal) => {
      const list = Array.isArray(currentVal) ? currentVal : [];
      list.push(newChat);
      return list;
    });
    res.json({ success: true, data: newChat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.delete("/api/chats/:id", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  try {
    await updateStoreKeyWithLock("chats", (currentVal) => {
      const list = Array.isArray(currentVal) ? currentVal : [];
      return list.filter((c) => String(c.id) !== String(req.params.id));
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.post("/api/chats/clear", async (req, res) => {
  const { senderId, receiverId } = req.body;
  if (!senderId || !receiverId) {
    return res.status(400).json({ success: false, message: "Missing ids" });
  }
  try {
    await updateStoreKeyWithLock("chats", (currentVal) => {
      const chatList = Array.isArray(currentVal) ? currentVal : [];
      return chatList.filter((c) => !(String(c.senderId) === String(senderId) && String(c.receiverId) === String(receiverId) || String(c.senderId) === String(receiverId) && String(c.receiverId) === String(senderId)));
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.put("/api/chats/read", async (req, res) => {
  const { senderId, receiverId } = req.body;
  try {
    await updateStoreKeyWithLock("chats", (currentVal) => {
      const chatList = Array.isArray(currentVal) ? currentVal : [];
      chatList.forEach((c) => {
        if (String(c.senderId) === String(senderId) && String(c.receiverId) === String(receiverId) && !c.read) {
          c.read = true;
        }
      });
      return chatList;
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.post("/api/chats/broadcast-apk", async (req, res) => {
  try {
    const { text, attachment } = req.body;
    const studentsList = students || [];
    const now = Date.now();
    const newChats = [];
    studentsList.forEach((s) => {
      newChats.push({
        id: (now + Math.random()).toString(),
        senderId: "admin",
        receiverId: s.id,
        text: text || "Bapak/Ibu Orangtua dan Siswa, berikut adalah berkas instalasi Layanan Monitoring ChildGuard Madrasah Bisa. Silakan unduh, instal, dan aktifkan izin aksesibilitas serta overlay perangkat agar fitur pemantauan berjalan dengan baik.",
        timestamp: now,
        read: false,
        attachment: attachment || {
          type: "apk",
          name: "childguard_v2.1.0_prod.apk",
          data: "/public/childguard.apk"
        }
      });
    });
    await updateStoreKeyWithLock("chats", (currentVal) => {
      const chatList = Array.isArray(currentVal) ? currentVal : [];
      return [...chatList, ...newChats];
    });
    res.json({ success: true, count: newChats.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.get("/api/grades", requireAuth, (req, res) => {
  const authUser = req.user || getAuthUser(req);
  const role = String(authUser?.role || "").toLowerCase();
  let list = filterByMadrasah(grades, req);
  if (["student", "siswa", "class_leader", "ketua_kelas"].includes(role)) {
    list = list.filter((item) => String(item.studentId || item.student_id || "") === String(authUser.id));
  }
  res.json({ success: true, grades: list });
});
app.post("/api/grades", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const processed = [];
  for (const item of items) {
    const { classId, studentId, subjectName, category, score } = item;
    if (!classId || !studentId) continue;
    const existingIdx = grades.findIndex(
      (g) => String(g.classId) === String(classId) && String(g.studentId) === String(studentId) && String(g.subjectName || "").toLowerCase() === String(subjectName || "").toLowerCase() && String(g.category || "").toLowerCase() === String(category || "").toLowerCase()
    );
    const gradeObj = tagNewRecord({
      id: existingIdx >= 0 ? grades[existingIdx].id : "G_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
      classId: String(classId),
      studentId: String(studentId),
      subjectName: String(subjectName || ""),
      category: String(category || ""),
      score: Number(score || 0)
    }, req);
    if (existingIdx >= 0) {
      grades[existingIdx] = gradeObj;
    } else {
      grades.push(gradeObj);
    }
    processed.push(gradeObj);
  }
  await saveData("grades", grades);
  res.json({ success: true, count: processed.length, grade: processed[0], grades: processed });
});
app.get("/api/time-slots", requireAuth, (req, res) => {
  res.json({ success: true, timeSlots: timeSlots || [], kbmDuration: kbmDuration || 40 });
});
app.post("/api/time-slots", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  const { timeSlots: newSlots, kbmDuration: newKbm } = req.body;
  if (Array.isArray(newSlots)) {
    timeSlots = newSlots;
    await saveData("timeSlots", timeSlots);
  }
  if (newKbm !== void 0) {
    kbmDuration = Number(newKbm) || 40;
    await saveData("kbmDuration", kbmDuration);
  }
  res.json({ success: true, timeSlots, kbmDuration });
});
app.get("/api/grade-categories", requireAuth, (req, res) => {
  res.json({ success: true, gradeCategories: gradeCategories || [] });
});
app.post("/api/grade-categories", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  const { gradeCategories: newCats, category } = req.body;
  if (Array.isArray(newCats)) {
    gradeCategories = newCats;
    await saveData("gradeCategories", gradeCategories);
  } else if (category && typeof category === "string") {
    if (!gradeCategories.includes(category)) {
      gradeCategories.push(category);
      await saveData("gradeCategories", gradeCategories);
    }
  }
  res.json({ success: true, gradeCategories });
});
app.post("/api/grade-categories/rename", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  const { oldCategory, newCategory } = req.body;
  if (!oldCategory || !newCategory) {
    return res.status(400).json({ error: "Missing category parameters" });
  }
  const oldLower = String(oldCategory).trim().toLowerCase();
  const newTrim = String(newCategory).trim();
  if (Array.isArray(gradeCategories)) {
    gradeCategories = gradeCategories.map((c) => {
      const cStr = typeof c === "string" ? c : c.name || "";
      if (cStr.trim().toLowerCase() === oldLower) {
        return typeof c === "string" ? newTrim : { ...c, name: newTrim };
      }
      return c;
    });
    const uniqueCats = [];
    gradeCategories.forEach((c) => {
      const name = typeof c === "string" ? c : c.name;
      if (name && !uniqueCats.includes(name)) uniqueCats.push(name);
    });
    gradeCategories = uniqueCats;
    await saveData("gradeCategories", gradeCategories);
  }
  let updatedCount = 0;
  if (Array.isArray(grades)) {
    grades.forEach((g) => {
      if (String(g.category || "").trim().toLowerCase() === oldLower) {
        g.category = newTrim;
        updatedCount++;
      }
    });
    if (updatedCount > 0) {
      await saveData("grades", grades);
    }
  }
  res.json({ success: true, oldCategory, newCategory: newTrim, updatedCount, gradeCategories });
});
app.delete("/api/grade-categories/:name", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  const { name } = req.params;
  const catLower = String(name).trim().toLowerCase();
  if (Array.isArray(gradeCategories)) {
    gradeCategories = gradeCategories.filter((c) => {
      const cStr = typeof c === "string" ? c : c.name || "";
      return cStr.trim().toLowerCase() !== catLower;
    });
    await saveData("gradeCategories", gradeCategories);
  }
  let deletedCount = 0;
  if (Array.isArray(grades)) {
    const prevLen = grades.length;
    grades = grades.filter((g) => String(g.category || "").trim().toLowerCase() !== catLower);
    deletedCount = prevLen - grades.length;
    if (deletedCount > 0) {
      await saveData("grades", grades);
    }
  }
  res.json({ success: true, deletedCategory: name, deletedGradesCount: deletedCount, gradeCategories, categories: gradeCategories });
});
app.get("/api/system-settings/location", (req, res) => {
  res.json({ success: true, settings: schoolLocationSettings });
});
app.put("/api/system-settings/location", async (req, res) => {
  const { schoolLatitude, schoolLongitude, geofenceRadius } = req.body;
  schoolLocationSettings = {
    schoolLatitude: Number(schoolLatitude),
    schoolLongitude: Number(schoolLongitude),
    geofenceRadius: Number(geofenceRadius) || 100
  };
  await saveData("schoolLocationSettings", schoolLocationSettings);
  res.json({ success: true, settings: schoolLocationSettings });
});
function getExamQuestionsServer(ex) {
  if (!ex) return questions || [];
  const exCode = String(ex.bankCode || "").trim().toLowerCase();
  const exSub = String(ex.subject || "").trim().toLowerCase();
  const matchingGroups = (questionBankGroups || []).filter((bg) => {
    const bgCode = String(bg.code || "").trim().toLowerCase();
    return bgCode && exCode && bgCode === exCode;
  });
  const matchingGroupSubjectIds = matchingGroups.map((bg) => String(bg.subjectId).toLowerCase());
  const matchingSubjectObjs = (subjects || []).filter((s) => {
    const sName = String(s.name || "").trim().toLowerCase();
    return sName && exSub && sName === exSub;
  });
  const matchingSubjectIds = matchingSubjectObjs.map((s) => String(s.id).toLowerCase());
  let examQs = (questions || []).filter((q) => {
    if (!q) return false;
    const qCode = String(q.code || q.bankCode || q.groupCode || "").trim().toLowerCase();
    const qSub = String(q.subjectId || q.subject || "").trim().toLowerCase();
    if (exCode && exCode !== "undefined" && exCode !== "") {
      return qCode === exCode;
    } else if (exSub && exSub !== "undefined" && exSub !== "") {
      return qSub === exSub || matchingSubjectIds.includes(qSub) || matchingGroupSubjectIds.includes(qSub);
    }
    return false;
  });
  if (ex.type === "pilihan_dan_esay") {
    const pgQs = examQs.filter((q) => q.type !== "esay" && q.type !== "essay");
    const essayQs = examQs.filter((q) => q.type === "esay" || q.type === "essay");
    const targetPgCount = ex && (ex.questionCount || ex.qCount) ? parseInt(ex.questionCount || ex.qCount, 10) : 0;
    const targetEssayCount = ex && ex.essayCount ? parseInt(ex.essayCount, 10) : 0;
    let selectedPg = [];
    if (targetPgCount > 0) {
      if (pgQs.length >= targetPgCount) {
        selectedPg = pgQs.slice(0, targetPgCount);
      } else {
        selectedPg = [...pgQs];
        if (pgQs.length > 0) {
          while (selectedPg.length < targetPgCount) {
            for (const q of pgQs) {
              if (selectedPg.length < targetPgCount) {
                selectedPg.push(q);
              } else break;
            }
          }
        }
      }
    } else {
      selectedPg = [...pgQs];
    }
    let selectedEssay = [];
    if (targetEssayCount > 0) {
      if (essayQs.length >= targetEssayCount) {
        selectedEssay = essayQs.slice(0, targetEssayCount);
      } else {
        selectedEssay = [...essayQs];
        if (essayQs.length > 0) {
          while (selectedEssay.length < targetEssayCount) {
            for (const q of essayQs) {
              if (selectedEssay.length < targetEssayCount) {
                selectedEssay.push(q);
              } else break;
            }
          }
        }
      }
    } else {
      selectedEssay = [...essayQs];
    }
    return [...selectedPg, ...selectedEssay];
  }
  let targetCount = ex && (ex.questionCount || ex.qCount) ? parseInt(ex.questionCount || ex.qCount, 10) : 0;
  if (isNaN(targetCount) || targetCount <= 0) {
    return examQs;
  }
  let generalQuestions = [];
  if (examQs.length >= targetCount) {
    generalQuestions = examQs.slice(0, targetCount);
  } else {
    while (generalQuestions.length < targetCount) {
      for (const q of examQs) {
        if (generalQuestions.length < targetCount) {
          generalQuestions.push(q);
        } else break;
      }
    }
  }
  return generalQuestions;
}
function extractJsonFromText(text) {
  try {
    const cleanText = text.replace(/```json/gi, "").replace(/```/gi, "").trim();
    return JSON.parse(cleanText);
  } catch (err) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e) {
      }
    }
    throw new Error("Failed to parse JSON from AI response: " + text);
  }
}
function cleanIndonesianText(text) {
  if (!text) return "";
  return text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, " ").replace(/\s+/g, " ").trim();
}
function getIndonesianStopwords() {
  return /* @__PURE__ */ new Set([
    "yang",
    "dan",
    "di",
    "ke",
    "dari",
    "untuk",
    "dengan",
    "adalah",
    "ini",
    "itu",
    "pada",
    "saya",
    "kamu",
    "ia",
    "mereka",
    "kita",
    "kami",
    "anda",
    "dia",
    "atau",
    "juga",
    "bahwa",
    "oleh",
    "sebagai",
    "untuk",
    "oleh",
    "dalam",
    "akan",
    "telah",
    "sudah",
    "bisa",
    "dapat",
    "ada",
    "adalah",
    "ialah",
    "yaitu",
    "yakni",
    "secara",
    "tentang",
    "seperti",
    "bagi",
    "serta",
    "karena",
    "sehingga",
    "maka",
    "namun",
    "tetapi",
    "namun",
    "melainkan",
    "yaitu",
    "antara",
    "semua",
    "setiap",
    "terhadap",
    "kepada",
    "agar",
    "supaya",
    "kpd",
    "dgn",
    "utk"
  ]);
}
function getBigrams(text) {
  const bigrams = /* @__PURE__ */ new Set();
  for (let i = 0; i < text.length - 1; i++) {
    bigrams.add(text.substring(i, i + 2));
  }
  return bigrams;
}
function getSetIntersection(setA, setB) {
  const intersection = /* @__PURE__ */ new Set();
  setA.forEach((elem) => {
    if (setB.has(elem)) {
      intersection.add(elem);
    }
  });
  return intersection;
}
function isArabicText(text) {
  if (!text) return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}
function cleanArabicText(text) {
  if (!text) return "";
  let res = text;
  res = res.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
  res = res.replace(/\u0640/g, "");
  res = res.replace(/[إأآٱ]/g, "\u0627");
  res = res.replace(/ة/g, "\u0647");
  res = res.replace(/ى/g, "\u064A");
  res = res.replace(/[ؤ]/g, "\u0648").replace(/[ئ]/g, "\u064A");
  const arabicDigits = ["\u0660", "\u0661", "\u0662", "\u0663", "\u0664", "\u0665", "\u0666", "\u0667", "\u0668", "\u0669"];
  arabicDigits.forEach((digit, idx) => {
    res = res.replace(new RegExp(digit, "g"), String(idx));
  });
  res = res.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'؛،؟«»]/g, " ");
  res = res.replace(/\s+/g, " ").trim();
  return res;
}
function getArabicStopwords() {
  return /* @__PURE__ */ new Set([
    "\u0645\u0646",
    "\u0627\u0644\u0649",
    "\u0641\u064A",
    "\u0639\u0644\u0649",
    "\u0639\u0646",
    "\u0645\u0639",
    "\u0647\u0630\u0627",
    "\u0647\u0630\u0647",
    "\u0630\u0644\u0643",
    "\u062A\u0644\u0643",
    "\u0647\u0648",
    "\u0647\u064A",
    "\u0647\u0645",
    "\u0647\u0646",
    "\u0646\u062D\u0646",
    "\u0627\u0646\u0627",
    "\u0627\u0646\u062A",
    "\u0627\u0646\u062A\u0645",
    "\u0643\u0627\u0646",
    "\u0643\u0627\u0646\u062A",
    "\u064A\u0643\u0648\u0646",
    "\u0627\u0646",
    "\u0644\u0627",
    "\u0645\u0627",
    "\u0644\u0645",
    "\u0644\u0646",
    "\u062B\u0645",
    "\u0627\u0648",
    "\u0628\u0644",
    "\u062D\u062A\u0649",
    "\u0643\u0644",
    "\u0628\u0639\u0636",
    "\u063A\u064A\u0631",
    "\u062D\u064A\u062B",
    "\u0639\u0646\u062F",
    "\u0644\u0642\u062F",
    "\u0643\u064A\u0641",
    "\u0644\u0645\u0627\u0630\u0627",
    "\u0645\u0627\u0630\u0627",
    "\u0645\u062A\u0649",
    "\u0627\u064A\u0646",
    "\u0627\u0644\u0630\u064A",
    "\u0627\u0644\u062A\u064A",
    "\u0627\u0644\u0630\u064A\u0646",
    "\u0627\u0644\u0644\u0627\u062A\u064A",
    "\u0628\u0647\u0627",
    "\u0641\u064A\u0647",
    "\u0641\u064A\u0647\u0627",
    "\u0639\u0644\u064A\u0647",
    "\u0639\u0644\u064A\u0647\u0627",
    "\u0644\u0647",
    "\u0644\u0647\u0627",
    "\u0628\u064A\u0646",
    "\u0641\u0627\u0646",
    "\u0642\u062F",
    "\u0627\u0630\u0627",
    "\u0648\u0647\u0648",
    "\u0648\u0647\u064A",
    "\u0648\u0647\u0630\u0627"
  ]);
}
function computeArabicSimilarity(studentAnswer, keyAnswer) {
  const normStudent = cleanArabicText(studentAnswer);
  const normKey = cleanArabicText(keyAnswer);
  if (normStudent === normKey) {
    return {
      similarity: 100,
      matchedKeywords: ["\u0646\u0635 \u0645\u062A\u0637\u0627\u0628\u0642 \u062A\u0645\u0627\u0645\u0627\u064B"],
      explanations: "\u0645\u0645\u062A\u0627\u0632 \u062C\u062F\u0627\u064B. \u0625\u062C\u0627\u0628\u0629 \u0627\u0644\u0637\u0627\u0644\u0628 \u0645\u0637\u0627\u0628\u0642\u0629 \u062A\u0645\u0627\u0645\u0627\u064B \u0644\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0625\u062C\u0627\u0628\u0629 (100%)."
    };
  }
  const stopwords = getArabicStopwords();
  const studentWords = normStudent.split(" ").filter((w) => w.length > 0 && !stopwords.has(w));
  const keyWords = normKey.split(" ").filter((w) => w.length > 0 && !stopwords.has(w));
  const safeKeyWords = keyWords.length > 0 ? keyWords : normKey.split(" ").filter((w) => w.length > 0);
  const safeStudentWords = studentWords.length > 0 ? studentWords : normStudent.split(" ").filter((w) => w.length > 0);
  const studentSet = new Set(safeStudentWords);
  const keySet = new Set(safeKeyWords);
  const matchedKeywords = [];
  keySet.forEach((word) => {
    if (studentSet.has(word)) {
      matchedKeywords.push(word);
    } else {
      for (const stWord of safeStudentWords) {
        if (stWord.includes(word) || word.includes(stWord)) {
          if (word.length >= 3 && stWord.length >= 3) {
            matchedKeywords.push(word);
            break;
          }
        }
      }
    }
  });
  const uniqueMatches = new Set(matchedKeywords);
  const matchRatio = keySet.size > 0 ? uniqueMatches.size / keySet.size : 0;
  const studentBigrams = getBigrams(normStudent);
  const keyBigrams = getBigrams(normKey);
  const bigramOverlap = getSetIntersection(studentBigrams, keyBigrams);
  const bigramRatio = studentBigrams.size + keyBigrams.size > 0 ? 2 * bigramOverlap.size / (studentBigrams.size + keyBigrams.size) : 0;
  let score = Math.round(matchRatio * 65 + bigramRatio * 35);
  if (score > 100) score = 100;
  if (score < 0) score = 0;
  let explanation = "";
  if (score >= 85) {
    explanation = `Sangat Baik (Mumtaz). Jawaban bahasa Arab memiliki kesesuaian ${score}% dengan kunci jawaban rujukan. Menemukan kata kunci penting: ${Array.from(uniqueMatches).slice(0, 5).join(", ")}.`;
  } else if (score >= 60) {
    explanation = `Cukup Baik (Jayyid). Jawaban bahasa Arab memiliki kesesuaian ${score}% dengan kunci rujukan. Menemukan kata kunci: ${Array.from(uniqueMatches).slice(0, 4).join(", ")}.`;
  } else if (score >= 30) {
    explanation = `Kurang Lengkap (Maqbul). Kesesuaian teks Arab ${score}%. Terdapat sedikit kecocokan kata kunci: ${Array.from(uniqueMatches).slice(0, 3).join(", ")}.`;
  } else {
    explanation = `Belum Sesuai (Dhaif). Kesesuaian teks Arab ${score}%. Silakan tinjau kembali kaidah atau mufradat terkait.`;
  }
  return {
    similarity: score,
    matchedKeywords: Array.from(uniqueMatches),
    explanations: explanation
  };
}
function getEnglishStopwords() {
  return /* @__PURE__ */ new Set([
    "a",
    "about",
    "above",
    "after",
    "again",
    "against",
    "all",
    "am",
    "an",
    "and",
    "any",
    "are",
    "as",
    "at",
    "be",
    "because",
    "been",
    "before",
    "being",
    "below",
    "between",
    "both",
    "but",
    "by",
    "can",
    "could",
    "did",
    "do",
    "does",
    "doing",
    "down",
    "during",
    "each",
    "few",
    "for",
    "from",
    "further",
    "had",
    "has",
    "have",
    "having",
    "he",
    "her",
    "here",
    "hers",
    "herself",
    "him",
    "himself",
    "his",
    "how",
    "i",
    "if",
    "in",
    "into",
    "is",
    "it",
    "its",
    "itself",
    "just",
    "me",
    "more",
    "most",
    "my",
    "myself",
    "no",
    "nor",
    "not",
    "now",
    "of",
    "off",
    "on",
    "once",
    "only",
    "or",
    "other",
    "our",
    "ours",
    "ourselves",
    "out",
    "over",
    "own",
    "same",
    "she",
    "should",
    "so",
    "some",
    "such",
    "than",
    "that",
    "the",
    "their",
    "theirs",
    "them",
    "themselves",
    "then",
    "there",
    "these",
    "they",
    "this",
    "those",
    "through",
    "to",
    "too",
    "under",
    "until",
    "up",
    "very",
    "was",
    "we",
    "were",
    "what",
    "when",
    "where",
    "which",
    "while",
    "who",
    "whom",
    "why",
    "will",
    "with",
    "would",
    "you",
    "your",
    "yours",
    "yourself",
    "yourselves"
  ]);
}
function stemEnglishWord(word) {
  if (!word || word.length <= 3) return word;
  let w = word.toLowerCase();
  if (w.endsWith("ing") && w.length > 5) return w.slice(0, -3);
  if (w.endsWith("tion") && w.length > 5) return w.slice(0, -4);
  if (w.endsWith("ment") && w.length > 5) return w.slice(0, -4);
  if (w.endsWith("able") && w.length > 5) return w.slice(0, -4);
  if (w.endsWith("ible") && w.length > 5) return w.slice(0, -4);
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (w.endsWith("ed") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("ly") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) return w.slice(0, -1);
  return w;
}
function isEnglishText(text) {
  if (!text) return false;
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  if (words.length === 0) return false;
  const engStopwords = getEnglishStopwords();
  let matchCount = 0;
  for (const w of words) {
    if (engStopwords.has(w)) matchCount++;
  }
  return matchCount / words.length >= 0.2 || matchCount >= 2;
}
function computeEnglishSimilarity(studentAnswer, keyAnswer) {
  const cleanStudent = cleanIndonesianText(studentAnswer);
  const cleanKey = cleanIndonesianText(keyAnswer);
  if (cleanStudent === cleanKey) {
    return {
      similarity: 100,
      matchedKeywords: ["Exact match"],
      explanations: "Excellent. Student's answer matches the teacher's key reference completely (100%)."
    };
  }
  const stopwords = getEnglishStopwords();
  const studentWords = cleanStudent.split(" ").filter((w) => w.length > 1 && !stopwords.has(w));
  const keyWords = cleanKey.split(" ").filter((w) => w.length > 1 && !stopwords.has(w));
  const safeKeyWords = keyWords.length > 0 ? keyWords : cleanKey.split(" ").filter((w) => w.length > 1);
  const safeStudentWords = studentWords.length > 0 ? studentWords : cleanStudent.split(" ").filter((w) => w.length > 1);
  const studentStems = safeStudentWords.map((w) => stemEnglishWord(w));
  const studentStemSet = new Set(studentStems);
  const studentRawSet = new Set(safeStudentWords);
  const matchedKeywords = [];
  safeKeyWords.forEach((word) => {
    const stem = stemEnglishWord(word);
    if (studentRawSet.has(word) || studentStemSet.has(stem)) {
      matchedKeywords.push(word);
    } else {
      for (const stWord of safeStudentWords) {
        if (stWord.includes(word) || word.includes(stWord)) {
          if (word.length > 3 && stWord.length > 3) {
            matchedKeywords.push(word);
            break;
          }
        }
      }
    }
  });
  const uniqueMatches = new Set(matchedKeywords);
  const matchRatio = safeKeyWords.length > 0 ? uniqueMatches.size / safeKeyWords.length : 0;
  const studentBigrams = getBigrams(cleanStudent);
  const keyBigrams = getBigrams(cleanKey);
  const bigramOverlap = getSetIntersection(studentBigrams, keyBigrams);
  const bigramRatio = studentBigrams.size + keyBigrams.size > 0 ? 2 * bigramOverlap.size / (studentBigrams.size + keyBigrams.size) : 0;
  let score = Math.round(matchRatio * 60 + bigramRatio * 40);
  if (score > 100) score = 100;
  if (score < 0) score = 0;
  let explanation = "";
  if (score >= 85) {
    explanation = `Very Good. The English answer has a ${score}% similarity with the key reference. Found core keywords: ${Array.from(uniqueMatches).slice(0, 5).join(", ")}.`;
  } else if (score >= 60) {
    explanation = `Good. The English answer has a ${score}% similarity with the key reference. Found keywords: ${Array.from(uniqueMatches).slice(0, 4).join(", ")}.`;
  } else if (score >= 30) {
    explanation = `Incomplete. The English answer has a ${score}% similarity. Matches few keywords: ${Array.from(uniqueMatches).slice(0, 3).join(", ")}.`;
  } else {
    explanation = `Not Matching. The English answer has a ${score}% similarity with the key reference.`;
  }
  return {
    similarity: score,
    matchedKeywords: Array.from(uniqueMatches),
    explanations: explanation
  };
}
function isMathFormula(text) {
  if (!text) return false;
  const mathSymbols = /[=\+\-\*\/\^√±≠≤≥≈π×÷²³½¼¾]|\\frac|\\sqrt|\\times|\\div|\\pm|\\cdot|\\approx|\\pi|sin\(|cos\(|tan\(|log\(|ln\(/i;
  const equationPattern = /\b([a-zA-Z]\s*=\s*[\d\.\-\+\*\/a-zA-Z]+|\d+[\.,]\d+|\d+\s*[\+\-\*\/×÷]\s*\d+)\b/;
  return mathSymbols.test(text) || equationPattern.test(text);
}
function canonicalizeMathExpression(expr) {
  if (!expr) return "";
  let res = expr.toLowerCase();
  res = res.replace(/\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}/g, "($1)/($2)");
  res = res.replace(/\\sqrt\s*\{([^}]+)\}/g, "sqrt($1)");
  res = res.replace(/\\sqrt\[(\d+)\]\s*\{([^}]+)\}/g, "root$1($2)");
  res = res.replace(/\\times|\\cdot|·|×/g, "*");
  res = res.replace(/\\div|÷/g, "/");
  res = res.replace(/\\pm|±/g, "+-");
  res = res.replace(/\\approx|≈/g, "~=");
  res = res.replace(/\\neq|≠/g, "!=");
  res = res.replace(/\\le|≤/g, "<=");
  res = res.replace(/\\ge|≥/g, ">=");
  res = res.replace(/\\pi|π/g, "pi");
  res = res.replace(/\\left|\\right/g, "");
  res = res.replace(/²/g, "^2").replace(/³/g, "^3").replace(/⁴/g, "^4");
  res = res.replace(/\^\{([^}]+)\}/g, "^$1");
  res = res.replace(/(\d+),(\d+)/g, "$1.$2");
  res = res.replace(/\bcm\s*(\^?2|persegi)\b/g, "cm2");
  res = res.replace(/\bm\s*(\^?2|persegi)\b/g, "m2");
  res = res.replace(/\bcm\s*(\^?3|kubik)\b/g, "cm3");
  res = res.replace(/\bm\s*(\^?3|kubik)\b/g, "m3");
  res = res.replace(/\bkm\s*\/\s*jam\b/g, "km/h");
  res = res.replace(/\bm\s*\/\s*detik\b/g, "m/s");
  res = res.replace(/\[/g, "(").replace(/\]/g, ")");
  res = res.replace(/\{/g, "(").replace(/\}/g, ")");
  res = res.replace(/\s*([\+\-\*\/\^=><~:])\s*/g, "$1");
  res = res.replace(/\s+/g, " ").trim();
  return res;
}
function extractKeyMathTokens(expr) {
  const norm = canonicalizeMathExpression(expr);
  const tokens = norm.match(/([a-zA-Z]\s*=\s*[^\s,;]+|\b\d+(\.\d+)?(cm2|m2|cm3|m3|km\/h|m\/s|cm|m|km|kg|gr|gram|detik|s|menit|jam|derajat|%)?|\b[a-zA-Z]\b|sqrt\([^\)]+\)|\([^\)]+\))/g);
  return tokens || norm.split(/\s+/).filter((t) => t.length > 0);
}
function computeMathSimilarity(studentAnswer, keyAnswer) {
  const normStudent = canonicalizeMathExpression(studentAnswer);
  const normKey = canonicalizeMathExpression(keyAnswer);
  if (normStudent === normKey) {
    return {
      similarity: 100,
      matchedKeywords: [keyAnswer.trim()],
      explanations: "Sempurna (100%). Rumus atau nilai perhitungan matematika siswa tepat dan identik dengan kunci jawaban."
    };
  }
  const flatStudent = normStudent.replace(/\s+/g, "");
  const flatKey = normKey.replace(/\s+/g, "");
  if (flatStudent === flatKey) {
    return {
      similarity: 100,
      matchedKeywords: [keyAnswer.trim()],
      explanations: "Sempurna (100%). Bentuk persamaan atau rumus matematika siswa tepat sesuai dengan kunci jawaban."
    };
  }
  const studentNumbers = normStudent.match(/\b\d+(\.\d+)?\b/g) || [];
  const keyNumbers = normKey.match(/\b\d+(\.\d+)?\b/g) || [];
  const lastKeyNum = keyNumbers.length > 0 ? keyNumbers[keyNumbers.length - 1] : null;
  const lastStudentNum = studentNumbers.length > 0 ? studentNumbers[studentNumbers.length - 1] : null;
  const studentTokens = extractKeyMathTokens(studentAnswer);
  const keyTokens = extractKeyMathTokens(keyAnswer);
  const studentSet = new Set(studentTokens.map((t) => t.replace(/\s+/g, "")));
  const matchedTokens = [];
  keyTokens.forEach((kt) => {
    const cleanKt = kt.replace(/\s+/g, "");
    if (studentSet.has(cleanKt)) {
      matchedTokens.push(kt);
    } else {
      for (const st of studentSet) {
        if (st.includes(cleanKt) || cleanKt.includes(st)) {
          matchedTokens.push(kt);
          break;
        }
      }
    }
  });
  const uniqueMatches = new Set(matchedTokens);
  let tokenScore = keyTokens.length > 0 ? Math.round(uniqueMatches.size / keyTokens.length * 100) : 0;
  let finalResultMatched = false;
  if (lastKeyNum && (lastStudentNum === lastKeyNum || studentNumbers.includes(lastKeyNum))) {
    finalResultMatched = true;
    tokenScore = Math.max(tokenScore, 85);
  }
  const studentBigrams = getBigrams(normStudent);
  const keyBigrams = getBigrams(normKey);
  const bigramOverlap = getSetIntersection(studentBigrams, keyBigrams);
  const bigramRatio = studentBigrams.size + keyBigrams.size > 0 ? 2 * bigramOverlap.size / (studentBigrams.size + keyBigrams.size) : 0;
  let finalScore = Math.max(tokenScore, Math.round(tokenScore * 0.7 + bigramRatio * 30));
  if (finalScore > 100) finalScore = 100;
  if (finalScore < 0) finalScore = 0;
  let explanation = "";
  if (finalScore >= 85) {
    explanation = `Sangat Baik. Hasil perhitungan / rumus matematika siswa mencapai kesesuaian ${finalScore}%. ${finalResultMatched ? "Hasil akhir perhitungan benar." : "Langkah dan rumus sesuai."} Menemukan komponen: ${Array.from(uniqueMatches).slice(0, 4).join(", ") || "sesuai rujukan"}.`;
  } else if (finalScore >= 60) {
    explanation = `Cukup Baik. Kesesuaian rumus / angka ${finalScore}%. Terdapat komponen perhitungan yang cocok: ${Array.from(uniqueMatches).slice(0, 3).join(", ")}.`;
  } else if (finalScore >= 30) {
    explanation = `Kurang Lengkap. Kesesuaian rumus / angka ${finalScore}%. Menemukan sebagian elemen: ${Array.from(uniqueMatches).slice(0, 2).join(", ")}.`;
  } else {
    explanation = `Belum Sesuai. Hasil rumus / angka ${finalScore}% belum sesuai dengan kunci rujukan guru.`;
  }
  return {
    similarity: finalScore,
    matchedKeywords: Array.from(uniqueMatches),
    explanations: explanation
  };
}
function computeUniversalEssaySimilarity(studentAnswer, keyAnswer) {
  const rawStudent = (studentAnswer || "").trim();
  const rawKey = (keyAnswer || "").trim();
  if (!rawStudent || rawStudent.toLowerCase() === "tidak menjawab") {
    return {
      similarity: 0,
      matchedKeywords: [],
      explanations: "Siswa tidak memberikan jawaban atau jawaban kosong."
    };
  }
  if (!rawKey) {
    return {
      similarity: 100,
      matchedKeywords: [],
      explanations: "Rujukan kunci jawaban guru kosong, diberikan nilai penuh sebagai default."
    };
  }
  if (isArabicText(rawKey) || isArabicText(rawStudent)) {
    return computeArabicSimilarity(rawStudent, rawKey);
  }
  if (isMathFormula(rawKey) || isMathFormula(rawStudent)) {
    const mathResult = computeMathSimilarity(rawStudent, rawKey);
    if (mathResult.similarity >= 50) {
      return mathResult;
    }
  }
  if (isEnglishText(rawKey) || isEnglishText(rawStudent)) {
    return computeEnglishSimilarity(rawStudent, rawKey);
  }
  return computeIndonesianTextSimilarity(rawStudent, rawKey);
}
function computeIndonesianTextSimilarity(studentAnswer, keyAnswer) {
  const cleanStudent = cleanIndonesianText(studentAnswer);
  const cleanKey = cleanIndonesianText(keyAnswer);
  if (cleanStudent === cleanKey) {
    return {
      similarity: 100,
      matchedKeywords: ["Sesuai penuh"],
      explanations: "Sangat Baik (100%). Jawaban siswa identik dengan kunci jawaban rujukan guru."
    };
  }
  const stopwords = getIndonesianStopwords();
  const studentWords = cleanStudent.split(" ").filter((w) => w.length > 1);
  const keyWords = cleanKey.split(" ").filter((w) => w.length > 1);
  const studentCore = studentWords.filter((w) => !stopwords.has(w));
  const keyCore = keyWords.filter((w) => !stopwords.has(w));
  if (keyCore.length === 0) {
    keyCore.push(...keyWords);
  }
  if (studentCore.length === 0) {
    studentCore.push(...studentWords);
  }
  const studentSet = new Set(studentCore);
  const keySet = new Set(keyCore);
  const matchedKeywords = [];
  keySet.forEach((word) => {
    if (studentSet.has(word)) {
      matchedKeywords.push(word);
    } else {
      for (const stWord of studentCore) {
        if (stWord.includes(word) || word.includes(stWord)) {
          if (word.length > 3 && stWord.length > 3) {
            matchedKeywords.push(word);
            break;
          }
        }
      }
    }
  });
  const uniqueMatches = new Set(matchedKeywords);
  const matchRatio = keySet.size > 0 ? uniqueMatches.size / keySet.size : 0;
  const studentBigrams = getBigrams(cleanStudent);
  const keyBigrams = getBigrams(cleanKey);
  const bigramOverlap = getSetIntersection(studentBigrams, keyBigrams);
  const bigramRatio = studentBigrams.size + keyBigrams.size > 0 ? 2 * bigramOverlap.size / (studentBigrams.size + keyBigrams.size) : 0;
  let finalScore = Math.round(matchRatio * 60 + bigramRatio * 40);
  if (finalScore > 100) finalScore = 100;
  if (finalScore < 0) finalScore = 0;
  let explanation = "";
  if (finalScore >= 85) {
    explanation = `Sangat Baik. Jawaban memiliki kesamaan ${finalScore}% dengan rujukan kunci jawaban. Menemukan kesesuaian kata kunci penting: ${uniqueMatches.size > 0 ? Array.from(uniqueMatches).slice(0, 5).join(", ") : "seluruh rujukan"}.`;
  } else if (finalScore >= 60) {
    explanation = `Cukup Baik. Jawaban memiliki kesamaan ${finalScore}% dengan rujukan kunci jawaban. Menemukan kata kunci penting: ${uniqueMatches.size > 0 ? Array.from(uniqueMatches).slice(0, 4).join(", ") : "sebagian rujukan"}.`;
  } else if (finalScore >= 30) {
    explanation = `Kurang Lengkap. Jawaban memiliki kesamaan ${finalScore}% dengan rujukan kunci jawaban. Menemukan sedikit kecocokan kata kunci: ${uniqueMatches.size > 0 ? Array.from(uniqueMatches).slice(0, 3).join(", ") : "beberapa kata"}.`;
  } else {
    explanation = `Belum Sesuai. Jawaban memiliki kesamaan ${finalScore}% dengan rujukan kunci jawaban. Silakan tinjau kembali materi terkait.`;
  }
  return {
    similarity: finalScore,
    matchedKeywords: Array.from(uniqueMatches),
    explanations: explanation
  };
}
app.post("/api/gemini/auto-koreksi", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  try {
    const { classId, examId, studentId, method = "ai" } = req.body;
    if (!classId || !examId) {
      return res.status(400).json({ success: false, message: "classId dan examId harus diisi." });
    }
    const ex = exams.find((e) => String(e.id) === String(examId));
    if (!ex) {
      return res.status(404).json({ success: false, message: "Jadwal ujian tidak ditemukan." });
    }
    const authUser = getAuthUser(req);
    const isBos = authUser?.role === "bos" || authUser?.role === "superadmin";
    if (!isBos && !isItemForCurrentMadrasah(ex, req)) {
      return res.status(403).json({ success: false, message: "Akses ditolak." });
    }
    const examQuestions = getExamQuestionsServer(ex);
    const essayQuestions = examQuestions.filter((q) => q.type === "esay" || q.type === "essay");
    if (essayQuestions.length === 0) {
      return res.json({ success: false, message: "Ujian ini tidak memiliki soal esay untuk dikoreksi." });
    }
    const classStudents = students.filter(
      (s) => String(s.classId) === String(classId) && (isBos || isItemForCurrentMadrasah(s, req))
    );
    let completedStudents = classStudents.filter((st) => {
      const key = st.id + "_" + examId;
      return Boolean(completedExams[key]) || studentExamAnswers[key] !== void 0;
    });
    if (studentId) {
      completedStudents = completedStudents.filter((st) => String(st.id) === String(studentId));
    }
    if (completedStudents.length === 0) {
      return res.json({ success: false, message: studentId ? "Siswa belum selesai mengerjakan ujian atau jawaban esay tidak ditemukan." : "Belum ada siswa di kelas ini yang mengerjakan ujian ini." });
    }
    if (method === "keyword") {
      let successCount2 = 0;
      for (const st of completedStudents) {
        const key1 = st.id + "_" + examId;
        const key2 = String(st.id) + "_" + String(examId);
        const studentAnswers = studentExamAnswers[key1] || studentExamAnswers[key2] || {};
        const grades2 = {};
        const explanations = {};
        for (const q of essayQuestions) {
          const studentAns = studentAnswers[q.id] !== void 0 ? studentAnswers[q.id] : studentAnswers[String(q.id)] || "";
          const keyAns = q.answer || "";
          const result = computeUniversalEssaySimilarity(studentAns, keyAns);
          grades2[q.id] = result.similarity;
          explanations[q.id] = result.explanations;
        }
        const gradeObj = studentExamGrades[key1] || studentExamGrades[key2] || {
          id: "G" + Date.now() + "_" + st.id,
          studentId: st.id,
          examId,
          classId,
          pgQuestionsCount: examQuestions.filter((q) => q.type !== "esay" && q.type !== "essay").length,
          correctPgCount: 0,
          pgScore: 100,
          essayScore: 0,
          finalScore: 100,
          essayGrades: {},
          essayExplanations: {}
        };
        gradeObj.essayGrades = { ...gradeObj.essayGrades || {}, ...grades2 };
        gradeObj.essayExplanations = { ...gradeObj.essayExplanations || {}, ...explanations };
        let sum = 0;
        essayQuestions.forEach((q) => {
          const val = gradeObj.essayGrades[q.id] !== void 0 ? gradeObj.essayGrades[q.id] : gradeObj.essayGrades[String(q.id)] || 0;
          sum += Number(val) || 0;
        });
        gradeObj.essayScore = Math.round(sum / essayQuestions.length);
        gradeObj.isGraded = true;
        const weightPg = ex.weightPg !== void 0 ? Number(ex.weightPg) : 50;
        const weightEssay = ex.weightEssay !== void 0 ? Number(ex.weightEssay) : 50;
        gradeObj.finalScore = Math.round((gradeObj.pgScore || 0) * weightPg / 100 + gradeObj.essayScore * weightEssay / 100);
        studentExamGrades[key1] = gradeObj;
        studentExamGrades[key2] = gradeObj;
        successCount2++;
      }
      await saveData("studentExamGrades", studentExamGrades);
      return res.json({
        success: true,
        message: `Proses koreksi otomatis Non-AI selesai. Berhasil mencocokkan & menilai ${successCount2} siswa secara instan tanpa API key.`
      });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: "GEMINI_API_KEY environment variable is missing on server. Gunakan metode Koreksi Non-AI."
      });
    }
    const ai = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
    let successCount = 0;
    let failCount = 0;
    for (const st of completedStudents) {
      const key1 = st.id + "_" + examId;
      const key2 = String(st.id) + "_" + String(examId);
      const studentAnswers = studentExamAnswers[key1] || studentExamAnswers[key2] || {};
      const prompt = `
Anda adalah seorang pendidik penyelia yang ahli dan objektif dalam mengoreksi ujian esay siswa.
Tugas Anda adalah menilai jawaban esay siswa berdasarkan Pertanyaan dan Kunci Jawaban / Rujukan Guru yang disediakan.

Berikan nilai integer antara 0 sampai 100 (0 jika tidak menjawab/ngawur, 100 jika sempurna sesuai rujukan).
Berikan penjelasan yang singkat, padat, dan konstruktif dalam bahasa Indonesia (maksimal 2 kalimat) mengapa siswa tersebut mendapatkan nilai tersebut berdasarkan jawabannya.

Format respon yang Anda berikan HARUS berupa JSON murni dengan struktur berikut (tanpa markdown formatting, tanpa \`\`\`json):
{
  "grades": {
    "question_id": <nilai_integer_0_sampai_100>
  },
  "explanations": {
    "question_id": "<penjelasan_singkat_indonesia>"
  }
}

Berikut adalah data esay siswa:
Nama Siswa: ${st.name}
Mata Pelajaran: ${ex.subject}
Ujian: ${ex.title}

Daftar Pertanyaan, Kunci Jawaban, dan Jawaban Siswa:
${essayQuestions.map((q, i) => {
        const studentAns = studentAnswers[q.id] !== void 0 ? studentAnswers[q.id] : studentAnswers[String(q.id)] || "";
        return `
[Soal ${i + 1}]
ID Soal: ${q.id}
Pertanyaan: ${q.question}
Kunci Jawaban Guru / Rujukan: ${q.answer || "-"}
Jawaban Siswa: ${studentAns || "(Tidak menjawab)"}
`;
      }).join("\n---")}`;
      try {
        const response = await generateGeminiContent(ai, {
          model: "gemini-3.7-flash",
          contents: prompt
        });
        const textResponse = response.text || "";
        const parsed = extractJsonFromText(textResponse);
        if (parsed && parsed.grades) {
          const gradeObj = studentExamGrades[key1] || studentExamGrades[key2] || {
            id: "G" + Date.now() + "_" + st.id,
            studentId: st.id,
            examId,
            classId,
            pgQuestionsCount: examQuestions.filter((q) => q.type !== "esay" && q.type !== "essay").length,
            correctPgCount: 0,
            pgScore: 100,
            essayScore: 0,
            finalScore: 100,
            essayGrades: {},
            essayExplanations: {}
          };
          gradeObj.essayGrades = { ...gradeObj.essayGrades || {}, ...parsed.grades };
          gradeObj.essayExplanations = { ...gradeObj.essayExplanations || {}, ...parsed.explanations };
          let sum = 0;
          essayQuestions.forEach((q) => {
            const val = gradeObj.essayGrades[q.id] !== void 0 ? gradeObj.essayGrades[q.id] : gradeObj.essayGrades[String(q.id)] || 0;
            sum += Number(val) || 0;
          });
          gradeObj.essayScore = Math.round(sum / essayQuestions.length);
          gradeObj.isGraded = true;
          const weightPg = ex.weightPg !== void 0 ? Number(ex.weightPg) : 50;
          const weightEssay = ex.weightEssay !== void 0 ? Number(ex.weightEssay) : 50;
          gradeObj.finalScore = Math.round((gradeObj.pgScore || 0) * weightPg / 100 + gradeObj.essayScore * weightEssay / 100);
          studentExamGrades[key1] = gradeObj;
          studentExamGrades[key2] = gradeObj;
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        console.warn(`[Auto Koreksi] AI gagal memproses siswa ${st.name}, beralih ke metode kecocokan cerdas (Non-AI fallback):`, err?.message || err);
        try {
          const grades2 = {};
          const explanations = {};
          for (const q of essayQuestions) {
            const studentAns = studentAnswers[q.id] !== void 0 ? studentAnswers[q.id] : studentAnswers[String(q.id)] || "";
            const keyAns = q.answer || "";
            const result = computeUniversalEssaySimilarity(studentAns, keyAns);
            grades2[q.id] = result.similarity;
            explanations[q.id] = result.explanations;
          }
          const gradeObj = studentExamGrades[key1] || studentExamGrades[key2] || {
            id: "G" + Date.now() + "_" + st.id,
            studentId: st.id,
            examId,
            classId,
            pgQuestionsCount: examQuestions.filter((q) => q.type !== "esay" && q.type !== "essay").length,
            correctPgCount: 0,
            pgScore: 100,
            essayScore: 0,
            finalScore: 100,
            essayGrades: {},
            essayExplanations: {}
          };
          gradeObj.essayGrades = { ...gradeObj.essayGrades || {}, ...grades2 };
          gradeObj.essayExplanations = { ...gradeObj.essayExplanations || {}, ...explanations };
          let sum = 0;
          essayQuestions.forEach((q) => {
            const val = gradeObj.essayGrades[q.id] !== void 0 ? gradeObj.essayGrades[q.id] : gradeObj.essayGrades[String(q.id)] || 0;
            sum += Number(val) || 0;
          });
          gradeObj.essayScore = Math.round(sum / essayQuestions.length);
          gradeObj.isGraded = true;
          const weightPg = ex.weightPg !== void 0 ? Number(ex.weightPg) : 50;
          const weightEssay = ex.weightEssay !== void 0 ? Number(ex.weightEssay) : 50;
          gradeObj.finalScore = Math.round((gradeObj.pgScore || 0) * weightPg / 100 + gradeObj.essayScore * weightEssay / 100);
          studentExamGrades[key1] = gradeObj;
          studentExamGrades[key2] = gradeObj;
          successCount++;
        } catch (fbErr) {
          failCount++;
        }
      }
    }
    await saveData("studentExamGrades", studentExamGrades);
    res.json({
      success: true,
      message: `Proses auto koreksi AI selesai. Berhasil mengoreksi ${successCount} siswa.${failCount > 0 ? ` Gagal memproses ${failCount} siswa.` : ""}`
    });
  } catch (error) {
    console.error("[Auto Koreksi Error]:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});
app.post("/api/gemini/auto-koreksi-lkpd", requireAuth, requireRole(["teacher", "guru", "admin", "bos", "superadmin"]), async (req, res) => {
  try {
    const { classId, lkpdId, method = "ai" } = req.body;
    if (!classId || !lkpdId) {
      return res.status(400).json({ success: false, message: "classId dan lkpdId harus diisi." });
    }
    const store = readLocalStore();
    let lkpdList2 = store.lkpdList || [];
    const lkpd = lkpdList2.find((l) => String(l.id) === String(lkpdId));
    if (!lkpd) {
      return res.status(404).json({ success: false, message: "LKPD tidak ditemukan." });
    }
    const authUser = getAuthUser(req);
    const isBos = authUser?.role === "bos" || authUser?.role === "superadmin";
    if (!isBos && !isItemForCurrentMadrasah(lkpd, req)) {
      return res.status(403).json({ success: false, message: "Akses ditolak." });
    }
    const markers = lkpd.markers || [];
    if (markers.length === 0) {
      return res.json({ success: false, message: "LKPD ini tidak memiliki titik pertanyaan untuk dikoreksi." });
    }
    const submissions = lkpd.submissions || [];
    const classStudents = students.filter(
      (s) => String(s.classId) === String(classId) && (isBos || isItemForCurrentMadrasah(s, req))
    );
    const classStudentIds = new Set(classStudents.map((s) => String(s.id)));
    const submissionsToGrade = submissions.filter((sub) => classStudentIds.has(String(sub.studentId)));
    if (submissionsToGrade.length === 0) {
      return res.json({ success: false, message: "Belum ada jawaban siswa masuk dari kelas ini." });
    }
    let successCount = 0;
    let failCount = 0;
    if (method === "keyword") {
      for (const sub of submissionsToGrade) {
        const answers = sub.answers || {};
        const scores = {};
        const feedback = {};
        let totalScore = 0;
        let totalPoints = 0;
        for (const mk of markers) {
          const studentAns = String(answers[mk.id] || "").trim();
          const keyAns = String(mk.answerKey || "").trim();
          const maxPoints = Number(mk.points) || 25;
          totalPoints += maxPoints;
          const result = computeUniversalEssaySimilarity(studentAns, keyAns);
          const scaledScore = Math.round(result.similarity / 100 * maxPoints);
          scores[mk.id] = scaledScore;
          feedback[mk.id] = result.explanations || `Kesesuaian kunci jawaban: ${result.similarity}%`;
          totalScore += scaledScore;
        }
        sub.scores = scores;
        sub.feedback = feedback;
        sub.totalScore = totalPoints > 0 ? Math.round(totalScore / totalPoints * 100) : 0;
        sub.isGraded = true;
        sub.gradedAt = (/* @__PURE__ */ new Date()).toISOString();
        successCount++;
      }
    } else {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is missing on server.");
      }
      const ai = new import_genai.GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      for (const sub of submissionsToGrade) {
        try {
          const answers = sub.answers || {};
          let prompt = `Anda adalah Guru Penilai profesional Madrasah Digital.
Silakan koreksi jawaban siswa untuk LKPD (Lembar Kerja Peserta Didik) berjudul "${lkpd.title}".
Berikut adalah daftar pertanyaan, kunci jawaban guru, dan jawaban dari siswa bernama "${sub.studentName}".

Koreksilah secara adil, objektif, dan berikan penilaian per nomor sesuai bobot poin maksimalnya.
Untuk setiap nomor, berikan nilai numerik (skor) antara 0 hingga bobot maksimal, serta ulasan (feedback/penjelasan) singkat, mendidik, dan sopan dalam Bahasa Indonesia.

Format respons wajib berupa JSON murni dengan skema berikut:
{
  "grades": {
    "ID_SOAL_1": nilai_angka,
    "ID_SOAL_2": nilai_angka
  },
  "explanations": {
    "ID_SOAL_1": "Ulasan guru...",
    "ID_SOAL_2": "Ulasan guru..."
  }
}

Catatan:
- Kembalikan HANYA objek JSON valid tersebut tanpa tambahan teks markdown or backticks \`\`\`.
- ID_SOAL_1, ID_SOAL_2 dst harus sama persis dengan ID Soal yang diberikan di bawah.

Berikut daftar pertanyaannya:
`;
          markers.forEach((mk, i) => {
            const studentAns = answers[mk.id] || "";
            prompt += `
[Soal ${i + 1}]
ID Soal: ${mk.id}
Pertanyaan: ${mk.question}
Bobot Maksimal: ${mk.points || 25} Poin
Kunci Jawaban Guru / Rujukan: ${mk.answerKey || "-"}
Jawaban Siswa: ${studentAns || "(Tidak menjawab)"}
---`;
          });
          const response = await generateGeminiContent(ai, {
            model: "gemini-3.7-flash",
            contents: prompt
          });
          const textResponse = response.text || "";
          const parsed = extractJsonFromText(textResponse);
          if (parsed && parsed.grades) {
            const scores = {};
            const feedback = {};
            let totalScore = 0;
            let totalPoints = 0;
            markers.forEach((mk) => {
              const maxPoints = Number(mk.points) || 25;
              totalPoints += maxPoints;
              const val = parsed.grades[mk.id] !== void 0 ? parsed.grades[mk.id] : parsed.grades[String(mk.id)] || 0;
              const fb = parsed.explanations[mk.id] || parsed.explanations[String(mk.id)] || "Bagus.";
              const validatedScore = Math.max(0, Math.min(maxPoints, Math.round(Number(val) || 0)));
              scores[mk.id] = validatedScore;
              feedback[mk.id] = fb;
              totalScore += validatedScore;
            });
            sub.scores = scores;
            sub.feedback = feedback;
            sub.totalScore = totalPoints > 0 ? Math.round(totalScore / totalPoints * 100) : 0;
            sub.isGraded = true;
            sub.gradedAt = (/* @__PURE__ */ new Date()).toISOString();
            successCount++;
          } else {
            failCount++;
          }
        } catch (subErr) {
          console.error(`Error grading submission of ${sub.studentName}:`, subErr);
          failCount++;
        }
      }
    }
    store.lkpdList = lkpdList2;
    writeLocalStore(store);
    await saveData("lkpdList", lkpdList2);
    res.json({
      success: true,
      message: `Proses auto koreksi LKPD selesai. Berhasil mengoreksi ${successCount} siswa.${failCount > 0 ? ` Gagal memproses ${failCount} siswa.` : ""}`
    });
  } catch (error) {
    console.error("[Auto Koreksi LKPD Error]:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});
app.post("/api/gemini/generate-questions", async (req, res) => {
  try {
    const { topic, mcCount = 5, essayCount = 0, optionCount = 4, level = "Sedang" } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing on server.");
    }
    const ai = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
    const prompt = `
Buatkan soal ujian untuk madrasah.
Topik: ${topic}
Tingkat kesulitan: ${level}
Jumlah soal pilihan ganda: ${mcCount}
Jumlah soal esay: ${essayCount}
Jumlah opsi pilihan ganda: ${optionCount}

Format JSON array of objects dengan properti: type ('mc' atau 'essay'), question, options (array string), answer, explanation.
${NO_DASHES_PROMPT}
`;
    const response = await generateGeminiContent(ai, {
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const resultText = response.text || "[]";
    const rawData = safeParseGeminiJSON(resultText, null);
    if (!rawData) throw new Error("Invalid JSON from Gemini response: " + resultText);
    const data = sanitizeGeneratedData(rawData);
    res.json({ success: true, data });
  } catch (error) {
    console.error("Gemini AI error (using fallback):", error);
    const { topic, mcCount = 5, essayCount = 0, optionCount = 4 } = req.body || {};
    const items = [];
    for (let i = 0; i < (mcCount || 5); i++) {
      items.push({
        type: "mc",
        question: `Soal Pilihan Ganda ${i + 1} mengenai ${topic || "Materi Sekolah"}: Apa konsep mendasar dari topik ini?`,
        options: optionCount === 5 ? ["Opsi A", "Opsi B", "Opsi C", "Opsi D", "Opsi E"] : ["Opsi A", "Opsi B", "Opsi C", "Opsi D"],
        answer: "Opsi A",
        explanation: `Penjelasan edukatif mengenai ${topic || "materi"} sesuai kurikulum madrasah.`
      });
    }
    for (let i = 0; i < (essayCount || 0); i++) {
      items.push({
        type: "essay",
        question: `Jelaskan secara rinci prinsip dan penerapan dari ${topic || "materi"} dalam kehidupan sehari-hari!`,
        options: [],
        answer: "Jawaban uraian komprehensif.",
        explanation: "Penjelasan uraian."
      });
    }
    res.json({ success: true, data: items, fallback: true });
  }
});
app.post("/api/gemini/generate-enrichment", async (req, res) => {
  try {
    const { topic } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing on server.");
    }
    const ai = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
    const prompt = `
Buatkan uraian pengayaan pembelajaran atau ringkasan materi pembelajaran madrasah yang mendalam dan edukatif untuk topik: "${topic}".
Berikan penjelasan 2-3 paragraf yang bermutu tinggi dan profesional dalam bahasa Indonesia.
${NO_DASHES_PROMPT}
`;
    const response = await generateGeminiContent(ai, {
      model: "gemini-3.7-flash",
      contents: prompt
    });
    const text = cleanDashedLines(response.text || "");
    res.json({ success: true, text });
  } catch (error) {
    console.error("Gemini AI error (using fallback):", error);
    const { topic } = req.body || {};
    const fallbackText = `Materi pengayaan mengenai ${topic || "pembelajaran madrasah"} mencakup pemahaman komprehensif, nilai-nilai spiritual, serta penerapan praktis dalam kehidupan sehari-hari. Peserta didik diharapkan dapat memahami konsep dasar, menganalisis hikmah yang terkandung, serta mengamalkannya dengan penuh kedisiplinan dan tanggung jawab.`;
    res.json({ success: true, text: fallbackText, fallback: true });
  }
});
var lessonPlans = bootStore["lessonPlans"] && bootStore["lessonPlans"].length > 0 ? bootStore["lessonPlans"] : [
  {
    id: "LP1",
    subjectId: "S1",
    title: "Modul Fiqih: Shalat Berjamaah",
    topic: "Shalat Berjamaah",
    grade: "X",
    identitasModul: "Nama Penyusun: Ahmad Fauzi, S.Pd.I\nInstansi: MAN 1 Model\nTahun Penyusunan: 2026\nKelas: X\nAlokasi Waktu: 2 x 45 Menit",
    kompetensiAwal: "Siswa telah memahami rukun shalat fardhu dan syarat sah shalat secara mandiri.",
    profilPancasila: "Beriman, bertaqwa kepada Tuhan YME dan Berakhlak mulia (spiritual shalat), Gotong Royong (kebersamaan jamaah).",
    saranaPrasarana: "Masjid/musholla sekolah, sajadah, buku panduan Fiqih, proyektor, presentasi PowerPoint.",
    targetPeserta: "Siswa kelas X Umum / Reguler (maksimal 36 siswa).",
    modelPembelajaran: "Problem-Based Learning (PBL) dan Demonstrasi Praktis.",
    tujuanPembelajaran: "1. Menjelaskan keutamaan shalat berjamaah.\n2. Mendemonstrasikan tata cara shalat berjamaah, termasuk posisi imam dan makmum.",
    pemahamanBermakna: "Shalat berjamaah melatih kedisiplinan diri, menumbuhkan rasa persaudaraan sesama muslim, dan melipatgandakan pahala ibadah.",
    pertanyaanPemantik: "Mengapa shalat berjamaah dinilai 27 derajat lebih utama dibanding shalat sendirian? Bagaimana jika makmum terlambat (masbuq)?",
    persiapanPembelajaran: "Guru menyiapkan modul, lembar observasi praktik, proyektor, dan memastikan masjid sekolah siap digunakan.",
    kegiatanPembelajaran: "Pendahuluan (10 menit): Salam, doa, motivasi.\nKegiatan Inti (70 menit): Tanya jawab, simulasi posisi shalat jamaah.\nPenutup (10 menit): Refleksi, penugasan mandiri.",
    asesmen: "Formatif: Lembar penilaian praktik tata cara masbuq.\nSumatif: Ujian pemahaman teori konsep shalat jamaah.",
    pengayaanRemedial: "Pengayaan: Membaca rujukan kitab Fathul Qarib mengenai syarat sah imam.\nRemedial: Mengulang praktik bacaan shalat dengan bimbingan khusus.",
    lkpd: "Lembar Kerja Siswa: Analisis status keabsahan shalat berjamaah pada 3 skenario studi kasus.",
    lembarKerja: "Rubrik Penilaian Sikap Spiritual dan Keterampilan Praktik Shalat.",
    glosarium: "Imam, Makmum, Masbuq, Muwafiq, Fardhu Kifayah.",
    daftarPustaka: "Fauzi, Ahmad. 2024. Buku Teks Mata Pelajaran Terkait."
  }
];
app.get("/api/lesson-plans", (req, res) => {
  const { subjectId } = req.query;
  const filteredTenant = filterByMadrasah(lessonPlans, req);
  if (subjectId) {
    const filtered = filteredTenant.filter((lp) => String(lp.subjectId) === String(subjectId));
    return res.json({ success: true, data: filtered });
  }
  res.json({ success: true, data: filteredTenant });
});
app.post("/api/lesson-plans", async (req, res) => {
  const lp = tagNewRecord(req.body, req);
  if (!lp.id) {
    lp.id = "LP" + Date.now();
    lessonPlans.push(lp);
  } else {
    const idx = lessonPlans.findIndex((item) => String(item.id) === String(lp.id));
    if (idx !== -1) {
      lessonPlans[idx] = lp;
    } else {
      lessonPlans.push(lp);
    }
  }
  await saveData("lessonPlans", lessonPlans);
  res.json({ success: true, data: lp, message: "Modul Ajar berhasil disimpan" });
});
app.delete("/api/lesson-plans/:id", async (req, res) => {
  const { id } = req.params;
  lessonPlans = lessonPlans.filter((item) => String(item.id) !== String(id));
  await saveData("lessonPlans", lessonPlans);
  res.json({ success: true, message: "Modul Ajar berhasil dihapus" });
});
app.get("/api/import-groups", (req, res) => {
  const { subjectId } = req.query;
  if (subjectId) {
    const filtered = importGroups.filter((g) => String(g.subjectId) === String(subjectId));
    return res.json({ success: true, data: filtered });
  }
  res.json({ success: true, data: importGroups });
});
app.post("/api/import-groups", async (req, res) => {
  const grp = req.body;
  if (!grp.id) {
    grp.id = "grp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    importGroups.push(grp);
  } else {
    const idx = importGroups.findIndex((g) => String(g.id) === String(grp.id));
    if (idx !== -1) {
      importGroups[idx] = grp;
    } else {
      importGroups.push(grp);
    }
  }
  await saveData("importGroups", importGroups);
  res.json({ success: true, data: grp, message: "Kelompok berhasil disimpan" });
});
app.delete("/api/import-groups/:id", async (req, res) => {
  const { id } = req.params;
  importGroups = importGroups.filter((g) => String(g.id) !== String(id));
  await saveData("importGroups", importGroups);
  res.json({ success: true, message: "Kelompok berhasil dihapus" });
});
function detectSubjectCategoryServer(subjectName = "", topic = "", materiDetail = "") {
  const raw = `${subjectName} ${topic} ${materiDetail}`.toLowerCase();
  if (raw.includes("koding") || raw.includes("coding") || raw.includes("ai") || raw.includes("informatika") || raw.includes("sistem komputer") || raw.includes("komputer") || raw.includes("arduino") || raw.includes("python") || raw.includes("algoritma") || raw.includes("siber") || raw.includes("cyber") || raw.includes("mikrokontroler") || raw.includes("single board") || raw.includes("c++") || raw.includes("unoardusim") || raw.includes("iot") || raw.includes("pemrograman") || raw.includes("tinkercad")) {
    return "koding_ai";
  }
  if (raw.includes("arab") || raw.includes("lughah") || raw.includes("hiwar") || raw.includes("nahwu") || raw.includes("sharaf") || raw.includes("mufradat") || raw.includes("qira") || raw.includes("kitabah")) {
    return "bahasa_arab";
  }
  if (raw.includes("pai") || raw.includes("agama") || raw.includes("quran") || raw.includes("hadis") || raw.includes("fikih") || raw.includes("fiqih") || raw.includes("akidah") || raw.includes("akhlak") || raw.includes("ski") || raw.includes("sejarah kebudayaan islam") || raw.includes("islam") || raw.includes("tajwid")) {
    return "pai_madrasah";
  }
  return "umum";
}
function getSubjectTemplateInstructions(subjectName = "", topic = "") {
  const raw = `${subjectName} ${topic}`.toLowerCase();
  let profile = {
    karakteristik: "Pembelajaran berbasis konsep dan aplikasi keilmuan secara umum.",
    kompetensi: "Penguasaan konsep dasar, analisis, dan penerapan dalam masalah umum.",
    aktivitas: "Membaca teks, diskusi, tanya jawab, penugasan, dan presentasi.",
    asesmen: "Tes tertulis, observasi sikap, dan penilaian penugasan.",
    lkpd: "Soal pemahaman, tabel isian, dan instruksi diskusi.",
    rubrik: "Pemahaman konsep, ketepatan penyelesaian, dan keaktifan diskusi.",
    kko: "Menjelaskan, mengidentifikasi, menganalisis, dan mempresentasikan.",
    pertanyaanPemantik: "Bagaimana konsep materi ini berlaku dalam kehidupan sehari-hari?",
    pengayaan: "Eksplorasi materi lanjutan secara mandiri.",
    remedial: "Bimbingan ulang untuk konsep yang belum dipahami.",
    aturanKhusus: "JANGAN menggunakan istilah 'domain Konsep Dasar Keilmuan', 'desain implementasi', 'kegagalan sistem', 'laboratorium', atau 'studi kasus' jika tidak relevan. Sesuaikan bahasa dengan karakteristik ilmu."
  };
  if (raw.includes("arab") || raw.includes("nahwu") || raw.includes("sharaf") || raw.includes("hiwar")) {
    profile = {
      karakteristik: "Pembelajaran bahasa komunikatif dan tekstual mencakup kemahiran (Istima', Kalam, Qira'ah, Kitabah) dan unsur bahasa (Mufradat, Qawaid). JANGAN gunakan aktivitas sains/teknologi.",
      kompetensi: "Penguasaan kosakata (mufradat), tata bahasa (qawaid/nahwu/sharaf), dan keterampilan berbahasa Arab.",
      aktivitas: "Menyimak dialog (istima'), menirukan pelafalan, membaca teks Arab berharakat (qira'ah), menulis huruf/kalimat Arab (kitabah), praktik percakapan (hiwar).",
      asesmen: "Uji pelafalan, tes penguasaan mufradat, tes qawaid, uji bacaan, tulisan, dan unjuk kerja kalam/hiwar. JANGAN gunakan 'uji pemecahan masalah/studi kasus HOTS'.",
      lkpd: "Latihan mufradat (menyambung arti), melengkapi dialog berbahasa Arab, menyusun kata menjadi kalimat (tartib), praktik hiwar, membaca teks Arab.",
      rubrik: "Ketepatan pengucapan (makharijul huruf), ketepatan kosakata, struktur kalimat (tarkib), kelancaran berbicara, pemahaman isi teks.",
      kko: "Menyebutkan (kosakata), membaca (teks), menggunakan (ungkapan), menyusun (kalimat), mempraktikkan (dialog), menganalisis (tata bahasa).",
      pertanyaanPemantik: "Pertanyaan kontekstual terkait fungsi ungkapan atau tata bahasa yang dipelajari dalam bahasa Arab.",
      pengayaan: "Praktik percakapan lanjutan, membuat karangan/teks (kitabah) mandiri.",
      remedial: "Latihan membaca mufradat, mencocokkan kosakata dengan arti, dan bimbingan pelafalan.",
      aturanKhusus: "WAJIB menggunakan tulisan Arab secara nyata dalam isi modul (materi, contoh, dialog, mufradat, LKPD). Sediakan teks Arab, terjemahan, dan kosakata penting. Gunakan istilah Arab: \u0627\u0644\u0627\u0633\u0645, \u0627\u0644\u0641\u0639\u0644, \u0627\u0644\u062C\u0645\u0644\u0629, \u0627\u0644\u0645\u0628\u062A\u062F\u0623, \u0627\u0644\u062E\u0628\u0631 dll sesuai topik."
    };
  } else if (raw.includes("matematika") || raw.includes("math")) {
    profile = {
      karakteristik: "Pembelajaran berbasis logika, penalaran ruang, bilangan, aljabar, dan pemecahan masalah matematis.",
      kompetensi: "Pemahaman konsep matematis, operasi hitung, penalaran logis, pemecahan masalah, dan komunikasi matematis.",
      aktivitas: "Mengamati masalah nyata, menemukan pola matematis, memahami konsep/rumus, latihan prosedural bertahap, dan verifikasi jawaban.",
      asesmen: "Tes pemahaman konsep, uji presisi prosedur matematis, uji penalaran logis.",
      lkpd: "Soal bertahap, tabel pola bilangan/geometri, dan eksplorasi langkah pemecahan masalah.",
      rubrik: "Pemahaman konsep, ketepatan prosedur matematis, ketepatan hasil akhir, dan komunikasi matematis.",
      kko: "Menghitung, menentukan, membedakan, menerapkan (rumus/konsep), memecahkan masalah, membuktikan.",
      pertanyaanPemantik: "Bagaimana kita memodelkan masalah nyata ini menjadi persamaan/pola matematika?",
      pengayaan: "Pemecahan masalah matematis tingkat lanjut (HOTS) atau soal olimpiade sederhana.",
      remedial: "Pengulangan konsep dasar, latihan prosedural dengan angka yang lebih mudah.",
      aturanKhusus: "Fokus pada struktur pemecahan masalah matematis. Hindari kegiatan 'membaca teks panjang' atau 'menghafal'."
    };
  } else if (raw.includes("biologi") || raw.includes("biology")) {
    profile = {
      karakteristik: "Pembelajaran sains kehidupan, observasi makhluk hidup, sistem biologi, dan eksperimen alam.",
      kompetensi: "Pemahaman konsep biologi, observasi, klasifikasi, analisis sistem kehidupan.",
      aktivitas: "Mengamati fenomena alam, membuat prediksi, observasi mikroskopis/makroskopis, eksperimen, mengumpulkan dan menganalisis data, menarik kesimpulan.",
      asesmen: "Uji pengetahuan sistem biologi, laporan observasi/eksperimen, analisis data.",
      lkpd: "Tabel pengamatan/observasi, diagram sistem organ/sel, pertanyaan analisis data percobaan.",
      rubrik: "Pemahaman konsep sains, ketelitian observasi, kemampuan analisis data, kejelasan laporan.",
      kko: "Mengidentifikasi, mengklasifikasikan, menganalisis, menyimpulkan, mendeskripsikan sistem.",
      pertanyaanPemantik: "Apa yang terjadi pada makhluk hidup/sistem biologi ini jika lingkungan berubah?",
      pengayaan: "Eksplorasi ekosistem atau eksperimen lanjutan di luar jam.",
      remedial: "Penjelasan ulang konsep bergambar, melengkapi diagram sistem organ/sel.",
      aturanKhusus: "Gunakan istilah biologi yang tepat. Integrasikan kegiatan laboratorium/pengamatan bila relevan dengan topik."
    };
  } else if (raw.includes("sejarah") || raw.includes("history")) {
    profile = {
      karakteristik: "Pembelajaran ilmu masa lalu, kronologi peristiwa, analisis sebab-akibat, dan interpretasi sumber sejarah.",
      kompetensi: "Berpikir kronologis, berpikir sinkronik/diakronik, interpretasi sejarah, dan pemahaman narasi masa lalu.",
      aktivitas: "Membaca sumber sejarah, menyusun kronologi/timeline, menganalisis sebab-akibat peristiwa, interpretasi sumber, dan diskusi peninggalan.",
      asesmen: "Uji pengetahuan sejarah, analisis kronologis, esai sebab-akibat.",
      lkpd: "Peta konsep peristiwa, garis waktu (timeline), analisis dokumen/sumber sejarah.",
      rubrik: "Akurasi fakta sejarah, kemampuan berpikir kronologis, ketajaman analisis sebab-akibat.",
      kko: "Menjelaskan, menyusun kronologi, membandingkan, menganalisis, menginterpretasi.",
      pertanyaanPemantik: "Bagaimana peristiwa masa lalu ini membentuk kehidupan kita saat ini? Apa sebab utamanya?",
      pengayaan: "Kajian literatur sejarah lanjutan, analisis tokoh sejarah lokal.",
      remedial: "Mengurutkan peristiwa menggunakan garis waktu sederhana.",
      aturanKhusus: "JANGAN gunakan praktik eksperimen atau algoritma. Fokus pada alur waktu, fakta, dan kausalitas sejarah."
    };
  } else if (raw.includes("fisika") || raw.includes("physics")) {
    profile = {
      karakteristik: "Pembelajaran fenomena alam, hukum fisika, gaya, energi, dan pemodelan matematis fisika.",
      kompetensi: "Pemahaman hukum alam, pengukuran, analisis besaran fisika, dan penyelesaian matematis.",
      aktivitas: "Demonstrasi fenomena fisika, eksperimen/praktikum, pengumpulan data terukur, perhitungan matematis fisika.",
      asesmen: "Laporan praktikum, pemecahan masalah fisika matematis, pemahaman konsep.",
      lkpd: "Tabel pengukuran besaran fisika, grafik hubungan antar variabel, soal hitungan fisika.",
      rubrik: "Ketepatan pengukuran, penerapan rumus yang benar, analisis grafik, kebenaran hasil hitung.",
      kko: "Menghitung, mengukur, merumuskan, menganalisis, membuktikan (hukum fisika).",
      pertanyaanPemantik: "Mengapa benda bergerak dengan cara tersebut? Besaran fisika apa yang memengaruhinya?",
      pengayaan: "Eksperimen fisika mandiri, penerapan hukum fisika pada teknologi modern.",
      remedial: "Latihan pemahaman rumus dasar dan perhitungan dengan panduan langkah per langkah.",
      aturanKhusus: "Integrasikan konsep teori dan perhitungan matematis."
    };
  } else if (raw.includes("kimia") || raw.includes("chemistry")) {
    profile = {
      karakteristik: "Pembelajaran struktur atom, ikatan kimia, reaksi, dan stoikiometri.",
      kompetensi: "Pemahaman reaksi kimia, analisis molekul, perhitungan stoikiometri, dan praktik lab.",
      aktivitas: "Mengamati reaksi kimia, menyusun persamaan reaksi, perhitungan mol/stoikiometri, praktikum.",
      asesmen: "Uji persamaan reaksi, laporan hasil percobaan, hitungan stoikiometri.",
      lkpd: "Menyetarakan persamaan reaksi, tabel pengamatan perubahan warna/suhu, perhitungan zat.",
      rubrik: "Ketepatan rumus kimia/persamaan, presisi hitungan, dan prosedur keselamatan/kerja lab.",
      kko: "Menyetarakan, menghitung, menganalisis, meramalkan hasil reaksi.",
      pertanyaanPemantik: "Bagaimana dua zat yang direaksikan dapat menghasilkan zat baru? Apa reaksi yang terjadi?",
      pengayaan: "Analisis jurnal kimia terapan.",
      remedial: "Latihan menyetarakan persamaan reaksi sederhana.",
      aturanKhusus: "Gunakan notasi/rumus kimia yang tepat."
    };
  } else if (raw.includes("informatika") || raw.includes("koding") || raw.includes("komputer")) {
    profile = {
      karakteristik: "Pembelajaran komputasi, algoritma, pemrograman, dan perangkat keras/lunak.",
      kompetensi: "Berpikir komputasional, algoritma dan pemrograman, analisis data, jaringan komputer.",
      aktivitas: "Analisis masalah, merancang algoritma, menulis baris kode, debugging, dan pengujian program/hardware.",
      asesmen: "Uji kode program (koding), pembuatan prototipe, analisis efisiensi algoritma.",
      lkpd: "Tabel flowchart, penelusuran kode (tracing), dan panduan praktikum koding.",
      rubrik: "Ketepatan logika algoritma, kebersihan kode (clean code), keberhasilan eksekusi (tanpa error).",
      kko: "Memprogram, menganalisis, merancang, menguji, menerapkan.",
      pertanyaanPemantik: "Bagaimana logika algoritma ini menyelesaikan masalah tersebut secara komputasional?",
      pengayaan: "Pembuatan proyek software lanjutan.",
      remedial: "Latihan algoritma dasar menggunakan visual block atau tracing baris per baris.",
      aturanKhusus: "Gunakan terminologi informatika (algoritma, syntax, debugging, dll)."
    };
  } else if (raw.includes("indonesia")) {
    profile = {
      karakteristik: "Pembelajaran bahasa dan sastra Indonesia, keterampilan berbahasa (menyimak, membaca, berbicara, menulis).",
      kompetensi: "Pemahaman teks, kaidah kebahasaan, produksi teks lisan dan tulisan, serta apresiasi sastra.",
      aktivitas: "Membaca teks (narasi, eksposisi, puisi, dll), menganalisis struktur/kaidah bahasa, menulis teks mandiri, dan berdiskusi lisan.",
      asesmen: "Penilaian membaca pemahaman, menulis teks sesuai struktur, praktik deklamasi/pidato/presentasi.",
      lkpd: "Analisis struktur dan kaidah kebahasaan teks, melengkapi teks rumpang, draf tulisan.",
      rubrik: "Keserasian ide, struktur teks, ejaan/tata bahasa (PUEBI), diksi, dan pelafalan (lisan).",
      kko: "Menjelaskan, menyimpulkan, mengevaluasi teks, menyusun (teks), menyajikan (lisan).",
      pertanyaanPemantik: "Apa pesan tersirat dari teks ini? Bagaimana struktur ini membantu tujuan penulis?",
      pengayaan: "Menulis resensi atau naskah drama.",
      remedial: "Latihan menemukan gagasan utama paragraf dan menyusun kalimat baku.",
      aturanKhusus: "Gunakan istilah linguistik dan sastra yang relevan."
    };
  } else if (raw.includes("inggris") || raw.includes("english")) {
    profile = {
      karakteristik: "Pembelajaran bahasa Inggris komunikatif (Listening, Speaking, Reading, Writing).",
      kompetensi: "Penguasaan grammar, vocabulary, dan kelancaran komunikasi internasional.",
      aktivitas: "Listening to dialogues, reading texts, practicing conversations (speaking), writing short essays.",
      asesmen: "Listening comprehension, speaking performance, reading quiz, writing task.",
      lkpd: "Fill-in-the-blank grammar, vocabulary matching, reading comprehension questions.",
      rubrik: "Pronunciation, fluency, grammar accuracy, vocabulary richness.",
      kko: "Identify, analyze, practice, create, communicate.",
      pertanyaanPemantik: "How do you express [topic] appropriately in an English context?",
      pengayaan: "Debate or advanced essay writing.",
      remedial: "Basic grammar drills and vocabulary reading.",
      aturanKhusus: "Present components partially in English where appropriate, maintaining natural language learning flow."
    };
  } else if (raw.includes("pjok") || raw.includes("jasmani") || raw.includes("olahraga")) {
    profile = {
      karakteristik: "Pembelajaran pendidikan jasmani, olahraga, kesehatan fisik, dan gerak motorik.",
      kompetensi: "Keterampilan gerak spesifik, kebugaran jasmani, dan pengetahuan kesehatan.",
      aktivitas: "Pemanasan, demonstrasi gerakan olahraga, praktik gerak, bermain dengan peraturan dimodifikasi, pendinginan.",
      asesmen: "Uji performa gerakan fisik, tes kebugaran, dan tes tertulis aturan permainan/kesehatan.",
      lkpd: "Lembar observasi gerakan teman, ceklis kesehatan fisik.",
      rubrik: "Kesesuaian teknik gerak, kelincahan, sportivitas, dan kerja sama tim.",
      kko: "Mempraktikkan, mendemonstrasikan, mengkoordinasikan, merancang latihan.",
      pertanyaanPemantik: "Bagaimana cara melakukan gerak dasar ini dengan benar dan aman untuk menghindari cedera?",
      pengayaan: "Latihan fisik intensitas tinggi, menjadi pemimpin senam/pemanasan.",
      remedial: "Pengulangan gerak dasar terbimbing.",
      aturanKhusus: "Sangat berfokus pada aktivitas lapangan/fisik, bukan hanya hafalan teori."
    };
  } else if (raw.includes("seni") || raw.includes("art") || raw.includes("budaya")) {
    profile = {
      karakteristik: "Pembelajaran apresiasi, ekspresi, kreativitas, dan karya seni budaya (rupa, musik, tari, teater).",
      kompetensi: "Apresiasi seni, eksplorasi estetika, dan produksi/penciptaan karya seni.",
      aktivitas: "Mengamati karya, mengeksplorasi teknik dan medium, merancang sketsa/konsep, membuat karya (prakarya), presentasi karya.",
      asesmen: "Penilaian produk/karya, portofolio, pameran/penampilan (performance).",
      lkpd: "Desain sketsa awal, analisis apresiasi karya seni.",
      rubrik: "Kreativitas, estetika, penguasaan teknik medium, dan kelengkapan konsep.",
      kko: "Merancang, menciptakan, mengapresiasi, mengekspresikan.",
      pertanyaanPemantik: "Pesan atau perasaan apa yang ingin kamu sampaikan melalui karya senimu?",
      pengayaan: "Membuat karya seni menggunakan medium campuran (mixed media).",
      remedial: "Eksplorasi ulang teknik dasar seni.",
      aturanKhusus: "Fokus pada kreativitas dan ekspresi budaya."
    };
  } else if (raw.includes("fikih") || raw.includes("fiqih") || raw.includes("akidah") || raw.includes("quran") || raw.includes("hadis") || raw.includes("ski")) {
    profile = {
      karakteristik: "Pembelajaran keislaman madrasah, dalil naqli (Al-Qur'an/Hadis), dan praktik ibadah/akhlak.",
      kompetensi: "Pemahaman hukum/syariat, penanaman akidah, pembiasaan akhlak mulia, dan hikmah sejarah Islam.",
      aktivitas: "Menyimak bacaan dalil, membaca teks dalil, analisis hukum/kisah, diskusi hikmah, praktik ibadah.",
      asesmen: "Hafalan dalil, tes pengetahuan hukum/akidah, uji praktik ibadah.",
      lkpd: "Mencocokkan dalil dengan hukum, analisis kisah teladan, ceklis pembiasaan ibadah.",
      rubrik: "Kelancaran bacaan dalil, ketepatan hukum, sikap/akhlak, dan presisi praktik.",
      kko: "Menjelaskan (dalil), mempraktikkan, meneladani, menyimpulkan (hikmah).",
      pertanyaanPemantik: "Apa hikmah dan nilai-nilai akhlak/hukum dari ajaran/peristiwa ini dalam hidup kita?",
      pengayaan: "Menelaah literatur keislaman lanjutan/kitab kuning ringan.",
      remedial: "Bimbingan baca tulis Al-Qur'an/dalil, latihan menghafal bertahap.",
      aturanKhusus: "WAJIB menyertakan teks Arab (dalil Al-Qur'an/Hadis), terjemahan, dan hikmah spiritual. Jangan gunakan praktik eksperimen laboratorium."
    };
  } else if (raw.includes("ppkn") || raw.includes("pancasila") || raw.includes("kewarganegaraan")) {
    profile = {
      karakteristik: "Pembelajaran nilai Pancasila, konstitusi, hak/kewajiban warga negara, dan wawasan kebangsaan.",
      kompetensi: "Pemahaman norma, sikap demokratis, kesadaran hukum, dan penerapan nilai luhur bangsa.",
      aktivitas: "Diskusi kasus hukum/sosial, debat isu kewarganegaraan, simulasi peradilan/musyawarah, analisis berita.",
      asesmen: "Esai sikap, observasi nilai karakter (Pancasila), rubrik debat/diskusi.",
      lkpd: "Analisis studi kasus pelanggaran hak/kewajiban, pemetaan nilai konstitusi.",
      rubrik: "Argumentasi logis, sikap demokratis, pemahaman dasar hukum/Pancasila.",
      kko: "Menganalisis, menghargai, mematuhi, mempertajam (argumentasi), menunjukkan (sikap).",
      pertanyaanPemantik: "Bagaimana nilai-nilai Pancasila dapat diimplementasikan untuk menyelesaikan masalah sosial ini?",
      pengayaan: "Proyek kewarganegaraan (citizenship project) di lingkungan masyarakat.",
      remedial: "Pendalaman konsep dasar konstitusi/nilai luhur dengan contoh sederhana.",
      aturanKhusus: "Fokus pada afeksi, kewarganegaraan aktif, dan diskusi nilai."
    };
  } else if (raw.includes("geografi") || raw.includes("ekonomi") || raw.includes("sosiologi")) {
    profile = {
      karakteristik: "Pembelajaran ilmu sosial, keruangan (geografi), interaksi manusia, dan dinamika ekonomi.",
      kompetensi: "Pemahaman fenomena sosial/keruangan/ekonomi, analisis data statistik sosial, dan pemecahan isu masyarakat.",
      aktivitas: "Membaca peta (geografi), analisis data pasar (ekonomi), observasi lingkungan sosial (sosiologi), diskusi fenomena.",
      asesmen: "Uji pemahaman fenomena, laporan observasi sosial, analisis grafik/kurva.",
      lkpd: "Analisis peta, grafik ekonomi, atau studi kasus masalah sosial masyarakat.",
      rubrik: "Ketajaman analisis fenomena, interpretasi data yang benar, kejelasan laporan.",
      kko: "Menganalisis (fenomena/data), memetakan, menjelaskan (hubungan sebab-akibat sosial).",
      pertanyaanPemantik: "Mengapa fenomena/masalah (sosial/ekonomi/keruangan) ini terjadi dan bagaimana dampaknya bagi masyarakat?",
      pengayaan: "Penelitian sosial berskala kecil di sekolah/masyarakat.",
      remedial: "Mengulang membaca dan interpretasi data/grafik/peta dasar.",
      aturanKhusus: "Gunakan pendekatan kontekstual berbasis data masyarakat nyata."
    };
  }
  return `
==================================================
INSTRUKSI KHUSUS PROFIL PEDAGOGIS MATA PELAJARAN
==================================================
MATA PELAJARAN: ${subjectName}
TOPIK: ${topic}

Anda adalah Generator Modul Ajar Profesional. 
Gunakan PROFIL PEDAGOGIS berikut secara ketat agar modul ajar selaras dengan karakter keilmuannya:

1. Karakteristik Mapel: ${profile.karakteristik}
2. Kompetensi Utama: ${profile.kompetensi}
3. Aktivitas Pembelajaran: ${profile.aktivitas}
4. Jenis Asesmen: ${profile.asesmen}
5. Jenis LKPD: ${profile.lkpd}
6. Fokus Rubrik Penilaian: ${profile.rubrik}
7. Kata Kerja Operasional (KKO) Dominan: ${profile.kko}
8. Contoh Pertanyaan Pemantik: ${profile.pertanyaanPemantik}
9. Ide Pengayaan: ${profile.pengayaan}
10. Ide Remedial: ${profile.remedial}

ATURAN WAJIB:
- ${profile.aturanKhusus}
- JANGAN GUNAKAN TEMPLATE GENERIK (seperti "domain Konsep Dasar Keilmuan", "efisiensi proses", "alur kerja", "kegagalan sistem", "praktik laboratorium", "studi kasus teknologi") JIKA TIDAK RELEVAN.
- Tujuan Pembelajaran HARUS menggunakan C1-C6 (sesuai Bloom) secara spesifik terkait materi, BUKAN kata-kata generik.
- Sesuaikan nama tahapan, istilah teknis, dan instrumen asesmen dengan karakter ${subjectName}.
- HASIL AKHIR HARUS TERASA SEPERTI DIBUAT OLEH GURU MATA PELAJARAN ${subjectName.toUpperCase()} PROFESIONAL!
`;
}
app.post("/api/gemini/generate-modul", async (req, res) => {
  try {
    const { subjectName, topic, grade, fieldName } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY tidak dikonfigurasi di server.");
    }
    const ai = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
    const category = detectSubjectCategoryServer(subjectName, topic);
    const subjectRule = getSubjectTemplateInstructions(subjectName, topic);
    let prompt = `Buatkan draf bagian "${fieldName}" untuk modul ajar Kurikulum Merdeka mata pelajaran "${subjectName}", materi "${topic}", kelas "${grade}".
Gunakan bahasa Indonesia yang profesional (atau kombinasi bahasa target seperti bahasa Arab/Inggris jika relevan dengan mapel).
DILARANG keras menggunakan format markdown seperti bintang (**) atau pagar (#).

${subjectRule}

${NO_DASHES_PROMPT}`;
    const response = await generateGeminiContent(ai, {
      model: "gemini-3.7-flash",
      contents: prompt
    });
    const text = cleanDashedLines(response.text || "");
    res.json({ success: true, text });
  } catch (error) {
    console.error("Gemini Modul Ajar error (using fallback):", error);
    const { subjectName, topic, grade, fieldName } = req.body || {};
    const safeTopic = topic || "Materi Pokok Pembelajaran";
    const safeSubject = subjectName || "Mata Pelajaran";
    const safeGrade = grade || "X (Sepuluh)";
    try {
      const masterResult = generateMasterV2ModulAjar({
        schoolName: appSettings?.schoolName || "Madrasah / Sekolah",
        teacherName: "Guru Mata Pelajaran",
        subjectName: safeSubject,
        grade: safeGrade,
        babUtama: safeTopic,
        subbab: safeTopic,
        materiInti: safeTopic
      });
      let fallbackText = masterResult[fieldName] || `Draf bagian ${fieldName} untuk topik ${safeTopic} mata pelajaran ${safeSubject}.`;
      return res.json({ success: true, text: fallbackText, fallback: true });
    } catch (engineErr) {
      let fallbackText = `Draf bagian ${fieldName} untuk topik ${safeTopic} mata pelajaran ${safeSubject}.`;
      return res.json({ success: true, text: fallbackText, fallback: true });
    }
  }
});
app.post("/api/gemini/generate-modul-all", async (req, res) => {
  try {
    const { subjectName, topic, materiDetail, grade, model = "Deep Learning" } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY tidak dikonfigurasi di server.");
    }
    const ai = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
    const category = detectSubjectCategoryServer(subjectName, topic, materiDetail);
    const subjectRule = getSubjectTemplateInstructions(subjectName, topic);
    const modelDesc = model === "Deep Learning" ? "Deep Learning (Pembelajaran Mendalam yang berfokus pada eksplorasi konsep secara mendalam, pemecahan masalah nyata, serta penalaran tingkat tinggi/HOTS)" : model;
    let jsonSchemaInstructions = "";
    jsonSchemaInstructions = `Kembalikan respon strictly dalam format JSON objek:
{
  "identitasModul": "INFORMASI UMUM
A. IDENTITAS MODUL
- Mata Pelajaran: ${subjectName}
- Kelas: ${grade}
- Topik: ${topic}",
  "kompetensiAwal": "KOMPETENSI AWAL
Peserta didik memiliki pemahaman dasar ${topic}.",
  "profilPancasila": "PROFIL PELAJAR PANCASILA
Karakter yang relevan.",
  "saranaPrasarana": "SARANA DAN PRASARANA
Alat dan bahan.",
  "targetPeserta": "TARGET PESERTA DIDIK
Reguler.",
  "modelPembelajaran": "MODEL PEMBELAJARAN
Model yang sesuai.",
  "tujuanPembelajaran": "TUJUAN PEMBELAJARAN
Memahami konsep ${topic}.",
  "pemahamanBermakna": "PEMAHAMAN BERMAKNA
Manfaat ${topic}.",
  "pertanyaanPemantik": "PERTANYAAN PEMANTIK
Apa itu ${topic}?",
  "persiapanPembelajaran": "PERSIAPAN PEMBELAJARAN
Persiapan guru.",
  "kegiatanPembelajaran": "KEGIATAN PEMBELAJARAN
Pendahuluan, Inti, Penutup.",
  "asesmen": "ASESMEN
Formatif dan sumatif.",
  "pengayaanRemedial": "PENGAYAAN DAN REMEDIAL
Kegiatan tindak lanjut.",
  "lkpd": "LEMBAR KERJA PESERTA DIDIK (LKPD)
Tugas siswa.",
  "lembarKerja": "LAMPIRAN BAHAN AJAR
Materi lengkap.",
  "glosarium": "GLOSARIUM
Istilah penting.",
  "daftarPustaka": "DAFTAR PUSTAKA
Sumber referensi."
}`;
    const prompt = `
Buatkan draf LENGKAP, SANGAT PANJANG, RINCI, DAN TERSTRUKTUR "Modul Ajar" Kurikulum Merdeka untuk mata pelajaran "${subjectName}", materi/topik "${topic}", kelas/tingkat "${grade}", menggunakan Model/Metode Pembelajaran "${modelDesc}".
${subjectRule}
${materiDetail ? `
URAIAN / CATATAN DETAIL MATERI DARI GURU:
"${materiDetail}"

Instruksi Tambahan: AI HARUS mengelaborasi dan menguraikan poin-poin materi di atas secara sangat mendalam, terperinci, terstruktur, dan komprehensif ke dalam seluruh komponen modul ajar.` : ""}

DILARANG MEMBUAT RINGKASAN ATAU SINGKAT! Tuliskan setiap komponen secara terurai panjang dan komprehensif.
Tuliskan hasil TANPA format markdown bintang (**) atau pagar (#). Gunakan penomoran huruf (A, B, C) atau angka (1, 2, 3) biasa yang rapi.
${jsonSchemaInstructions}
${NO_DASHES_PROMPT}
`;
    const response = await generateGeminiContent(ai, {
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const resultText = response.text || "{}";
    const rawData = safeParseGeminiJSON(resultText, null);
    if (!rawData) throw new Error("Invalid JSON from Gemini Modul Ajar All response: " + resultText);
    const data = sanitizeGeneratedData(rawData);
    res.json({ success: true, data });
  } catch (error) {
    console.error("Gemini Modul Ajar All error (using fallback):", error);
    const { subjectName, topic, materiDetail, grade, semester = "1", model = "Deep Learning" } = req.body || {};
    const safeTopic = topic || "Materi Pokok Pembelajaran";
    const safeSubject = subjectName || "Mata Pelajaran";
    const safeGrade = grade || "X (Sepuluh)";
    try {
      const masterResult = generateMasterV2ModulAjar({
        schoolName: appSettings?.schoolName || "Madrasah / Sekolah",
        teacherName: "Guru Mata Pelajaran",
        subjectName: safeSubject,
        grade: safeGrade,
        semester: semester || "1",
        babUtama: safeTopic,
        subbab: safeTopic,
        materiInti: materiDetail ? `${safeTopic} - ${materiDetail}` : safeTopic,
        alokasiWaktu: "4 JP",
        modelPembelajaran: model || "Deep Learning"
      });
      res.json({ success: true, data: masterResult, fallback: true });
    } catch (engineErr) {
      let fallbackData = {
        identitasModul: `INFORMASI UMUM
A. IDENTITAS MODUL
- Mata Pelajaran: ${safeSubject}
- Topik: ${safeTopic}
- Kelas: ${safeGrade}
- Semester: ${semester}`,
        kompetensiAwal: `KOMPETENSI AWAL
Peserta didik memiliki pemahaman dasar materi ${safeTopic}.`,
        profilPancasila: `PROFIL PELAJAR PANCASILA
Mandiri, Bernalar Kritis, Bergotong Royong, Kreatif`,
        saranaPrasarana: `SARANA DAN PRASARANA
Alat tulis, Buku Teks, Proyektor`,
        targetPeserta: `TARGET PESERTA DIDIK
Peserta didik reguler/tipikal`,
        modelPembelajaran: `MODEL PEMBELAJARAN
${model}`,
        tujuanPembelajaran: `TUJUAN PEMBELAJARAN
Memahami dan mempraktikkan konsep ${safeTopic}`,
        pemahamanBermakna: `PEMAHAMAN BERMAKNA
Menerapkan materi ${safeTopic} dalam kehidupan sehari-hari`,
        pertanyaanPemantik: `PERTANYAAN PEMANTIK
Apa yang kalian ketahui tentang ${safeTopic}?`,
        persiapanPembelajaran: `PERSIAPAN PEMBELAJARAN
Guru menyiapkan bahan ajar dan media`,
        kegiatanPembelajaran: `KEGIATAN PEMBELAJARAN
Pendahuluan, Kegiatan Inti, Penutup`,
        asesmen: `ASESMEN
Asesmen Formatif dan Sumatif`,
        pengayaanRemedial: `PENGAYAAN DAN REMEDIAL
Pengayaan untuk yang sudah tuntas, Remedial untuk yang belum`,
        lkpd: `LKPD
Lembar Kerja terkait ${safeTopic}`,
        lembarKerja: `BAHAN BACAAN
Materi pembelajaran ${safeTopic}`,
        glosarium: `GLOSARIUM
Daftar istilah penting terkait ${safeTopic}`,
        daftarPustaka: `DAFTAR PUSTAKA
Buku panduan mata pelajaran ${safeSubject}`
      };
      res.json({ success: true, data: fallbackData, fallback: true });
    }
  }
});
app.post("/api/modul/parse-document", async (req, res) => {
  try {
    const { fileName, fileType, fileBase64, base64, textContent, content } = req.body;
    const effectiveBase64 = fileBase64 || base64;
    const effectiveTextContent = textContent || content;
    let extractedText = "";
    let extractedHtml = "";
    if (effectiveTextContent && typeof effectiveTextContent === "string" && effectiveTextContent.trim()) {
      extractedText = effectiveTextContent.trim();
      extractedHtml = extractedText.split(/\n\s*\n/).map((para) => `<p style="margin-bottom: 12px; line-height: 1.6;">${para.replace(/\n/g, "<br/>")}</p>`).join("");
    } else if (effectiveBase64 && typeof effectiveBase64 === "string") {
      const base64Data = effectiveBase64.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const isDocx = fileName && (fileName.toLowerCase().endsWith(".docx") || fileName.toLowerCase().endsWith(".doc")) || fileType && (fileType.includes("word") || fileType.includes("officedocument") || fileType === "docx" || fileType === "doc");
      const isPdf = fileName && fileName.toLowerCase().endsWith(".pdf") || fileType && (fileType.includes("pdf") || fileType === "pdf");
      if (isDocx) {
        try {
          const textResult = await import_mammoth.default.extractRawText({ buffer });
          const htmlResult = await import_mammoth.default.convertToHtml({ buffer });
          extractedText = textResult.value ? textResult.value.trim() : "";
          extractedHtml = htmlResult.value ? htmlResult.value.trim() : "";
        } catch (docxErr) {
          console.warn("[Docx Parser Warning] Mammoth parsing failed, falling back to string extraction:", docxErr.message);
          extractedText = buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{2,}/g, " ").trim();
          extractedHtml = `<p>${extractedText.replace(/\n/g, "<br/>")}</p>`;
        }
      } else if (isPdf) {
        const apiKey = process.env.GEMINI_API_KEY;
        let pdfParsedWithAi = false;
        if (apiKey) {
          try {
            const ai = new import_genai.GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
            const pdfExtractRes = await generateGeminiContent(ai, {
              model: "gemini-3.7-flash",
              contents: [
                {
                  inlineData: {
                    mimeType: "application/pdf",
                    data: base64Data
                  }
                },
                "Ekstrak seluruh materi, bab, dan isi naskah dokumen pembelajaran dari file PDF ini secara lengkap, rinci, dan terstruktur. Tampilkan teks murni materi tanpa tanda pembatas berulang."
              ]
            });
            if (pdfExtractRes && pdfExtractRes.text) {
              extractedText = pdfExtractRes.text.trim();
              extractedHtml = extractedText.split(/\n\s*\n/).map((para) => `<p style="margin-bottom: 12px; line-height: 1.6;">${para.replace(/\n/g, "<br/>")}</p>`).join("");
              pdfParsedWithAi = true;
            }
          } catch (pdfAiErr) {
            console.warn("[PDF AI Parser Warning] Gemini inlineData PDF parse failed:", pdfAiErr.message);
          }
        }
        if (!pdfParsedWithAi) {
          const rawBufStr = buffer.toString("utf-8");
          const textMatches = rawBufStr.match(/\(([^()]+)\)/g);
          if (textMatches && textMatches.length > 10) {
            extractedText = textMatches.map((m) => m.slice(1, -1)).join(" ").replace(/\\r|\\n/g, " ").replace(/\s{2,}/g, " ").trim();
          } else {
            extractedText = rawBufStr.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{2,}/g, " ").trim();
          }
          extractedHtml = `<p>${extractedText.replace(/\n/g, "<br/>")}</p>`;
        }
      } else {
        extractedText = buffer.toString("utf-8").trim();
        extractedHtml = extractedText.split(/\n\s*\n/).map((para) => `<p style="margin-bottom: 12px; line-height: 1.6;">${para.replace(/\n/g, "<br/>")}</p>`).join("");
      }
    }
    if (!extractedText) {
      extractedText = "Dokumen modul ajar terimpor. Berisi materi pembelajaran terstruktur.";
      extractedHtml = `<p>${extractedText}</p>`;
    }
    res.json({
      success: true,
      fileName: fileName || "Dokumen_Modul",
      extractedText,
      text: extractedText,
      extractedHtml,
      characterCount: extractedText.length,
      wordCount: extractedText.split(/\s+/).filter(Boolean).length
    });
  } catch (error) {
    console.error("Document parse error:", error);
    res.status(500).json({ success: false, message: "Gagal membaca dokumen: " + (error.message || "Unknown error") });
  }
});
app.post("/api/modul/import-ai-structure", async (req, res) => {
  try {
    const { subjectName, grade, semester = "1", topic, extractedText, guruName, kepsekName } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    const safeSubject = subjectName || "Mata Pelajaran";
    const safeTopic = topic || "Materi Pokok Pembelajaran";
    const safeGrade = grade || "X (Sepuluh)";
    let ai = null;
    if (apiKey) {
      try {
        ai = new import_genai.GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
      } catch (e) {
        console.warn("GoogleGenAI init failed:", e);
      }
    }
    if (ai && extractedText && extractedText.length > 30) {
      try {
        const prompt = `
Sebagai pakar kurikulum Merdeka dan guru profesional, telaah dan transformasikan isi DOKUMEN MODUL/MATERI AJAR yang diunggah berikut ini menjadi perangkat "MODUL AJAR KURIKULUM MERDEKA LENGKAP (21 KOMPONEN A-U)" yang sangat berbobot, terperinci, dan siap ajar.

INFORMASI DOKUMEN:
- Mata Pelajaran: "${safeSubject}"
- Kelas / Tingkat: "${safeGrade}"
- Semester: "${semester}"
- Topik / Materi Acuan: "${safeTopic}"

DOKUMEN ASLI YANG DIUNGGAH (WORD/PDF/TEKS):
"""
${extractedText.substring(0, 12e3)}
"""

PANDUAN PENYUSUNAN KOMPONEN:
Gunakan materi aktual dari dokumen yang diunggah untuk mengisi semua komponen berikut secara lengkap, mendalam, dan relevan:
1. identitasModul: Informasi penyusun, institusi, tahun, jenjang/tingkat ${safeGrade}, alokasi waktu (misal 4 JP / 2 Pertemuan).
2. kompetensiAwal: Pengetahuan/keterampilan prasyarat berdasarkan dokumen.
3. profilPancasila: Dimensi profil pelajar (Bernalar Kritis, Mandiri, Bergotong Royong, Kreatif, Berakhlak Mulia).
4. saranaPrasarana: Media, alat bahan ajar, dan sumber materi.
5. targetPeserta: Target peserta didik reguler / tipikal dengan diferensiasi.
6. modelPembelajaran: Model pembelajaran aktif (misal Deep Learning / Problem-Based Learning / Project-Based Learning).
7. tujuanPembelajaran: Tujuan pembelajaran operasional berbasis ABCD dan kata kerja operasional taksonomi Bloom.
8. pemahamanBermakna: Manfaat nyata materi ini dalam kehidupan sehari-hari siswa.
9. pertanyaanPemantik: 3-4 pertanyaan pemantik yang merangsang rasa ingin tahu dan nalar kritis.
10. persiapanPembelajaran: Langkah persiapan guru sebelum masuk kelas.
11. kegiatanPembelajaran: Uraian langkah detail Pertemuan 1 & 2 (Pendahuluan, Inti berbasis Literasi, Critical Thinking, Collaboration, Communication, Creativity, dan Penutup).
12. asesmen: Asesmen formatif (observasi/kuis), asesmen sumatif (tes tertulis/unjuk kerja), dan instrumen rubrik.
13. pengayaanRemedial: Program pengayaan siswa capaian tinggi dan remedial siswa yang butuh bimbingan.
14. lkpd: Lembar Kerja Peserta Didik (LKPD) lengkap berisi petunjuk, tugas analisis/soal, dan instruksi diskusi.
15. lembarKerja: Rangkuman bahan bacaan guru dan siswa diambil langsung dari inti sari dokumen impor.
16. glosarium: Glosarium daftar istilah kunci beserta definisinya dari materi dokumen.
17. daftarPustaka: Referensi dan sumber rujukan bahan ajar.

${NO_DASHES_PROMPT}

KEMBALIKAN HANYA OBJEK JSON MURNI DENGAN STRUKTUR:
{
  "title": "Modul Ajar: ${safeTopic}",
  "topic": "${safeTopic}",
  "identitasModul": "string",
  "kompetensiAwal": "string",
  "profilPancasila": "string",
  "saranaPrasarana": "string",
  "targetPeserta": "string",
  "modelPembelajaran": "string",
  "tujuanPembelajaran": "string",
  "pemahamanBermakna": "string",
  "pertanyaanPemantik": "string",
  "persiapanPembelajaran": "string",
  "kegiatanPembelajaran": "string",
  "asesmen": "string",
  "pengayaanRemedial": "string",
  "lkpd": "string",
  "lembarKerja": "string",
  "glosarium": "string",
  "daftarPustaka": "string"
}
`;
        const response = await generateGeminiContent(ai, {
          model: "gemini-3.7-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json"
          }
        });
        const resultText = response.text || "{}";
        const rawData = safeParseGeminiJSON(resultText, null);
        if (rawData && rawData.tujuanPembelajaran) {
          const data = sanitizeGeneratedData(rawData);
          return res.json({
            success: true,
            data: {
              ...data,
              extractedContent: extractedText,
              isImported: true
            }
          });
        }
      } catch (genErr) {
        console.warn("[Modul Import AI] Gemini generation error, using fallback template:", genErr.message);
      }
    }
    const masterFallback = generateMasterV2ModulAjar({
      schoolName: appSettings?.schoolName || "Madrasah / Sekolah",
      teacherName: guruName || "Guru Mata Pelajaran",
      subjectName: safeSubject,
      grade: safeGrade,
      semester,
      babUtama: safeTopic,
      subbab: safeTopic,
      materiInti: extractedText ? `${safeTopic}

${extractedText.substring(0, 1500)}` : safeTopic,
      alokasiWaktu: "4 JP",
      modelPembelajaran: "Deep Learning"
    });
    res.json({
      success: true,
      data: {
        ...masterFallback,
        lembarKerja: extractedText ? `RINGKASAN BAHAN BACAAN DOKUMEN ACUAN:
${extractedText.substring(0, 3e3)}` : masterFallback.lembarKerja,
        extractedContent: extractedText,
        isImported: true,
        fallback: true
      }
    });
  } catch (error) {
    console.error("Modul import AI error:", error);
    res.status(500).json({ success: false, message: "Gagal memproses struktur modul: " + (error.message || "Unknown error") });
  }
});
app.post("/api/gemini/generate-modul2-general", async (req, res) => {
  try {
    const { subjectName, babs } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY tidak dikonfigurasi di server.");
    const ai = new import_genai.GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
    const prompt = `
Sebagai guru profesional, buatkan dokumen administrasi pembelajaran UMUM untuk mata pelajaran "${subjectName}" yang mencakup bab-bab berikut: ${babs.join(", ")}.

Output HARUS BERUPA STRING HTML (tanpa markdown blok seperti \`\`\`html).
Dokumen HTML ini harus menggunakan styling inline atau class Tailwind (contoh: class="border border-black p-2") agar rapi saat dicetak.
Susun persis menyerupai format resmi yang mencakup:

<div class="document-section">
<h2 class="text-center font-bold text-xl mb-4">ANALISIS ALOKASI WAKTU</h2>
(Buat tabel Perhitungan Minggu / Jam Efektif dan tabel Distribusi Alokasi Waktu yang mendistribusikan bab-bab di atas secara logis untuk 1 semester)
</div>

<div class="document-section mt-10">
<h2 class="text-center font-bold text-xl mb-4">SILABUS</h2>
(Buat tabel Silabus dengan kolom: Kompetensi Dasar/Elemen, Indikator, Materi Pokok (bab-bab di atas), Kegiatan Pembelajaran, Penilaian, Alokasi Waktu, Sumber Belajar)
</div>

<div class="document-section mt-10">
<h2 class="text-center font-bold text-xl mb-4">ALUR TUJUAN PEMBELAJARAN (ATP)</h2>
(Buat tabel ATP dengan kolom: Elemen, Capaian Pembelajaran, Tujuan Pembelajaran, Alur Tujuan Pembelajaran, Alokasi Waktu)
</div>

<div class="document-section mt-10">
<h2 class="text-center font-bold text-xl mb-4">KRITERIA KETUNTASAN TUJUAN PEMBELAJARAN (KKTP)</h2>
(Buat tabel KKTP dengan kolom: No, Tujuan Pembelajaran, Kriteria (Interval Nilai 1,2,3,4), Keterangan Intervensi)
</div>

Pastikan isinya detail dan sangat profesional, serta tabel-tabelnya memiliki border dan padding yang rapi (class="w-full border-collapse border border-slate-800 text-sm").
`;
    const response = await generateGeminiContent(ai, {
      model: "gemini-3.7-flash",
      contents: prompt
    });
    let html = response.text || "";
    html = html.replace(/\`\`\`html/g, "").replace(/\`\`\`/g, "");
    res.json({ success: true, html });
  } catch (error) {
    console.error("Generate Modul 2 General error (using fallback):", error);
    const { subjectName = "Mata Pelajaran", babs = ["Bab 1", "Bab 2"] } = req.body || {};
    const fallbackHtml = `
      <div class="p-6 font-sans">
        <h1 class="text-2xl font-bold text-center mb-6">DOKUMEN ADMINISTRASI PEMBELAJARAN: ${subjectName}</h1>
        <div class="mb-8">
          <h2 class="text-lg font-bold bg-slate-100 p-2 border">1. ANALISIS ALOKASI WAKTU</h2>
          <table class="w-full border-collapse border border-slate-800 text-sm mt-2">
            <thead><tr class="bg-slate-200"><th class="border border-slate-800 p-2">No</th><th class="border border-slate-800 p-2">Komponen / Bab</th><th class="border border-slate-800 p-2">Alokasi Waktu</th></tr></thead>
            <tbody>
              ${Array.isArray(babs) ? babs.map((b, i) => `<tr><td class="border border-slate-800 p-2 text-center">${i + 1}</td><td class="border border-slate-800 p-2">${b}</td><td class="border border-slate-800 p-2 text-center">4 JP</td></tr>`).join("") : ""}
            </tbody>
          </table>
        </div>
        <div class="mb-8">
          <h2 class="text-lg font-bold bg-slate-100 p-2 border">2. SILABUS & ATP</h2>
          <p class="p-2 text-sm text-slate-700">Silabus dan Alur Tujuan Pembelajaran mata pelajaran ${subjectName} dirancang untuk mencapai profil pelajar Pancasila dan rahmatan lil alamin.</p>
        </div>
      </div>
    `;
    res.json({ success: true, html: fallbackHtml, fallback: true });
  }
});
app.post("/api/gemini/generate-modul2-bab", async (req, res) => {
  try {
    const { subjectName, babTitle, grade = "X" } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY tidak dikonfigurasi di server.");
    const ai = new import_genai.GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
    const subjectRule = getSubjectTemplateInstructions(subjectName, babTitle);
    const prompt = `
Buatkan perangkat pembelajaran lengkap berstandar Kurikulum Merdeka / Nasional untuk mata pelajaran "${subjectName}", bab/materi/topik "${babTitle}", kelas/tingkat "${grade}".
Pembelajaran diintegrasikan dengan pengembangan karakter mulia, bernalar kritis, dan profil pelajar berakhlak terpuji.
${subjectRule}

PENTING: Dilarang menggunakan simbol markdown seperti bintang (*, **), pagar (#), atau backtick (\`) dalam teks keluaran. Gunakan penulisan huruf dan angka biasa yang rapi dan benar. Kembalikan respon strictly dalam format JSON objek dengan kunci-kunci berikut. Pastikan isinya sangat detail, berbobot, lengkap, siap pakai (bukan sekadar placeholder atau ringkasan):
{
  "modulAjar": {
    "identitasModul": "Nama Penyusun: Tim Guru 
Instansi: (Nama Sekolah)
Tahun: 2026
Kelas: ${grade}
Alokasi Waktu: 2 x 45 Menit",
    "kompetensiAwal": "Prasyarat kompetensi spesifik untuk materi ${babTitle}",
    "profilPancasila": "Karakter Profil Pelajar Pancasila yang relevan",
    "saranaPrasarana": "Sarana, prasarana, alat, bahan spesifik mapel",
    "targetPeserta": "Kategori dan target siswa (Reguler/Tipikal)",
    "modelPembelajaran": "Model pembelajaran spesifik (contoh: Inquiry / PBL / Dll)",
    "tujuanPembelajaran": "Tujuan Pembelajaran (TP) terukur sesuai KKO Bloom",
    "pemahamanBermakna": "Manfaat materi ${babTitle} secara konkret",
    "pertanyaanPemantik": "Pertanyaan pemantik yang relevan dan natural",
    "persiapanPembelajaran": "Langkah persiapan guru spesifik mapel",
    "kegiatanPembelajaran": "Skenario lengkap Pendahuluan, Kegiatan Inti, Penutup (MENGGUNAKAN AKTIVITAS KHAS MAPEL)",
    "asesmen": "Jenis dan instrumen asesmen yang sesuai karakteristik mapel",
    "pengayaanRemedial": "Tindakan pengayaan dan remedial yang sesuai",
    "lkpd": "Draf LKPD konkret yang sesuai (teks, soal, analisis, dll)",
    "lembarKerja": "Bahan bacaan lengkap",
    "glosarium": "Daftar istilah penting yang muncul di materi",
    "daftarPustaka": "Daftar Pustaka relevan"
  },
  "rppHtml": "HTML string lengkap berisi Rencana Pelaksanaan Pembelajaran (RPP) Kurikulum Merdeka bab ${babTitle} secara mendalam dengan tabel identitas, kompetensi dasar, skenario kegiatan pembelajaran, instrumen evaluasi, serta tanda tangan guru & kepala madrasah. Gunakan border-collapse dan styling inline yang rapi. Tanpa tanda bintang atau pagar.",
  "sklHtml": "HTML string lengkap berisi tabel ANALISIS KETERKAITAN SKL, KI, KD, IPK, MATERI, KEGIATAN, DAN PENILAIAN Kurikulum Merdeka untuk bab ${babTitle}. Tabel harus lebar w-full, ber-border-slate-800, ber-cellpadding, dan memuat analisis mendalam keterkaitan kompetensi dasar dengan nilai karakter mulia. Tanpa tanda bintang atau pagar."
}
`;
    const response = await generateGeminiContent(ai, {
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const resultText = response.text || "{}";
    const data = safeParseGeminiJSON(resultText, null);
    if (!data) throw new Error("Invalid JSON from Gemini response: " + resultText);
    res.json({ success: true, data });
  } catch (error) {
    console.error("Generate Modul 2 Bab error:", error);
    const { subjectName, babTitle, grade = "X" } = req.body || {};
    const fallbackModul = {
      identitasModul: `Penyusun: Tim Guru
Kelas: ${grade}
Alokasi Waktu: 2 x 45 Menit`,
      kompetensiAwal: `Siswa telah memahami konsep dasar materi prasyarat yang berkaitan dengan bab ${babTitle || "ini"}.`,
      profilPancasila: `Berkebinekaan Global, Bergotong Royong, Mandiri, Bernalar Kritis, Kreatif.`,
      saranaPrasarana: `Papan tulis, spidol, proyektor LCD, buku referensi.`,
      targetPeserta: `Peserta didik reguler / tipikal kelas ${grade}.`,
      modelPembelajaran: `Problem Based Learning (PBL) atau model yang sesuai dengan karakteristik materi.`,
      tujuanPembelajaran: `1. Memahami secara mendalam konsep ${babTitle || "materi"}.`,
      pemahamanBermakna: `Mempelajari ${babTitle || "materi ini"} menumbuhkan pemahaman logis dan aplikatif.`,
      pertanyaanPemantik: `Mengapa penting bagi kita untuk menyikapi topik ${babTitle || "ini"}?`,
      persiapanPembelajaran: `Guru menyiapkan rencana ajar, bahan materi, dan LKPD.`,
      kegiatanPembelajaran: `Pendahuluan: Salam dan apersepsi.
Inti: Investigasi kelompok terstruktur.
Penutup: Apresiasi, simpulan, dan doa.`,
      asesmen: `Asesmen formatif dan sumatif tertulis.`,
      pengayaanRemedial: `Pendampingan khusus bagi siswa yang membutuhkan remedial, dan proyek mandiri bagi siswa pengayaan.`,
      lkpd: `Lembark Kerja Siswa: Menganalisis studi kasus nyata bertema ${babTitle || "pembelajaran"} secara kolaboratif.`,
      lembarKerja: `Rubrik penilaian dan kuis pemahaman konsep.`,
      glosarium: `Istilah kunci terkait ${babTitle || "pembelajaran"} beserta definisinya.`,
      daftarPustaka: `Buku referensi yang relevan dengan mata pelajaran.`
    };
    const fallbackRpp = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="text-align: center; margin-bottom: 5px;">RENCANA PELAKSANAAN PEMBELAJARAN (RPP)</h2>
        <p style="text-align: center; font-size: 14px; margin-top: 0; color: #555;">Kurikulum Merdeka</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px;">
          <tr><td style="border: 1px solid #ccc; padding: 8px; font-weight: bold; width: 30%;">Mata Pelajaran</td><td style="border: 1px solid #ccc; padding: 8px;">${subjectName || "Mata Pelajaran"}</td></tr>
          <tr><td style="border: 1px solid #ccc; padding: 8px; font-weight: bold;">Materi/Bab</td><td style="border: 1px solid #ccc; padding: 8px;">${babTitle || "Bab Pembelajaran"}</td></tr>
          <tr><td style="border: 1px solid #ccc; padding: 8px; font-weight: bold;">Kelas/Semester</td><td style="border: 1px solid #ccc; padding: 8px;">Grade ${grade} / Ganjil</td></tr>
          <tr><td style="border: 1px solid #ccc; padding: 8px; font-weight: bold;">Alokasi Waktu</td><td style="border: 1px solid #ccc; padding: 8px;">2 JP (2 x 45 Menit)</td></tr>
        </table>
        
        <h3 style="border-bottom: 2px solid #059669; padding-bottom: 5px;">I. TUJUAN PEMBELAJARAN (Berbasis Aspek Kognitif, Afektif, & Psikomotor)</h3>
        <p>1. Peserta didik mampu menjelaskan dan menganalisis materi ${babTitle || "pembelajaran"} dengan kritis dan mendalam.<br>
        2. Peserta didik menunjukkan karakter profil pelajar Pancasila yang relevan dalam interaksi sosial-emosional.</p>
        
        <h3 style="border-bottom: 2px solid #059669; padding-bottom: 5px;">II. SKENARIO KEGIATAN PEMBELAJARAN (Kegiatan Pembelajaran)</h3>
        <p><strong>A. Pendahuluan (15 Menit):</strong><br>
        1. Guru membuka kelas dengan salam hangat, dan menanyakan kesiapan belajar siswa hari ini.<br>
        2. Doa bersama dengan penuh khidmat dipimpin salah satu peserta didik sebagai bentuk syukur kepada Tuhan YME.<br>
        3. Apersepsi bermakna mengaitkan materi ${babTitle || "pembelajaran"} dengan pengalaman nyata peserta didik.</p>
        
        <p><strong>B. Kegiatan Inti (60 Menit):</strong><br>
        1. Peserta didik dibagi ke dalam beberapa kelompok kecil yang heterogen sesuai dengan gaya belajar dan karakteristik.<br>
        2. Guru memberikan stimulasi bermakna berupa studi kasus/masalah terkait ${babTitle || "pembelajaran"}.<br>
        3. Setiap kelompok berkolaborasi memecahkan masalah dengan berdiskusi dan bernalar kritis.<br>
        4. Presentasi hasil diskusi kelompok di mana kelompok lain memberikan tanggapan konstruktif.</p>
        
        <p><strong>C. Penutup (15 Menit):</strong><br>
        1. Guru bersama peserta didik merumuskan refleksi emosi dan simpulan dari pembelajaran hari ini.<br>
        2. Guru memberikan apresiasi verbal/non-verbal atas pencapaian peserta didik.<br>
        3. Doa penutup dan salam penutup.</p>
        
        <h3 style="border-bottom: 2px solid #059669; padding-bottom: 5px;">III. PENILAIAN PEMBELAJARAN (Asesmen Pembelajaran)</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Aspek</th>
              <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Teknik Penilaian</th>
              <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Instrumen</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="border: 1px solid #ccc; padding: 8px; font-weight: bold;">Sikap/Karakter</td><td style="border: 1px solid #ccc; padding: 8px;">Observasi / Jurnal Karakter</td><td style="border: 1px solid #ccc; padding: 8px;">Lembar pengamatan kepedulian dan kerja sama</td></tr>
            <tr><td style="border: 1px solid #ccc; padding: 8px; font-weight: bold;">Pengetahuan</td><td style="border: 1px solid #ccc; padding: 8px;">Tes Tertulis / Lisan</td><td style="border: 1px solid #ccc; padding: 8px;">Kuis pemahaman konsep berbasis nalar kritis</td></tr>
            <tr><td style="border: 1px solid #ccc; padding: 8px; font-weight: bold;">Keterampilan</td><td style="border: 1px solid #ccc; padding: 8px;">Unjuk Kerja / Proyek Kolaboratif</td><td style="border: 1px solid #ccc; padding: 8px;">Rubrik presentasi kelompok & komunikasi yang baik</td></tr>
          </tbody>
        </table>

        <div style="margin-top: 50px; display: flex; justify-content: space-between;">
          <div style="text-align: center; width: 40%;">
            <p>Mengetahui,<br>Kepala Sekolah</p>
            <br><br><br>
            <p>_______________________<br>NIP. .........................</p>
          </div>
          <div style="text-align: center; width: 40%;">
            <p>Malang, .................... 2026<br>Guru Mata Pelajaran</p>
            <br><br><br>
            <p>_______________________<br>NIP. .........................</p>
          </div>
        </div>
      </div>
    `;
    const fallbackSkl = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="text-align: center; margin-bottom: 5px;">ANALISIS KETERKAITAN SKL, KI, KD, IPK, MATERI, DAN PENILAIAN</h2>
        <p style="text-align: center; font-size: 14px; margin-top: 0; color: #555;">Kurikulum Merdeka</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="border: 1px solid #333; padding: 6px; text-align: center;">SKL (Standar Kompetensi Lulusan)</th>
              <th style="border: 1px solid #333; padding: 6px; text-align: center;">Kompetensi Inti (KI) / Elemen</th>
              <th style="border: 1px solid #333; padding: 6px; text-align: center;">Kompetensi Dasar (KD) / Tujuan</th>
              <th style="border: 1px solid #333; padding: 6px; text-align: center;">Indikator Pencapaian Kompetensi (IPK)</th>
              <th style="border: 1px solid #333; padding: 6px; text-align: center;">Materi Pokok</th>
              <th style="border: 1px solid #333; padding: 6px; text-align: center;">Kegiatan Pembelajaran</th>
              <th style="border: 1px solid #333; padding: 6px; text-align: center;">Rencana Penilaian</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #333; padding: 6px;">Mendemonstrasikan pemahaman konsep, nalar kritis, berkebinekaan global, dan mandiri.</td>
              <td style="border: 1px solid #333; padding: 6px;">KI-1 & KI-2 (Sikap Spiritual & Sosial)<br>KI-3 (Pengetahuan)</td>
              <td style="border: 1px solid #333; padding: 6px;">Menganalisis prinsip-prinsip ${babTitle || "pembelajaran"} secara teoritis dan mengaitkannya dengan nilai-nilai luhur dan Profil Pelajar Pancasila.</td>
              <td style="border: 1px solid #333; padding: 6px;">1. Menjelaskan konsep dasar ${babTitle || "materi"}.<br>2. Menemukan implikasi akhlak mulia dari penerapan materi.</td>
              <td style="border: 1px solid #333; padding: 6px;"><strong>${babTitle || "Materi Inti"}</strong><br>- Kajian Tekstual & Kontekstual<br>- Dimensi Sosial & Spiritual PPP</td>
              <td style="border: 1px solid #333; padding: 6px;">Siswa aktif mengeksplorasi masalah nyata dalam diskusi kelompok dengan dialog interaktif berlandaskan bernalar kritis dan kolaboratif.</td>
              <td style="border: 1px solid #333; padding: 6px;">- Penilaian Sikap/Karakter (Observasi)<br>- Tes Tulis Pemahaman Konsep<br>- Portofolio Kerja Kelompok</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    res.json({
      success: true,
      data: {
        modulAjar: fallbackModul,
        rppHtml: fallbackRpp,
        sklHtml: fallbackSkl
      },
      fallback: true
    });
  }
});
app.post("/api/gemini/generate-ppt", async (req, res) => {
  try {
    const { subjectName, topic, materiDetail, grade = "X", slideCount = 8, theme = "midnight" } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY tidak dikonfigurasi di server.");
    }
    const ai = new import_genai.GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
    const prompt = `
Sebagai pengembang media pembelajaran digital interaktif berbasis AI, buatkan draf slide presentasi PPT murni berisi materi inti secara lengkap dan mendalam.
Mata Pelajaran: "${subjectName}"
Topik/Materi Utama: "${topic}"
Kelas/Tingkat: "${grade}"
Jumlah Slide Target: ${slideCount || 8} slide

ATURAN STRICT:
1. HILANGKAN slide identitas guru, slide judul cover, slide tujuan pembelajaran, slide apersepsi, atau slide penutup terima kasih yang tidak perlu.
2. Semua slide target (${slideCount}) harus berisi KONTEN MATERI INTI murni dan bermakna. Setiap slide harus berbobot dan fokus sepenuhnya ke sub-bab materi.
3. Dilarang menggunakan simbol markdown seperti bintang (*, **) atau pagar (#) dalam teks isi slide. Gunakan kalimat ringkas, komunikatif, bernalar kritis, serta interaktif.

Kembalikan respon STRICTLY sebagai JSON objek dengan format berikut:
{
  "title": "Judul Utama PPT Materi",
  "subtitle": "Mata Pelajaran ${subjectName} Kelas ${grade}",
  "theme": "${theme}",
  "slides": [
    {
      "slideNumber": 1,
      "type": "content",
      "badge": "Sub-Bab 1",
      "title": "Nama Sub-Bab Pertama",
      "subtitle": "Pengenalan Konsep Pertama",
      "points": [
        "Poin penjelasan materi inti kesatu yang mendalam",
        "Poin penjelasan materi inti kedua dengan kalimat lugas",
        "Poin penjelasan materi inti ketiga secara terstruktur"
      ],
      "keyTakeaway": "Pesan kunci / kesimpulan ringkas dari sub-bab ini.",
      "teacherNote": "Petunjuk penyampaian bagi guru saat menjelaskan slide ini.",
      "interactiveQuestion": "Pertanyaan interaktif bernalar kritis terkait sub-bab ini untuk memancing keaktifan peserta didik."
    }
  ]
}
Catatan: Buatkan total ${slideCount || 8} slide bertahap semuanya fokus mengupas materi inti dari "${topic}".
${NO_DASHES_PROMPT}
`;
    const response = await generateGeminiContent(ai, {
      model: "gemini-3.7-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const resultText = response.text || "{}";
    const rawData = safeParseGeminiJSON(resultText, null);
    if (!rawData) throw new Error("Invalid JSON from Gemini response: " + resultText);
    const data = sanitizeGeneratedData(rawData);
    res.json({ success: true, data });
  } catch (error) {
    console.error("Generate PPT error (using fallback):", error);
    const { subjectName, topic, materiDetail, grade = "X" } = req.body || {};
    const fallbackData = {
      title: `Materi Inti: ${topic || "Materi Pembelajaran"}`,
      subtitle: `${subjectName || "Mata Pelajaran"} - Kelas ${grade}`,
      theme: req.body?.theme || "midnight",
      slides: [
        {
          slideNumber: 1,
          type: "content",
          badge: "Sub-Bab 1: Konsep Dasar",
          title: `Konsep Utama ${topic}`,
          subtitle: "Pengantar dan Pemahaman Dasar",
          points: [
            "Memahami pilar-pilar penting materi secara sistematis",
            "Menganalisis definisi fungsional dan contoh nyatanya",
            "Menghubungkan konsep dasar dengan kebutuhan praktis"
          ],
          keyTakeaway: "Konsep utama merupakan pondasi terpenting untuk pemahaman materi lanjutan.",
          teacherNote: "Jelaskan definisi utama secara perlahan dan pastikan siswa mencatat kata-kata kunci.",
          interactiveQuestion: "Bagaimana kalian mendefinisikan materi ini dengan bahasa kalian sendiri?"
        },
        {
          slideNumber: 2,
          type: "content",
          badge: "Sub-Bab 2: Analisa Detail",
          title: "Uraian dan Komponen Inti",
          subtitle: "Struktur dan Mekanisme Kerja",
          points: [
            materiDetail ? materiDetail.substring(0, 150) : `Bagian-bagian penting yang menyusun materi ${topic}`,
            "Masing-masing komponen memiliki fungsi krusial yang saling terintegrasi",
            "Analisis mendalam mengenai alur kerja dan interaksi sistem"
          ],
          keyTakeaway: "Setiap komponen memiliki peranan yang tak terpisahkan dalam keberlangsungan sistem.",
          teacherNote: "Bimbing peserta didik mengidentifikasi korelasi antar-komponen.",
          interactiveQuestion: "Menurut kalian, apa yang terjadi bila salah satu komponen ini tidak berfungsi?"
        }
      ]
    };
    res.json({ success: true, data: fallbackData, fallback: true });
  }
});
app.post("/api/gemini/generate-poster", async (req, res) => {
  try {
    const { subjectName, topic, grade = "X", theme = "modern", notes = "" } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY tidak dikonfigurasi di server.");
    }
    const ai = new import_genai.GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
    let prompt = `
Sebagai ahli visualisasi materi dan media pembelajaran (infografis/poster), buatkan rancangan data visual poster interaktif edukasi berbobot tinggi untuk:
Mata Pelajaran: "${subjectName}"
Materi Utama: "${topic}"
Kelas/Tingkat: "${grade}"
`;
    if (notes) {
      prompt += `
Catatan Khusus & Prompt Tambahan dari Guru (PENTING: ikuti instruksi spesifik ini dalam menyusun struktur poster dan diagram):
"${notes}"
`;
    }
    prompt += `
Poster ini akan ditampilkan secara interaktif di layar. Poster harus memiliki:
1. Visual Labeled Hotspots: Bagian-bagian gambar/diagram ilustrasi yang dapat diklik untuk menampilkan penjelasan interaktif (misal membahas CPU, ada hotspot untuk ALU, CU, Registers, Cache; atau membahas Shalat, ada Takbir, Ruku, Sujud; atau membahas Sel, ada Nukleus, Mitokondria, Ribosom). Buatkan minimal 3 dan maksimal 5 hotspots dengan koordinat x dan y (dalam persen, 10 hingga 90).
2. Core Pillars: 3 sampai 4 poin materi inti terpenting yang dipajang dalam grid poster.
3. Fun Facts / Quick Notes: Info menarik singkat terkait materi.

Kembalikan respon STRICTLY sebagai JSON objek dengan format berikut:
{
  "title": "Judul Poster Menarik",
  "subtitle": "Infografis Pembelajaran Terintegrasi - ${subjectName} Kelas ${grade}",
  "theme": "${theme}",
  "illustrationTitle": "Judul Bagian Ilustrasi/Diagram Tengah",
  "illustrationDescription": "Panduan visual interaktif. Silakan klik bagian berlabel untuk mengupas materi detail.",
  "hotspots": [
    {
      "id": "hotspot-1",
      "label": "Singkatan/Label Pendek (maks 15 karakter)",
      "name": "Nama Lengkap Bagian/Komponen",
      "x": 25,
      "y": 40,
      "description": "Penjelasan singkat fungsi utama komponen ini (1-2 kalimat).",
      "details": "Detail teknis tambahan yang mendalam untuk dibaca siswa saat hotspot diklik."
    }
  ],
  "corePillars": [
    {
      "title": "Pilar Materi 1",
      "desc": "Ringkasan penjelasan berbobot tinggi mengenai pilar materi pertama.",
      "icon": "fa-solid fa-cube"
    }
  ],
  "funFacts": [
    "Fakta unik menarik kesatu terkait materi.",
    "Fakta unik menarik kedua terkait materi."
  ],
  "summary": "Pernyataan rangkuman pamungkas poster yang memotivasi siswa untuk mendalami materi."
}
Pastikan koordinat x dan y bervariasi agar tidak bertumpuk di satu tempat.
${NO_DASHES_PROMPT}
`;
    const response = await generateGeminiContent(ai, {
      model: "gemini-3.7-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const resultText = response.text || "{}";
    const rawData = safeParseGeminiJSON(resultText, null);
    if (!rawData) throw new Error("Invalid JSON from Gemini poster response: " + resultText);
    const data = sanitizeGeneratedData(rawData);
    let imageUrl = "";
    try {
      console.log(`[Gemini API] Attempting image generation for poster with prompt: ${topic}`);
      const imgRes = await ai.models.generateImages({
        model: "imagen-3.0-generate-002",
        prompt: `A highly detailed, beautiful professional textbook vector illustration about "${topic}" for "${subjectName}" class. Clean educational poster style, diagrammatic explanation, sharp details, vibrant colors, school context, high quality, 4:3 aspect ratio.${notes ? ` Focus focus on: ${notes}` : ""}`,
        config: {
          numberOfImages: 1,
          outputMimeType: "image/jpeg",
          aspectRatio: "4:3"
        }
      });
      if (imgRes && imgRes.generatedImages && imgRes.generatedImages[0]) {
        const bytes = imgRes.generatedImages[0].image?.imageBytes;
        if (bytes) {
          imageUrl = `data:image/jpeg;base64,${bytes}`;
          console.log(`[Gemini API] Image generated successfully using imagen-3.0-generate-002!`);
        }
      }
    } catch (imgErr) {
      console.error("Failed to generate image with imagen-3.0-generate-002", imgErr);
      const lowerSubject = (subjectName || "").toLowerCase();
      const lowerTopic = (topic || "").toLowerCase();
      if (lowerSubject.includes("math") || lowerSubject.includes("matematika") || lowerTopic.includes("aljabar") || lowerTopic.includes("hitung")) {
        imageUrl = "https://images.unsplash.com/photo-1509228468518-180dd4864904?q=80&w=800&auto=format&fit=crop";
      } else if (lowerSubject.includes("ipa") || lowerSubject.includes("science") || lowerSubject.includes("biologi") || lowerSubject.includes("kimia") || lowerSubject.includes("fisika") || lowerTopic.includes("sel") || lowerTopic.includes("organ tubuh")) {
        imageUrl = "https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=800&auto=format&fit=crop";
      } else if (lowerSubject.includes("komputer") || lowerSubject.includes("informatika") || lowerSubject.includes("coding") || lowerTopic.includes("program") || lowerTopic.includes("software")) {
        imageUrl = "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=800&auto=format&fit=crop";
      } else if (lowerSubject.includes("sejarah") || lowerSubject.includes("history") || lowerSubject.includes("sosial") || lowerSubject.includes("ips") || lowerTopic.includes("budaya")) {
        imageUrl = "https://images.unsplash.com/photo-1461360370896-922624d12aa1?q=80&w=800&auto=format&fit=crop";
      } else if (lowerSubject.includes("bahasa") || lowerSubject.includes("language") || lowerSubject.includes("inggris") || lowerSubject.includes("indonesia")) {
        imageUrl = "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?q=80&w=800&auto=format&fit=crop";
      } else {
        imageUrl = "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=800&auto=format&fit=crop";
      }
    }
    if (!data.imageUrl && imageUrl) {
      data.imageUrl = imageUrl;
    }
    res.json({ success: true, data });
  } catch (error) {
    console.error("Generate Poster error (using fallback):", error);
    const { subjectName, topic, grade = "X" } = req.body || {};
    const fallbackData = {
      title: `Visualisasi Interaktif: ${topic || "Materi"}`,
      subtitle: `Infografis Pembelajaran Terintegrasi - ${subjectName || "Informatika"} Kelas ${grade}`,
      theme: req.body?.theme || "modern",
      illustrationTitle: `Diagram Analisis ${topic || "Sistem"}`,
      illustrationDescription: "Klik label pada diagram interaktif di bawah untuk mengupas rahasia materi.",
      hotspots: [
        {
          id: "hotspot-1",
          label: "Input Unit",
          name: "Sistem Masukan (Input Unit)",
          x: 20,
          y: 40,
          description: "Menerima instruksi data mentah dari luar untuk diproses oleh sistem.",
          details: "Berfungsi menyerap stimuli eksternal dan menerjemahkannya ke dalam bentuk sandi digital yang dimengerti mesin."
        },
        {
          id: "hotspot-2",
          label: "Processing Unit",
          name: "Sistem Pemrosesan Inti",
          x: 50,
          y: 35,
          description: "Otak utama yang melakukan manipulasi, kalkulasi, dan pengolahan data.",
          details: "Mengendalikan seluruh operasi logika, memetakan keputusan, serta mengatur koordinasi jalannya instruksi."
        },
        {
          id: "hotspot-3",
          label: "Output Unit",
          name: "Sistem Keluaran (Output Unit)",
          x: 80,
          y: 40,
          description: "Menampilkan hasil pemrosesan informasi dalam format yang dipahami manusia.",
          details: "Mentransmisikan sandi internal menjadi visual, suara, atau tindakan nyata yang membawa manfaat langsung bagi pengguna."
        }
      ],
      corePillars: [
        {
          title: "Fondasi Konseptual",
          desc: "Memahami struktur hulu ke hilir yang membentuk keutuhan materi secara logis dan runtut.",
          icon: "fa-solid fa-compass"
        },
        {
          title: "Mekanisme Operasional",
          desc: "Setiap elemen bertindak aktif menyokong fungsionalitas sistem demi tercapainya efisiensi tinggi.",
          icon: "fa-solid fa-gears"
        },
        {
          title: "Implementasi Nyata",
          desc: "Menghubungkan teori ke dalam contoh kasus kehidupan sehari-hari demi membangun nalar kritis peserta didik.",
          icon: "fa-solid fa-lightbulb"
        }
      ],
      funFacts: [
        "Seluruh kesuksesan pemahaman konsep visual bergantung pada kemauan bereksperimen.",
        "Satu gambar diagram interaktif terbukti mampu menaikkan retensi memori siswa hingga 60%."
      ],
      summary: "Menguasai struktur visual membantu kita memetakan masa depan teknologi dengan bimbingan akhlak dan ilmu yang berkah."
    };
    res.json({ success: true, data: fallbackData });
  }
});
app.post("/api/gemini/generate-kbc-document", async (req, res) => {
  try {
    const { docType, subjectName, babs = [], babIndex, babTitle, grade = "X", guruName, guruNip, kepsekName, kepsekNip } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY tidak dikonfigurasi di server.");
    const ai = new import_genai.GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
    let prompt = "";
    const babsList = babs.join(", ");
    switch (docType) {
      case "alokasi_waktu":
        prompt = `
Buatkan dokumen "ANALISIS ALOKASI WAKTU" berstandar Kurikulum Merdeka untuk mata pelajaran "${subjectName}", kelas/tingkat "${grade}".
Dokumen ini harus menghitung secara logis alokasi jam pelajaran (JP) efektif untuk semester ganjil dan genap, serta mendistribusikan materi bab berikut secara seimbang: ${babsList}.
Isi dokumen harus dalam format HTML terstruktur rapi. Gunakan tabel-tabel profesional dengan border tipis (border-collapse, border: 1px solid #333, padding: 8px) dan pastikan ada tempat tanda tangan Mengetahui Kepala Sekolah dan Guru Mata Pelajaran di bagian bawah.
Kurikulum Merdeka menekankan penyusunan jadwal yang efisien dan berpusat pada peserta didik.
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Kembalikan respon strictly dalam format HTML mentah (tanpa markdown blok seperti \`\`\`html atau \`\`\`).
`;
        break;
      case "ki_kd":
        prompt = `
Buatkan dokumen "ANALISIS KI-KD (Karakter Kurikulum Berbasis Cinta)" Sekolah Menengah untuk mata pelajaran "${subjectName}", kelas/tingkat "${grade}", mencakup materi bab: ${babsList}.
Analisis keterkaitan Kompetensi Inti (KI-1 Sikap Spiritual, KI-2 Sikap Sosial, KI-3 Pengetahuan, KI-4 Keterampilan) dengan Kompetensi Dasar (KD) masing-masing bab, lalu kaitkan dengan nilai-nilai Profil Pelajar Pancasila.
Format dokumen berupa tabel HTML komprehensif, rapi, lebar 100%, ber-border (border-collapse, padding: 8px), lengkap dengan kolom: No, Kompetensi Inti (KI), Kompetensi Dasar (KD), Indikator Pencapaian Kompetensi (IPK), dan Integrasi Karakter/PPP. Sertakan tanda tangan di bagian bawah.
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Kembalikan respon strictly dalam format HTML mentah (tanpa markdown blok seperti \`\`\`html atau \`\`\`).
`;
        break;
      case "rpp":
        prompt = `
Buatkan "RPP (Rencana Pelaksanaan Pembelajaran)" berstandar Kurikulum Merdeka untuk mata pelajaran "${subjectName}", kelas/tingkat "${grade}", Bab ${Number(babIndex) + 1}: "${babTitle}".
Dokumen RPP ini harus sama persis dengan format administrasi guru resmi, mencakup:
1. Identitas RPP (Mata Pelajaran, Kelas, Semester, Bab, Materi, Alokasi Waktu).
2. Tujuan Pembelajaran (mencakup aspek Kognitif & Afektif/PPP).
3. Langkah-Langkah Kegiatan Pembelajaran (Pendahuluan dengan apersepsi, Kegiatan Inti yang sesuai karakteristik mapel, dan Penutup dengan apresiasi, refleksi, & doa).
4. Penilaian Pembelajaran (Sikap/Karakter, Pengetahuan, Keterampilan).
Format dokumen harus berupa HTML yang sangat rapi, terstruktur, menggunakan tabel-tabel ber-border, serta tempat tanda tangan guru & kepala madrasah di bagian bawah.
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Kembalikan respon strictly dalam format HTML mentah (tanpa markdown blok seperti \`\`\`html atau \`\`\`).
`;
        break;
      case "silabus":
        prompt = `
Buatkan dokumen "SILABUS PEMBELAJARAN" Sekolah Menengah untuk mata pelajaran "${subjectName}", kelas/tingkat "${grade}".
Silabus harus memetakan seluruh bab berikut secara berurutan: ${babsList}.
Untuk setiap bab, jabarkan dalam tabel HTML besar yang rapi dengan kolom: Elemen/Kompetensi Dasar, Indikator, Materi Pokok, Kegiatan Pembelajaran (yang diintegrasikan dengan pembelajaran aktif dan inovatif), Penilaian (formatif, sumatif, afektif), Alokasi Waktu, dan Sumber Belajar.
Pastikan tabelnya lebar w-full, border-collapse, ber-border 1px solid #333, padding 8px, dan sertakan tempat tanda tangan di bagian bawah.
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Kembalikan respon strictly dalam format HTML mentah (tanpa markdown blok seperti \`\`\`html atau \`\`\`).
`;
        break;
      case "atp":
        prompt = `
Buatkan dokumen "ALUR TUJUAN PEMBELAJARAN (ATP)" berstandar Kurikulum Merdeka untuk mata pelajaran "${subjectName}", kelas/tingkat "${grade}".
ATP ini harus memetakan alur pembelajaran secara kronologis untuk materi bab berikut: ${babsList}.
Format berupa tabel HTML profesional dengan kolom: No, Elemen, Capaian Pembelajaran (CP), Tujuan Pembelajaran (TP), Alur Tujuan Pembelajaran (ATP), dan Alokasi Waktu (JP).
Setiap tujuan harus dirumuskan secara operasional dan mengintegrasikan kecakapan sosial-emosional Profil Pelajar Pancasila. Sertakan tanda tangan di bawah.
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Kembalikan respon strictly dalam format HTML mentah (tanpa markdown blok seperti \`\`\`html atau \`\`\`).
`;
        break;
      case "cp":
        prompt = `
Buatkan dokumen "CAPAIAN PEMBELAJARAN (CP)" berstandar Kurikulum Merdeka untuk mata pelajaran "${subjectName}", kelas/tingkat "${grade}", mengacu pada bab-bab: ${babsList}.
Tuliskan Rasionalitas Mata Pelajaran, Tujuan Mata Pelajaran, Karakteristik Mata Pelajaran, dan tabel Capaian Pembelajaran per Elemen yang disesuaikan dengan nilai-nilai Profil Pelajar Pancasila.
Format berupa dokumen HTML yang rapi dengan heading, list, dan tabel ber-border, lengkap dengan tempat tanda tangan di bagian bawah.
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Kembalikan respon strictly dalam format HTML mentah (tanpa markdown blok seperti \`\`\`html atau \`\`\`).
`;
        break;
      case "kktp":
        prompt = `
Buatkan dokumen "KRITERIA KETUNTASAN TUJUAN PEMBELAJARAN (KKTP)" berstandar Kurikulum Merdeka untuk mata pelajaran "${subjectName}", kelas/tingkat "${grade}".
Tentukan kriteria ketuntasan dari tujuan pembelajaran setiap bab berikut: ${babsList}.
Buat dalam tabel HTML yang sangat detail dengan kolom: No, Bab / Tujuan Pembelajaran, Kriteria Ketuntasan (dengan Interval Nilai: 0-60% Baru Berkembang, 61-80% Layak, 81-90% Cakap, 91-100% Mahir), dan Tindak Lanjut / Intervensi (bagaimana guru membimbing siswa pada rentang nilai tersebut). Sertakan tanda tangan di bawah.
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Kembalikan respon strictly dalam format HTML mentah (tanpa markdown blok seperti \`\`\`html atau \`\`\`).
`;
        break;
      case "modul_ajar":
        prompt = `
Buatkan "MODUL AJAR LENGKAP" berstandar Kurikulum Merdeka untuk mata pelajaran "${subjectName}", kelas/tingkat "${grade}", Bab ${Number(babIndex) + 1}: "${babTitle}".
Dokumen HARUS SANGAT PANJANG, RINCI, DAN MENYELURUH (komprehensif) menyerupai dokumen asli yang tebalnya mencapai 17 halaman. Jangan membuat dokumen yang singkat atau poin-poin yang dipotong. Uraikan setiap sub-bab materi, penjelasan kegiatan guru dan siswa, serta rubrik penilaian dengan kalimat yang lengkap dan deskripsi yang detail!

Sistematika Modul Ajar harus sama persis dengan standar Kurikulum Merdeka berikut, ditulis dalam HTML berkelas:

A. INFORMASI UMUM
1. Identitas Modul (Nama Penyusun, Institusi, Tahun Penyusunan, Jenjang Sekolah, Kelas, Alokasi Waktu)
2. Kompetensi Awal
3. Profil Pelajar Pancasila dan Pelajar Rahmatan Lil Alamin (berfokus pada pilar kasih sayang, kelembutan, dan empati)
4. Sarana dan Prasarana
5. Target Peserta Didik
6. Model Pembelajaran

B. KOMPONEN INTI
1. Tujuan Pembelajaran (Kognitif, Afektif, Psikomotorik) beserta penjabaran detail
2. Pemahaman Bermakna (Uraian naratif yang menginspirasi)
3. Pertanyaan Pemantik
4. Kegiatan Pembelajaran (Buat skenario yang sangat rinci, memuat skrip/dialog contoh, estimasi waktu, serta langkah konkret yang mencerminkan cinta kasih dalam pendidikan):
   - Kegiatan Pendahuluan (Penuh kehangatan dan motivasi)
   - Kegiatan Inti (Eksplorasi, Elaborasi, Konfirmasi dengan narasi panjang lebar)
   - Kegiatan Penutup (Refleksi mendalam dan apresiasi)
5. Asesmen (Sertakan instrumen dan rubrik penilaian yang sangat detail untuk Sikap, Pengetahuan, dan Keterampilan. Jangan gunakan tabel sederhana, gunakan rubrik dengan deskriptor lengkap 4 skala)
6. Pengayaan dan Remedial (Uraikan programnya secara konkrit)
7. Refleksi Peserta Didik dan Guru (Daftar pertanyaan reflektif yang panjang dan mendalam)

C. LAMPIRAN
1. Lembar Kerja Peserta Didik (LKPD) yang lengkap dengan studi kasus/soal-soal
2. Bahan Bacaan Guru dan Peserta Didik (Sertakan MATERI PEMBAHASAN YANG PANJANG, RINCI, DAN MENYELURUH sesuai bab "${babTitle}")
3. Glosarium (Daftar istilah lengkap)
4. Daftar Pustaka

Format harus berupa dokumen HTML yang sangat indah, menggunakan semantic tags, pembatas garis yang elegan, tabel rubrik asesmen, paragraf teks materi yang sangat terperinci dan ekstensif, serta tempat tanda tangan di bagian paling bawah. JANGAN PERNAH menyajikan informasi hanya dengan satu-dua kalimat pendek. Eksplorasi setiap poin semaksimal mungkin!
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Kembalikan respon strictly dalam format HTML mentah (tanpa markdown blok seperti \`\`\`html atau \`\`\`).
`;
        break;
      case "prosem":
        prompt = `
Buatkan dokumen "PROGRAM SEMESTER (PROSEM)" berstandar Kurikulum Merdeka untuk mata pelajaran "${subjectName}", kelas/tingkat "${grade}".
Petakan distribusi alokasi jam pelajaran (JP) per minggu untuk semester berjalan, mengalokasikan materi bab berikut secara logis: ${babsList}.
Format berupa tabel HTML horizontal besar dengan kolom: No, Materi Pokok / Bab, Jml JP, Juli (Minggu 1-4), Agustus (Minggu 1-4), September (Minggu 1-4), Oktober (Minggu 1-4), November (Minggu 1-4), Desember (Minggu 1-4), lengkap dengan tanda centang/angka distribusi JP di setiap sel minggunya. Tambahkan tempat tanda tangan di bawah.
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Kembalikan respon strictly dalam format HTML mentah (tanpa markdown blok seperti \`\`\`html atau \`\`\`).
`;
        break;
      case "prota":
        prompt = `
Buatkan dokumen "PROGRAM TAHUNAN (PROTA)" berstandar Kurikulum Merdeka untuk mata pelajaran "${subjectName}", kelas/tingkat "${grade}".
Petakan pembagian alokasi waktu tahunan (Semester 1 & Semester 2) untuk bab-bab berikut: ${babsList}.
Format berupa tabel HTML resmi dengan kolom: No, Semester, Kompetensi Dasar / Bab Pokok, Alokasi Waktu (JP), Keterangan. Pastikan isinya berbobot dan terdistribusi logis dengan total akumulasi JP tahunan yang rasional. Tambahkan tanda tangan di bawah.
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Kembalikan respon strictly dalam format HTML mentah (tanpa markdown blok seperti \`\`\`html atau \`\`\`).
`;
        break;
      case "tp":
        prompt = `
Buatkan dokumen "TUJUAN PEMBELAJARAN (TP)" berstandar Kurikulum Merdeka untuk mata pelajaran "${subjectName}", kelas/tingkat "${grade}".
Rumuskan secara detail Tujuan Pembelajaran (TP) kognitif, psikomotorik, dan afektif berbasis empati serta karakter mulia untuk setiap bab berikut: ${babsList}.
Format berupa dokumen HTML yang rapi dengan heading, poin-poin terstruktur, tabel pemetaan elemen ke tujuan pembelajaran, dan tempat tanda tangan di bawah.
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Kembalikan respon strictly dalam format HTML mentah (tanpa markdown blok seperti \`\`\`html atau \`\`\`).
`;
        break;
      case "lkpd":
        prompt = `
Buatkan "LEMBAR KERJA PESERTA DIDIK (LKPD)" berstandar Kurikulum Merdeka untuk mata pelajaran "${subjectName}", kelas/tingkat "${grade}", Bab ${Number(babIndex) + 1}: "${babTitle}".
LKPD ini harus interaktif, berpusat pada siswa, dan mendidik dengan penuh kasih sayang, mencakup:
1. Identitas Peserta Didik & Kelompok.
2. Petunjuk Belajar (instruksi pengerjaan bernuansa asih-asuh).
3. Ringkasan Materi Pokok secara menarik.
4. Tugas/Aktivitas Kolaboratif Kelompok (memecahkan studi kasus moral/sosial dengan penuh kelembutan akhlak).
5. Pertanyaan Diskusi Kritis & Refleksi Karakter.
6. Rubrik Penilaian Diri & Rubrik Kerjasama Kelompok.
Format berupa dokumen HTML yang sangat rapi, menarik bagi siswa, dan dilengkapi tempat tanda tangan guru & orang tua/wali di bawah.
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Kembalikan respon strictly dalam format HTML mentah (tanpa markdown blok seperti \`\`\`html atau \`\`\`).
`;
        break;
      default:
        return res.status(400).json({ success: false, message: "docType tidak valid." });
    }
    if (guruName || kepsekName) {
      prompt += `

Untuk kolom tanda tangan di bagian paling bawah dokumen, Anda WAJIB menyertakan data berikut secara persis:
- Nama Guru: ${guruName || "(Nama Guru)"}
- NIP Guru: ${guruNip || "-"}
- Nama Kepala Sekolah: ${kepsekName || "(Nama Kepala Sekolah)"}
- NIP Kepala Sekolah: ${kepsekNip || "-"}
Pastikan kolom tanda tangan tersebut diformat dengan sangat rapi dan estetik menggunakan tabel atau struktur CSS flexbox/grid yang bersih (misalnya di sebelah kiri Kepala Sekolah dan sebelah kanan Guru), diletakkan di bagian akhir dokumen HTML.`;
    }
    const response = await generateGeminiContent(ai, {
      model: "gemini-3.7-flash",
      contents: prompt
    });
    let html = response.text || "";
    html = html.replace(/\`\`\`html/g, "").replace(/\`\`\`/g, "").trim();
    res.json({ success: true, html });
  } catch (error) {
    console.error("Generate Document error (using fallback):", error);
    const { docType = "Dokumen", subjectName = "Mata Pelajaran" } = req.body || {};
    const fallbackHtml = `<div class="p-6 font-sans"><h2 class="text-xl font-bold text-center mb-4">DOKUMEN ADMINISTRASI: ${docType.toUpperCase()} (${subjectName})</h2><p>Dokumen administrasi profesional madrasah disusun dengan mengintegrasikan nilai luhur dan Kurikulum Merdeka.</p></div>`;
    res.json({ success: true, html: fallbackHtml, fallback: true });
  }
});
app.post("/api/gemini/generate-soal-kisi", async (req, res) => {
  try {
    const { subjectName, mcCount = 10, essayCount = 5, optionCount = 5, lessons = [], difficulty = "sedang" } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY tidak dikonfigurasi di server.");
    }
    const ai = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
    let lessonsContext = "";
    if (lessons && lessons.length > 0) {
      lessonsContext = lessons.map((l, idx) => {
        return `Modul ${idx + 1}:
- Judul: ${l.title || ""}
- Topik: ${l.topic || ""}
- Kompetensi Awal: ${l.kompetensiAwal || ""}
- Tujuan Pembelajaran: ${l.tujuanPembelajaran || ""}
- Pemahaman Bermakna: ${l.pemahamanBermakna || ""}${l.extractedContent ? `
- Naskah Dokumen Modul Acuan: ${l.extractedContent.substring(0, 1e3)}` : ""}`;
      }).join("\n\n");
    } else {
      lessonsContext = "Tidak ada modul ajar tersimpan spesifik. Buatkan soal umum untuk mata pelajaran ini.";
    }
    let difficultyInstruction = "";
    if (difficulty === "mudah") {
      difficultyInstruction = `TINGKAT KESULITAN SOAL: MUDAH. Soal-soal yang dibuat HARUS berada pada level kognitif rendah ke sedang, yaitu C1, C2, C3, atau C4. SANGAT DILARANG menggunakan kategori C5 (Mengevaluasi) atau C6 (Mencipta) dalam kisi-kisi maupun naskah soal.`;
    } else if (difficulty === "sulit") {
      difficultyInstruction = `TINGKAT KESULITAN SOAL: SULIT / HOTS. Soal-soal yang dibuat HARUS bertaraf tinggi, yaitu terdiri dari level kognitif C3, C4, C5, atau C6. SANGAT DIUTAMAKAN menyertakan soal HOTS (Higher Order Thinking Skills) kategori C4, C5, dan C6.`;
    } else {
      difficultyInstruction = `TINGKAT KESULITAN SOAL: SEDANG. Jumlah dan sebaran tingkat kognitif dari C1, C2, C3, C4, C5, sampai C6 harus seimbang dan merata secara adil.`;
    }
    const subjectRule = getSubjectTemplateInstructions(subjectName);
    const prompt = `
Anda adalah sistem AI Penyusun Soal Ujian berorientasi pada Kurikulum Merdeka.
Tugas Anda adalah membuat naskah soal ujian dan KISI-KISI UJIAN yang berkaitan erat dengan modul-modul ajar berikut:

Mata Pelajaran: ${subjectName}
Kurikulum: Kurikulum Merdeka
${subjectRule}

Modul-modul Ajar Acuan:
${lessonsContext}

Ketentuan Khusus Tingkat Kesulitan:
${difficultyInstruction}

Sistem Ujian yang diminta:
1. Jumlah Soal Pilihan Ganda: ${mcCount} soal.
2. Jumlah Soal Essay/Uraian: ${essayCount} soal.
3. Untuk Pilihan Ganda, opsi harus sampai huruf ${optionCount === 5 ? "E" : "D"} (yaitu A, B, C, D${optionCount === 5 ? ", E" : ""}).

PENTING: Dilarang menggunakan simbol markdown seperti bintang (*, **), pagar (#), atau backtick (\`) dalam teks pertanyaan, opsi, penjelasan, maupun kisi-kisi. Gunakan penulisan huruf dan angka biasa yang rapi dan benar.

Respon harus strictly berupa JSON dengan format objek seperti berikut:
{
  "questions": [
    {
      "no": 1,
      "type": "mc",
      "question": "Pertanyaan pilihan ganda yang komprehensif dan menguji pemahaman materi...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "A",
      "explanation": "Penjelasan berbobot...",
      "kisiKisi": {
        "kompetensiDasar": "Kompetensi dasar (KD) atau capaian pembelajaran yang diukur",
        "materi": "Materi pokok dari modul",
        "indikator": "Indikator ketercapaian soal (misal: Disajikan teks, siswa dapat menentukan...)",
        "levelKognitif": "L1 atau L2 atau L3",
        "dimensiProsesKognitif": "Mengingat atau Memahami atau Menerapkan atau Menganalisis atau Mengevaluasi atau Mencipta",
        "kategori": "C1 atau C2 atau C3 atau C4 atau C5 atau C6",
        "bentukSoal": "Pilihan Ganda"
      }
    },
    ...
  ]
}

Pastikan no soal berurutan dari 1 sampai ${Number(mcCount) + Number(essayCount)}.
Soal essay memiliki properti "type": "essay", "options": [] (array kosong), dan "kisiKisi.bentukSoal": "Essay" atau "Uraian".
Tuliskan hasil tanpa format markdown seperti bintang (**) atau pagar (#). Gunakan penomoran angka atau huruf biasa. Gunakan format JSON yang valid. Jangan sertakan teks markdown pembungkus di luar JSON (strictly return JSON).
${NO_DASHES_PROMPT}
`;
    const response = await generateGeminiContent(ai, {
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const resultText = response.text || "{}";
    const rawData = safeParseGeminiJSON(resultText, null);
    if (!rawData) throw new Error("Invalid JSON from Gemini Generate Soal Kisi response: " + resultText);
    const data = sanitizeGeneratedData(rawData);
    res.json({ success: true, data });
  } catch (error) {
    console.error("Gemini Generate Soal Kisi error (using fallback):", error);
    const { subjectName, mcCount = 5, essayCount = 2, optionCount = 5, difficulty = "sedang" } = req.body || {};
    const items = [];
    let qNo = 1;
    let mcCat = "C2";
    let mcLevel = "L2";
    let mcDim = "Memahami";
    let esCat = "C3";
    let esLevel = "L2";
    let esDim = "Menerapkan";
    if (difficulty === "mudah") {
      mcCat = "C2";
      mcLevel = "L2";
      mcDim = "Memahami";
      esCat = "C3";
      esLevel = "L2";
      esDim = "Menerapkan";
    } else if (difficulty === "sulit") {
      mcCat = "C4";
      mcLevel = "L3";
      mcDim = "Menganalisis";
      esCat = "C5";
      esLevel = "L3";
      esDim = "Mengevaluasi";
    } else {
      mcCat = "C3";
      mcLevel = "L2";
      mcDim = "Menerapkan";
      esCat = "C4";
      esLevel = "L3";
      esDim = "Menganalisis";
    }
    for (let i = 0; i < (mcCount || 5); i++) {
      items.push({
        no: qNo,
        type: "mc",
        question: `Bagaimana pemahaman dan penerapan utama materi ${subjectName || "Mata Pelajaran"} dalam kehidupan sehari-hari?`,
        options: optionCount === 5 ? ["A. Mengaplikasikan prinsip dasar dengan benar dan tepat", "B. Mengabaikan aturan dan prinsip dasar", "C. Menerapkan secara acak tanpa landasan", "D. Menolak mempelajari konsep dasar", "E. Tidak memperhatikan relevansi materi"] : ["A. Mengaplikasikan prinsip dasar dengan benar dan tepat", "B. Mengabaikan aturan dan prinsip dasar", "C. Menerapkan secara acak tanpa landasan", "D. Menolak mempelajari konsep dasar"],
        answer: "A",
        explanation: "Pemahaman materi dilakukan dengan menerapkan prinsip utama secara sistematis dan benar.",
        kisiKisi: {
          kompetensiDasar: `Memahami konsep dasar pada materi ${subjectName || "Mata Pelajaran"}`,
          materi: `Materi Inti ${subjectName || "Mata Pelajaran"}`,
          indikator: "Siswa dapat menganalisis dan menerapkan konsep dasar secara tepat.",
          levelKognitif: mcLevel,
          dimensiProsesKognitif: mcDim,
          kategori: mcCat,
          bentukSoal: "Pilihan Ganda"
        }
      });
      qNo++;
    }
    for (let i = 0; i < (essayCount || 2); i++) {
      items.push({
        no: qNo,
        type: "essay",
        question: `Jelaskan secara komprehensif bagaimana penerapan ilmu ${subjectName || "Mata Pelajaran"} dapat menyelesaikan masalah di lingkungan Anda!`,
        options: [],
        answer: "Penerapan materi dilakukan melalui analisis masalah, perumusan solusi berdasarkan prinsip ilmiah, serta evaluasi hasil secara berkelanjutan.",
        explanation: "Jawaban essay mengutamakan elaborasi pemahaman materi.",
        kisiKisi: {
          kompetensiDasar: `Menganalisis dan mengevaluasi penerapan ${subjectName || "Mata Pelajaran"}`,
          materi: `Aplikasi ${subjectName || "Mata Pelajaran"}`,
          indikator: "Siswa mampu menjelaskan penerapan keilmuan secara analitis dan sistematis.",
          levelKognitif: esLevel,
          dimensiProsesKognitif: esDim,
          kategori: esCat,
          bentukSoal: "Essay"
        }
      });
      qNo++;
    }
    res.json({ success: true, data: { questions: items }, fallback: true });
  }
});
app.get("/api/schedules", (req, res) => {
  res.json({ success: true, schedules: filterByMadrasah(schedules, req) });
});
app.post("/api/schedules", async (req, res) => {
  const mId = getRequestMadrasahId(req);
  if (Array.isArray(req.body)) {
    const taggedIncoming = req.body.map((item) => tagNewRecord(item, req));
    let otherSchedules = [];
    if (mId && mId !== "default" && mId !== "BOSS") {
      const matchM = madrasahs.find((m) => String(m.id) === mId || String(m.slug) === mId);
      const targetId = matchM ? matchM.id : mId;
      const targetSlug = matchM ? matchM.slug : mId;
      otherSchedules = schedules.filter((s) => {
        const imId = String(s.madrasahId || "").trim();
        const imSlug = String(s.madrasahSlug || "").trim();
        if (!imId && !imSlug) return true;
        return imId !== targetId && imSlug !== targetSlug && imId !== targetSlug && imSlug !== targetId;
      });
    } else {
      const defaultM = madrasahs.find((m) => m.id === "default" || m.slug === "default") || madrasahs[0];
      const defId = defaultM ? defaultM.id : "default";
      const defSlug = defaultM ? defaultM.slug : "default";
      otherSchedules = schedules.filter((s) => {
        const imId = String(s.madrasahId || "default").trim();
        const imSlug = String(s.madrasahSlug || "default").trim();
        const isDefault = imId === "default" || imId === defId || imId === defSlug || imSlug === "default" || imSlug === defSlug || imSlug === defId || !s.madrasahId && !s.madrasahSlug;
        return !isDefault;
      });
    }
    schedules = [...otherSchedules, ...taggedIncoming];
  } else if (req.body && req.body.id) {
    const tagged = tagNewRecord(req.body, req);
    const idx = schedules.findIndex((s) => String(s.id) === String(req.body.id));
    if (idx >= 0) {
      schedules[idx] = { ...schedules[idx], ...tagged };
    } else {
      schedules.push(tagged);
    }
  }
  await saveData("schedules", schedules);
  res.json({ success: true, schedules: filterByMadrasah(schedules, req) });
});
app.delete("/api/schedules/:id", async (req, res) => {
  const { id } = req.params;
  schedules = schedules.filter((s) => String(s.id) !== String(id));
  await saveData("schedules", schedules);
  res.json({ success: true, schedules: filterByMadrasah(schedules, req) });
});
app.get("/api/exams", (req, res) => {
  res.json({ success: true, exams: filterByMadrasah(exams, req) });
});
app.get("/api/lkpds", (req, res) => {
  res.json({ success: true, lkpdList: filterByMadrasah(lkpdList, req) });
});
app.post("/api/exams", async (req, res) => {
  const mId = getRequestMadrasahId(req);
  if (Array.isArray(req.body)) {
    const taggedIncoming = req.body.map((item) => tagNewRecord(item, req));
    let otherExams = [];
    if (mId && mId !== "default" && mId !== "BOSS") {
      const matchM = madrasahs.find((m) => String(m.id) === mId || String(m.slug) === mId);
      const targetId = matchM ? matchM.id : mId;
      const targetSlug = matchM ? matchM.slug : mId;
      otherExams = exams.filter((e) => {
        const imId = String(e.madrasahId || "").trim();
        const imSlug = String(e.madrasahSlug || "").trim();
        if (!imId && !imSlug) return true;
        return imId !== targetId && imSlug !== targetSlug && imId !== targetSlug && imSlug !== targetId;
      });
    } else {
      const defaultM = madrasahs.find((m) => m.id === "default" || m.slug === "default") || madrasahs[0];
      const defId = defaultM ? defaultM.id : "default";
      const defSlug = defaultM ? defaultM.slug : "default";
      otherExams = exams.filter((e) => {
        const imId = String(e.madrasahId || "default").trim();
        const imSlug = String(e.madrasahSlug || "default").trim();
        const isDefault = imId === "default" || imId === defId || imId === defSlug || imSlug === "default" || imSlug === defSlug || imSlug === defId || !e.madrasahId && !e.madrasahSlug;
        return !isDefault;
      });
    }
    exams = [...otherExams, ...taggedIncoming];
  } else if (req.body && req.body.id) {
    const tagged = tagNewRecord(req.body, req);
    const idx = exams.findIndex((e) => String(e.id) === String(req.body.id));
    if (idx >= 0) {
      exams[idx] = { ...exams[idx], ...tagged };
    } else {
      exams.push(tagged);
    }
  }
  await saveData("exams", exams);
  res.json({ success: true, exams: filterByMadrasah(exams, req) });
});
app.delete("/api/exams/:id", async (req, res) => {
  const { id } = req.params;
  exams = exams.filter((e) => String(e.id) !== String(id));
  await saveData("exams", exams);
  res.json({ success: true, exams: filterByMadrasah(exams, req) });
});
app.get("/api/rooms", (req, res) => {
  res.json({ success: true, rooms: filterByMadrasah(rooms, req) });
});
app.post("/api/rooms", async (req, res) => {
  const mId = getRequestMadrasahId(req);
  if (Array.isArray(req.body)) {
    const taggedIncoming = req.body.map((item) => tagNewRecord(item, req));
    let otherRooms = [];
    if (mId && mId !== "default" && mId !== "BOSS") {
      const matchM = madrasahs.find((m) => String(m.id) === mId || String(m.slug) === mId);
      const targetId = matchM ? matchM.id : mId;
      const targetSlug = matchM ? matchM.slug : mId;
      otherRooms = rooms.filter((r) => {
        const imId = String(r.madrasahId || "").trim();
        const imSlug = String(r.madrasahSlug || "").trim();
        if (!imId && !imSlug) return true;
        return imId !== targetId && imSlug !== targetSlug && imId !== targetSlug && imSlug !== targetId;
      });
    } else {
      const defaultM = madrasahs.find((m) => m.id === "default" || m.slug === "default") || madrasahs[0];
      const defId = defaultM ? defaultM.id : "default";
      const defSlug = defaultM ? defaultM.slug : "default";
      otherRooms = rooms.filter((r) => {
        const imId = String(r.madrasahId || "default").trim();
        const imSlug = String(r.madrasahSlug || "default").trim();
        const isDefault = imId === "default" || imId === defId || imId === defSlug || imSlug === "default" || imSlug === defSlug || imSlug === defId || !r.madrasahId && !r.madrasahSlug;
        return !isDefault;
      });
    }
    rooms = [...otherRooms, ...taggedIncoming];
  } else if (req.body && req.body.id) {
    const tagged = tagNewRecord(req.body, req);
    const idx = rooms.findIndex((r) => String(r.id) === String(req.body.id));
    if (idx >= 0) {
      rooms[idx] = { ...rooms[idx], ...tagged };
    } else {
      rooms.push(tagged);
    }
  }
  await saveData("rooms", rooms);
  res.json({ success: true, rooms: filterByMadrasah(rooms, req) });
});
app.delete("/api/rooms/:id", async (req, res) => {
  const { id } = req.params;
  rooms = rooms.filter((r) => String(r.id) !== String(id));
  await saveData("rooms", rooms);
  res.json({ success: true, rooms: filterByMadrasah(rooms, req) });
});
app.get("/api/journals", async (req, res) => {
  if (pool) {
    try {
      const dbRes = await pool.query("SELECT value FROM app_store WHERE key = 'journals'");
      if (dbRes.rows.length > 0) {
        let val = dbRes.rows[0].value;
        if (typeof val === "string") {
          try {
            val = JSON.parse(val);
          } catch (e) {
          }
        }
        return res.json({ success: true, journals: filterByMadrasah(val || [], req) });
      }
    } catch (e) {
    }
  }
  res.json({ success: true, journals: filterByMadrasah(journals, req) });
});
app.post("/api/journals", async (req, res) => {
  const mId = getRequestMadrasahId(req);
  if (Array.isArray(req.body)) {
    const taggedIncoming = req.body.map((item) => tagNewRecord(item, req));
    let otherJournals = [];
    if (mId && mId !== "default" && mId !== "BOSS") {
      const matchM = madrasahs.find((m) => String(m.id) === mId || String(m.slug) === mId);
      const targetId = matchM ? matchM.id : mId;
      const targetSlug = matchM ? matchM.slug : mId;
      otherJournals = journals.filter((j) => {
        const imId = String(j.madrasahId || "").trim();
        const imSlug = String(j.madrasahSlug || "").trim();
        if (!imId && !imSlug) return true;
        return imId !== targetId && imSlug !== targetSlug && imId !== targetSlug && imSlug !== targetId;
      });
    } else {
      const defaultM = madrasahs.find((m) => m.id === "default" || m.slug === "default") || madrasahs[0];
      const defId = defaultM ? defaultM.id : "default";
      const defSlug = defaultM ? defaultM.slug : "default";
      otherJournals = journals.filter((j) => {
        const imId = String(j.madrasahId || "default").trim();
        const imSlug = String(j.madrasahSlug || "default").trim();
        const isDefault = imId === "default" || imId === defId || imId === defSlug || imSlug === "default" || imSlug === defSlug || imSlug === defId || !j.madrasahId && !j.madrasahSlug;
        return !isDefault;
      });
    }
    journals = [...otherJournals, ...taggedIncoming];
  } else if (req.body && req.body.id) {
    const tagged = tagNewRecord(req.body, req);
    const idx = journals.findIndex((j) => String(j.id) === String(req.body.id));
    if (idx >= 0) {
      journals[idx] = { ...journals[idx], ...tagged };
    } else {
      journals.push(tagged);
    }
  }
  await saveData("journals", journals);
  res.json({ success: true, journals: filterByMadrasah(journals, req) });
});
app.delete("/api/journals/:id", async (req, res) => {
  const { id } = req.params;
  journals = journals.filter((j) => String(j.id) !== String(id));
  await saveData("journals", journals);
  res.json({ success: true, journals: filterByMadrasah(journals, req) });
});
app.get("/api/calendar-events", (req, res) => {
  res.json({ success: true, calendarEvents: filterByMadrasah(calendarEvents, req) });
});
app.post("/api/calendar-events", async (req, res) => {
  const mId = getRequestMadrasahId(req);
  if (Array.isArray(req.body)) {
    const taggedIncoming = req.body.map((item) => tagNewRecord(item, req));
    let otherEvents = [];
    if (mId && mId !== "default" && mId !== "BOSS") {
      const matchM = madrasahs.find((m) => String(m.id) === mId || String(m.slug) === mId);
      const targetId = matchM ? matchM.id : mId;
      const targetSlug = matchM ? matchM.slug : mId;
      otherEvents = calendarEvents.filter((c) => {
        const imId = String(c.madrasahId || "").trim();
        const imSlug = String(c.madrasahSlug || "").trim();
        if (!imId && !imSlug) return true;
        return imId !== targetId && imSlug !== targetSlug && imId !== targetSlug && imSlug !== targetId;
      });
    } else {
      const defaultM = madrasahs.find((m) => m.id === "default" || m.slug === "default") || madrasahs[0];
      const defId = defaultM ? defaultM.id : "default";
      const defSlug = defaultM ? defaultM.slug : "default";
      otherEvents = calendarEvents.filter((c) => {
        const imId = String(c.madrasahId || "default").trim();
        const imSlug = String(c.madrasahSlug || "default").trim();
        const isDefault = imId === "default" || imId === defId || imId === defSlug || imSlug === "default" || imSlug === defSlug || imSlug === defId || !c.madrasahId && !c.madrasahSlug;
        return !isDefault;
      });
    }
    calendarEvents = [...otherEvents, ...taggedIncoming];
  } else if (req.body && req.body.id) {
    const tagged = tagNewRecord(req.body, req);
    const idx = calendarEvents.findIndex((c) => String(c.id) === String(req.body.id));
    if (idx >= 0) {
      calendarEvents[idx] = { ...calendarEvents[idx], ...tagged };
    } else {
      calendarEvents.push(tagged);
    }
  }
  await saveData("calendarEvents", calendarEvents);
  res.json({ success: true, calendarEvents: filterByMadrasah(calendarEvents, req) });
});
app.delete("/api/calendar-events/:id", async (req, res) => {
  const { id } = req.params;
  calendarEvents = calendarEvents.filter((c) => String(c.id) !== String(id));
  await saveData("calendarEvents", calendarEvents);
  res.json({ success: true, calendarEvents });
});
app.post("/api/games/:id/submit", async (req, res) => {
  const { id } = req.params;
  const { submittedAnswer, studentId, isPreview, passed, customXp } = req.body;
  let eduGamesData = await getMemoryKeyValue("eduGames") || [];
  const game = Array.isArray(eduGamesData) ? eduGamesData.find((g) => String(g.id) === String(id)) : null;
  let isCorrect = passed === true;
  if (!isCorrect && game) {
    const key = String(game.answerKey || game.correctAnswer || game.answer || "").trim().toLowerCase();
    const sub = String(submittedAnswer || "").trim().toLowerCase();
    if (key && sub && (key === sub || key.replace(/\s+/g, "") === sub.replace(/\s+/g, ""))) {
      isCorrect = true;
    }
  }
  let earnedXp = customXp !== void 0 && customXp !== null ? Number(customXp) : game ? Number(game.rewardXp || 100) : 100;
  if (isNaN(earnedXp)) earnedXp = 100;
  let newTotalXp = 0;
  if (studentId && !isPreview) {
    const stIdx = students.findIndex((s) => String(s.id) === String(studentId));
    if (stIdx >= 0) {
      if (isCorrect) {
        students[stIdx].gameXp = (Number(students[stIdx].gameXp) || 0) + earnedXp;
        students[stIdx].dailyStreak = (Number(students[stIdx].dailyStreak) || 0) + 1;
      }
      newTotalXp = students[stIdx].gameXp;
      await saveData("students", students);
    }
  }
  res.json({
    success: true,
    isCorrect,
    earnedXp: isCorrect ? earnedXp : 0,
    newTotalXp
  });
});
app.post("/api/gemini/generate-rpp", async (req, res) => {
  try {
    const { subjectName, grade, plans, lessonsContext, guruName, guruNip, kepsekName, kepsekNip } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    const targetPlans = Array.isArray(plans) && plans.length > 0 ? plans : [{ title: subjectName, topic: subjectName, grade: grade || "X" }];
    const buildFallbackHTML = (p, index) => {
      const planTopic = p.topic || p.title || `Materi ${index + 1}`;
      const planTitle = p.title || `Modul ${index + 1}`;
      const planGrade = p.grade || grade || "X";
      const formattedDate = (/* @__PURE__ */ new Date()).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
      return `<div style="font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; color: #000; line-height: 1.5; font-size: 11pt; padding: 20px; background: #fff; max-width: 800px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
    <h2 style="text-align: center; font-size: 14pt; font-weight: bold; margin: 0 0 15px 0; font-family: Arial, sans-serif; text-transform: uppercase;">
        RENCANA PELAKSANAAN PEMBELAJARAN (RPP ${index + 1})
    </h2>

    <!-- Identitas Table -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 10.5pt;">
        <tr>
            <td style="width: 15%; padding: 3px 0;">Sekolah</td>
            <td style="width: 38%; padding: 3px 0;">: [Nama Nama Sekolah]</td>
            <td style="width: 17%; padding: 3px 0;">Kelas/Semester</td>
            <td style="width: 30%; padding: 3px 0;">: ${planGrade} / 1 (Ganjil)</td>
        </tr>
        <tr>
            <td style="padding: 3px 0;">Mata Pelajaran</td>
            <td style="padding: 3px 0;">: ${subjectName}</td>
            <td style="padding: 3px 0;">Alokasi Waktu</td>
            <td style="padding: 3px 0;">: 2 x 40 Menit</td>
        </tr>
        <tr>
            <td style="padding: 3px 0;">Materi Pokok</td>
            <td style="padding: 3px 0;">: ${planTopic}</td>
            <td style="padding: 3px 0;">Kompetensi Dasar</td>
            <td style="padding: 3px 0;">: 3.${index + 1} dan 4.${index + 1}</td>
        </tr>
    </table>

    <!-- A. TUJUAN PEMBELAJARAN -->
    <div style="font-weight: bold; font-size: 11pt; margin-top: 10px; margin-bottom: 5px;">A. TUJUAN PEMBELAJARAN</div>
    <div style="margin-bottom: 5px;">Setelah peserta didik mengamati, menanya, mengeksplorasi, menalar dan merefleksi, diharapkan peserta didik mampu :</div>
    <ul style="margin: 0 0 15px 20px; padding-left: 5px; list-style-type: disc;">
        <li>Menjelaskan konsep dan pemahaman mendalam mengenai ${planTopic}.</li>
        <li>Mengidentifikasi karakteristik serta prinsip utama dari ${planTopic}.</li>
        <li>Membedakan penerapan ${planTopic} dalam kehidupan sehari-hari.</li>
        <li>Memfungsikan pemahaman tentang ${planTopic} untuk pemecahan masalah praktis.</li>
        <li>Menunjukkan apresiasi dan kepedulian melalui perilaku mengamalkan ${planTopic}.</li>
    </ul>

    <!-- Media, Alat / Bahan, Sumber Belajar Table -->
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #7a9a3b; margin-bottom: 15px; font-size: 10pt;">
        <thead>
            <tr style="background-color: #8da458; color: #ffffff; font-weight: bold;">
                <th style="width: 50%; padding: 6px; border: 1px solid #7a9a3b; text-align: center;">Media</th>
                <th style="width: 50%; padding: 6px; border: 1px solid #7a9a3b; text-align: center;">Alat / Bahan</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="padding: 6px; border: 1px solid #b8ca94; vertical-align: top;">
                    \u2756 Worksheet atau lembar kerja (siswa)<br>
                    \u2756 Lembar penilaian<br>
                    \u2756 LCD Proyektor/ Slide presentasi (ppt)
                </td>
                <td style="padding: 6px; border: 1px solid #b8ca94; vertical-align: top;">
                    \u2756 Penggaris, spidol, papan tulis<br>
                    \u2756 Laptop & infocus<br>
                    \u2756 Internet : google
                </td>
            </tr>
            <tr style="background-color: #f1f6e8;">
                <td colspan="2" style="padding: 6px; border: 1px solid #7a9a3b; font-weight: bold; text-align: center;">
                    Sumber Belajar : Buku Siswa ${subjectName} Kelas ${planGrade}, Kemenag / Kemdikbud, Tahun 2020
                </td>
            </tr>
        </tbody>
    </table>

    <!-- B. KEGIATAN PEMBELAJARAN -->
    <div style="font-weight: bold; font-size: 11pt; margin-top: 10px; margin-bottom: 5px;">B. KEGIATAN PEMBELAJARAN</div>
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #63822d; margin-bottom: 15px; font-size: 10pt;">
        <thead>
            <tr style="background-color: #557224; color: #ffffff; font-weight: bold; text-align: center;">
                <th colspan="2" style="padding: 6px; border: 1px solid #557224;">Pertemuan Ke-1</th>
            </tr>
            <tr style="background-color: #728f37; color: #ffffff; font-weight: bold; text-align: center;">
                <th colspan="2" style="padding: 5px; border: 1px solid #728f37;">Pendahuluan</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td colspan="2" style="padding: 8px; border: 1px solid #b3c98d; background-color: #ffffff;">
                    1. Peserta didik memberi salam, berdoa (PPK)<br>
                    2. Guru mengecek kehadiran peserta didik dan memberi motivasi<br>
                    3. Guru menyampaikan tujuan dan manfaat pembelajaran tentang materi yang akan diajarkan<br>
                    4. Guru menyampaikan garis besar cakupan materi dan langkah pembelajaran
                </td>
            </tr>
            <tr>
                <td style="width: 18%; padding: 10px 5px; border: 1px solid #b3c98d; font-weight: bold; text-align: center; vertical-align: middle; background-color: #f8faf4;">
                    Kegiatan Inti
                </td>
                <td style="width: 82%; padding: 0; border: 1px solid #b3c98d; background-color: #ffffff;">
                    <div style="background-color: #e2ebd0; padding: 4px 8px; font-weight: bold; color: #000; border-bottom: 1px solid #b3c98d;">KEGIATAN LITERASI</div>
                    <div style="padding: 6px 8px 10px 8px; border-bottom: 1px solid #e2ebd0;">
                        \u2022 Peserta didik diberi motivasi dan panduan untuk melihat, mengamati, membaca dan menuliskannya kembali. Mereka diberi tayangan dan bahan bacaan terkait materi ${planTopic}
                    </div>

                    <div style="background-color: #e2ebd0; padding: 4px 8px; font-weight: bold; color: #000; border-bottom: 1px solid #b3c98d;">CRITICAL THINKING (BERPIKIR KRITIK)</div>
                    <div style="padding: 6px 8px 10px 8px; border-bottom: 1px solid #e2ebd0;">
                        \u2022 Guru memberikan kesempatan untuk mengidentifikasi sebanyak mungkin hal yang belum dipahami. Pertanyaan ini harus tetap berkaitan dengan materi ${planTopic}
                    </div>

                    <div style="background-color: #e2ebd0; padding: 4px 8px; font-weight: bold; color: #000; border-bottom: 1px solid #b3c98d;">COLLABORATION (KERJASAMA)</div>
                    <div style="padding: 6px 8px 10px 8px; border-bottom: 1px solid #e2ebd0;">
                        \u2022 Peserta didik dibentuk dalam beberapa kelompok untuk mendiskusikan, mengumpulkan informasi, mempresentasikan ulang, dan saling bertukar informasi mengenai ${planTopic}
                    </div>

                    <div style="background-color: #e2ebd0; padding: 4px 8px; font-weight: bold; color: #000; border-bottom: 1px solid #b3c98d;">COMMUNICATION (BERKOMUNIKASI)</div>
                    <div style="padding: 6px 8px 10px 8px; border-bottom: 1px solid #e2ebd0;">
                        \u2022 Peserta didik mempresentasikan hasil kerja kelompok atau individu secara klasikal, mengemukakan pendapat atas presentasi yang dilakukan kemudian ditanggapi kembali oleh kelompok atau individu yang mempresentasikan
                    </div>

                    <div style="background-color: #e2ebd0; padding: 4px 8px; font-weight: bold; color: #000; border-bottom: 1px solid #b3c98d;">CREATIVITY (KREATIVITAS)</div>
                    <div style="padding: 6px 8px 10px 8px;">
                        \u2022 Guru dan peserta didik membuat kesimpulan tentang hal-hal yang telah dipelajari terkait materi ${planTopic}. Peserta didik kemudian diberi kesempatan untuk menanyakan kembali hal-hal yang belum dipahami
                    </div>
                </td>
            </tr>
            <tr style="background-color: #728f37; color: #ffffff; font-weight: bold; text-align: center;">
                <th colspan="2" style="padding: 5px; border: 1px solid #728f37;">Penutup</th>
            </tr>
            <tr>
                <td colspan="2" style="padding: 8px; border: 1px solid #b3c98d; background-color: #ffffff;">
                    1. Guru bersama peserta didik merefleksikan pengalaman belajar<br>
                    2. Guru memberikan penilaian lisan secara acak dan singkat<br>
                    3. Guru menyampaikan rencana pembelajaran pada pertemuan berikutnya dan berdoa
                </td>
            </tr>
        </tbody>
    </table>

    <!-- C. PENILAIAN HASIL PEMBELAJARAN -->
    <div style="font-weight: bold; font-size: 11pt; margin-top: 10px; margin-bottom: 5px;">C. PENILAIAN HASIL PEMBELAJARAN</div>
    <ul style="margin: 0 0 20px 20px; padding-left: 5px; list-style-type: square;">
        <li><b>Penilaian Sikap</b> : Observasi/Jurnal;</li>
        <li><b>Penilaian Pengetahuan</b> : Tes lisan, Penugasan;</li>
        <li><b>Penilaian Keterampilan</b> : Unjuk Kerja Kegiatan diskusi dan presentasi;</li>
    </ul>

    <!-- Signature Block -->
    <div style="width: 100%; margin-top: 30px; font-size: 10.5pt;">
        <table style="width: 100%; border: none;">
            <tr>
                <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
                    Mengetahui<br>
                    <b>Kepala Sekolah</b><br><br><br><br><br>
                    <b><u>${kepsekName || "................................"}</u></b><br>
                    NIP: ${kepsekNip || "................................"}
                </td>
                <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
                    Tanjung Jabung Barat, ${formattedDate}<br>
                    <b>Guru Mata Pelajaran</b><br><br><br><br><br>
                    <b><u>${guruName || "................................"}</u></b><br>
                    NIP: ${guruNip || "................................"}
                </td>
            </tr>
        </table>
    </div>
</div>`;
    };
    let ai = null;
    if (apiKey) {
      try {
        ai = new import_genai.GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
      } catch (e) {
        console.warn("GoogleGenAI init failed:", e);
      }
    }
    const rpps = [];
    for (let index = 0; index < targetPlans.length; index++) {
      const p = targetPlans[index];
      const planTopic = p.topic || p.title || `Materi ${index + 1}`;
      const planTitle = p.title || `Modul ${index + 1}`;
      const planGrade = p.grade || grade || "X";
      const planActivities = p.activities || p.kegiatanPembelajaran || planTopic;
      let htmlContent = "";
      if (ai) {
        try {
          const prompt = `Buatkan dokumen "RENCANA PELAKSANAAN PEMBELAJARAN (RPP)" LENGKAP berstandar Kurikulum Merdeka dengan TAMPILAN TEMPLATE HTML SAMA PERSIS dengan acuan berikut untuk:
Mata Pelajaran: "${subjectName}"
Kelas/Tingkat: "${planGrade}"
Materi Pokok: "${planTopic}"
Judul Modul: "${planTitle}"
Kegiatan / Detail Materi: "${planActivities}"

PENTING:
- Gunakan struktur & styling HTML persis seperti template berikut.
- Gunakan Materi Pokok "${planTopic}".
- Buat Tujuan Pembelajaran (A) dengan 4-5 poin spesifik mengenai ${planTopic}.
- Pada Langkah Kegiatan Inti (B), sebutkan secara spesifik mengenai ${planTopic} di bagian KEGIATAN LITERASI, CRITICAL THINKING, COLLABORATION, COMMUNICATION, dan CREATIVITY.
- Jangan gunakan markdown codeblock html - kembalikan MURNI string HTML mentah saja!

TEMPLATE MANDATORI HTML:
${buildFallbackHTML(p, index)}`;
          const response = await generateGeminiContent(ai, {
            model: "gemini-3.7-flash",
            contents: prompt,
            config: {
              responseMimeType: "text/plain"
            }
          });
          if (response && response.text) {
            htmlContent = response.text.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
          }
        } catch (genErr) {
          console.warn(`[RPP Gen] Gemini generation for index ${index} failed, using template fallback. Error:`, genErr?.message || genErr);
        }
      }
      if (!htmlContent) {
        htmlContent = buildFallbackHTML(p, index);
      }
      htmlContent = htmlContent.replace(/\bmodul\s*ajar\b/gi, "Materi").replace(/\bmodul\s*(\d+)/gi, "Bab $1").replace(/\bmodul\b/gi, "Materi").replace(/\bModul\b/g, "Materi");
      rpps.push({
        id: p.id || "materi_" + (index + 1),
        title: `RPP ${index + 1}: ${planTopic}`,
        topic: planTopic,
        grade: planGrade,
        htmlContent
      });
    }
    res.json({
      success: true,
      rpps,
      count: rpps.length,
      htmlContent: rpps[0]?.htmlContent || ""
    });
  } catch (error) {
    console.error("Error generating RPP (using fallback):", error);
    const fallbackHtml = `<div class="p-6 font-sans"><h2 class="text-xl font-bold text-center mb-4">RENCANA PELAKSANAAN PEMBELAJARAN (RPP)</h2><p>Disusun secara profesional sesuai kurikulum merdeka madrasah.</p></div>`;
    res.json({ success: true, count: 1, htmlContent: fallbackHtml, fallback: true });
  }
});
app.post("/api/gemini/generate-device", async (req, res) => {
  try {
    const { deviceType, subjectName, grade, plans, guruName, guruNip, kepsekName, kepsekNip } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    const targetPlans = Array.isArray(plans) && plans.length > 0 ? plans : [{ title: subjectName, topic: subjectName, grade: grade || "X" }];
    const formattedDate = (/* @__PURE__ */ new Date()).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const teacherSign = `
      <table style="width: 100%; margin-top: 30px; font-size: 10pt; border: none;" border="0">
        <tr>
          <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
            Mengetahui,<br><b>Kepala Sekolah</b><br><br><br><br><br>
            <b><u>${kepsekName || "................................"}</u></b><br>
            NIP: ${kepsekNip || "................................"}
          </td>
          <td style="width: 50%; text-align: center; vertical-align: top; border: none;">
            Tanjung Jabung Barat, ${formattedDate}<br>
            <b>Guru Mata Pelajaran</b><br><br><br><br><br>
            <b><u>${guruName || "................................"}</u></b><br>
            NIP: ${guruNip || "................................"}
          </td>
        </tr>
      </table>
    `;
    const removeModulWord = (str) => {
      if (!str) return "";
      return str.replace(/modul\s*ajar\s*/gi, "").replace(/modul\s*(\d+)\s*:?/gi, "Bab $1:").replace(/\bmodul\b/gi, "Materi").replace(/\bModul\b/g, "Materi").trim();
    };
    const buildDeviceFallback = (type, planList) => {
      const g = grade || planList[0]?.grade || "VII";
      if (type === "silabus") {
        const firstTopic = removeModulWord(planList[0]?.topic || planList[0]?.title || subjectName);
        const silabusBabRows = planList.map((p, idx) => {
          const cleanTopic = removeModulWord(p.topic || p.title || subjectName) || `${subjectName} Bab ${idx + 1}`;
          return `
            <tr>
              <td style="vertical-align: top; border: 1px solid #000;">
                <b>3.${idx + 1} Memahami & menganalisis ${cleanTopic}</b><br><br>
                <b>4.${idx + 1} Menyajikan kesimpulan & fenomena sosial terkait ${cleanTopic}</b>
              </td>
              <td style="vertical-align: top; border: 1px solid #000;">
                3.${idx + 1}.1 Mendefinisikan pengertian ${cleanTopic}<br>
                3.${idx + 1}.2 Menjelaskan isi kandungan & prinsip ${cleanTopic}<br>
                3.${idx + 1}.3 Menganalisis penerapan ${cleanTopic}<br>
                4.${idx + 1}.1 Mendeskripsikan cara efektif mengaplikasikan ${cleanTopic}<br>
                4.${idx + 1}.2 Mempresentasikan hasil analisis ${cleanTopic}
              </td>
              <td style="vertical-align: top; border: 1px solid #000;">
                <b>${cleanTopic}</b><br>
                \u2022 Konsep Utama ${cleanTopic}<br>
                \u2022 Penerapan & Analisis
              </td>
              <td style="vertical-align: top; border: 1px solid #000;">
                <b>Mengamati:</b><br>
                \u2022 Mencermati bacaan teks tentang ${cleanTopic}<br>
                \u2022 Menyimak penjelasan materi via tayangan/media<br>
                <b>Menanya:</b><br>
                \u2022 Stimulus pertanyaan mengenai ${cleanTopic}<br>
                <b>Mengeksplorasi:</b><br>
                \u2022 Peserta didik mendiskusikan ${cleanTopic}<br>
                <b>Mengasosiasi:</b><br>
                \u2022 Membuat kesimpulan tentang ${cleanTopic}<br>
                <b>Mengkomunikasikan:</b><br>
                \u2022 Mempresentasikan hasil diskusi tentang ${cleanTopic}
              </td>
              <td style="vertical-align: top; border: 1px solid #000;">
                <b>Tugas:</b> Mengumpulkan gambar/berita/artikel sesuai materi<br>
                <b>Observasi:</b> Keaktifan diskusi & presentasi<br>
                <b>Portofolio:</b> Membuat paparan materi<br>
                <b>Tes:</b> Tes Tulis & Lisan
              </td>
              <td style="vertical-align: top; border: 1px solid #000; text-align: center;">4 x TM</td>
              <td style="vertical-align: top; border: 1px solid #000;">Buku Pedoman Guru & Siswa ${subjectName}, Internet</td>
            </tr>
          `;
        }).join("");
        return `<div style="font-family: Arial, sans-serif; color: #000; line-height: 1.4; font-size: 10pt; padding: 20px; background: #fff; max-width: 1050px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
          <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 12px;">SILABUS</h2>
          <table style="width: 100%; margin-bottom: 15px; font-size: 10pt; border: none;">
            <tr><td style="width: 18%; border:none;">Satuan Pendidikan</td><td style="width: 32%; border:none;">: [Nama Nama Sekolah]</td><td style="width: 18%; border:none;">Kelas / Semester</td><td style="width: 32%; border:none;">: ${g} / 1-2 (Ganjil & Genap)</td></tr>
            <tr><td style="border:none;">Mata Pelajaran</td><td style="border:none;">: ${subjectName}</td><td style="border:none;">Tahun Pelajaran</td><td style="border:none;">: 2024/2025</td></tr>
          </table>

          <div style="margin-bottom: 15px; font-size: 9.5pt; line-height: 1.5;">
            <b>Standar Kompetensi (KI)</b><br>
            <b>KI-1 :</b> Menerima dan menjalankan ajaran agama yang dianutnya<br>
            <b>KI-2 :</b> Menunjukkan perilaku jujur, disiplin, tanggung jawab, santun, peduli (toleran, gotong royong), santun, percaya diri, dan percaya diri dalam berinteraksi secara efektif dengan lingkungan sosial dan alam dalam jangkauan pergaulan dan keberadaannya<br>
            <b>KI-3 :</b> Memahami pengetahuan (faktual, konseptual dan prosedural) dengan cara mengamati [mendengar, melihat, membaca] berdasarkan rasa ingin tahu tentang ilmu pengetahuan, teknologi, seni dan budaya terkait fenomena dan kejadian tampak mata<br>
            <b>KI-4 :</b> Mencoba, mengolah, dan menyaji dalam ranah konkret (menggunakan, mengurai, merangkai, memodifikasi, dan membuat) dan ranah abstrak (menulis, membaca, menghitung, menggambar, dan mengarang) sesuai dengan yang dipelajari di sekolah dan sumber lain yang sama dalam sudut pandang/teori
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 9pt;" border="1" cellpadding="6">
            <thead>
              <tr style="background-color: #d9e3b8; text-align: center; font-weight: bold; border: 1px solid #000;">
                <th style="width: 18%; border: 1px solid #000;">Kompetensi Dasar</th>
                <th style="width: 15%; border: 1px solid #000;">Indikator</th>
                <th style="width: 14%; border: 1px solid #000;">Materi Pokok</th>
                <th style="width: 22%; border: 1px solid #000;">Kegiatan Pembelajaran</th>
                <th style="width: 17%; border: 1px solid #000;">Penilaian</th>
                <th style="width: 7%; border: 1px solid #000;">Alokasi Waktu</th>
                <th style="width: 7%; border: 1px solid #000;">Sumber Belajar</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="vertical-align: top; border: 1px solid #000;">
                  1.1 Menerima dan meyakini ajaran ${subjectName}<br>
                  1.2 Menerima kekuasaan dan rahmat Allah SWT<br>
                  1.3 Menerima bahwa Allah SWT mencintai kebaikan
                </td>
                <td style="vertical-align: top; border: 1px solid #000;">-</td>
                <td style="vertical-align: top; border: 1px solid #000;">
                  Perwujudan sikap religius dalam pembelajaran tentang:<br>
                  \u2022 ${firstTopic}<br>
                  \u2022 Struktur dan contoh-contoh telaahannya
                </td>
                <td style="vertical-align: top; border: 1px solid #000;">
                  Sebelum pembelajaran dimulai, diawali dengan kegiatan berdoa.<br><br>
                  Mengikuti pembelajaran dengan kegiatan mengamati, menanya, diskusi tentang:<br>
                  \u2022 ${firstTopic}<br>
                  Struktur dan contoh-contoh telaahannya
                </td>
                <td style="vertical-align: top; border: 1px solid #000;">
                  <b>Observasi:</b> Merumuskan pernyataan hubungan materi.<br>
                  <b>Penilaian diri:</b> Menjawab sesuai pemahaman.<br>
                  <b>Penilaian Sejawat:</b> Diisi oleh teman sejawat.<br>
                  <b>Jurnal Anecdot:</b> Rekam jejak kegiatan.
                </td>
                <td style="vertical-align: top; border: 1px solid #000; text-align: center;">-</td>
                <td style="vertical-align: top; border: 1px solid #000;">Buku Pedoman Guru & Siswa</td>
              </tr>
              <tr>
                <td style="vertical-align: top; border: 1px solid #000;">
                  2.1 Menjalankan sikap tanggung jawab dalam berperilaku<br>
                  2.2 Menghayati sikap disiplin dalam menjalankan kewajiban<br>
                  2.3 Menjalankan sikap peduli kepada masyarakat
                </td>
                <td style="vertical-align: top; border: 1px solid #000;">-</td>
                <td style="vertical-align: top; border: 1px solid #000;">
                  Perwujudan sikap sportif dan disiplin dalam pembelajaran tentang:<br>
                  \u2022 ${firstTopic}<br>
                  (Terintegrasi pada KI 3 dan KI 4)
                </td>
                <td style="vertical-align: top; border: 1px solid #000;">
                  Mengikuti pembelajaran dengan kegiatan mengamati, menanya, diskusi tentang:<br>
                  \u2022 ${firstTopic}<br>
                  Struktur dan contoh-contoh telaahannya
                </td>
                <td style="vertical-align: top; border: 1px solid #000;">
                  <b>Observasi & Jurnal:</b> Rekam jejak anak dalam kegiatan sehari-hari
                </td>
                <td style="vertical-align: top; border: 1px solid #000; text-align: center;">-</td>
                <td style="vertical-align: top; border: 1px solid #000;">Buku Pedoman Guru</td>
              </tr>
              ${silabusBabRows}
            </tbody>
          </table>
          ${teacherSign}
        </div>`;
      }
      if (type === "atp") {
        const rows = planList.map((p, idx) => {
          const cleanTopic = removeModulWord(p.topic || p.title || subjectName) || `${subjectName} Bab ${idx + 1}`;
          return `
            <tr>
              <td style="text-align: center; border: 1px solid #000;">${idx + 1}</td>
              <td style="border: 1px solid #000;"><b>Bab ${idx + 1}</b><br>${cleanTopic}</td>
              <td style="border: 1px solid #000;">Peserta didik mampu memahami, menganalisis, dan mengaplikasikan konsep ${cleanTopic} dalam konteks nyata.</td>
              <td style="border: 1px solid #000;">
                1. Menjelaskan konsep dasar ${cleanTopic}<br>
                2. Mengidentifikasi komponen dan prinsip ${cleanTopic}<br>
                3. Menyelesaikan studi kasus dan latihan ${cleanTopic}
              </td>
              <td style="text-align: center; border: 1px solid #000;">4 JP</td>
              <td style="border: 1px solid #000;">Beriman, Bernalar Kritis, Gotong Royong</td>
              <td style="border: 1px solid #000;">Asesmen Formatif (Kuis), Sumatif (Tes Tulis)</td>
            </tr>
          `;
        }).join("");
        return `<div style="font-family: Arial, sans-serif; color: #000; line-height: 1.5; font-size: 11pt; padding: 20px; background: #fff; max-width: 950px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
          <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">ALUR TUJUAN PEMBELAJARAN (ATP)</h2>
          <h3 style="text-align: center; font-size: 11pt; font-weight: bold; margin-top: 0; margin-bottom: 20px;">KURIKULUM MERDEKA</h3>
          <table style="width: 100%; margin-bottom: 15px; font-size: 10pt; border: none;">
            <tr><td style="width: 18%; border:none;">Mata Pelajaran</td><td style="width: 32%; border:none;">: ${subjectName}</td><td style="width: 18%; border:none;">Kelas / Fase</td><td style="width: 32%; border:none;">: ${g} / Fase ${g === "7" || g === "8" || g === "9" ? "D" : "E"}</td></tr>
            <tr><td style="border:none;">Satuan Pendidikan</td><td style="border:none;">: [Nama Nama Sekolah]</td><td style="border:none;">Tahun Pelajaran</td><td style="border:none;">: 2024/2025</td></tr>
          </table>
          <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt;" border="1" cellpadding="6">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: center; font-weight: bold;">
                <th style="width: 4%;">No</th>
                <th style="width: 20%;">Bab / Elemen</th>
                <th style="width: 24%;">Capaian Pembelajaran (CP)</th>
                <th style="width: 24%;">Tujuan Pembelajaran (TP)</th>
                <th style="width: 8%;">Alokasi</th>
                <th style="width: 10%;">Profil Pelajar</th>
                <th style="width: 10%;">Asesmen</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          ${teacherSign}
        </div>`;
      }
      if (type === "kktp") {
        const items = planList.map((p, idx) => {
          const cleanTopic = removeModulWord(p.topic || p.title || subjectName);
          return `
            <div style="margin-bottom: 25px;">
              <h4 style="font-size: 11pt; font-weight: bold; margin-bottom: 8px;">Bab ${idx + 1}: ${cleanTopic}</h4>
              <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt;" border="1" cellpadding="6">
                <thead>
                  <tr style="background-color: #f1f5f9; font-weight: bold; text-align: center;">
                    <th style="width: 30%;">Tujuan Pembelajaran</th>
                    <th style="width: 20%;">Perlu Bimbingan (0-60)</th>
                    <th style="width: 20%;">Cukup (61-70)</th>
                    <th style="width: 15%;">Baik (71-85)</th>
                    <th style="width: 15%;">Sangat Baik (86-100)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="border: 1px solid #000;">Memahami & menguasai ${cleanTopic}</td>
                    <td style="border: 1px solid #000;">Belum mampu menjelaskan konsep dasar ${cleanTopic}</td>
                    <td style="border: 1px solid #000;">Mampu menjelaskan sebagian konsep ${cleanTopic}</td>
                    <td style="border: 1px solid #000;">Mampu menjelaskan dan menerapkan ${cleanTopic} secara tepat</td>
                    <td style="border: 1px solid #000;">Menguasai sepenuhnya dan dapat merefleksikan ${cleanTopic}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          `;
        }).join("");
        return `<div style="font-family: Arial, sans-serif; color: #000; line-height: 1.5; font-size: 11pt; padding: 20px; background: #fff; max-width: 900px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
          <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">KRITERIA KETERCAPAIAN TUJUAN PEMBELAJARAN (KKTP)</h2>
          <h3 style="text-align: center; font-size: 11pt; font-weight: bold; margin-top: 0; margin-bottom: 20px;">MATAPELAJARAN: ${subjectName.toUpperCase()} - KELAS ${g}</h3>
          ${items}
          ${teacherSign}
        </div>`;
      }
      if (type === "prota") {
        const rows = planList.map((p, idx) => {
          const cleanTopic = removeModulWord(p.topic || p.title || subjectName);
          return `
            <tr>
              <td style="text-align: center; border: 1px solid #000;">${idx < Math.ceil(planList.length / 2) ? 1 : 2}</td>
              <td style="text-align: center; border: 1px solid #000;">${idx + 1}</td>
              <td style="border: 1px solid #000;"><b>Bab ${idx + 1}: ${cleanTopic}</b></td>
              <td style="text-align: center; border: 1px solid #000;">4 JP</td>
              <td style="border: 1px solid #000;">Terlaksana di Bulan ${idx < 2 ? "Juli/Agustus" : "September/Oktober"}</td>
            </tr>
          `;
        }).join("");
        return `<div style="font-family: Arial, sans-serif; color: #000; line-height: 1.5; font-size: 11pt; padding: 20px; background: #fff; max-width: 900px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
          <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">PROGRAM TAHUNAN (PROTA)</h2>
          <h3 style="text-align: center; font-size: 11pt; font-weight: bold; margin-top: 0; margin-bottom: 20px;">TAHUN PELAJARAN 2024/2025 - KELAS ${g}</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 10pt;" border="1" cellpadding="6">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: center; font-weight: bold;">
                <th style="width: 10%;">Semester</th>
                <th style="width: 8%;">No</th>
                <th style="width: 50%;">Materi Pokok / Bab</th>
                <th style="width: 12%;">Alokasi Waktu</th>
                <th style="width: 20%;">Keterangan</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          ${teacherSign}
        </div>`;
      }
      if (type === "prosem") {
        const rows = planList.map((p, idx) => {
          const cleanTopic = removeModulWord(p.topic || p.title || subjectName);
          return `
            <tr>
              <td style="text-align: center; border: 1px solid #000;">${idx + 1}</td>
              <td style="border: 1px solid #000;">${cleanTopic}</td>
              <td style="text-align: center; border: 1px solid #000;">4 JP</td>
              <td style="text-align: center; border: 1px solid #000;">${idx === 0 ? "2" : ""}</td>
              <td style="text-align: center; border: 1px solid #000;">${idx === 0 ? "2" : ""}</td>
              <td style="text-align: center; border: 1px solid #000;">${idx === 1 ? "2" : ""}</td>
              <td style="text-align: center; border: 1px solid #000;">${idx === 1 ? "2" : ""}</td>
              <td style="text-align: center; border: 1px solid #000;">${idx === 2 ? "2" : ""}</td>
              <td style="text-align: center; border: 1px solid #000;">${idx === 2 ? "2" : ""}</td>
            </tr>
          `;
        }).join("");
        return `<div style="font-family: Arial, sans-serif; color: #000; line-height: 1.5; font-size: 11pt; padding: 20px; background: #fff; max-width: 900px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
          <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">PROGRAM SEMESTER (PROSEM)</h2>
          <h3 style="text-align: center; font-size: 11pt; font-weight: bold; margin-top: 0; margin-bottom: 20px;">SEMESTER 1 (GANJIL) - ${subjectName.toUpperCase()} KELAS ${g}</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 9pt;" border="1" cellpadding="4">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: center; font-weight: bold;">
                <th style="width: 5%;" rowspan="2">No</th>
                <th style="width: 35%;" rowspan="2">Materi Pokok / Bab</th>
                <th style="width: 10%;" rowspan="2">JP</th>
                <th colspan="2">Juli</th>
                <th colspan="2">Agustus</th>
                <th colspan="2">September</th>
              </tr>
              <tr style="background-color: #f8fafc; text-align: center; font-weight: bold;">
                <th>W1</th><th>W2</th><th>W1</th><th>W2</th><th>W1</th><th>W2</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          ${teacherSign}
        </div>`;
      }
      if (type === "analisis_kikd") {
        const rows = planList.map((p, idx) => {
          const cleanTopic = removeModulWord(p.topic || p.title || subjectName);
          return `
            <tr>
              <td style="text-align: center; border: 1px solid #000;">${idx + 1}</td>
              <td style="border: 1px solid #000;">Elemen Pemahaman ${subjectName}</td>
              <td style="border: 1px solid #000;">Peserta didik mampu menganalisis, mengidentifikasi, dan mempraktikkan ${cleanTopic}</td>
              <td style="border: 1px solid #000;"><b>${cleanTopic}</b><br>Konsep, Aplikasi, dan Analisis Kasus</td>
              <td style="border: 1px solid #000;">TP 1.${idx + 1}: Mengidentifikasi dan menjelaskan ${cleanTopic} dengan tepat</td>
            </tr>
          `;
        }).join("");
        return `<div style="font-family: Arial, sans-serif; color: #000; line-height: 1.5; font-size: 11pt; padding: 20px; background: #fff; max-width: 900px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
          <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">ANALISIS CP / KI-KD</h2>
          <h3 style="text-align: center; font-size: 11pt; font-weight: bold; margin-top: 0; margin-bottom: 20px;">PEMETAAN CAPAIAN DAN TUJUAN PEMBELAJARAN - ${subjectName.toUpperCase()}</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt;" border="1" cellpadding="6">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: center; font-weight: bold;">
                <th style="width: 5%;">No</th>
                <th style="width: 20%;">Elemen</th>
                <th style="width: 30%;">Capaian Pembelajaran (CP)</th>
                <th style="width: 25%;">Ruang Lingkup Materi</th>
                <th style="width: 20%;">Tujuan Pembelajaran (TP)</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          ${teacherSign}
        </div>`;
      }
      if (type === "tp") {
        const items = planList.map((p, idx) => {
          const cleanTopic = removeModulWord(p.topic || p.title || subjectName);
          return `
            <div style="margin-bottom: 20px; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; background-color: #f8fafc;">
              <h4 style="font-size: 11pt; font-weight: bold; color: #1e293b; margin-bottom: 6px;">Bab ${idx + 1}: ${cleanTopic}</h4>
              <p style="margin: 0 0 6px 0; font-size: 10pt;"><b>Rincian Tujuan Pembelajaran (TP):</b></p>
              <ul style="margin: 0; padding-left: 20px; font-size: 10pt;">
                <li>[C2 - Pemahaman] Menjelaskan secara rinci definisi dan karakteristik ${cleanTopic}.</li>
                <li>[C3 - Penerapan] Menerapkan konsep ${cleanTopic} dalam penyelesaian tugas kontekstual.</li>
                <li>[C4 - Analisis] Menganalisis perbedaan serta dampak dari ${cleanTopic} secara kritis.</li>
                <li>[A3 - Sikap] Menunjukkan sikap disiplin, santun, dan bertanggung jawab saat berdiskusi tentang ${cleanTopic}.</li>
              </ul>
            </div>
          `;
        }).join("");
        return `<div style="font-family: Arial, sans-serif; color: #000; line-height: 1.5; font-size: 11pt; padding: 20px; background: #fff; max-width: 900px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
          <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">RINCIAN TUJUAN PEMBELAJARAN (TP)</h2>
          <h3 style="text-align: center; font-size: 11pt; font-weight: bold; margin-top: 0; margin-bottom: 20px;">MATA PELAJARAN: ${subjectName.toUpperCase()} KELAS ${g}</h3>
          ${items}
          ${teacherSign}
        </div>`;
      }
      if (type === "cp") {
        const rows = planList.map((p, idx) => {
          const cleanTopic = removeModulWord(p.topic || p.title || subjectName);
          return `
            <tr>
              <td style="text-align: center; border: 1px solid #000;">${idx + 1}</td>
              <td style="border: 1px solid #000;">Elemen ${idx + 1}: ${cleanTopic}</td>
              <td style="border: 1px solid #000;">Pada akhir Fase ini, peserta didik memiliki kemampuan komprehensif untuk memahami, mengklasifikasi, dan mempraktikkan ${cleanTopic} dengan cermat, kritis, dan berakhlak mulia.</td>
            </tr>
          `;
        }).join("");
        return `<div style="font-family: Arial, sans-serif; color: #000; line-height: 1.5; font-size: 11pt; padding: 20px; background: #fff; max-width: 900px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
          <h2 style="text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">CAPAIAN PEMBELAJARAN (CP)</h2>
          <h3 style="text-align: center; font-size: 11pt; font-weight: bold; margin-top: 0; margin-bottom: 20px;">FASE D/E/F - ${subjectName.toUpperCase()}</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 10pt;" border="1" cellpadding="8">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: center; font-weight: bold;">
                <th style="width: 8%;">No</th>
                <th style="width: 30%;">Elemen Pembelajaran</th>
                <th style="width: 62%;">Deskripsi Capaian Pembelajaran (CP)</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          ${teacherSign}
        </div>`;
      }
      if (type === "lkpd") {
        return planList.map((p, idx) => {
          const cleanTopic = removeModulWord(p.topic || p.title || subjectName);
          return {
            id: `lkpd_${idx + 1}`,
            title: `LKPD Bab ${idx + 1}: ${cleanTopic}`,
            topic: cleanTopic,
            htmlContent: `<div style="font-family: Arial, sans-serif; color: #000; line-height: 1.5; font-size: 11pt; padding: 20px; background: #fff; max-width: 800px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px;">
              <div style="border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 15px; text-align: center;">
                <h2 style="font-size: 13pt; font-weight: bold; margin: 0;">LEMBAR KERJA PESERTA DIDIK (LKPD ${idx + 1})</h2>
                <h3 style="font-size: 11pt; font-weight: bold; margin: 4px 0 0 0;">${subjectName.toUpperCase()} - ${cleanTopic}</h3>
              </div>
              <table style="width: 100%; margin-bottom: 15px; font-size: 10pt; border: none;">
                <tr><td style="width: 15%; border:none;">Kelompok</td><td style="width: 35%; border:none;">: .......................................</td><td style="width: 15%; border:none;">Kelas</td><td style="width: 35%; border:none;">: ${g}</td></tr>
                <tr><td style="border:none;">Anggota</td><td style="border:none;">: 1. .................. 2. ..................</td><td style="border:none;">Tanggal</td><td style="border:none;">: .......................................</td></tr>
              </table>

              <div style="margin-bottom: 12px; background: #f8fafc; padding: 10px; border-left: 4px solid #0284c7;">
                <b>Petunjuk Pengerjaan:</b>
                <ol style="margin: 4px 0 0 16px; padding: 0;">
                  <li>Bacalah materi ringkas tentang <b>${cleanTopic}</b> dengan teliti.</li>
                  <li>Diskusikan pertanyaan di bawah ini bersama teman sekelompokmu.</li>
                  <li>Tuliskan hasil diskusi pada kolom jawaban yang tersedia.</li>
                </ol>
              </div>

              <div style="margin-bottom: 15px;">
                <b>A. STIMULUS & RINGKASAN MATERI</b>
                <p style="text-align: justify; text-indent: 20px; margin-top: 4px;">
                  Materi ${cleanTopic} mengajarkan kita pentingnya memahami konsep dasar serta prinsip penerapannya dalam kehidupan sehari-hari. Simak dan pelajari poin utama mengenai ${cleanTopic} untuk menjawab soal-soal berikut.
                </p>
              </div>

              <div style="margin-bottom: 15px;">
                <b>B. TUGAS & DISKUSI KELOMPOK</b>
                <ol style="margin-top: 6px; padding-left: 20px;">
                  <li style="margin-bottom: 12px;">
                    <b>Jelaskan pengertian dan konsep utama dari ${cleanTopic}!</b>
                    <div style="height: 60px; border: 1px dashed #94a3b8; border-radius: 4px; margin-top: 6px; background: #fafafa;"></div>
                  </li>
                  <li style="margin-bottom: 12px;">
                    <b>Sebutkan 3 contoh penerapan ${cleanTopic} dalam lingkungan sekitar kita!</b>
                    <div style="height: 60px; border: 1px dashed #94a3b8; border-radius: 4px; margin-top: 6px; background: #fafafa;"></div>
                  </li>
                  <li style="margin-bottom: 12px;">
                    <b>Analisis permasalahan yang sering terjadi terkait ${cleanTopic} dan berikan solusinya!</b>
                    <div style="height: 80px; border: 1px dashed #94a3b8; border-radius: 4px; margin-top: 6px; background: #fafafa;"></div>
                  </li>
                </ol>
              </div>

              <div style="margin-top: 20px;">
                <b>C. KESIMPULAN KELOMPOK</b>
                <div style="height: 60px; border: 1px solid #94a3b8; border-radius: 4px; margin-top: 6px; background: #fff;"></div>
              </div>

              ${teacherSign}
            </div>`
          };
        });
      }
      return `<div style="padding:20px;"><h3>Dokumen ${type} untuk ${subjectName}</h3></div>`;
    };
    let ai = null;
    if (apiKey) {
      try {
        ai = new import_genai.GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
      } catch (e) {
        console.warn("GoogleGenAI init failed:", e);
      }
    }
    let singleHtml = "";
    if (deviceType === "lkpd") {
      const fallbackList = buildDeviceFallback("lkpd", targetPlans);
      res.json({
        success: true,
        deviceType: "lkpd",
        items: fallbackList,
        count: fallbackList.length,
        htmlContent: fallbackList[0]?.htmlContent || ""
      });
      return;
    }
    const fallbackHtml = buildDeviceFallback(deviceType, targetPlans);
    if (ai) {
      try {
        const prompt = `Buatkan dokumen "${deviceType.toUpperCase()}" LENGKAP berstandar Kurikulum Merdeka untuk:
Mata Pelajaran: "${subjectName}"
Kelas/Tingkat: "${grade || "X"}"
Daftar Materi Pembelajaran:
${targetPlans.map((p, i) => `${i + 1}. ${removeModulWord(p.topic || p.title || subjectName)}`).join("\n")}

SANGAT PENTING:
- DILARANG MENULIS ATAU MENGGUNAKAN KATA "MODUL" ATAU "MODUL AJAR" di dalam dokumen! Gunakan kata "Bab" atau "Materi" atau langsung sebutkan judul materinya.
- Kembalikan format HTML rapi dengan tabel yang lengkap dan styling inline professional.
- Jangan gunakan markdown codeblock - kembalikan MURNI string HTML mentah saja!
TEMPLATE ACUAN:
${fallbackHtml}`;
        const response = await generateGeminiContent(ai, {
          model: "gemini-3.7-flash",
          contents: prompt,
          config: { responseMimeType: "text/plain" }
        });
        if (response && response.text) {
          singleHtml = response.text.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
        }
      } catch (e) {
        console.warn(`[Device Gen] Gemini generation for ${deviceType} failed, using template fallback.`, e?.message);
      }
    }
    if (!singleHtml) {
      singleHtml = fallbackHtml;
    }
    singleHtml = singleHtml.replace(/\bmodul\s*ajar\b/gi, "Materi").replace(/\bmodul\s*(\d+)/gi, "Bab $1").replace(/\bmodul\b/gi, "Materi").replace(/\bModul\b/g, "Materi");
    res.json({
      success: true,
      deviceType,
      items: [{ id: deviceType + "_1", title: deviceType.toUpperCase() + " " + subjectName, htmlContent: singleHtml }],
      count: 1,
      htmlContent: singleHtml
    });
  } catch (error) {
    console.error("Error generating device (using fallback):", error);
    const { deviceType = "Perangkat Pembelajaran", subjectName = "Mata Pelajaran" } = req.body || {};
    const fallbackHtml = `<div class="p-6 font-sans"><h2 class="text-xl font-bold text-center mb-4">${deviceType.toUpperCase()} (${subjectName})</h2><p>Perangkat pembelajaran resmi madrasah disusun komprehensif dan sistematis.</p></div>`;
    res.json({ success: true, count: 1, htmlContent: fallbackHtml, fallback: true });
  }
});
app.get("/api/generated-exams", (req, res) => {
  res.json({ success: true, generatedExams: filterByMadrasah(generatedExams, req) });
});
app.post("/api/generated-exams", async (req, res) => {
  const mId = getRequestMadrasahId(req);
  if (Array.isArray(req.body)) {
    const taggedIncoming = req.body.map((item) => tagNewRecord(item, req));
    let otherExams = [];
    if (mId && mId !== "default" && mId !== "BOSS") {
      const matchM = madrasahs.find((m) => String(m.id) === mId || String(m.slug) === mId);
      const targetId = matchM ? matchM.id : mId;
      const targetSlug = matchM ? matchM.slug : mId;
      otherExams = generatedExams.filter((e) => {
        const imId = String(e.madrasahId || "").trim();
        const imSlug = String(e.madrasahSlug || "").trim();
        if (!imId && !imSlug) return true;
        return imId !== targetId && imSlug !== targetSlug && imId !== targetSlug && imSlug !== targetId;
      });
    } else {
      const defaultM = madrasahs.find((m) => m.id === "default" || m.slug === "default") || madrasahs[0];
      const defId = defaultM ? defaultM.id : "default";
      const defSlug = defaultM ? defaultM.slug : "default";
      otherExams = generatedExams.filter((e) => {
        const imId = String(e.madrasahId || "default").trim();
        const imSlug = String(e.madrasahSlug || "default").trim();
        const isDefault = imId === "default" || imId === defId || imId === defSlug || imSlug === "default" || imSlug === defSlug || imSlug === defId || !e.madrasahId && !e.madrasahSlug;
        return !isDefault;
      });
    }
    generatedExams = [...otherExams, ...taggedIncoming];
  } else if (req.body && req.body.id) {
    const tagged = tagNewRecord(req.body, req);
    const idx = generatedExams.findIndex((e) => String(e.id) === String(req.body.id));
    if (idx >= 0) {
      generatedExams[idx] = { ...generatedExams[idx], ...tagged };
    } else {
      generatedExams.push(tagged);
    }
  }
  await saveData("generatedExams", generatedExams);
  res.json({ success: true, generatedExams: filterByMadrasah(generatedExams, req) });
});
app.delete("/api/generated-exams/:id", async (req, res) => {
  const { id } = req.params;
  generatedExams = generatedExams.filter((e) => String(e.id) !== String(id));
  await saveData("generatedExams", generatedExams);
  res.json({ success: true, generatedExams: filterByMadrasah(generatedExams, req) });
});
app.get("/api/settings", (req, res) => {
  const safeSettings = { ...appSettings || {} };
  ["adminPass", "password", "jwtSecret", "apiKey", "geminiApiKey", "cloudinaryApiSecret"].forEach((k) => delete safeSettings[k]);
  res.setHeader("Cache-Control", "no-store");
  res.json({ success: true, settings: safeSettings, isOfflineMode });
});
app.put("/api/settings", requireAuth, requireRole(["admin", "bos", "superadmin"]), async (req, res) => {
  appSettings = { ...appSettings, ...req.body };
  await saveData("settings", appSettings);
  res.json({ success: true, settings: appSettings });
});
app.get("/api/system/backup", (req, res) => {
  const backupData = {
    version: "1.0",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    schoolName: appSettings.schoolName || "Sekolah Menengah",
    students,
    teachers,
    classes,
    subjects,
    schedules,
    savedRosters,
    timeSlots,
    kbmDuration,
    attendance,
    teacherAttendance,
    questionBankGroups,
    questions,
    exams,
    rooms,
    journals,
    gradeCategories,
    generatedExams,
    lessonPlans,
    grades,
    settings: appSettings,
    schoolLocationSettings
  };
  res.setHeader("Content-Disposition", `attachment; filename=Backup_Data_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`);
  res.setHeader("Content-Type", "application/json");
  res.json(backupData);
});
app.post("/api/system/restore", async (req, res) => {
  try {
    let backup = req.body;
    if (!backup || typeof backup !== "object") {
      return res.status(400).json({ success: false, message: "Format file backup tidak valid." });
    }
    backup = await persistRestoredImageData(backup);
    const merged = await processSystemRestore(backup);
    res.json({ success: true, message: "Restore data sistem berhasil diproses!", merged });
  } catch (err) {
    res.status(500).json({ success: false, message: "Gagal merestore data: " + err.message });
  }
});
async function processSystemRestore(backup) {
  isRestoring = true;
  try {
    const getArr = (key, legacyKeys = []) => {
      if (Array.isArray(backup[key])) return backup[key];
      if (typeof backup[key] === "string") {
        try {
          const p = JSON.parse(backup[key]);
          if (Array.isArray(p)) return p;
        } catch (e) {
        }
      }
      for (const lk of legacyKeys) {
        if (Array.isArray(backup[lk])) return backup[lk];
        if (typeof backup[lk] === "string") {
          try {
            const p = JSON.parse(backup[lk]);
            if (Array.isArray(p)) return p;
          } catch (e) {
          }
        }
      }
      return null;
    };
    const getObj = (key, legacyKeys = []) => {
      if (backup[key] && typeof backup[key] === "object") return backup[key];
      if (typeof backup[key] === "string") {
        try {
          const p = JSON.parse(backup[key]);
          if (p && typeof p === "object") return p;
        } catch (e) {
        }
      }
      for (const lk of legacyKeys) {
        if (backup[lk] && typeof backup[lk] === "object") return backup[lk];
        if (typeof backup[lk] === "string") {
          try {
            const p = JSON.parse(backup[lk]);
            if (p && typeof p === "object") return p;
          } catch (e) {
          }
        }
      }
      return null;
    };
    const rCloudinaryMap = getObj("photoCloudinaryMap", ["madrasah_photoCloudinaryMap", "photoCloudinaryMap"]);
    if (rCloudinaryMap && typeof rCloudinaryMap === "object") {
      photoCloudinaryMap = { ...photoCloudinaryMap, ...rCloudinaryMap };
    }
    const rStudents = getArr("students", ["madrasah_students"]);
    if (rStudents) {
      for (let i = 0; i < rStudents.length; i++) {
        if (rStudents[i] && rStudents[i].photo && rStudents[i].photo.startsWith("data:image/")) {
          rStudents[i].photo = await saveBase64ToFirestore(rStudents[i].photo);
        }
      }
      const mergedStudents = [...students];
      for (const b of rStudents) {
        const bId = String(b.id || "").trim();
        const bNis = String(b.nis || "").trim();
        const bUsername = String(b.username || "").trim().toLowerCase();
        const bName = String(b.name || "").trim().toLowerCase();
        const existingIndex = mergedStudents.findIndex((s) => {
          const sId = String(s.id || "").trim();
          const sNis = String(s.nis || "").trim();
          const sUsername = String(s.username || "").trim().toLowerCase();
          const sName = String(s.name || "").trim().toLowerCase();
          if (bId && sId === bId) return true;
          if (bNis && sNis && sNis === bNis) return true;
          if (bUsername && sUsername && sUsername === bUsername) return true;
          if (bName && sName && sName === bName) return true;
          return false;
        });
        if (existingIndex >= 0) {
          const ext = mergedStudents[existingIndex];
          const merged = { ...ext, ...b };
          if (ext.photo && !b.photo) {
            merged.photo = ext.photo;
          }
          if (ext.no_hp && !b.no_hp) {
            merged.no_hp = ext.no_hp;
          }
          if (ext.role && !b.role) {
            merged.role = ext.role;
          }
          if (ext.classId && !b.classId) {
            merged.classId = ext.classId;
          }
          if (ext.password && String(ext.password) !== String(ext.nis) && (String(b.password) === String(b.nis) || !b.password)) {
            merged.password = ext.password;
          }
          mergedStudents[existingIndex] = merged;
        } else {
          mergedStudents.push(b);
        }
      }
      students = mergedStudents;
      await saveData("students", students);
    }
    const rTeachers = getArr("teachers", ["madrasah_teachers"]);
    if (rTeachers) {
      for (let i = 0; i < rTeachers.length; i++) {
        if (rTeachers[i] && rTeachers[i].photo && rTeachers[i].photo.startsWith("data:image/")) {
          rTeachers[i].photo = await saveBase64ToFirestore(rTeachers[i].photo);
        }
      }
      const mergedTeachers = [...teachers];
      for (const b of rTeachers) {
        const bId = String(b.id || "").trim();
        const bNip = String(b.nip || "").trim();
        const bUsername = String(b.username || "").trim().toLowerCase();
        const bName = String(b.name || "").trim().toLowerCase();
        const existingIndex = mergedTeachers.findIndex((t) => {
          const tId = String(t.id || "").trim();
          const tNip = String(t.nip || "").trim();
          const tUsername = String(t.username || "").trim().toLowerCase();
          const tName = String(t.name || "").trim().toLowerCase();
          if (bId && tId === bId) return true;
          if (bNip && tNip && tNip === bNip) return true;
          if (bUsername && tUsername && tUsername === bUsername) return true;
          if (bName && tName && tName === bName) return true;
          return false;
        });
        if (existingIndex >= 0) {
          const ext = mergedTeachers[existingIndex];
          const bAny = b;
          const merged = { ...ext, ...bAny };
          if (ext.photo && !bAny.photo) {
            merged.photo = ext.photo;
          }
          if (ext.role && !bAny.role) {
            merged.role = ext.role;
          }
          if (ext.mapel && ext.mapel.length > 0 && (!bAny.mapel || bAny.mapel.length === 0)) {
            merged.mapel = ext.mapel;
          }
          if (ext.password && String(ext.password) !== String(ext.nip) && (!bAny.password || String(bAny.password) === String(bAny.nip))) {
            merged.password = ext.password;
          }
          mergedTeachers[existingIndex] = merged;
        } else {
          mergedTeachers.push(b);
        }
      }
      teachers = mergedTeachers;
      await saveData("teachers", teachers);
    }
    const rClasses = getArr("classes", ["madrasah_classes"]);
    if (rClasses) {
      const mergedClasses = [...classes];
      for (const b of rClasses) {
        const bId = String(b.id || "").trim();
        const bName = String(b.name || "").trim().toLowerCase();
        const existingIndex = mergedClasses.findIndex((c) => {
          const cId = String(c.id || "").trim();
          const cName = String(c.name || "").trim().toLowerCase();
          if (bId && cId === bId) return true;
          if (bName && cName && cName === bName) return true;
          return false;
        });
        if (existingIndex >= 0) {
          const ext = mergedClasses[existingIndex];
          const merged = { ...ext, ...b };
          if (ext.homeroomTeacherId && !b.homeroomTeacherId && !b.homeroom_teacher_id) {
            merged.homeroomTeacherId = ext.homeroomTeacherId;
          }
          mergedClasses[existingIndex] = merged;
        } else {
          mergedClasses.push(b);
        }
      }
      classes = mergedClasses;
      await saveData("classes", classes);
    }
    const rSubjects = getArr("subjects", ["madrasah_subjects"]);
    if (rSubjects) {
      const mergedSubjects = [...subjects];
      for (const b of rSubjects) {
        const bId = String(b.id || "").trim();
        const bName = String(b.name || "").trim().toLowerCase();
        const bCode = String(b.code || "").trim().toLowerCase();
        const existingIndex = mergedSubjects.findIndex((s) => {
          const sId = String(s.id || "").trim();
          const sName = String(s.name || "").trim().toLowerCase();
          const sCode = String(s.code || "").trim().toLowerCase();
          if (bId && sId === bId) return true;
          if (bName && sName && sName === bName) return true;
          if (bCode && sCode && sCode === bCode) return true;
          return false;
        });
        if (existingIndex >= 0) {
          mergedSubjects[existingIndex] = { ...mergedSubjects[existingIndex], ...b };
        } else {
          mergedSubjects.push(b);
        }
      }
      subjects = mergedSubjects;
      await saveData("subjects", subjects);
    }
    const rSchedules = getArr("schedules", ["madrasah_schedules"]);
    if (rSchedules) {
      const mergedSchedules = [...schedules];
      for (const b of rSchedules) {
        const bId = String(b.id || "").trim();
        const bDay = String(b.day || "").trim().toLowerCase();
        const bClassId = String(b.classId || "").trim();
        const bSubjectId = String(b.subjectId || "").trim();
        const bTime = String(b.time || "").trim().toLowerCase();
        const existingIndex = mergedSchedules.findIndex((s) => {
          const sId = String(s.id || "").trim();
          const sDay = String(s.day || "").trim().toLowerCase();
          const sClassId = String(s.classId || "").trim();
          const sSubjectId = String(s.subjectId || "").trim();
          const sTime = String(s.time || "").trim().toLowerCase();
          if (bId && sId === bId) return true;
          if (bDay === sDay && bClassId === sClassId && bSubjectId === sSubjectId && bTime === sTime) return true;
          return false;
        });
        if (existingIndex >= 0) {
          mergedSchedules[existingIndex] = { ...mergedSchedules[existingIndex], ...b };
        } else {
          mergedSchedules.push(b);
        }
      }
      schedules = mergedSchedules;
      await saveData("schedules", schedules);
    }
    const rAttendance = getArr("attendance", ["madrasah_attendance"]);
    if (rAttendance) {
      for (let i = 0; i < rAttendance.length; i++) {
        if (rAttendance[i] && rAttendance[i].photo && rAttendance[i].photo.startsWith("data:image/")) {
          rAttendance[i].photo = await saveBase64ToFirestore(rAttendance[i].photo);
        }
      }
      const mergedAttendance = [...attendance];
      for (const b of rAttendance) {
        const bId = String(b.id || "").trim();
        const bStudentId = String(b.studentId || b.student_id || "").trim();
        const bDate = String(b.date || "").trim();
        const existingIndex = mergedAttendance.findIndex((a) => {
          const aId = String(a.id || "").trim();
          const aStudentId = String(a.studentId || a.student_id || "").trim();
          const aDate = String(a.date || "").trim();
          if (bId && aId === bId) return true;
          if (bStudentId && aStudentId && bStudentId === aStudentId && bDate === aDate) return true;
          return false;
        });
        if (existingIndex >= 0) {
          const ext = mergedAttendance[existingIndex];
          const merged = { ...ext };
          const extIsAbsen = ext.status && ext.status !== "BELUM ABSEN" && ext.status !== "BELUM_ABSEN" && ext.status !== "";
          const bIsAbsen = b.status && b.status !== "BELUM ABSEN" && b.status !== "BELUM_ABSEN" && b.status !== "";
          if (!extIsAbsen && bIsAbsen) {
            merged.status = b.status;
            if (b.photo) merged.photo = b.photo;
            if (b.location) merged.location = b.location;
            if (b.notes) merged.notes = b.notes;
            if (b.createdAt) merged.createdAt = b.createdAt;
          } else if (extIsAbsen) {
            merged.status = ext.status;
            if (ext.photo) {
              merged.photo = ext.photo;
            } else if (b.photo) {
              merged.photo = b.photo;
            }
            if (ext.location) {
              merged.location = ext.location;
            } else if (b.location) {
              merged.location = b.location;
            }
            if (ext.notes) {
              merged.notes = ext.notes;
            } else if (b.notes) {
              merged.notes = b.notes;
            }
            if (ext.createdAt) {
              merged.createdAt = ext.createdAt;
            } else if (b.createdAt) {
              merged.createdAt = b.createdAt;
            }
          }
          mergedAttendance[existingIndex] = merged;
        } else {
          mergedAttendance.push(b);
        }
      }
      attendance = mergedAttendance;
      await saveData("attendance", attendance);
    }
    const rTeacherAttendance = getArr("teacherAttendance", ["madrasah_teacher_attendance", "madrasah_teacherAttendance"]);
    if (rTeacherAttendance) {
      for (let i = 0; i < rTeacherAttendance.length; i++) {
        if (rTeacherAttendance[i] && rTeacherAttendance[i].photo && rTeacherAttendance[i].photo.startsWith("data:image/")) {
          rTeacherAttendance[i].photo = await saveBase64ToFirestore(rTeacherAttendance[i].photo);
        }
      }
      const mergedTeacherAttendance = [...teacherAttendance];
      for (const b of rTeacherAttendance) {
        const bId = String(b.id || "").trim();
        const bTeacherId = String(b.teacherId || b.teacher_id || "").trim();
        const bDate = String(b.date || "").trim();
        const existingIndex = mergedTeacherAttendance.findIndex((a) => {
          const aId = String(a.id || "").trim();
          const aTeacherId = String(a.teacherId || a.teacher_id || "").trim();
          const aDate = String(a.date || "").trim();
          if (bId && aId === bId) return true;
          if (bTeacherId && aTeacherId && bTeacherId === aTeacherId && bDate === aDate) return true;
          return false;
        });
        if (existingIndex >= 0) {
          const ext = mergedTeacherAttendance[existingIndex];
          const merged = { ...ext };
          const extIsAbsen = ext.status && ext.status !== "BELUM ABSEN" && ext.status !== "BELUM_ABSEN" && ext.status !== "";
          const bIsAbsen = b.status && b.status !== "BELUM ABSEN" && b.status !== "BELUM_ABSEN" && b.status !== "";
          if (!extIsAbsen && bIsAbsen) {
            merged.status = b.status;
            if (b.photo) merged.photo = b.photo;
            if (b.location) merged.location = b.location;
            if (b.notes) merged.notes = b.notes;
            if (b.createdAt) merged.createdAt = b.createdAt;
          } else if (extIsAbsen) {
            merged.status = ext.status;
            if (ext.photo) {
              merged.photo = ext.photo;
            } else if (b.photo) {
              merged.photo = b.photo;
            }
            if (ext.location) {
              merged.location = ext.location;
            } else if (b.location) {
              merged.location = b.location;
            }
            if (ext.notes) {
              merged.notes = ext.notes;
            } else if (b.notes) {
              merged.notes = b.notes;
            }
            if (ext.createdAt) {
              merged.createdAt = ext.createdAt;
            } else if (b.createdAt) {
              merged.createdAt = b.createdAt;
            }
          }
          mergedTeacherAttendance[existingIndex] = merged;
        } else {
          mergedTeacherAttendance.push(b);
        }
      }
      teacherAttendance = mergedTeacherAttendance;
      await saveData("teacherAttendance", teacherAttendance);
    }
    const rQuestionBankGroups = getArr("questionBankGroups", ["madrasah_questionBankGroups", "madrasah_question_groups"]);
    if (rQuestionBankGroups) {
      const mergedQuestionBankGroups = [...questionBankGroups];
      for (const b of rQuestionBankGroups) {
        const bId = String(b.id || "").trim();
        const bName = String(b.name || "").trim().toLowerCase();
        const existingIndex = mergedQuestionBankGroups.findIndex((g) => {
          const gId = String(g.id || "").trim();
          const gName = String(g.name || "").trim().toLowerCase();
          if (bId && gId === bId) return true;
          if (bName && gName && gName === bName) return true;
          return false;
        });
        if (existingIndex >= 0) {
          mergedQuestionBankGroups[existingIndex] = { ...mergedQuestionBankGroups[existingIndex], ...b };
        } else {
          mergedQuestionBankGroups.push(b);
        }
      }
      questionBankGroups = mergedQuestionBankGroups;
      await saveData("questionBankGroups", questionBankGroups);
    }
    const rQuestions = getArr("questions", ["madrasah_questions", "questionBank", "madrasah_questionBank"]);
    if (rQuestions) {
      const mergedQuestions = [...questions];
      for (const b of rQuestions) {
        const bId = String(b.id || "").trim();
        const bText = String(b.text || b.questionText || b.question || "").trim().toLowerCase();
        const existingIndex = mergedQuestions.findIndex((q) => {
          const qId = String(q.id || "").trim();
          const qText = String(q.text || q.questionText || q.question || "").trim().toLowerCase();
          if (bId && qId === bId) return true;
          if (bText && qText && qText === bText) return true;
          return false;
        });
        if (existingIndex >= 0) {
          mergedQuestions[existingIndex] = { ...mergedQuestions[existingIndex], ...b };
        } else {
          mergedQuestions.push(b);
        }
      }
      questions = mergedQuestions;
      await saveData("questions", questions);
    }
    const rExams = getArr("exams", ["madrasah_exams"]);
    if (rExams) {
      const mergedExams = [...exams];
      for (const b of rExams) {
        const bId = String(b.id || "").trim();
        const bTitle = String(b.title || b.name || "").trim().toLowerCase();
        const existingIndex = mergedExams.findIndex((e) => {
          const eId = String(e.id || "").trim();
          const eTitle = String(e.title || e.name || "").trim().toLowerCase();
          if (bId && eId === bId) return true;
          if (bTitle && eTitle && eTitle === bTitle) return true;
          return false;
        });
        if (existingIndex >= 0) {
          mergedExams[existingIndex] = { ...mergedExams[existingIndex], ...b };
        } else {
          mergedExams.push(b);
        }
      }
      exams = mergedExams;
      await saveData("exams", exams);
    }
    const rRooms = getArr("rooms", ["madrasah_rooms"]);
    if (rRooms) {
      const mergedRooms = [...rooms];
      for (const b of rRooms) {
        const bId = String(b.id || "").trim();
        const bName = String(b.name || "").trim().toLowerCase();
        const existingIndex = mergedRooms.findIndex((r) => {
          const rId = String(r.id || "").trim();
          const rName = String(r.name || "").trim().toLowerCase();
          if (bId && rId === bId) return true;
          if (bName && rName && rName === bName) return true;
          return false;
        });
        if (existingIndex >= 0) {
          mergedRooms[existingIndex] = { ...mergedRooms[existingIndex], ...b };
        } else {
          mergedRooms.push(b);
        }
      }
      rooms = mergedRooms;
      await saveData("rooms", rooms);
    }
    const rJournals = getArr("journals", ["madrasah_journals"]);
    if (rJournals) {
      const mergedJournals = [...journals];
      for (const b of rJournals) {
        const bId = String(b.id || "").trim();
        const existingIndex = mergedJournals.findIndex((j) => String(j.id || "").trim() === bId);
        if (existingIndex >= 0) {
          mergedJournals[existingIndex] = { ...mergedJournals[existingIndex], ...b };
        } else {
          mergedJournals.push(b);
        }
      }
      journals = mergedJournals;
      await saveData("journals", journals);
    }
    const rGradeCategories = getArr("gradeCategories", ["madrasah_grade_categories", "madrasah_gradeCategories"]);
    if (rGradeCategories) {
      const mergedGradeCategories = [...gradeCategories];
      for (const b of rGradeCategories) {
        const bId = String(b.id || "").trim();
        const bName = String(b.name || "").trim().toLowerCase();
        const existingIndex = mergedGradeCategories.findIndex((c) => {
          const cId = String(c.id || "").trim();
          const cName = String(c.name || "").trim().toLowerCase();
          if (bId && cId === bId) return true;
          if (bName && cName && cName === bName) return true;
          return false;
        });
        if (existingIndex >= 0) {
          mergedGradeCategories[existingIndex] = { ...mergedGradeCategories[existingIndex], ...b };
        } else {
          mergedGradeCategories.push(b);
        }
      }
      gradeCategories = mergedGradeCategories;
      await saveData("gradeCategories", gradeCategories);
    }
    const rGeneratedExams = getArr("generatedExams", ["madrasah_generated_exams", "madrasah_generatedExams"]);
    if (rGeneratedExams) {
      const mergedGeneratedExams = [...generatedExams];
      for (const b of rGeneratedExams) {
        const bId = String(b.id || "").trim();
        const existingIndex = mergedGeneratedExams.findIndex((e) => String(e.id || "").trim() === bId);
        if (existingIndex >= 0) {
          mergedGeneratedExams[existingIndex] = { ...mergedGeneratedExams[existingIndex], ...b };
        } else {
          mergedGeneratedExams.push(b);
        }
      }
      generatedExams = mergedGeneratedExams;
      await saveData("generatedExams", generatedExams);
    }
    const rLessonPlans = getArr("lessonPlans", ["madrasah_lessonPlans", "madrasah_lesson_plans"]);
    if (rLessonPlans) {
      const mergedLessonPlans = [...lessonPlans];
      for (const b of rLessonPlans) {
        const bId = String(b.id || "").trim();
        const existingIndex = mergedLessonPlans.findIndex((p) => String(p.id || "").trim() === bId);
        if (existingIndex >= 0) {
          mergedLessonPlans[existingIndex] = { ...mergedLessonPlans[existingIndex], ...b };
        } else {
          mergedLessonPlans.push(b);
        }
      }
      lessonPlans = mergedLessonPlans;
      await saveData("lessonPlans", lessonPlans);
    }
    const rGrades = getArr("grades", ["madrasah_grades"]);
    if (rGrades) {
      const mergedGrades = [...grades];
      for (const b of rGrades) {
        const bId = String(b.id || "").trim();
        const bClassId = String(b.classId || "").trim();
        const bStudentId = String(b.studentId || "").trim();
        const bSubjectName = String(b.subjectName || "").trim().toLowerCase();
        const bCategory = String(b.category || "").trim().toLowerCase();
        const existingIndex = mergedGrades.findIndex((g) => {
          const gId = String(g.id || "").trim();
          const gClassId = String(g.classId || "").trim();
          const gStudentId = String(g.studentId || "").trim();
          const gSubjectName = String(g.subjectName || "").trim().toLowerCase();
          const gCategory = String(g.category || "").trim().toLowerCase();
          if (bId && gId === bId) return true;
          if (bClassId === gClassId && bStudentId === gStudentId && bSubjectName === gSubjectName && bCategory === gCategory) return true;
          return false;
        });
        if (existingIndex >= 0) {
          mergedGrades[existingIndex] = { ...mergedGrades[existingIndex], ...b };
        } else {
          mergedGrades.push(b);
        }
      }
      grades = mergedGrades;
      await saveData("grades", grades);
    }
    const rSettings = getObj("settings", ["madrasah_settings"]);
    if (rSettings) {
      appSettings = { ...rSettings, ...appSettings };
      await saveData("settings", appSettings);
    }
    const rSchoolLocation = getObj("schoolLocationSettings", ["madrasah_schoolLocationSettings"]);
    if (rSchoolLocation) {
      schoolLocationSettings = { ...rSchoolLocation, ...schoolLocationSettings };
      await saveData("schoolLocationSettings", schoolLocationSettings);
    }
    const rCustomGradeColumns = getObj("customGradeColumns", ["madrasah_customGradeColumns"]);
    if (rCustomGradeColumns) {
      customGradeColumns = { ...rCustomGradeColumns, ...customGradeColumns };
      await saveData("customGradeColumns", customGradeColumns);
    }
  } finally {
    isRestoring = false;
    try {
      const store = readLocalStore();
      writeLocalStore(store);
      if (db) {
        const criticalKeys = ["students", "teachers", "admins", "classes", "subjects", "exams", "questions", "settings", "photoCloudinaryMap"];
        for (const key of criticalKeys) {
          if (store[key]) {
            saveKeyToFirestore(key, store[key]).catch(() => {
            });
          }
        }
      }
    } catch (e) {
    }
  }
  const hasKey = (key, legacyKeys = []) => {
    if (backup[key] !== void 0) return true;
    for (const lk of legacyKeys) {
      if (backup[lk] !== void 0) return true;
    }
    return false;
  };
  const batchToSave = [];
  if (hasKey("students", ["madrasah_students"])) batchToSave.push({ key: "students", value: students });
  if (hasKey("teachers", ["madrasah_teachers"])) batchToSave.push({ key: "teachers", value: teachers });
  if (hasKey("classes", ["madrasah_classes"])) batchToSave.push({ key: "classes", value: classes });
  if (hasKey("subjects", ["madrasah_subjects"])) batchToSave.push({ key: "subjects", value: subjects });
  if (hasKey("schedules", ["madrasah_schedules"])) batchToSave.push({ key: "schedules", value: schedules });
  if (hasKey("savedRosters", ["madrasah_savedRosters", "madrasah_saved_rosters"])) batchToSave.push({ key: "savedRosters", value: savedRosters });
  if (hasKey("timeSlots", ["madrasah_timeSlots", "madrasah_time_slots"])) batchToSave.push({ key: "timeSlots", value: timeSlots });
  if (hasKey("kbmDuration", ["madrasah_kbmDuration", "madrasah_kbm_duration"])) batchToSave.push({ key: "kbmDuration", value: kbmDuration });
  if (hasKey("attendance", ["madrasah_attendance"])) batchToSave.push({ key: "attendance", value: attendance });
  if (hasKey("teacherAttendance", ["madrasah_teacher_attendance", "madrasah_teacherAttendance"])) batchToSave.push({ key: "teacherAttendance", value: teacherAttendance });
  if (hasKey("questionBankGroups", ["madrasah_questionBankGroups", "madrasah_question_groups"])) batchToSave.push({ key: "questionBankGroups", value: questionBankGroups });
  if (hasKey("questions", ["madrasah_questions", "questionBank", "madrasah_questionBank"])) batchToSave.push({ key: "questions", value: questions });
  if (hasKey("exams", ["madrasah_exams"])) batchToSave.push({ key: "exams", value: exams });
  if (hasKey("rooms", ["madrasah_rooms"])) batchToSave.push({ key: "rooms", value: rooms });
  if (hasKey("journals", ["madrasah_journals"])) batchToSave.push({ key: "journals", value: journals });
  if (hasKey("gradeCategories", ["madrasah_grade_categories", "madrasah_gradeCategories"])) batchToSave.push({ key: "gradeCategories", value: gradeCategories });
  if (hasKey("customGradeColumns", ["madrasah_customGradeColumns"])) batchToSave.push({ key: "customGradeColumns", value: customGradeColumns });
  if (hasKey("generatedExams", ["madrasah_generated_exams", "madrasah_generatedExams"])) batchToSave.push({ key: "generatedExams", value: generatedExams });
  if (hasKey("lessonPlans", ["madrasah_lessonPlans", "madrasah_lesson_plans"])) batchToSave.push({ key: "lessonPlans", value: lessonPlans });
  if (hasKey("grades", ["madrasah_grades"])) batchToSave.push({ key: "grades", value: grades });
  if (hasKey("settings", ["madrasah_settings"])) batchToSave.push({ key: "settings", value: appSettings });
  if (hasKey("schoolLocationSettings", ["madrasah_schoolLocationSettings"])) batchToSave.push({ key: "schoolLocationSettings", value: schoolLocationSettings });
  batchToSave.push({ key: "photoCloudinaryMap", value: photoCloudinaryMap });
  if (batchToSave.length > 0) {
    await saveDataBatch(batchToSave);
  }
  syncAllPhotosToCloudinary().catch((err) => {
    console.warn("[Cloudinary Restore Sync Trigger Error]:", err);
  });
  return {
    students,
    teachers,
    classes,
    subjects,
    schedules,
    attendance,
    teacherAttendance,
    questionBankGroups,
    questions,
    exams,
    rooms,
    journals,
    gradeCategories,
    customGradeColumns,
    generatedExams,
    lessonPlans,
    grades,
    settings: appSettings,
    schoolLocationSettings
  };
}
var restoreChunks = {};
app.post("/api/system/restore/chunk", async (req, res) => {
  try {
    const { uploadId, chunkData, chunkIndex, totalChunks } = req.body;
    if (!uploadId || chunkData === void 0 || chunkIndex === void 0 || totalChunks === void 0) {
      return res.status(400).json({ success: false, message: "Invalid chunk payload" });
    }
    if (!restoreChunks[uploadId]) {
      restoreChunks[uploadId] = [];
    }
    restoreChunks[uploadId][chunkIndex] = chunkData;
    let received = 0;
    for (let i = 0; i < totalChunks; i++) {
      if (restoreChunks[uploadId][i] !== void 0) received++;
    }
    if (received === totalChunks) {
      const fullString = restoreChunks[uploadId].join("");
      delete restoreChunks[uploadId];
      const backup = JSON.parse(fullString);
      const merged = await processSystemRestore(backup);
      return res.json({ success: true, message: "Restore data sistem berhasil diproses (chunked)!", merged });
    }
    res.json({ success: true, message: `Chunk ${chunkIndex + 1}/${totalChunks} received` });
  } catch (err) {
    res.status(500).json({ success: false, message: "Gagal memproses chunk: " + err.message });
  }
});
app.post("/api/sync-state", async (req, res) => {
  try {
    let { key, data } = req.body;
    if (!key) return res.status(400).json({ success: false, message: "Key required" });
    if (key === "students" && Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        if (data[i] && data[i].photo && data[i].photo.startsWith("data:image/")) {
          data[i].photo = await saveBase64ToFirestore(data[i].photo);
        }
      }
    }
    if (key === "teachers" && Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        if (data[i] && data[i].photo && data[i].photo.startsWith("data:image/")) {
          data[i].photo = await saveBase64ToFirestore(data[i].photo);
        }
      }
    }
    if (key === "attendance" && Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        if (data[i] && data[i].photo && data[i].photo.startsWith("data:image/")) {
          data[i].photo = await saveBase64ToFirestore(data[i].photo);
        }
      }
    }
    if (key === "teacherAttendance" && Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        if (data[i] && data[i].photo && data[i].photo.startsWith("data:image/")) {
          data[i].photo = await saveBase64ToFirestore(data[i].photo);
        }
      }
    }
    if ((key === "questions" || key === "questionBank") && Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        if (data[i] && data[i].imageUrl && data[i].imageUrl.startsWith("data:image/")) {
          data[i].imageUrl = await saveBase64ToFirestore(data[i].imageUrl);
        }
      }
    }
    if (key === "teachers") {
      if (Array.isArray(data)) {
        const tMap = new Map(teachers.map((t) => [String(t.id), t]));
        const newTeachers = [];
        for (const item of data) {
          if (item && item.id != null) {
            const ext = tMap.get(String(item.id));
            newTeachers.push(ext ? { ...ext, ...item } : item);
          }
        }
        teachers = newTeachers;
      } else {
        teachers = data;
      }
      await saveData("teachers", teachers);
    } else if (key === "students") {
      if (Array.isArray(data)) {
        const sMap = new Map(students.map((s) => [String(s.id), s]));
        const newStudents = [];
        for (const item of data) {
          if (item && item.id != null) {
            const idStr = String(item.id);
            const ext = sMap.get(idStr);
            if (!ext) {
              newStudents.push(item);
            } else {
              const merged = { ...ext, ...item };
              if (ext.name && ext.name !== ext.nis && (item.name === item.nis || !item.name)) {
                merged.name = ext.name;
              }
              if (ext.no_hp && !item.no_hp) {
                merged.no_hp = ext.no_hp;
              }
              if (ext.photo && !item.photo) {
                merged.photo = ext.photo;
              }
              if (ext.password && String(ext.password) !== String(ext.nis) && (String(item.password) === String(item.nis) || !item.password)) {
                merged.password = ext.password;
              }
              newStudents.push(merged);
            }
          }
        }
        students = newStudents;
      } else {
        students = data;
      }
      await saveData("students", students);
    } else if (key === "classes") {
      if (Array.isArray(data)) {
        const cMap = new Map(classes.map((c) => [String(c.id), c]));
        const newClasses = [];
        for (const item of data) {
          if (item && item.id != null) {
            const ext = cMap.get(String(item.id));
            newClasses.push(ext ? { ...ext, ...item } : item);
          }
        }
        classes = newClasses;
      } else {
        classes = data;
      }
      await saveData("classes", classes);
    } else if (key === "subjects") {
      subjects = data;
      await saveData("subjects", subjects);
    } else if (key === "attendance") {
      if (Array.isArray(data)) {
        if (data.length === 0 && Array.isArray(attendance) && attendance.length > 0) {
        } else {
          const aMap = new Map((Array.isArray(attendance) ? attendance : []).map((a) => [String(a.id || `${a.studentId}_${a.date}_${a.subjectId || ""}`), a]));
          for (const item of data) {
            if (item) {
              const k = String(item.id || `${item.studentId}_${item.date}_${item.subjectId || ""}`);
              aMap.set(k, { ...aMap.get(k) || {}, ...item });
            }
          }
          attendance = Array.from(aMap.values());
        }
      } else if (data) {
        attendance = data;
      }
      await saveData("attendance", attendance);
    } else if (key === "teacherAttendance") {
      if (Array.isArray(data)) {
        if (data.length === 0 && Array.isArray(teacherAttendance) && teacherAttendance.length > 0) {
        } else {
          const tMap = new Map((Array.isArray(teacherAttendance) ? teacherAttendance : []).map((t) => [String(t.id || `${t.teacherId}_${t.date}`), t]));
          for (const item of data) {
            if (item) {
              const k = String(item.id || `${item.teacherId}_${item.date}`);
              tMap.set(k, { ...tMap.get(k) || {}, ...item });
            }
          }
          teacherAttendance = Array.from(tMap.values());
        }
      } else if (data) {
        teacherAttendance = data;
      }
      await saveData("teacherAttendance", teacherAttendance);
    } else if (key === "schedules") {
      schedules = mergeTenantListData(schedules, data, req);
      await saveData("schedules", schedules);
    } else if (key === "savedRosters") {
      savedRosters = mergeTenantListData(savedRosters, data, req);
      await saveData("savedRosters", savedRosters);
    } else if (key === "timeSlots") {
      timeSlots = mergeTenantListData(timeSlots, data, req);
      await saveData("timeSlots", timeSlots);
    } else if (key === "kbmDuration") {
      kbmDuration = data;
      await saveData("kbmDuration", kbmDuration);
    } else if (key === "questionBankGroups") {
      questionBankGroups = mergeTenantListData(questionBankGroups, data, req);
      await saveData("questionBankGroups", questionBankGroups);
    } else if (key === "questionBank" || key === "questions") {
      questions = mergeTenantListData(questions, data, req);
      await saveData("questions", questions);
    } else if (key === "exams") {
      exams = mergeTenantListData(exams, data, req);
      await saveData("exams", exams);
    } else if (key === "lkpdList") {
      lkpdList = mergeLkpdListDataSmart(lkpdList, data, req);
      await saveData("lkpdList", lkpdList);
    } else if (key === "rooms") {
      rooms = mergeTenantListData(rooms, data, req);
      await saveData("rooms", rooms);
    } else if (key === "journals") {
      journals = mergeTenantListData(journals, data, req);
      await saveData("journals", journals);
    } else if (key === "gradeCategories") {
      gradeCategories = mergeTenantListData(gradeCategories, data, req);
      await saveData("gradeCategories", gradeCategories);
    } else if (key === "calendarEvents") {
      calendarEvents = mergeTenantListData(calendarEvents, data, req);
      await saveData("calendarEvents", calendarEvents);
    } else if (key === "generatedExams") {
      generatedExams = mergeTenantListData(generatedExams, data, req);
      await saveData("generatedExams", generatedExams);
    } else if (key === "lessonPlans") {
      lessonPlans = mergeTenantListData(lessonPlans, data, req);
      await saveData("lessonPlans", lessonPlans);
    } else if (key === "grades") {
      grades = mergeTenantListData(grades, data, req);
      await saveData("grades", grades);
    } else if (key === "settings") {
      appSettings = data;
      await saveData("settings", appSettings);
    } else if (key === "schoolLocations" || key === "schoolLocationSettings") {
      schoolLocationSettings = data;
      await saveData("schoolLocationSettings", schoolLocationSettings);
    } else if (key === "childguardStatus") {
      if (typeof data === "object" && data !== null) {
        const now = Date.now();
        for (const [sKey, sStatus] of Object.entries(data)) {
          if (typeof sStatus === "object" && sStatus !== null) {
            sStatus.serverTime = now;
            sStatus.online = true;
          }
        }
        childguardStatus = { ...childguardStatus || {}, ...data };
        for (const [sKey, sStatus] of Object.entries(data)) {
          const cleanSKey = String(sKey).replace(/\D/g, "");
          const matchedStudent = (students || []).find(
            (s) => String(s.id) === String(sKey) || String(s.nis) === String(sKey) || cleanSKey !== "" && String(s.id).replace(/\D/g, "") === cleanSKey || cleanSKey !== "" && String(s.nis).replace(/\D/g, "") === cleanSKey
          );
          if (matchedStudent) {
            if (matchedStudent.id) childguardStatus[String(matchedStudent.id)] = sStatus;
            if (matchedStudent.nis) childguardStatus[String(matchedStudent.nis)] = sStatus;
          } else if (Array.isArray(students) && students.length === 1) {
            const first = students[0];
            if (first) {
              if (first.id) childguardStatus[String(first.id)] = sStatus;
              if (first.nis) childguardStatus[String(first.nis)] = sStatus;
            }
          }
        }
      } else {
        childguardStatus = data;
      }
      await saveData("childguardStatus", childguardStatus);
    } else {
      await saveData(key, data);
    }
    return res.json({ success: true, key });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
app.get("/api/realtime-stream", (req, res) => {
  const authUser = req.user || verifyRealtimeToken(String(req.query?.rt || ""));
  if (!authUser) return res.status(401).end();
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(`data: ${JSON.stringify({ type: "connected" })}

`);
  if (typeof res.flush === "function") {
    res.flush();
  }
  sseClients.push({ res, user: authUser });
  const pingInterval = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: "ping" })}

`);
      if (typeof res.flush === "function") {
        res.flush();
      }
    } catch (e) {
      clearInterval(pingInterval);
    }
  }, 25e3);
  req.on("close", () => {
    clearInterval(pingInterval);
    sseClients = sseClients.filter((c) => c.res !== res);
  });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: {
          ignored: (p) => p.includes("local_store.json") || p.includes("node_modules")
        }
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath, {
      etag: true,
      lastModified: true,
      setHeaders: (res, filePath) => {
        res.removeHeader("X-Frame-Options");
        res.setHeader("Content-Security-Policy", "frame-ancestors *");
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
      }
    }));
    app.get("*", (req, res) => {
      if (req.path.endsWith(".js") || req.path.endsWith(".css") || req.path.endsWith(".map")) {
        return res.status(404).send("Asset not found");
      }
      res.removeHeader("X-Frame-Options");
      res.setHeader("Content-Security-Policy", "frame-ancestors *");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  const server = app.listen(PORT, "0.0.0.0", 1024, () => {
    console.log(`
======================================================`);
    console.log(`  MADRASAH BISA CBT & MANAJEMEN SERVER SIAP`);
    console.log(`======================================================`);
    console.log(`  > Akses Lokal Laptop : http://localhost:${PORT}`);
    const ifaces = import_os.default.networkInterfaces();
    let hasLan = false;
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          console.log(`  > Akses HP Siswa (LAN/Wi-Fi): http://${iface.address}:${PORT}`);
          hasLan = true;
        }
      }
    }
    if (!hasLan) {
      console.log(`  > Akses Jaringan: http://0.0.0.0:${PORT}`);
    }
    console.log(`  > Connection Backlog: 1024 connections max`);
    console.log(`======================================================
`);
  });
  try {
    const { WebSocketServer } = await import("ws");
    const wss = new WebSocketServer({ server });
    const clients = wsClients;
    wss.on("connection", (ws) => {
      let registeredClientId = null;
      let registeredUser = null;
      ws.on("message", (message) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === "register") {
            const authUser = verifyAuthToken(String(data.token || ""));
            if (!authUser) {
              ws.close(4001, "Unauthorized");
              return;
            }
            const requestedClientId = String(data.clientId || "");
            const role = String(authUser.role || "").toLowerCase();
            const isStudent = ["student", "siswa", "class_leader", "ketua_kelas"].includes(role);
            const isStaff = ["teacher", "guru", "admin", "bos", "superadmin"].includes(role);
            if (isStudent && requestedClientId !== String(authUser.id)) {
              ws.close(4003, "Client identity mismatch");
              return;
            }
            if (requestedClientId === "admin" && !isStaff) {
              ws.close(4003, "Staff role required");
              return;
            }
            registeredUser = authUser;
            registeredClientId = requestedClientId || String(authUser.id);
            clients.set(registeredClientId, ws);
            console.log(`Signaling WS: authenticated client registered - ${registeredClientId}`);
          } else if (data.type === "signal") {
            if (!registeredUser || !registeredClientId) {
              ws.close(4001, "Register first");
              return;
            }
            const recipientId = String(data.recipientId || "");
            const signal = data.signal;
            if (!recipientId || signal === void 0) return;
            const role = String(registeredUser.role || "").toLowerCase();
            const isStudent = ["student", "siswa", "class_leader", "ketua_kelas"].includes(role);
            const isBoss = role === "bos" || role === "superadmin";
            if (isStudent && recipientId !== "admin") return;
            if (!isStudent && recipientId !== "admin" && !isBoss) {
              const targetStudent = (students || []).find((st) => String(st.id) === recipientId);
              if (targetStudent) {
                const targetTenant = String(targetStudent.madrasahId || targetStudent.tenant || "default");
                if (targetTenant !== String(registeredUser.madrasahId || "default")) return;
              }
            }
            const recipientWs = clients.get(recipientId);
            if (recipientWs && recipientWs.readyState === 1) {
              recipientWs.send(JSON.stringify({
                type: "signal",
                senderId: registeredClientId,
                signal
              }));
            }
          }
        } catch (e) {
          console.error("Signaling WS message error:", e);
        }
      });
      ws.on("close", () => {
        if (registeredClientId && clients.get(registeredClientId) === ws) {
          clients.delete(registeredClientId);
          console.log(`Signaling WS: Client disconnected - ${registeredClientId}`);
        }
      });
      ws.on("error", (err) => {
        console.error(`Signaling WS error for ${registeredClientId}:`, err);
      });
    });
    console.log("WebRTC WebSocket Signaling Server initialized successfully!");
  } catch (err) {
    console.error("Failed to start WebRTC WebSocket Signaling Server:", err);
  }
}
if (!process.env.VERCEL) {
  startServer();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  appExport
});
//# sourceMappingURL=server.cjs.map
