// app.js - TaskMaster Pro Logic

const API_BASE_URL = 'http://localhost:3000/api/todos';

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
document.addEventListener('DOMContentLoaded', () => {
    // ---- Password Reset Logic for Login Page ----
    const resetForm = document.getElementById('resetForm');
    if (resetForm) {
        initPasswordResetLogic();
        return; // Stop here if on login page
    }

    // ---- Dashboard Logic ----
    // Check Authentication
    const savedUser = localStorage.getItem('taskmaster_user');
    if (!savedUser) {
        window.location.href = 'login.html';
        return;
    }
    
    currentUser = savedUser;
    
    // Set UI 
    const welcomeText = document.getElementById('welcomeUserText');
    if(welcomeText) welcomeText.textContent = `Logged in as: ${currentUser}`;
    
    fetchTasks();
});

// Event Listeners
if (submitTaskBtn) submitTaskBtn.addEventListener('click', handleAddTask);
if (saveEditBtn) saveEditBtn.addEventListener('click', handleSaveEdit);
if (cancelEditBtn) cancelEditBtn.addEventListener('click', resetForm);

// Logout handling
const logoutBtn = document.getElementById('logoutBtn');
if(logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('taskmaster_user');
        window.location.href = 'login.html';
    });
}

/**
 * Fetch all tasks from the API
 */
async function fetchTasks() {
    showLoading(true);
    try {
        const response = await fetch(API_BASE_URL, {
            headers: {
                'x-user-id': currentUser
            }
        });
        
        if (response.status === 401) {
            localStorage.removeItem('taskmaster_user');
            window.location.href = 'login.html';
            return;
        }
        
        if (!response.ok) throw new Error('Failed to fetch tasks');
        
        allTasks = await response.json();
        renderTasks();
    } catch (error) {
        console.error('Error fetching tasks:', error);
        alert('Could not load tasks. Make sure your local server is running.');
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
 * Add a new task
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
        const response = await fetch(API_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': currentUser
            },
            body: JSON.stringify({ title, description, category })
        });
        
        if (!response.ok) throw new Error('Failed to add task');
        
        const newTask = await response.json();
        allTasks.push(newTask);
        
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
 * Delete a task
 */
async function deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/${id}`, {
            method: 'DELETE',
            headers: {
                'x-user-id': currentUser
            }
        });
        
        if (!response.ok) throw new Error('Failed to delete task');
        
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
 * Save edited changes
 */
async function handleSaveEdit() {
    const id = editTaskIdInput.value;
    const title = taskTitleInput.value.trim();
    const description = taskDescInput.value.trim();
    const category = taskCategorySelect.value;
    
    if (!id || !title) return;
    
    setButtonLoading(saveEditBtn, true, 'Saving...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': currentUser
            },
            body: JSON.stringify({ title, description, category })
        });
        
        if (!response.ok) throw new Error('Failed to update task');
        
        const updatedTask = await response.json();
        
        // Update local state and re-render
        const index = allTasks.findIndex(t => t.id === id);
        if (index !== -1) {
            allTasks[index] = updatedTask;
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

/**
 * Password Reset UI Logic for login.html
 */
function initPasswordResetLogic() {
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    const backToLoginLink = document.getElementById('backToLoginLink');
    const authForm = document.getElementById('authForm');
    const resetForm = document.getElementById('resetForm');
    const authError = document.getElementById('authError');
    const formTitle = document.getElementById('formTitle');
    const formSubtitle = document.getElementById('formSubtitle');
    const toggleModeDiv = document.querySelector('.toggle-mode'); 
    
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            authForm.style.display = 'none';
            resetForm.style.display = 'block';
            toggleModeDiv.style.display = 'none';
            document.getElementById('forgotPasswordContainer').style.display = 'none';
            formTitle.textContent = 'Reset Password';
            formSubtitle.textContent = 'Enter your recovery key and a new password.';
            authError.classList.add('hidden');
        });
    }

    if (backToLoginLink) {
        backToLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            resetForm.style.display = 'none';
            authForm.style.display = 'block';
            toggleModeDiv.style.display = 'block';
            document.getElementById('forgotPasswordContainer').style.display = 'block';
            formTitle.textContent = 'Welcome Back';
            formSubtitle.textContent = 'Enter your credentials to access your personal workspace.';
            authError.classList.add('hidden');
        });
    }

    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('resetUsernameInput').value.trim();
            const recoveryKey = document.getElementById('resetRecoveryKeyInput').value.trim();
            const newPassword = document.getElementById('resetPasswordInput').value;
            const submitBtn = document.getElementById('resetSubmitBtn');
            const originalText = submitBtn.innerHTML;
            
            if (!username || !recoveryKey || !newPassword) return;
            
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            submitBtn.disabled = true;
            authError.classList.add('hidden');
            
            try {
                const response = await fetch('http://localhost:3000/api/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, recoveryKey, newPassword })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Password reset failed');
                }
                
                submitBtn.innerHTML = '<i class="fas fa-check"></i> Success!';
                submitBtn.classList.replace('btn-warning', 'btn-success');
                
                setTimeout(() => {
                    backToLoginLink.click();
                    submitBtn.innerHTML = originalText;
                    submitBtn.classList.replace('btn-success', 'btn-warning');
                    submitBtn.disabled = false;
                    resetForm.reset();
                }, 1500);
                
            } catch (error) {
                console.error(error);
                authError.textContent = error.message;
                authError.classList.remove('hidden');
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }
}
