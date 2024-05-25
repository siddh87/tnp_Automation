const express = require('express');
const dbConnection = require('./src/db/conn');
const path = require('path');
const ejs = require('ejs');
const multer = require('multer');
const bcrypt = require('bcrypt');
const session = require('express-session');
const bodyParser = require('body-parser');
const JobPosting = require('./src/models/jobPosting');
const User = require('./src/models/user');
const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// Set EJS as the view engine
app.set('views', path.join(__dirname, '/templates/views'));
app.set('view engine', 'ejs');

// Middleware for session management
app.use(session({
    secret: 'harekrishnaharekrishnakrishnakrishnahareharehareramharereamramramharehare', // Change this to a strong secret
    resave: false,
    saveUninitialized: true
}));

// authorization
const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
      // User is authenticated, allow access to the next middleware or route handler
      next();
  } else {
      // User is not authenticated, redirect to login page
      res.redirect('/login');
  }
};

const restrictToUserType = (allowedUserTypes) => {
    return (req, res, next) => {
        const userType = req.session.userType;
        if (allowedUserTypes.includes(userType)) {
            // User is allowed to access this module, proceed to the next middleware or route handler
            next();
        } else {
            // User is not allowed to access this module, redirect to appropriate page or send 403 Forbidden status
            res.status(403).send(`You can't access this module because you're logged as a ${userType}`);
        }
    };
};

// Set up Multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads'); // Directory where uploaded files will be stored
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname); // Use original file name for uploaded file
    }
});

// Initialize Multer upload
const upload = multer({ storage: storage });

// Routes
// app.get('/', requireAuth, (req, res) => {
//     // Redirect to appropriate page based on user type
//     switch (req.session.userType) {
//         case 'student':
//             res.redirect('/student');
//             break;
//         case 'tnp':
//             res.redirect('/TnP');
//             break;
//         case 'recruiter':
//             res.redirect('/recruiter');
//             break;
//         case 'faculty':
//         case 'hod':
//             res.redirect('/department');
//             break;
//         default:
//             res.render('home', { loggedIn: true }); // Render the home page if userType is not recognized
//             break;
//     }
// });

// Home route
app.get('/', (req, res) => {
    res.render('home', { loggedIn: req.session.userId ? true : false });
});

// student route
app.get('/student', requireAuth, restrictToUserType(['student']), async (req, res) => {
    try {
        // Fetch job postings from the database
        const jobPostings = await JobPosting.find();

        // Fetch user data from the database based on the logged-in user ID
        const user = await User.findById(req.session.userId);
        console.log(user.profilePicture);
        // Pass the user data and job postings to the student.ejs view
        res.render('student', { user, jobPostings });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching data');
    }
});



// TnP route
app.get('/TnP', requireAuth, restrictToUserType(['tnp']), (req, res) => {
    res.render('TnP', { successMessage: req.session.successMessage });
    // Clear the session after using the success message
    req.session.successMessage = null;
});

// Department route
app.get('/department', requireAuth, restrictToUserType(['faculty', 'hod']), (req, res) => {
    res.render('department');
});

// Recruiter route
app.get('/recruiter', requireAuth, restrictToUserType(['recruiter']), (req, res) => {
    res.render('recruiter');
});

// Reset password route (GET request)
app.get('/reset', (req, res) => {
    res.render('reset');
});

// Login page route
app.get('/login', (req, res) => {
  const redirectToLogin = req.query.redirect === 'true';
  res.render('login', { redirectToLogin });
});

// Reset password route (POST request)
app.post('/reset', async (req, res) => {
    const { email, oldPassword, newPassword } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.send('Email not found');
        }
        const passwordMatch = await bcrypt.compare(oldPassword, user.password);
        if (!passwordMatch) {
            return res.send('Incorrect old password');
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();
        res.render('reset', { message: 'Password updated successfully' });
    } catch (error) {
        console.error("error aaya hia bhai " + error);
        res.send('Error resetting password');
    }
});

// Login route (POST request)
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
      const user = await User.findOne({ email });
      if (!user) {
          return res.send('Email not found');
      }
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
          return res.send('Incorrect password');
      }
      // Set up session
      req.session.userId = user._id;
      req.session.userType = user.userType;
      // Redirect to appropriate page based on user type
      switch (user.userType) {
        case 'student':
            res.redirect('/student');
            break;
        case 'tnp':
            res.redirect('/TnP');
            break;
        case 'recruiter':
            res.redirect('/recruiter');
            break;
        case 'faculty':
        case 'hod':
            res.redirect('/department');
            break;
        default:
            res.redirect('/');
            break;
    }
  } catch (error) {
      console.error(error);
      res.send('Error logging in');
  }
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
            return res.send('Error logging out');
        }
        res.redirect('/');
    });
});


// Now we are building the student module features 
app.get('/updateProfile', requireAuth, restrictToUserType(['student']), (req, res) => {
    res.render('updateProfile');
});

// Update profile route (POST request)
app.post('/update_profile', requireAuth, restrictToUserType(['student']), upload.single('profilePicture'), async (req, res) => {
    const userId = req.session.userId;
    const { name } = req.body;
    const profilePicture = req.file; // Assuming you're using multer for file uploads

    try {
        // Update user's name and profile picture in the database
        const updatedFields = {};
        if (name) {
            updatedFields.name = name;
        }
        if (profilePicture) {
            // Code to upload and save profile picture to the server or cloud storage
            updatedFields.profilePicture = '/uploads/' + profilePicture.filename; // Example: storing the file path
        }
        await User.findByIdAndUpdate(userId, updatedFields);

        res.redirect('/student'); // Redirect to student dashboard after updating profile
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

// job posting
app.post('/job_postings', async (req, res) => {
    try {
        const { companyName, profile, skillsRequired, eligibility, description, applyLink } = req.body;
        
        // Create a new job posting document
        const jobPosting = new JobPosting({
            companyName,
            profile,
            skillsRequired: skillsRequired.split(',').map(skill => skill.trim()), // Convert comma-separated skills to an array
            eligibility,
            description,
            applyLink
        });

        // Save the job posting to the database
        await jobPosting.save();
        res.render('TnP', { successMessage: 'Job posted successfully' }); // Render the same page with a success message
    } catch (error) {
        console.error(error);
        res.send('Error adding job posting');
    }
});


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
