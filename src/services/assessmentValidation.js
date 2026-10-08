import { questionErrors } from "./questionImport.js";

export function publicationErrors(questions) {
  if (!questions.length) return [{ index: null, message: "Add at least one complete question before publishing." }];
  const errors = [];
  if (questions.length > 40) errors.push({ index: null, message: "Use at most 40 questions." });
  questions.forEach((question, index) => {
    for (const message of questionErrors(question)) errors.push({ index, message });
    if (question.importReview && !question.importReview.checked) errors.push({ index, message: "Check the imported question against the source and mark it reviewed." });
  });
  return errors;
}
