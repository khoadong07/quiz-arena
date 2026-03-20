// ===================== IMPORT =====================
import { setQuestions, getSettings } from "./state.js";

// ===================== FETCH QUESTIONS =====================
export const fetchQuestions = async () => {
  try {
    const settings = getSettings();

    const questionsApi = `https://opentdb.com/api.php?amount=${settings.amount}&category=${settings.category}&difficulty=${settings.difficulty}&type=multiple`;
    const res = await fetch(questionsApi);
    const data = await res.json();

    // 5️⃣ Savollarni state ga saqlash
    setQuestions(data.results || []); 
  } catch (err) {
    console.error("API error:", err);
    setQuestions([]);
  }
};
