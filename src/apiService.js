const fetch = require("node-fetch");
const he = require('he');

// fetch trivia questions from Open Trivia DB
const fetchTriviaQuestions = async (amount = 10, category = "", difficulty = "medium", type = "multiple") => {
    try {
        const url = `https://opentdb.com/api.php?amount=${amount}&category=${category}&difficulty=${difficulty}&type=${type}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Failed to connect to Open Trivia DB.");
        }

        const data = await response.json();

        if (data.response_code !== 0) {
            throw new Error("No questions available for the selected options. Please try again.");
        }

        // Decode HTML entities
        const decodedQuestions = data.results.map((question) => {
            question.question = he.decode(question.question); // Decode the question text
            question.correct_answer = he.decode(question.correct_answer); // Decode the correct answer text
            question.incorrect_answers = question.incorrect_answers.map(ans => he.decode(ans)); // Decode all incorrect answers
            return question;
        });

        return decodedQuestions; // Return decoded questions
    } catch (err) {
        console.error("Error fetching trivia questions:", err.message);
        throw err;
    }
};

module.exports = { fetchTriviaQuestions };
