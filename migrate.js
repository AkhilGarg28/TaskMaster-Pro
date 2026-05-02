const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

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
const Todo = mongoose.model('Todo', todoSchema);

mongoose.connect('mongodb://localhost:27017/taskmaster').then(async () => {
    console.log('Connected to MongoDB');
    
    // Read old data
    const usersData = JSON.parse(fs.readFileSync(path.join(__dirname, 'users.json'), 'utf8'));
    const todosData = JSON.parse(fs.readFileSync(path.join(__dirname, 'database.json'), 'utf8'));

    // Migrate Users
    for (const u of usersData) {
        // Prevent dupes
        const existing = await User.findOne({ username: Object.values(u)[0] || u.username }); // Safe fallback
        if (!existing) {
            await User.create(u);
            console.log(`Migrated user: ${u.username}`);
        }
    }

    // Migrate Todos
    for (const t of todosData) { // database.json
        const existing = await Todo.findOne({ id: t.id });
        if (!existing) {
            await Todo.create(t);
            console.log(`Migrated todo: ${t.title}`);
        }
    }

    console.log('Migration complete. You can delete users.json and database.json safely later.');
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
