// ===================== IMPORT =====================
import { fetchQuestions } from "./api.js";
import { showLoading, hideLoading } from "../ui.js";
import { loadSettings } from "./state.js";

document.addEventListener("DOMContentLoaded", () => {
    loadSettings();
    showLoading();
    fetchQuestions();
    hideLoading();
});
