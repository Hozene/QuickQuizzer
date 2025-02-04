require("dotenv").config();
const express = require("express");
const session = require('express-session');
const path = require("path");
const quizController = require("./src/quizController");
const apiService = require("./src/apiService");
const { query } = require("./src/db");
const multer = require("multer");
const { BlobServiceClient } = require("@azure/storage-blob");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = "profile-pictures";
const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(containerName);

const categoryMap = {
    9: "General Knowledge",
    11: "Movies",
    12: "Music",
    15: "Video Games",
    17: "Science & Nature",
    18: "Computers"
};

// middleware
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,}));

// routes
app.get("/", async (req, res) => {
    console.log('Rendering index with:', {
        userID: req.session.userID,
        username: req.session.username
    }); // Debug data being passed
    res.render('index', {
        userID: req.session.userID || null,
        username: req.session.username || null,
        profilePicture: req.session.profilePicture || null,
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

app.post('/register', async (req, res) => {
    const { username, password, phone_number, email, profilePicture } = req.body;

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
        // Set default profile picture path
        const defaultProfilePicture = '/images/profile.png';

        // new user into the database
        const insertUserQuery = `
            INSERT INTO Users (username, password, phone_number, email, profile_picture_url)
            VALUES ('${username}', '${password}', '${phone_number}', '${email}', '${defaultProfilePicture}')
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
        const sqlQuery = `SELECT ID, username, profile_picture_url FROM Users WHERE username = '${username}' AND password = '${password}'`;
        const result = await query(sqlQuery);
        if (result.length > 0) {
            req.session.userID = result[0].ID;
            req.session.username = result[0].username;
            req.session.profilePicture = result[0].profile_picture_url || '/images/profile.png';
            res.redirect('/');
        } else {
            res.render('login', {
                error: 'Invalid username or password.',
                userID: null,
                username: null
            });
        }
    } catch (err) {
        res.render('login', {
            error: 'Login failed. Please try again.',
            userID: null,
            username: null
        });
    }
});

app.get('/register', (req, res) => {
    res.render('register', {
        userID: req.session.userID || null,
        error: null
    });
});

app.get('/profile', async (req, res) => {
    if (!req.session.userID) {
        return res.redirect('/login');
    }
    try {
        const totalQuestions = await apiService.fetchTotalQuestions();
        const profileQuery = `SELECT profile_picture_url FROM Users WHERE ID = ${req.session.userID}`;
        const profileData = await query(profileQuery);
        let profilePictureUrl = profileData[0]?.profile_picture_url;

        // unique questions answered by the user
        const userQuestionsQuery = `
            SELECT DISTINCT AnswerID, Category 
            FROM QuestionResults 
            WHERE UserID = ${req.session.userID}
        `;
        const userQuestions = await query(userQuestionsQuery);
        req.session.userQuestions = userQuestions;

        // progress
        const totalAnswered = userQuestions.length;
        const progressPercentage = ((totalAnswered / totalQuestions) * 100).toFixed(2);

        if (!profilePictureUrl) {
            profilePictureUrl = '/images/profile.png';
        }

        res.render('profile', {
            userID: req.session.userID,
            username: req.session.username,
            progressPercentage: progressPercentage,
            profilePicture: profilePictureUrl,  // Pass the profile picture URL to the template
            error: null
        });
    } catch (err) {
        console.error('Error loading profile:', err);
        res.render('profile', {
            userID: req.session.userID,
            username: req.session.username,
            profilePictureUrl: '/images/profile.png',
            progressPercentage: 0,
            error: 'Failed to load profile data.'
        });
    }
});

app.get("/userChartData", async (req, res) => {
    if (!req.session.userID) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const userQuestions = req.session.userQuestions;

        const categoryCounts = {};
        userQuestions.forEach((question) => {
            const categoryName = categoryMap[question.Category] || `Any Category ${question.Category}`;
            categoryCounts[categoryName] = (categoryCounts[categoryName] || 0) + 1;
        });

        const pieChartData = {
            labels: Object.keys(categoryCounts),
            datasets: [{
                data: Object.values(categoryCounts),
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF'
                ]
            }]
        };

        res.json(pieChartData);
    } catch (err) {
        console.error("Error loading chart data:", err);
        res.status(500).json({ error: "Failed to load chart data" });
    }
});

app.get('/settings', async (req, res) => {
    if (!req.session.userID) {
        return res.redirect('/login');
    }
    try {
        const userQuery = `SELECT email, phone_number FROM Users WHERE ID = ${req.session.userID}`;
        const userData = await query(userQuery);
        const { email, phone_number } = userData[0];

        res.render('settings', {
            userID: req.session.userID,
            username: req.session.username,
            profilePicture: req.session.profilePicture,
            email,
            phone_number,
            error: null
        });
    } catch (err) {
        console.error('Error loading settings:', err);
        res.render('settings', {
            userID: req.session.userID,
            username: req.session.username,
            profilePicture: req.session.profilePicture,
            error: 'Failed to load settings.'
        });
    }
});

app.post('/update-profile-picture', upload.single("profilePicture"), async (req, res) => {
    if (!req.session.userID) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const file = req.file;
    if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    try {
        const blobName = `${req.session.userID}-${uuidv4()}-${file.originalname}`;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        await blockBlobClient.uploadData(file.buffer, {
            blobHTTPHeaders: { blobContentType: file.mimetype }
        });

        const profilePictureUrl = blockBlobClient.url;

        const updateQuery = `UPDATE Users SET profile_picture_url = '${profilePictureUrl}' WHERE ID = ${req.session.userID}`;
        await query(updateQuery);

        req.session.profilePicture = profilePictureUrl;

        res.json({ success: true, profilePictureUrl });
    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ error: "Upload failed" });
    }
});

app.post('/update-email', async (req, res) => {
    if (!req.session.userID) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const { newEmail } = req.body;
    if (!newEmail) {
        return res.status(400).json({ error: "New email is required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
        return res.status(400).json({ error: "Invalid email format" });
    }

    try {
        const updateQuery = `UPDATE Users SET email = '${newEmail}' WHERE ID = ${req.session.userID}`;
        await query(updateQuery);

        res.json({ success: true, message: "Email updated successfully" });
    } catch (err) {
        console.error("Error updating email:", err);
        res.status(500).json({ error: "Failed to update email" });
    }
});

app.post('/update-phone', async (req, res) => {
    if (!req.session.userID) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const { newPhone } = req.body;
    if (!newPhone) {
        return res.status(400).json({ error: "New phone number is required" });
    }

    const phoneRegex = /^\+?[0-9\s()]{10,15}$/;
    if (!phoneRegex.test(newPhone)) {
        return res.status(400).json({ error: "Invalid phone number format" });
    }

    try {
        const updateQuery = `UPDATE Users SET phone_number = '${newPhone}' WHERE ID = ${req.session.userID}`;
        await query(updateQuery);

        res.json({ success: true, message: "Phone number updated successfully" });
    } catch (err) {
        console.error("Error updating phone number:", err);
        res.status(500).json({ error: "Failed to update phone number" });
    }
});

app.post('/update-password', async (req, res) => {
    if (!req.session.userID) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ error: "All fields are required" });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: "New password and confirmation do not match" });
    }

    try {
        const userQuery = `SELECT password FROM Users WHERE ID = ${req.session.userID}`;
        const userData = await query(userQuery);
        const storedPassword = userData[0].password;

        if (currentPassword !== storedPassword) {
            return res.status(400).json({ error: "Current password is incorrect" });
        }

        const updateQuery = `UPDATE Users SET password = '${newPassword}' WHERE ID = ${req.session.userID}`;
        await query(updateQuery);

        res.json({ success: true, message: "Password updated successfully" });
    } catch (err) {
        console.error("Error updating password:", err);
        res.status(500).json({ error: "Failed to update password" });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error destroying session:", err);
        }
        res.redirect('/');
    });
});

// start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
