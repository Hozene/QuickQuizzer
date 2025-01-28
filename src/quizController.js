const { fetchTriviaQuestions } = require("./apiService");

// Controller function
const startQuiz = async (req, res) => {
    const { category, difficulty } = req.body;

    try {
        // Fetch questions from the API
        const questions = await fetchTriviaQuestions(10, category, difficulty);

        res.render("quiz", { questions });
    } catch (error) {
        // handle errors, render the index page with an error message
        res.render("index", { error: error.message });
    }
};

module.exports = { startQuiz };
