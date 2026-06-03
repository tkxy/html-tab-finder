/* 同步注入主题，避免闪烁 */
(function() {
  try {
    const t = localStorage.getItem("theme");
    if (t === "dark" || t === "light") {
      document.documentElement.setAttribute("data-theme", t);
    }
  } catch {}
})();
