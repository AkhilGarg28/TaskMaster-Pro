// app.js - TaskMaster Pro Logic

// Initialize Supabase Client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Generate a unique Task ID (e.g., TM-1A2B3C)
 */
function generateTaskId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `TM-${timestamp}-${random}`;
}

// DOM Elements
const taskTitleInput = document.getElementById('taskTitle');
const taskDescInput = document.getElementById('taskDesc');
const taskCategorySelect = document.getElementById('taskCategory');

const submitTaskBtn = document.getElementById('submitTaskBtn');
const saveEditBtn = document.getElementById('saveEditBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const editTaskIdInput = document.getElementById('editTaskId');

const tasksContainer = document.getElementById('tasksContainer');
const loadingIndicator = document.getElementById('loadingIndicator');
const emptyState = document.getElementById('emptyState');

// State
let allTasks = [];
let currentUser = null;

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    // If not on dashboard (index.html), stop here
    if (!document.getElementById('tasksContainer')) {
        return;
    }

    const authOverlay = document.getElementById('authOverlay');

    // Check Authentication Session
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        // Redirect immediately - don't show any content
        localStorage.removeItem('taskmaster_user');
        window.location.href = 'login.html';
        return;
    }
    
    currentUser = session.user.email;
    
    // Session confirmed - hide overlay and show content
    if (authOverlay) {
        authOverlay.style.opacity = '0';
        setTimeout(() => {
            authOverlay.remove();
            document.body.style.overflow = '';
        }, 300);
    } else {
        document.body.style.overflow = '';
    }

    // Set UI 
    const welcomeText = document.getElementById('welcomeUserText');
    if(welcomeText) {
        const displayUser = currentUser.split('@')[0];
        welcomeText.textContent = `Logged in as: ${displayUser}`;
    }
    
    fetchTasks();
});

// Event Listeners
if (submitTaskBtn) submitTaskBtn.addEventListener('click', handleAddTask);
if (saveEditBtn) saveEditBtn.addEventListener('click', handleSaveEdit);
if (cancelEditBtn) cancelEditBtn.addEventListener('click', resetForm);

// Logout handling
const logoutBtn = document.getElementById('logoutBtn');
if(logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        localStorage.removeItem('taskmaster_user');
        window.location.href = 'login.html';
    });
}

/**
 * Fetch all tasks from Supabase
 */
async function fetchTasks() {
    showLoading(true);
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: todos, error } = await supabaseClient
            .from('todos')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        allTasks = todos.map(t => ({
            id: t.id,
            owner: t.owner_id,
            title: t.title,
            description: t.description,
            category: t.category,
            createdAt: t.created_at
        }));
        
        renderTasks();
    } catch (error) {
        console.error('Error fetching tasks:', error);
        alert('Could not load tasks. Please ensure Supabase tables are created.');
    } finally {
        showLoading(false);
    }
}

/**
 * Render tasks to the DOM
 */
function renderTasks() {
    tasksContainer.innerHTML = '';
    
    if (allTasks.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    // Sort tasks by creation date (newest first)
    const sortedTasks = [...allTasks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    sortedTasks.forEach(task => {
        // Format Date
        const dateObj = new Date(task.createdAt);
        const formattedDate = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        const taskElement = document.createElement('div');
        taskElement.className = 'task-item animate-in';
        taskElement.dataset.category = task.category;
        
        taskElement.innerHTML = `
            <div class="task-header">
                <div>
                    <div class="task-id-badge">${task.id}</div>
                    <div class="task-title">${escapeHTML(task.title)}</div>
                </div>
                <div class="task-actions">
                    <button class="btn-icon" onclick="prepareEdit('${task.id}')" title="Edit Task">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete" onclick="deleteTask('${task.id}')" title="Delete Task">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
            
            ${task.description ? `<div class="task-desc">${escapeHTML(task.description)}</div>` : ''}
            
            <div class="task-footer">
                <span class="task-badge">${getCategoryIcon(task.category)} ${task.category}</span>
                <span class="task-date">${formattedDate}</span>
            </div>
        `;
        
        tasksContainer.appendChild(taskElement);
    });
}

/**
 * Add a new task to Supabase
 */
async function handleAddTask() {
    const title = taskTitleInput.value.trim();
    const description = taskDescInput.value.trim();
    const category = taskCategorySelect.value;
    
    if (!title) {
        alert('Task Title is required!');
        taskTitleInput.focus();
        return;
    }
    
    setButtonLoading(submitTaskBtn, true, 'Adding...');
    
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const newTaskId = generateTaskId();
        const newTodoData = {
            id: newTaskId,
            title,
            description: description || '',
            category: category || 'General',
            owner_id: user.id
        };

        const { error } = await supabaseClient
            .from('todos')
            .insert([newTodoData]);
        
        if (error) throw error;
        
        const newTodo = {
            id: newTodoData.id,
            owner: newTodoData.owner_id,
            title: newTodoData.title,
            description: newTodoData.description,
            category: newTodoData.category,
            createdAt: new Date().toISOString()
        };

        allTasks.push(newTodo);
        
        resetForm();
        renderTasks();
    } catch (error) {
        console.error('Error adding task:', error);
        alert('Could not add task. Please try again.');
    } finally {
        setButtonLoading(submitTaskBtn, false, '<i class="fas fa-plus-circle"></i> Add Task');
    }
}

/**
 * Delete a task from Supabase
 */
async function deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('todos')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        // Remove from local state and re-render
        allTasks = allTasks.filter(t => t.id !== id);
        
        // If we were editing this task, reset the form.
        if (editTaskIdInput.value === id) {
            resetForm();
        }
        
        renderTasks();
    } catch (error) {
        console.error('Error deleting task:', error);
        alert('Could not delete task. Please try again.');
    }
}

/**
 * Load task data into the form for editing
 */
function prepareEdit(id) {
    const task = allTasks.find(t => t.id === id);
    if (!task) return;
    
    // Smooth scroll to top form
    document.getElementById('todoForm').scrollIntoView({ behavior: 'smooth' });
    
    // Populate form
    taskTitleInput.value = task.title;
    taskDescInput.value = task.description || '';
    taskCategorySelect.value = task.category;
    editTaskIdInput.value = task.id;
    
    // Toggle buttons
    submitTaskBtn.classList.add('hidden');
    saveEditBtn.classList.remove('hidden');
    cancelEditBtn.classList.remove('hidden');
    
    // Highlight input visually
    document.querySelectorAll('.input-card').forEach(card => card.style.borderColor = 'var(--accent-purple)');
}

/**
 * Save edited changes in Supabase
 */
async function handleSaveEdit() {
    const id = editTaskIdInput.value;
    const title = taskTitleInput.value.trim();
    const description = taskDescInput.value.trim();
    const category = taskCategorySelect.value;
    
    if (!id || !title) return;
    
    setButtonLoading(saveEditBtn, true, 'Saving...');
    
    try {
        const { error } = await supabaseClient
            .from('todos')
            .update({ title, description, category })
            .eq('id', id);
        
        if (error) throw error;
        
        // Update local state and re-render
        const index = allTasks.findIndex(t => t.id === id);
        if (index !== -1) {
            allTasks[index].title = title;
            allTasks[index].description = description;
            allTasks[index].category = category;
        }
        
        resetForm();
        renderTasks();
    } catch (error) {
        console.error('Error updating task:', error);
        alert('Could not update task. Please try again.');
    } finally {
        setButtonLoading(saveEditBtn, false, '<i class="fas fa-save"></i> Save Changes');
    }
}

/**
 * Reset Form Fields and UI State
 */
function resetForm() {
    taskTitleInput.value = '';
    taskDescInput.value = '';
    taskCategorySelect.value = 'General';
    editTaskIdInput.value = '';
    
    submitTaskBtn.classList.remove('hidden');
    saveEditBtn.classList.add('hidden');
    cancelEditBtn.classList.add('hidden');
    
    // Reset borders
    document.querySelectorAll('.input-card').forEach(card => card.style.borderColor = 'var(--card-border)');
}

/**
 * UI Helpers
 */
function showLoading(isLoading) {
    if (isLoading) {
        loadingIndicator.classList.remove('hidden');
        emptyState.classList.add('hidden');
        tasksContainer.innerHTML = '';
    } else {
        loadingIndicator.classList.add('hidden');
    }
}

function setButtonLoading(btnElement, isLoading, textContent) {
    btnElement.disabled = isLoading;
    btnElement.innerHTML = isLoading 
        ? `<i class="fas fa-spinner fa-spin"></i> ${textContent}` 
        : textContent;
}

function getCategoryIcon(category) {
    switch(category) {
        case 'Work': return '💼';
        case 'Personal': return '🏡';
        case 'Urgent': return '🔥';
        default: return '📌';
    }
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Password Reset Logic was moved directly to login.html to run serverless.
