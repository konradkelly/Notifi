class TodosApp {
    constructor() {
        this.todos = [];

        // Get DOM elements
        this.addTodoForm = document.getElementById('addTodoForm');
        this.todoInput = document.getElementById('todo-input');
        this.todosList = document.getElementById('todosList');
        this.inProgressList = document.getElementById('inProgressList');
        this.completedList = document.getElementById('completedList');

        // Count elements
        this.todosCount = document.getElementById('todosCount');
        this.inProgressCount = document.getElementById('inProgressCount');
        this.completedCount = document.getElementById('completedCount');

        this.init();
    }

    async init() {
        await this.loadTodos();
        this.addTodoForm.addEventListener('submit', (e) => this.handleAddTodo(e));
        this.render();
    }

    async loadTodos() {
        try {
            const response = await fetch('/api/todos');
            this.todos = await response.json();
        } catch (error) {
            console.error('Failed to load todos:', error);
            this.todos = [];
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
            createdAt: new Date().toISOString()
        };

        try {
            const response = await fetch('/api/todos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
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
            await fetch(`/api/todos/${id}`, { method: 'DELETE' });
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

        todoElement.innerHTML = `
            <div class="todo-content">
                <span class="todo-text" ondblclick="todosApp.startEdit(${todo.id})">${this.escapeHtml(todo.text)}</span>
                <input type="text" class="edit-input" value="${this.escapeHtml(todo.text)}" style="display: none;">
            </div>
            <div class="todo-actions">
                ${this.createActionButtons(todo)}
                <button class="delete-btn" onclick="todosApp.deleteTodo(${todo.id})" title="Delete">🗑️</button>
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

    startEdit(id) {
        const todoElement = document.querySelector(`[data-id="${id}"]`);
        const textElement = todoElement.querySelector('.todo-text');
        const inputElement = todoElement.querySelector('.edit-input');

        textElement.style.display = 'none';
        inputElement.style.display = 'block';
        inputElement.focus();
        inputElement.select();

        const saveEdit = () => {
            const newText = inputElement.value.trim();
            if (newText && newText !== textElement.textContent) {
                this.editTodo(id, newText);
            } else {
                textElement.style.display = 'block';
                inputElement.style.display = 'none';
            }
        };

        const cancelEdit = () => {
            inputElement.value = textElement.textContent;
            textElement.style.display = 'block';
            inputElement.style.display = 'none';
        };

        inputElement.addEventListener('blur', saveEdit, { once: true });
        inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
            }
        }, { once: true });
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
