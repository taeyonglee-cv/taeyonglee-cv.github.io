let currentLanguage = "en";
let translations = {};

// 1. 언어 감지 또는 localStorage에서 불러오기
function detectLanguage() {
  const saved = localStorage.getItem("lang");
  if (saved) return saved;

  const lang = navigator.language.slice(0, 2);
  if (["en", "ko", "fr"].includes(lang)) return lang;
  return "en";
}

// 2. 언어 로딩 + 저장 + 콜백 실행
function changeLanguage(lang, callback) {
  if (!["en", "ko", "fr"].includes(lang)) lang = "en";

  fetch(`./i18n/${lang}.json`)
    .then((res) => res.json())
    .then((data) => {
      translations = data;
      currentLanguage = lang;
      localStorage.setItem("lang", lang);
      if (typeof callback === "function") callback();
    })
    .catch(() => {
      console.error(`Failed to load ${lang}.json`);
    });
}
