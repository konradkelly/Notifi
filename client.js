class TodosApp {
    constructor() {
        // Auth elements
        this.authContainer = document.getElementById('auth-container');
        this.appContainer = document.getElementById('app-container');
        this.loginForm = document.getElementById('loginForm');
        this.registerForm = document.getElementById('registerForm');
        this.logoutBtn = document.getElementById('logout-btn');
        this.showRegisterLink = document.getElementById('show-register');
        this.showLoginLink = document.getElementById('show-login');
        this.loginFormContainer = document.getElementById('login-form-container');
        this.registerFormContainer = document.getElementById('register-form-container');

        // Todo elements
        this.addTodoForm = document.getElementById('addTodoForm');
        this.todoInput = document.getElementById('todo-input');
        this.todosList = document.getElementById('todosList');
        this.inProgressList = document.getElementById('inProgressList');
        this.completedList = document.getElementById('completedList');
        this.todosCount = document.getElementById('todosCount');
        this.inProgressCount = document.getElementById('inProgressCount');
        this.completedCount = document.getElementById('completedCount');

        // Modal elements
        this.todoModal = document.getElementById('todo-modal');
        this.modalTitle = document.getElementById('modal-title');
        this.modalDetails = document.getElementById('modal-details');
        this.closeBtn = document.querySelector('.close-btn');

        this.token = null;
        this.todos = [];

        this.init();
    }

    async init() {
        this.token = localStorage.getItem('token');

        // Auth event listeners
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        this.logoutBtn.addEventListener('click', () => this.handleLogout());
        this.showRegisterLink.addEventListener('click', () => this.toggleAuthForms(false));
        this.showLoginLink.addEventListener('click', () => this.toggleAuthForms(true));

        // Todo event listeners
        this.addTodoForm.addEventListener('submit', (e) => this.handleAddTodo(e));

        // Modal event listeners
        this.closeBtn.addEventListener('click', () => this.hideTodoModal());
        window.addEventListener('click', (e) => {
            if (e.target == this.todoModal) {
                this.hideTodoModal();
            }
        });

        if (this.token) {
            await this.loadTodos();
        } else {
            this.updateUI();
        }
    }

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

    toggleAuthForms(showLogin) {
        this.loginFormContainer.style.display = showLogin ? 'block' : 'none';
        this.registerFormContainer.style.display = showLogin ? 'none' : 'block';
    }

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
                throw new Error(errorData.error || 'Login failed');
            }

            const { token } = await response.json();
            localStorage.setItem('token', token);
            this.token = token;
            this.updateUI();
            this.loadTodos();
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value.trim();

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Registration failed');
            }

            alert('Registration successful! Please log in.');
            this.toggleAuthForms(true); // Show login form
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    handleLogout() {
        localStorage.removeItem('token');
        this.token = null;
        this.todos = [];
        this.render();
        this.updateUI();
    }

    async loadTodos() {
        try {
            const response = await fetch('/api/todos', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.status === 401 || response.status === 403) {
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
            this.todoInput.value = '';
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
            const savedTodo = await response.json();
            this.todos.push(savedTodo);
            this.render();
        } catch (error) {
            console.error('Failed to add todo:', error);
        }
    }

    async deleteTodo(id) {
        try {
            await fetch(`/api/todos/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            this.todos = this.todos.filter(todo => todo.id !== id);
            this.render();
        } catch (error) {
            console.error('Failed to delete todo:', error);
        }
    }

    async updateTodoStatus(id, newStatus) {
        try {
            await fetch(`/api/todos/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ status: newStatus }),
            });
            const todo = this.todos.find(todo => todo.id === id);
            if (todo) {
                todo.status = newStatus;
                this.render();
            }
        } catch (error) {
            console.error('Failed to update todo status:', error);
        }
    }

    async editTodo(id, newText) {
        try {
            await fetch(`/api/todos/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ text: newText }),
            });
            const todo = this.todos.find(todo => todo.id === id);
            if (todo) {
                todo.text = newText.trim();
                this.render();
            }
        } catch (error) {
            console.error('Failed to edit todo:', error);
        }
    }

    createTodoElement(todo) {
        const todoElement = document.createElement('div');
        todoElement.className = `todo-item ${todo.status === 'in-progress' ? 'in-progress' : ''} ${todo.status === 'completed' ? 'completed' : ''}`;
        todoElement.dataset.id = todo.id;
        todoElement.setAttribute('onclick', `todosApp.showTodoModal(${todo.id})`);

        todoElement.innerHTML = `
            <div class="todo-content">
                <span class="todo-text">${this.escapeHtml(todo.text)}</span>
                <input type="text" class="edit-input" value="${this.escapeHtml(todo.text)}" style="display: none;">
            </div>
            <div class="todo-actions">
                ${this.createActionButtons(todo)}
                <button class="delete-btn" onclick="event.stopPropagation(); todosApp.deleteTodo(${todo.id})" title="Delete">🗑️</button>
            </div>
        `;

        return todoElement;
    }

    createActionButtons(todo) {
        switch (todo.status) {
            case 'todo':
                return `<button class="start-btn" onclick="todosApp.updateTodoStatus(${todo.id}, 'in-progress')" title="Start">▶️</button>`;
            case 'in-progress':
                return `
                    <button class="back-btn" onclick="todosApp.updateTodoStatus(${todo.id}, 'todo')" title="Move back">⬅️</button>
                    <button class="complete-btn" onclick="todosApp.updateTodoStatus(${todo.id}, 'completed')" title="Complete">✅</button>
                `;
            case 'completed':
                return `
                    <button class="restart-btn" onclick="todosApp.updateTodoStatus(${todo.id}, 'in-progress')" title="Restart">🔄</button>
                `;
        }
    }

    showTodoModal(id) {
        const todo = this.todos.find(todo => todo.id === id);
        if (todo) {
            this.modalTitle.textContent = todo.text;
            this.modalDetails.textContent = todo.details || 'Click to add details';
            this.todoModal.style.display = 'block';

            this.modalDetails.onclick = () => {
                const input = document.createElement('input');
                input.type = 'text';
                if (this.modalDetails.textContent === 'Click to add details') {
                    input.value = '';
                } else {
                    input.value = this.modalDetails.textContent;
                }
                input.className = 'edit-input';
                this.modalDetails.replaceWith(input);
                input.focus();

                const saveDetails = () => {
                    const newDetails = input.value.trim();
                    this.updateTodoDetails(id, newDetails);
                    this.modalDetails.textContent = newDetails || 'Click to add details'; // Update the details in the modal
                    input.replaceWith(this.modalDetails);
                };

                input.addEventListener('blur', saveDetails);
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        saveDetails();
                    }
                });
            };
        }
    }

    hideTodoModal() {
        this.todoModal.style.display = 'none';
    }

    async updateTodoDetails(id, newDetails) {
        try {
            await fetch(`/api/todos/${id}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ details: newDetails }),
            });
            const todo = this.todos.find(todo => todo.id === id);
            if (todo) {
                todo.details = newDetails;
                this.render();
            }
        } catch (error) {
            console.error('Failed to update todo details:', error);
        }
    }

    render() {
        this.clearList(this.todosList);
        this.clearList(this.inProgressList);
        this.clearList(this.completedList);

        const todosByStatus = {
            'todo': [],
            'in-progress': [],
            'completed': []
        };

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
        while (listElement.firstChild) {
            listElement.removeChild(listElement.firstChild);
        }
    }

    renderColumn(columnElement, todos, emptyMessage) {
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

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.todosApp = new TodosApp();
});