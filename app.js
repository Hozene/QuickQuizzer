require("dotenv").config();
const express = require("express");
const session = require('express-session');
const path = require("path");
const quizController = require("./src/quizController");
const { query } = require("./src/db");

const app = express();
const PORT = process.env.PORT || 3000;

// middleware
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
}));

// routes
app.get("/", async (req, res) => {
    console.log('Rendering index with:', {
        userID: req.session.userID,
        username: req.session.username
    }); // Debug data being passed
    res.render('index', {
        userID: req.session.userID || null,
        username: req.session.username || null,
        error: null
    });
});

app.post("/quiz", quizController.startQuiz);

app.post("/results", quizController.submitQuiz);

app.get('/login', (req, res) => {
    res.render('login', {
        userID: req.session.userID || null,
        error: null
    });
});

app.get('/register', (req, res) => {
    res.render('register', {
        userID: req.session.userID || null,
        error: null
    });
});

app.get('/profile', (req, res) => {
    if (!req.session.userID) {
        return res.redirect('/login');
    }
    res.render('profile', {
        userID: req.session.userID,
        username: req.session.username,
        error: null
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error destroying session:", err);
        }
        res.redirect('/');
    });
});

app.post('/register', async (req, res) => {
    const { username, password, phone_number, email } = req.body;

    // basic validation
    if (!username || !password || !phone_number || !email) {
        return res.render('register', {
            error: 'All fields are required.',
            userID: req.session.userID || null
        });
    }

    // check if username already exists
    try {
        const checkUsernameQuery = `SELECT ID FROM Users WHERE username = '${username}'`;
        const usernameResult = await query(checkUsernameQuery);
        if (usernameResult.length > 0) {
            return res.render('register', {
                error: 'Username already exists. Please choose a different username.',
                userID: req.session.userID || null
            });
        }
        // phone number format
        const phoneRegex = /^\+?[0-9\s()]{10,15}$/;
        if (!phoneRegex.test(phone_number)) {
            return res.render('register', {
                error: 'Invalid phone number format. Only digits, +, (), and spaces are allowed.',
                userID: req.session.userID || null
            });
        }

        // email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.render('register', {
                error: 'Invalid email format.',
                userID: req.session.userID || null
            });
        }

        // new user into the database
        const insertUserQuery = `
            INSERT INTO Users (username, password, phone_number, email)
            VALUES ('${username}', '${password}', '${phone_number}', '${email}')
        `;
        await query(insertUserQuery);
        res.redirect('/login');
    } catch (err) {
        console.error('Registration error:', err);
        res.render('register', {
            error: 'Registration failed. Please try again.',
            userID: req.session.userID || null
        });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const sqlQuery = `SELECT ID, username FROM Users WHERE username = '${username}' AND password = '${password}'`;
        const result = await query(sqlQuery);
        if (result.length > 0) {
            req.session.userID = result[0].ID;
            req.session.username = result[0].username;
            res.redirect('/');
        } else {
            res.render('index', {
                error: 'Invalid username or password.',
                userID: null,
                username: null
            });
        }
    } catch (err) {
        res.render('index', {
            error: 'Login failed. Please try again.',
            userID: null,
            username: null
        });
    }
});

// start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
