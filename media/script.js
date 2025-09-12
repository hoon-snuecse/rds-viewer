// Get VS Code API
const vscode = acquireVsCodeApi();

// Handle button clicks
function loadFullData() {
    vscode.postMessage({
        command: 'loadFullData'
    });
}

function exportCsv() {
    vscode.postMessage({
        command: 'exportCsv'
    });
}

function copyVariable(varName) {
    vscode.postMessage({
        command: 'copyVariable',
        text: varName
    });
}

// Add event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Add click handlers for sortable columns
    const tables = document.querySelectorAll('.variables-table table, .data-table');
    tables.forEach(table => {
        const headers = table.querySelectorAll('th');
        headers.forEach((header, index) => {
            header.style.cursor = 'pointer';
            header.addEventListener('click', () => sortTable(table, index));
        });
    });
    
    // Add search functionality
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterTable(e.target.value);
        });
    }
});

// Table sorting function
function sortTable(table, columnIndex) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const header = table.querySelectorAll('th')[columnIndex];
    
    // Determine sort direction
    const isAscending = header.classList.contains('sort-desc');
    
    // Remove all sort indicators
    table.querySelectorAll('th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    
    // Add new sort indicator
    header.classList.add(isAscending ? 'sort-asc' : 'sort-desc');
    
    // Sort rows
    rows.sort((a, b) => {
        const aValue = a.cells[columnIndex].textContent.trim();
        const bValue = b.cells[columnIndex].textContent.trim();
        
        // Try to parse as number
        const aNum = parseFloat(aValue.replace(/[^0-9.-]/g, ''));
        const bNum = parseFloat(bValue.replace(/[^0-9.-]/g, ''));
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
            return isAscending ? aNum - bNum : bNum - aNum;
        }
        
        // Sort as string
        return isAscending 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
    });
    
    // Re-append sorted rows
    rows.forEach(row => tbody.appendChild(row));
}

// Table filtering function with highlighting
function filterTable(searchTerm) {
    const tables = document.querySelectorAll('.variables-table table, .data-table');
    const term = searchTerm.toLowerCase().trim();
    
    // Clear previous highlights
    document.querySelectorAll('.highlight').forEach(el => {
        el.outerHTML = el.textContent;
    });
    
    if (!term) {
        // Show all rows if search is empty
        tables.forEach(table => {
            table.querySelectorAll('tbody tr').forEach(row => {
                row.style.display = '';
            });
        });
        return;
    }
    
    let totalMatches = 0;
    
    tables.forEach(table => {
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            const hasMatch = text.includes(term);
            row.style.display = hasMatch ? '' : 'none';
            
            if (hasMatch) {
                totalMatches++;
                // Highlight matching text in visible rows
                row.querySelectorAll('td').forEach(cell => {
                    highlightText(cell, term);
                });
            }
        });
    });
    
    // Show no results message if needed
    updateSearchStatus(totalMatches, term);
}

// Highlight matching text
function highlightText(element, searchTerm) {
    const text = element.textContent;
    const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
    if (regex.test(text)) {
        element.innerHTML = text.replace(regex, '<span class="highlight">$1</span>');
    }
}

// Escape special regex characters
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Update search status
function updateSearchStatus(matches, term) {
    // Remove existing status
    const existingStatus = document.querySelector('.search-status');
    if (existingStatus) {
        existingStatus.remove();
    }
    
    if (term && matches === 0) {
        const status = document.createElement('div');
        status.className = 'no-results';
        status.textContent = `No results found for "${term}"`;
        document.querySelector('.search-container')?.after(status);
    }
}

// Clear search
function clearSearch() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = '';
        filterTable('');
    }
}

// Pagination functions
function paginateFirst() {
    vscode.postMessage({
        command: 'paginate',
        action: 'first'
    });
}

function paginatePrev() {
    vscode.postMessage({
        command: 'paginate',
        action: 'prev'
    });
}

function paginateNext() {
    vscode.postMessage({
        command: 'paginate',
        action: 'next'
    });
}

function paginateLast() {
    vscode.postMessage({
        command: 'paginate',
        action: 'last'
    });
}

function changePageSize(size) {
    vscode.postMessage({
        command: 'paginate',
        action: 'setPageSize',
        pageSize: parseInt(size)
    });
}

// Handle messages from extension
window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'updateData':
            updateDisplay(message.data);
            break;
        case 'showError':
            showError(message.error);
            break;
    }
});

function updateDisplay(data) {
    // Update the display with new data
    console.log('Updating display with:', data);
}

function showError(error) {
    const container = document.querySelector('.container');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.innerHTML = `<div class="error-message">${error}</div>`;
    container.insertBefore(errorDiv, container.firstChild);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Add CSS for sort indicators
const style = document.createElement('style');
style.textContent = `
    th.sort-asc::after {
        content: ' ▲';
        font-size: 10px;
        color: var(--vscode-descriptionForeground);
    }
    th.sort-desc::after {
        content: ' ▼';
        font-size: 10px;
        color: var(--vscode-descriptionForeground);
    }
    th:hover {
        background: var(--vscode-list-hoverBackground);
    }
`;
document.head.appendChild(style);