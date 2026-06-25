// migrate_to_supabase.js
// A helper script to migrate your local database.json tasks to Supabase.
// Run this using: node migrate_to_supabase.js

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function runMigration() {
    console.log('=== TaskMaster Pro Supabase Migration Helper ===\n');

    const dbPath = path.join(__dirname, 'database.json');
    if (!fs.existsSync(dbPath)) {
        console.error(`Error: database.json not found in ${__dirname}`);
        process.exit(1);
    }

    let supabaseUrlInput = (await question('Enter your Supabase Project URL (e.g. https://xxxx.supabase.co): ')).trim();
    const supabaseAnonKey = (await question('Enter your Supabase public anon key: ')).trim();
    const email = (await question('Enter your Supabase User Email: ')).trim();
    const password = await question('Enter your Supabase User Password: ');
    const localUsername = (await question('Enter your local username in database.json to migrate (e.g. akhilgarg): ')).trim();

    if (!supabaseUrlInput || !supabaseAnonKey || !email || !password || !localUsername) {
        console.error('\nError: All fields are required to proceed.');
        rl.close();
        process.exit(1);
    }

    // Clean up Supabase URL: strip trailing slashes and /rest/v1 suffix if present
    let supabaseUrl = supabaseUrlInput.replace(/\/+$/, "");
    if (supabaseUrl.endsWith('/rest/v1')) {
        supabaseUrl = supabaseUrl.slice(0, -8);
    }
    supabaseUrl = supabaseUrl.replace(/\/+$/, "");

    console.log('\nAuthenticating with Supabase...');
    
    try {
        // Authenticate with Supabase Auth API
        const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
                'apikey': supabaseAnonKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (!authResponse.ok) {
            const errData = await authResponse.json();
            throw new Error(errData.error_description || errData.error || 'Authentication failed');
        }

        const authData = await authResponse.json();
        const jwtToken = authData.access_token;
        const ownerId = authData.user.id;

        console.log(`Successfully authenticated! User ID: ${ownerId}`);

        // Read local database.json
        const fileContent = fs.readFileSync(dbPath, 'utf8');
        const todos = JSON.parse(fileContent);

        // Filter todos belonging to the local username
        const userTodos = todos.filter(t => t.owner === localUsername || t.owner.toLowerCase() === localUsername.toLowerCase());

        if (userTodos.length === 0) {
            console.log(`\nNo tasks found for local username "${localUsername}" in database.json.`);
            rl.close();
            process.exit(0);
        }

        console.log(`\nFound ${userTodos.length} tasks for "${localUsername}". Starting migration...`);

        let migratedCount = 0;
        for (const todo of userTodos) {
            console.log(`Migrating task: "${todo.title}"...`);

            const payload = {
                id: todo.id,
                owner_id: ownerId,
                title: todo.title,
                description: todo.description || '',
                category: todo.category || 'General',
                created_at: todo.createdAt || new Date().toISOString()
            };

            const insertResponse = await fetch(`${supabaseUrl}/rest/v1/todos`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseAnonKey,
                    'Authorization': `Bearer ${jwtToken}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(payload)
            });

            if (!insertResponse.ok) {
                const errText = await insertResponse.text();
                console.error(`Failed to migrate task "${todo.title}": ${errText}`);
            } else {
                migratedCount++;
            }
        }

        console.log(`\n=== Migration Completed! ===`);
        console.log(`Successfully migrated ${migratedCount} of ${userTodos.length} tasks.`);
        
    } catch (error) {
        console.error(`\nMigration failed: ${error.message}`);
    } finally {
        rl.close();
    }
}

runMigration();
