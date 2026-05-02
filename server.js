const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


mongoose.connect('mongodb://localhost:27017/taskmaster').then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));


const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    recoveryKeyHash: { type: String },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

const todoSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    owner: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    category: { type: String, default: 'General' },
    createdAt: { type: Date, default: Date.now }
});

// Remove Mongoose internal _id / __v when returning JSON
todoSchema.set('toJSON', {
    transform: (document, returnedObject) => {
        delete returnedObject._id;
        delete returnedObject.__v;
    }
});

const Todo = mongoose.model('Todo', todoSchema);

// Function to generate a random 8-character alphanumeric task ID
function generateTaskId() {
    return 'TSK-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

// Middleware to get current user from header
function requireUser(req, res, next) {
    const userId = req.headers['x-user-id'];
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: Missing User ID string' });
    }
    req.userId = userId;
    next();
}

// POST a new user registration route
app.post('/api/register', async (req, res) => {
    const { username, password, recoveryKey } = req.body;
    
    if (!username || username.trim() === '' || !password || password.trim() === '' || !recoveryKey || recoveryKey.trim() === '') {
        return res.status(400).json({ error: 'Username, password, and recovery key are required' });
    }
    
    const trimmedUser = username.trim();
    const trimmedKey = recoveryKey.trim();
    
    try {
        const existingUser = await User.findOne({ username: { $regex: new RegExp('^' + trimmedUser + '$', 'i') } });
        if (existingUser) {
            return res.status(409).json({ error: 'Username is already taken' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const recoveryKeyHash = await bcrypt.hash(trimmedKey, 10);
        
        const newUser = new User({
            username: trimmedUser,
            passwordHash: hashedPassword,
            recoveryKeyHash: recoveryKeyHash
        });
        
        await newUser.save();
        
        res.status(201).json({ message: 'User registered successfully', token: trimmedUser, username: trimmedUser });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST a user login session
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    
    try {
        const user = await User.findOne({ username: { $regex: new RegExp('^' + username.trim() + '$', 'i') } });
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        
        if (!isMatch) {
             return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        res.json({ token: user.username, username: user.username });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST password reset
app.post('/api/reset-password', async (req, res) => {
    const { username, recoveryKey, newPassword } = req.body;

    if (!username || !recoveryKey || !newPassword) {
        return res.status(400).json({ error: 'Username, recovery key, and new password are required' });
    }

    try {
        const user = await User.findOne({ username: { $regex: new RegExp('^' + username.trim() + '$', 'i') } });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.recoveryKeyHash) {
            return res.status(400).json({ error: 'No recovery key set for this user' });
        }

        const isMatch = await bcrypt.compare(recoveryKey.trim(), user.recoveryKeyHash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid recovery key' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.passwordHash = hashedPassword;

        await user.save();

        res.json({ message: 'Password reset successfully' });
    } catch(err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET all items for the user
app.get('/api/todos', requireUser, async (req, res) => {
    try {
        const userTodos = await Todo.find({ owner: req.userId });
        res.json(userTodos);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST a new item
app.post('/api/todos', requireUser, async (req, res) => {
    const { title, description, category } = req.body;
    
    if (!title) {
        return res.status(400).json({ error: 'Title is required' });
    }

    try {
        const newTodo = new Todo({
            id: generateTaskId(),
            owner: req.userId,
            title,
            description: description || '',
            category: category || 'General'
        });
        
        await newTodo.save();
        
        res.status(201).json(newTodo);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT (Update) an existing item
app.put('/api/todos/:id', requireUser, async (req, res) => {
    const id = req.params.id;
    const { title, description, category } = req.body;
    
    try {
        const todo = await Todo.findOne({ id: id, owner: req.userId });
        
        if (!todo) {
            return res.status(404).json({ error: 'Todo item not found' });
        }
        
        if (title !== undefined) todo.title = title;
        if (description !== undefined) todo.description = description;
        if (category !== undefined) todo.category = category;
        
        await todo.save();
        
        res.json(todo);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE an item
app.delete('/api/todos/:id', requireUser, async (req, res) => {
    const id = req.params.id;
    
    try {
        const result = await Todo.deleteOne({ id: id, owner: req.userId });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Todo item not found or unauthorized' });
        }
        
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
