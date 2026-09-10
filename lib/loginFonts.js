// Daftar font siap pakai untuk kustomisasi halaman login.
// `value` dipakai sebagai nama font-family & untuk membangun URL Google Fonts;
// dimuat secara dinamis di browser (bukan saat build), jadi tidak perlu koneksi
// internet saat proses build aplikasi.
export const LOGIN_FONTS = [
  { value: "Inter", label: "Inter (bersih, modern)" },
  { value: "Poppins", label: "Poppins (bulat, ramah)" },
  { value: "Montserrat", label: "Montserrat (tegas, elegan)" },
  { value: "Playfair Display", label: "Playfair Display (mewah, serif)" },
  { value: "Roboto", label: "Roboto (netral, standar)" },
  { value: "Lato", label: "Lato (hangat, mudah dibaca)" },
  { value: "Nunito", label: "Nunito (lembut, membulat)" },
  { value: "Raleway", label: "Raleway (tipis, minimalis)" },
  { value: "Merriweather", label: "Merriweather (klasik, serif)" },
  { value: "Quicksand", label: "Quicksand (santai, playful)" },
  { value: "Oswald", label: "Oswald (ramping, kuat)" },
  { value: "Pacifico", label: "Pacifico (tulisan tangan, ceria)" },
];

export const LOGIN_FONT_WEIGHTS = [
  { value: "400", label: "Normal (400)" },
  { value: "500", label: "Medium (500)" },
  { value: "600", label: "Semi Bold (600)" },
  { value: "700", label: "Bold (700)" },
  { value: "800", label: "Extra Bold (800)" },
];

export function googleFontHref(fontFamily) {
  const family = (fontFamily || "Inter").replace(/ /g, "+");
  return `https://fonts.googleapis.com/css2?family=${family}:wght@400;500;600;700;800&display=swap`;
}
