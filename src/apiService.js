const fetch = require("node-fetch");
const he = require('he');

// fetch the total number of verified trivia questions
const fetchTotalQuestions = async () => {
    try {
        const url = 'https://opentdb.com/api_count_global.php';
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Failed to connect to Open Trivia DB.");
        }

        const data = await response.json();

        return data.overall.total_num_of_verified_questions;
    } catch (err) {
        console.error("Error fetching total questions:", err.message);
        throw err;
    }
};

// fetch trivia questions from Open Trivia DB
const fetchTriviaQuestions = async (amount = 10, category = "", difficulty = "", type = "multiple") => {
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

module.exports = { fetchTriviaQuestions, fetchTotalQuestions };
