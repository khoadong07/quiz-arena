// ===================== IMPORT =====================
import { saveSettings } from "./state.js";

// ===================== DOM ELEMENTS =====================
const CategoryApi = "https://opentdb.com/api_category.php";
const categoryContainer = document.getElementById("category-questions");
const settingsForm = document.getElementById("settings-form"); // form element

// ===================== FETCH CATEGORIES =====================
const fetchCategory = async () => {
  const res = await fetch(CategoryApi);
  const data = await res.json();
  renderCategory(data.trivia_categories);
};
fetchCategory();

// ===================== RENDER CATEGORIES =====================
const renderCategory = (categories) => {
  categories.forEach((category) => {
    categoryContainer.innerHTML += `
            <option value="${category.id}">${category.name}</option>
        `;
  });
};

// ===================== FORM SUBMIT =====================
settingsForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const settingsObject = {};

  const formData = new FormData(settingsForm);
  formData.forEach((value, key) => {
    if (key === "amount" || key === "category" || key === "timer") {
      settingsObject[key] = parseInt(value);
    } else if (key === "difficulty") {
      settingsObject[key] = value;
    }
  });

  // ===================== SAVE SETTINGS =====================
  saveSettings(settingsObject);

  // ===================== REDIRECT =====================
  setTimeout(() => {
    window.location.href = "home.html";
  }, 1500);
});
