// client.js
// This script contains the TodosApp class, which handles all client-side logic
// for the todo application, including authentication, API calls, and UI rendering.

class TodosApp {
    constructor() {
        // --- Auth elements ---
        this.authContainer = document.getElementById('auth-container');
        this.appContainer = document.getElementById('app-container');
        this.loginForm = document.getElementById('loginForm');
        this.registerForm = document.getElementById('registerForm');
        this.logoutBtn = document.getElementById('logout-btn');
        this.showRegisterLink = document.getElementById('show-register');
        this.showLoginLink = document.getElementById('show-login');
        this.loginFormContainer = document.getElementById('login-form-container');
        this.registerFormContainer = document.getElementById('register-form-container');

        // --- Todo elements ---
        this.addTodoForm = document.getElementById('addTodoForm');
        this.todoInput = document.getElementById('todo-input');
        this.todosList = document.getElementById('todosList');
        this.inProgressList = document.getElementById('inProgressList');
        this.completedList = document.getElementById('completedList');
        this.todosCount = document.getElementById('todosCount');
        this.inProgressCount = document.getElementById('inProgressCount');
        this.completedCount = document.getElementById('completedCount');

        // --- Todo Modal ---
        this.todoModal = document.getElementById('todo-modal');
        this.modalTitle = document.getElementById('modal-title');
        this.modalDetails = document.getElementById('modal-details');

        // --- Password Change Modals ---
        this.passwordChangeModal = document.getElementById('password-change-modal');
        this.passwordChangeForm = document.getElementById('password-change-form');
        this.newPasswordInput = document.getElementById('new-password');
        this.passwordChangeSuccessModal = document.getElementById('password-change-success-modal');
        this.passwordChangeSuccessOkBtn = document.getElementById('password-change-success-ok-btn');

        // --- Close buttons ---
        if (this.todoModal) {
            const todoCloseBtn = this.todoModal.querySelector('.close-btn');
            if (todoCloseBtn) todoCloseBtn.addEventListener('click', () => this.hideTodoModal());
        }

        if (this.passwordChangeModal) {
            const passwordCloseBtn = this.passwordChangeModal.querySelector('.close-btn');
            if (passwordCloseBtn) passwordCloseBtn.addEventListener('click', () => this.passwordChangeModal.style.display = 'none');
        }

        if (this.passwordChangeSuccessOkBtn) {
            this.passwordChangeSuccessOkBtn.addEventListener('click', () => this.hidePasswordChangeSuccessModal());
        }

        // --- Window click to close modals ---
        window.addEventListener('click', (e) => {
            if (e.target === this.todoModal) this.hideTodoModal();
            if (e.target === this.passwordChangeModal) this.passwordChangeModal.style.display = 'none';
            if (e.target === this.passwordChangeSuccessModal) this.passwordChangeSuccessModal.style.display = 'none';
        });

        // --- App state ---
        this.token = null;
        this.tempToken = null;
        this.todos = [];

        // Initialize the app
        this.init();
    }

    async init() {
        this.token = localStorage.getItem('token');

        // Auth event listeners
        if (this.loginForm) this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        if (this.registerForm) this.registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        if (this.logoutBtn) this.logoutBtn.addEventListener('click', () => this.handleLogout());
        if (this.showRegisterLink) this.showRegisterLink.addEventListener('click', () => this.toggleAuthForms(false));
        if (this.showLoginLink) this.showLoginLink.addEventListener('click', () => this.toggleAuthForms(true));

        // Todo event listeners
        if (this.addTodoForm) this.addTodoForm.addEventListener('submit', (e) => this.handleAddTodo(e));

        // Password change form
        if (this.passwordChangeForm) this.passwordChangeForm.addEventListener('submit', (e) => this.handleChangePassword(e));

        // Load todos if token exists
        if (this.token) {
            await this.loadTodos();
        } else {
            this.updateUI();
        }
    }

    // --- Auth methods ---
    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value.trim();

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const errorData = await response.json();
                if (errorData.passwordExpired && errorData.tempToken) {
                    this.tempToken = errorData.tempToken;
                    this.showPasswordChangeModal();
                } else {
                    alert(`Login failed: ${errorData.error || 'Unknown error'}`);
                }
                return;
            }

            const data = await response.json();
            const { token } = data;
            localStorage.setItem('token', token);
            this.token = token;
            this.updateUI();
            await this.loadTodos();

        } catch (error) {
            console.error('Login failed:', error);
            alert('An error occurred during login.');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value.trim();

        if (username.length < 3) {
            alert('Username must be at least 3 characters long.');
            return;
        }
        if (password.length < 6) {
            alert('Password must be at least 6 characters long.');
            return;
        }

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const errorData = await response.json();
                alert(`Registration failed: ${errorData.error || 'Unknown error'}`);
                return;
            }

            alert('Registration successful! Please log in.');
            this.toggleAuthForms(true);
            this.registerForm.reset();

        } catch (error) {
            console.error('Registration network error:', error);
            alert('An error occurred during registration.');
        }
    }

    handleLogout() {
        localStorage.removeItem('token');
        this.token = null;
        this.todos = [];
        this.updateUI();
    }

    toggleAuthForms(showLogin) {
        this.loginFormContainer.style.display = showLogin ? 'block' : 'none';
        this.registerFormContainer.style.display = showLogin ? 'none' : 'block';
    }

    updateUI() {
        if (this.token) {
            this.authContainer.style.display = 'none';
            this.appContainer.style.display = 'block';
        } else {
            this.authContainer.style.display = 'block';
            this.appContainer.style.display = 'none';
        }
    }

    // --- Password Change methods ---
    showPasswordChangeModal() {
        if (this.passwordChangeModal) {
            if (this.passwordChangeForm) this.passwordChangeForm.reset();
            this.passwordChangeModal.style.display = 'block';
            
            // Disable background scrolling
            document.body.classList.add('modal-open');

            // Focus input after a short delay to ensure it's visible
            setTimeout(() => {
                if (this.newPasswordInput) this.newPasswordInput.focus();
            }, 50);
        }
    }


    async handleChangePassword(e) {
        e.preventDefault();
        const newPassword = this.newPasswordInput.value.trim();
        const tokenToUse = this.tempToken || this.token;

        if (newPassword.length < 8) {
            alert('Password must be at least 8 characters long.');
            return;
        }

        try {
            const response = await fetch('/api/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tokenToUse}`
                },
                body: JSON.stringify({ password: newPassword })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.token) {
                    localStorage.setItem('token', data.token);
                    this.token = data.token;
                }
                this.passwordChangeModal.style.display = 'none';
                this.passwordChangeSuccessModal.style.display = 'block';
                this.passwordChangeForm.reset();
                this.tempToken = null;

            } else {
                const errorData = await response.json();
                alert(`Failed to change password: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Failed to change password:', error);
            alert('An error occurred while changing the password.');
        }
    }

    hidePasswordChangeSuccessModal() {
        this.passwordChangeSuccessModal.style.display = 'none';
        this.updateUI();
        this.loadTodos();
    }

    // --- Todo methods ---
    async loadTodos() {
        try {
            const response = await fetch('/api/todos', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) {
                this.handleLogout();
                return;
            }
            this.todos = await response.json();
            this.render();
        } catch (error) {
            console.error('Failed to load todos:', error);
            this.handleLogout();
        }
    }

    async handleAddTodo(e) {
        e.preventDefault();
        const text = this.todoInput.value.trim();
        if (text) {
            await this.addTodo(text);
            this.todoInput.value = '';
        }
    }

    async addTodo(text) {
        try {
            const response = await fetch('/api/todos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ text, status: 'todo', details: 'Click to add details', createdAt: new Date().toISOString() })
            });

            if (response.ok) {
                const savedTodo = await response.json();
                this.todos.push(savedTodo);
                this.render();
            } else {
                const errorData = await response.json();
                alert(`Failed to add todo: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Failed to add todo:', error);
            alert('An error occurred while adding the todo.');
        }
    }


    // Toggles the visibility of the main app vs. the auth forms
    updateUI() {
        if (this.token) {
            this.authContainer.style.display = 'none';
            this.appContainer.style.display = 'block';
            document.body.classList.add('logged-in');
        } else {
            this.authContainer.style.display = 'block';
            this.appContainer.style.display = 'none';
            document.body.classList.remove('logged-in');
        }
    }

    // Toggles between the login and registration forms
    toggleAuthForms(showLogin) {
        if (this.loginFormContainer) this.loginFormContainer.style.display = showLogin ? 'block' : 'none';
        if (this.registerFormContainer) this.registerFormContainer.style.display = showLogin ? 'none' : 'block';
    }

    // --- Authentication Handlers ---
async handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        console.log('Login response status:', response.status); // Fixed debug log
        
        if (!response.ok) {
            const errorData = await response.json();
            console.log('Login error data:', errorData); // Moved debug log here
            
            if (errorData.passwordExpired && errorData.tempToken) {
                this.tempToken = errorData.tempToken; // Store the temporary token
                this.showPasswordChangeModal();
            } else {
                alert(`Login failed: ${errorData.error || 'Unknown error'}`);
            }
            return;
        }

        // Success case
        const data = await response.json(); // This should be 'data', not destructured
        const { token } = data; // Extract token from data
        
        localStorage.setItem('token', token);
        this.token = token;
        this.updateUI();
        await this.loadTodos(); // Added await for consistency
        
    } catch (error) {
        console.error('Login failed:', error);
        alert('An error occurred during login.');
    }
}


// Replace your handleRegister method in client.js with this improved version:

async handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value.trim();

    console.log('Attempting registration for:', username); // Debug log

    // Client-side validation
    if (username.length < 3) {
        alert('Username must be at least 3 characters long.');
        return;
    }
    
    if (password.length < 6) {
        alert('Password must be at least 6 characters long.');
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        console.log('Registration response status:', response.status); // Debug log

        if (!response.ok) {
            // Try to parse as JSON first, fall back to text
            let errorMessage = 'Registration failed';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
                console.log('Registration error details:', errorData);
            } catch (parseError) {
                // If JSON parsing fails, try to get text
                try {
                    const errorText = await response.text();
                    errorMessage = errorText || errorMessage;
                    console.log('Registration error text:', errorText);
                } catch (textError) {
                    console.error('Could not parse error response:', textError);
                }
            }
            
            console.error('Registration failed with message:', errorMessage);
            alert(`Registration failed: ${errorMessage}`);
            return;
        }

        const data = await response.json();
        console.log('Registration successful:', data);
        alert('Registration successful! Please log in.');
        this.toggleAuthForms(true); // Show login form
        
        // Clear the form
        document.getElementById('register-username').value = '';
        document.getElementById('register-password').value = '';
        
    } catch (error) {
        console.error('Registration network error:', error);
        alert('An error occurred during registration. Please check your connection and try again.');
    }
}

    handleLogout() {
        localStorage.removeItem('token');
        this.token = null;
        this.todos = [];
        this.render();
        this.updateUI();
    }

    // --- Todo List Handlers ---
    async loadTodos() {
        try {
            const response = await fetch('/api/todos', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.status === 401 || response.status === 403) {
                // If unauthorized, clear the token and log out
                this.handleLogout();
                return;
            }
            this.todos = await response.json();
            this.render();
        } catch (error) {
            console.error('Failed to load todos:', error);
            this.handleLogout(); // Logout on network error
        }
    }

    async handleAddTodo(e) {
        e.preventDefault();
        const text = this.todoInput.value.trim();
        if (text) {
            await this.addTodo(text);
            this.todoInput.value = ''; // Clear the input field
        }
    }

    async addTodo(text) {
        const newTodo = {
            text: text,
            status: 'todo',
            details: 'Click to add details',
            createdAt: new Date().toISOString()
        };

        try {
            const response = await fetch('/api/todos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(newTodo),
            });
            
            if (response.ok) {
                const savedTodo = await response.json();
                // Add the new todo to the local array and re-render the UI
                this.todos.push(savedTodo);
                this.render();
            } else {
                const errorData = await response.json();
                console.error('Failed to add todo:', errorData);
                alert(`Failed to add todo: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Failed to add todo:', error);
            alert('An error occurred while adding the todo.');
        }
    }
    
    async deleteTodo(id) {
        try {
            const response = await fetch(`/api/todos/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                this.todos = this.todos.filter(todo => todo.id !== id);
                this.render();
            } else {
                const errorData = await response.json();
                alert(`Failed to delete todo: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Failed to delete todo:', error);
            alert('An error occurred while deleting the todo.');
        }
    }
    
    async updateTodoStatus(id, newStatus) {
        try {
            const response = await fetch(`/api/todos/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ status: newStatus }),
            });
            
            if (response.ok) {
                const todo = this.todos.find(todo => todo.id === id);
                if (todo) {
                    todo.status = newStatus;
                    this.render();
                }
            } else {
                const errorData = await response.json();
                alert(`Failed to update todo status: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Failed to update todo status:', error);
            alert('An error occurred while updating the todo status.');
        }
    }

    async updateTodoDetails(id, newDetails) {
        try {
            const response = await fetch(`/api/todos/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ details: newDetails }),
            });

            if (response.ok) {
                const todo = this.todos.find(todo => todo.id === id);
                if (todo) {
                    todo.details = newDetails;
                    this.render();
                }
            } else {
                const errorData = await response.json();
                alert(`Failed to update todo details: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Failed to update todo details:', error);
            alert('An error occurred while updating the todo details.');
        }
    }

    // --- UI Rendering and Manipulation ---
    createTodoElement(todo) {
        const todoElement = document.createElement('div');
        todoElement.className = `todo-item ${todo.status}`;
        todoElement.dataset.id = todo.id;

        const todoContent = document.createElement('div');
        todoContent.className = 'todo-content';
        todoContent.textContent = todo.text;
        
        const todoActions = document.createElement('div');
        todoActions.className = 'todo-actions';

        // Actions for each status
        const actionButtons = this.createActionButtons(todo);
        actionButtons.forEach(button => todoActions.appendChild(button));

        // Delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-btn';
        deleteButton.innerHTML = '🗑️';
        deleteButton.title = 'Delete';
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevents modal from opening
            this.deleteTodo(todo.id);
        });
        todoActions.appendChild(deleteButton);

        todoElement.appendChild(todoContent);
        todoElement.appendChild(todoActions);

        // Click handler for modal
        todoElement.addEventListener('click', () => this.showTodoModal(todo.id));

        return todoElement;
    }

    createActionButtons(todo) {
        const buttons = [];
        switch (todo.status) {
            case 'todo':
                buttons.push(this.createButton('▶️', 'start-btn', () => this.updateTodoStatus(todo.id, 'in-progress'), 'Start'));
                break;
            case 'in-progress':
                buttons.push(this.createButton('⬅️', 'back-btn', () => this.updateTodoStatus(todo.id, 'todo'), 'Move to To-do'));
                buttons.push(this.createButton('✅', 'complete-btn', () => this.updateTodoStatus(todo.id, 'completed'), 'Complete'));
                break;
            case 'completed':
                buttons.push(this.createButton('🔄', 'restart-btn', () => this.updateTodoStatus(todo.id, 'in-progress'), 'Restart'));
                break;
        }
        return buttons;
    }

    createButton(emoji, className, handler, title) {
        const button = document.createElement('button');
        button.className = className;
        button.innerHTML = emoji;
        button.title = title;
        button.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent modal from opening
            handler();
        });
        return button;
    }

    showTodoModal(id) {
        const todo = this.todos.find(todo => todo.id === id);
        if (todo) {
            this.modalTitle.textContent = todo.text;
            this.modalDetails.textContent = todo.details || 'Click to add details';
            this.todoModal.style.display = 'block';

            // Store the ID of the todo being edited
            this.modalDetails.dataset.todoId = id;
        }
    }


    hideTodoModal() {
        this.todoModal.style.display = 'none';
        // Remove the todo ID from the dataset
        this.modalDetails.dataset.todoId = '';
    }


    // Main rendering logic to update the todo lists and counts
    render() {
        this.clearList(this.todosList);
        this.clearList(this.inProgressList);
        this.clearList(this.completedList);

        const todosByStatus = { 'todo': [], 'in-progress': [], 'completed': [] };

        this.todos.forEach(todo => {
            if (todosByStatus[todo.status]) {
                todosByStatus[todo.status].push(todo);
            }
        });

        this.renderColumn(this.todosList, todosByStatus['todo'], 'No todos yet. Add one above!');
        this.renderColumn(this.inProgressList, todosByStatus['in-progress'], 'No tasks in progress');
        this.renderColumn(this.completedList, todosByStatus['completed'], 'No completed tasks');

        this.todosCount.textContent = todosByStatus['todo'].length;
        this.inProgressCount.textContent = todosByStatus['in-progress'].length;
        this.completedCount.textContent = todosByStatus['completed'].length;
    }

    clearList(listElement) {
        if (listElement) {
            while (listElement.firstChild) {
                listElement.removeChild(listElement.firstChild);
            }
        }
    }

    renderColumn(columnElement, todos, emptyMessage) {
        if (!columnElement) return;

        if (todos.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.textContent = emptyMessage;
            columnElement.appendChild(emptyState);
        } else {
            todos.forEach(todo => {
                const todoElement = this.createTodoElement(todo);
                columnElement.appendChild(todoElement);
            });
        }
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.todosApp = new TodosApp();
});

// Event listener for editing todo details in the modal
document.addEventListener('click', (e) => {
    const modalDetails = document.getElementById('modal-details');
    const todoId = modalDetails?.dataset.todoId;

    if (e.target === modalDetails && todoId) {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = modalDetails.textContent === 'Click to add details' ? '' : modalDetails.textContent;
        input.className = 'edit-input';
        
        modalDetails.replaceWith(input);
        input.focus();

        const saveDetails = () => {
            const newDetails = input.value.trim();
            if (window.todosApp) {
                window.todosApp.updateTodoDetails(Number(todoId), newDetails);
            }
            modalDetails.textContent = newDetails || 'Click to add details';
            input.replaceWith(modalDetails);
        };

        input.addEventListener('blur', saveDetails);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveDetails();
            }
        });
    }
});
