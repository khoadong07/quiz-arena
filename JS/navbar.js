const homeBtn = document.querySelector("#home");
const settingsBtn = document.querySelector("#settings");

homeBtn.addEventListener("click", () => {
  window.location.href = "home.html";
});

settingsBtn.addEventListener("click", () => {
  window.location.href = "settings.html";
});
