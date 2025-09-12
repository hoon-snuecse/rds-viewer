// Excel-like RDS Viewer JavaScript

// Track loaded data ranges
let loadedRanges = [];
let isLoadingData = false;
let totalRows = 0;
let totalColumns = 0;
let currentLoadedRows = 500;
let currentNavigatedRow = 1; // Track the current navigated row

// Main tab switching
function switchMainTab(tabName) {
    console.log('=== Switching to tab:', tabName);
    
    // Notify extension about tab change
    if (typeof vscode !== 'undefined') {
        vscode.postMessage({
            command: 'tabChanged',
            tab: tabName
        });
    }
    
    // Update tab buttons
    const tabButtons = document.querySelectorAll('.tab-button');
    console.log('Found tab buttons:', tabButtons.length);
    
    tabButtons.forEach(btn => {
        console.log('Processing button:', btn.dataset.tab, 'Current classes:', btn.className);
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
            console.log('Added active class to:', btn.dataset.tab);
        } else {
            btn.classList.remove('active');
            console.log('Removed active class from:', btn.dataset.tab);
        }
    });
    
    // Update tab panels - use a more reliable method
    const summaryPanel = document.getElementById('summary-panel');
    const dataPanel = document.getElementById('data-panel');
    
    console.log('Summary panel exists:', !!summaryPanel);
    console.log('Data panel exists:', !!dataPanel);
    
    if (tabName === 'summary' && summaryPanel) {
        summaryPanel.classList.add('active');
        summaryPanel.style.display = 'flex';
        if (dataPanel) {
            dataPanel.classList.remove('active');
            dataPanel.style.display = 'none';
        }
        console.log('Switched to summary tab');
    } else if (tabName === 'data' && dataPanel) {
        dataPanel.classList.add('active');
        dataPanel.style.display = 'flex';
        if (summaryPanel) {
            summaryPanel.classList.remove('active');
            summaryPanel.style.display = 'none';
        }
        console.log('Switched to data tab');
        console.log('Data panel content length:', dataPanel.innerHTML.length);
        
        // Check if there's actual content
        if (dataPanel.innerHTML.length < 100) {
            console.warn('Data panel has very little content!');
            console.log('Data panel content:', dataPanel.innerHTML);
        }
    }
    
    // If switching to data tab, initialize column navigation
    if (tabName === 'data') {
        console.log('Data tab selected - initializing features');
        
        // Check if data panel has content
        const dataPanel = document.getElementById('data-panel');
        if (dataPanel) {
            console.log('Data panel found, innerHTML length:', dataPanel.innerHTML.length);
            if (dataPanel.innerHTML.trim().length < 50) {
                console.error('Data panel has no content!');
                console.log('Data panel content:', dataPanel.innerHTML);
            }
        } else {
            console.error('Data panel not found!');
        }
        
        setTimeout(() => {
            // Bind data control events
            bindDataControlEvents();
            
            // Force re-initialization of column navigation
            currentColumnOffset = 0;
            totalColumns = 0;
            visibleColumns = 0; // Will be set to show all columns
            
            initColumnNavigation();
            // checkLoadMoreButton(); // No longer needed, button is in HTML
            
            // Setup infinite scroll
            setupInfiniteScroll();
            
            // Check if data table exists
            const dataTable = document.querySelector('.data-table');
            if (dataTable) {
                console.log('Data table found');
                
                // Double-check column navigation initialization
                const headers = dataTable.querySelectorAll('thead th');
                if (headers.length > 1) {
                    console.log(`Found ${headers.length - 1} columns for navigation`);
                    if (totalColumns === 0) {
                        console.warn('Column navigation not initialized properly, retrying...');
                        initColumnNavigation();
                    }
                }
            } else {
                console.error('Data table NOT found!');
            }
            
            // Bind events again after a delay to ensure DOM is ready
            setTimeout(bindDataControlEvents, 500);
        }, 200);
    }
}

// Search table function
function searchTable(searchTerm) {
    const table = document.querySelector('.data-table');
    if (!table) return;
    
    const rows = table.querySelectorAll('tbody tr');
    const term = searchTerm.toLowerCase();
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(term)) {
            row.style.display = '';
            if (term) {
                highlightSearchTerm(row, term);
            }
        } else {
            row.style.display = 'none';
        }
    });
}

// Highlight search term
function highlightSearchTerm(row, term) {
    row.querySelectorAll('td').forEach(cell => {
        const text = cell.textContent;
        const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
        if (regex.test(text)) {
            cell.innerHTML = text.replace(regex, '<span class="highlight">$1</span>');
        }
    });
}

// Escape regex special characters
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Refresh data
function refreshData() {
    vscode.postMessage({
        command: 'refresh'
    });
}

// Search functionality
let searchTimeout = null;
let searchResults = [];
let currentSearchIndex = -1;

function searchData() {
    const searchInput = document.getElementById('data-search');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    const table = document.querySelector('.data-table');
    if (!table) return;
    
    // Clear previous highlights
    document.querySelectorAll('.highlight').forEach(el => {
        el.classList.remove('highlight');
    });
    document.querySelectorAll('.current-highlight').forEach(el => {
        el.classList.remove('current-highlight');
    });
    
    if (!searchTerm) {
        searchResults = [];
        currentSearchIndex = -1;
        return;
    }
    
    searchResults = [];
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach((row, rowIndex) => {
        const cells = row.querySelectorAll('td');
        cells.forEach((cell, cellIndex) => {
            const text = cell.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                cell.classList.add('highlight');
                searchResults.push({ row: rowIndex, cell: cellIndex, element: cell });
            }
        });
    });
    
    // Update search status
    if (searchResults.length > 0) {
        currentSearchIndex = 0;
        searchResults[0].element.classList.add('current-highlight');
        searchResults[0].element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Navigate search results
function nextSearchResult() {
    if (searchResults.length === 0) return;
    
    if (currentSearchIndex >= 0) {
        searchResults[currentSearchIndex].element.classList.remove('current-highlight');
    }
    
    currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
    searchResults[currentSearchIndex].element.classList.add('current-highlight');
    searchResults[currentSearchIndex].element.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Show export menu
function showExportMenu(event) {
    // Remove any existing menu
    const existingMenu = document.querySelector('.export-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    const menu = document.createElement('div');
    menu.className = 'export-menu';
    
    // Create menu options
    const options = [
        { format: 'csv', icon: '📄', label: 'Export as CSV' },
        { format: 'json', icon: '📋', label: 'Export as JSON' },
        { format: 'excel', icon: '📊', label: 'Export as Excel' }
    ];
    
    options.forEach(opt => {
        const option = document.createElement('div');
        option.className = 'export-option';
        option.innerHTML = `${opt.icon} ${opt.label}`;
        option.addEventListener('click', () => {
            exportData(opt.format);
            menu.remove();
        });
        menu.appendChild(option);
    });
    
    // Position menu near button
    const rect = event.target.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = rect.bottom + 'px';
    menu.style.left = Math.max(10, rect.left - 100) + 'px'; // Adjust position to avoid edge
    
    document.body.appendChild(menu);
    
    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target) && e.target.id !== 'export-btn') {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 0);
}

// Export data
function exportData(format) {
    vscode.postMessage({
        command: 'export',
        format: format
    });
    
    // Close export menu
    const menu = document.querySelector('.export-menu');
    if (menu) {
        menu.remove();
    }
}

// Handle messages from extension
window.addEventListener('message', event => {
    const message = event.data;
    console.log('Received message:', message.command, message);
    
    switch (message.command) {
        case 'showError':
            showError(message.error);
            break;
        case 'updateData':
            // Update only the data panel content without switching tabs
            console.log('Updating data panel with new data');
            const dataPanel = document.getElementById('data-panel');
            if (dataPanel && message.dataPanel) {
                // Update the data panel HTML
                dataPanel.innerHTML = message.dataPanel;
                
                // Update tracking variables if metadata exists
                if (message.data && message.data._metadata) {
                    totalRows = message.data._metadata.totalRows || totalRows;
                    currentLoadedRows = message.data._metadata.loadedRows || currentLoadedRows;
                }
                
                // Re-bind event listeners for the new elements
                setTimeout(() => {
                    bindDataControlEvents();
                    initColumnNavigation();
                    setupInfiniteScroll();
                    
                    // Update button text with current status
                    const loadMoreBtn = document.getElementById('load-more-btn');
                    if (loadMoreBtn) {
                        loadMoreBtn.disabled = false;
                        if (currentLoadedRows >= totalRows) {
                            loadMoreBtn.textContent = 'All rows loaded';
                            loadMoreBtn.disabled = true;
                        } else {
                            loadMoreBtn.textContent = `Load More Rows (${currentLoadedRows} of ${totalRows} loaded)`;
                        }
                    }
                }, 100);
            }
            break;
        case 'appendRows':
            // Append new rows to existing table
            console.log(`Appending rows ${message.startRow} to ${message.endRow}`);
            
            // Update column headers if we have column information
            if (message.columns && message.columns.length > 0) {
                updateColumnHeaders(message.columns);
            }
            
            appendRowsToTable(message.data, message.startRow);
            currentLoadedRows = message.endRow;
            totalRows = message.totalRows;
            isLoadingData = false;
            updateDataStatus();
            
            // Re-initialize column navigation with new columns
            initColumnNavigation();
            break;
        case 'navigateToCell':
            // Navigate to specific cell with new data
            console.log(`Received navigation data for row ${message.targetRow}, column ${message.targetColumn}`);
            console.log('Navigation data:', message.data);
            
            // Update global variables
            currentLoadedRows = message.endRow;
            totalRows = message.totalRows;
            totalColumns = message.totalColumns;
            currentNavigatedRow = message.targetRow; // Update current navigated row
            
            // Make sure we're on the data tab
            const navDataPanel = document.getElementById('data-panel');
            if (navDataPanel && !navDataPanel.classList.contains('active')) {
                console.log('Switching to data tab for navigation');
                switchMainTab('data');
            }
            
            // Replace table data
            console.log(`Replacing table data from row ${message.startRow}`);
            replaceTableData(message.data, message.startRow);
            
            // Calculate the correct row index in the current view
            const rowIndexInView = message.targetRow - message.startRow + 1;
            console.log(`Target row ${message.targetRow} is at index ${rowIndexInView} in view (rows ${message.startRow}-${message.endRow})`);
            
            // Wait for DOM to update, then scroll
            setTimeout(() => {
                const table = document.querySelector('.data-table');
                if (table) {
                    const rows = table.querySelectorAll('tbody tr');
                    console.log(`Found ${rows.length} rows in table after update`);
                    
                    if (rowIndexInView > 0 && rowIndexInView <= rows.length) {
                        const row = rows[rowIndexInView - 1];
                        if (row) {
                            const cells = row.querySelectorAll('td');
                            console.log(`Found ${cells.length} cells in target row`);
                            
                            // Target column is 1-based, cells[0] is row number, so use targetColumn directly
                            const cellIndex = message.targetColumn;
                            if (cellIndex >= 0 && cellIndex < cells.length) {
                                const cell = cells[cellIndex];
                                if (cell) {
                                    console.log(`Scrolling to row ${rowIndexInView} at col ${cellIndex}`);
                                    
                                    const tableContainer = document.querySelector('.data-table-container');
                                    if (tableContainer) {
                                        // Check if this is the last row navigation
                                        if (message.targetRow === totalRows) {
                                            // For last row, scroll to bottom
                                            console.log('Scrolling to bottom for last row');
                                            tableContainer.scrollTop = tableContainer.scrollHeight;
                                        } else if (rowIndexInView === 1) {
                                            // For first row in view, scroll to top
                                            console.log('Scrolling to top for first row in view');
                                            tableContainer.scrollTop = 0;
                                        } else {
                                            // Otherwise, scroll the row into view
                                            row.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'start' });
                                        }
                                    }
                                    
                                    // Highlight the entire row
                                    row.classList.add('highlighted-row');
                                    
                                    // Highlight the specific cell
                                    cell.classList.add('highlighted-cell');
                                    
                                    // Remove highlights after a delay
                                    setTimeout(() => {
                                        row.classList.remove('highlighted-row');
                                        cell.classList.remove('highlighted-cell');
                                    }, 3000);
                                } else {
                                    console.error(`Cell not found at index ${cellIndex}`);
                                }
                            } else {
                                console.error(`Cell index ${cellIndex} out of range (0-${cells.length - 1})`);
                            }
                        } else {
                            console.error('Target row element not found');
                        }
                    } else {
                        console.error(`Row index ${rowIndexInView} out of range (1-${rows.length})`);
                    }
                } else {
                    console.error('Table not found after DOM update');
                }
                updateDataStatus();
            }, 200); // Increased delay for DOM update
            break;
        case 'switchToDataTab':
            // Switch to data tab after load more
            console.log('Switching to data tab after load more');
            setTimeout(() => {
                switchMainTab('data');
                // Re-bind events after switching
                setTimeout(bindDataControlEvents, 100);
            }, 100);
            break;
    }
});

// Show error message
function showError(error) {
    const errorEl = document.createElement('div');
    errorEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--vscode-inputValidation-errorBackground);
        color: var(--vscode-inputValidation-errorForeground);
        border: 1px solid var(--vscode-inputValidation-errorBorder);
        padding: 10px 15px;
        border-radius: 4px;
        z-index: 1002;
    `;
    errorEl.textContent = error;
    
    document.body.appendChild(errorEl);
    
    setTimeout(() => {
        errorEl.remove();
    }, 5000);
}

// Column navigation
let currentColumnOffset = 0;
// totalColumns already declared at the top
let visibleColumns = 0; // Will be set to totalColumns to show all columns by default

function initColumnNavigation() {
    console.log('Initializing column navigation');
    const table = document.querySelector('.data-table');
    if (!table) {
        console.log('No data table found for column navigation');
        return;
    }
    
    const headers = table.querySelectorAll('thead th');
    totalColumns = headers.length - 1; // Exclude row number column
    console.log(`Found ${totalColumns} data columns`);
    
    // Reset to beginning
    currentColumnOffset = 0;
    
    // Show first 10 columns or all if less than 10
    if (totalColumns > 10) {
        visibleColumns = 10;
        isShowingAllColumns = false;
        updateVisibleColumns();
    } else {
        // If 10 or fewer columns, show all
        visibleColumns = totalColumns;
        isShowingAllColumns = true;
        const headers = table.querySelectorAll('thead th');
        const rows = table.querySelectorAll('tbody tr');
        headers.forEach(header => header.style.display = '');
        rows.forEach(row => {
            Array.from(row.cells).forEach(cell => cell.style.display = '');
        });
    }
}

function updateVisibleColumns() {
    console.log(`Updating visible columns: offset=${currentColumnOffset}, visible=${visibleColumns}`);
    const table = document.querySelector('.data-table');
    if (!table) {
        console.log('No table found in updateVisibleColumns');
        return;
    }
    
    const headers = table.querySelectorAll('thead th');
    const rows = table.querySelectorAll('tbody tr');
    
    console.log(`Processing ${headers.length} headers and ${rows.length} rows`);
    
    // Always show row number column (index 0)
    if (headers[0]) headers[0].style.display = '';
    
    // Hide/show columns based on offset
    for (let i = 1; i < headers.length; i++) {
        const columnIndex = i - 1; // Adjust for row number column
        if (columnIndex >= currentColumnOffset && columnIndex < currentColumnOffset + visibleColumns) {
            headers[i].style.display = '';
            // Show this column in all rows
            rows.forEach(row => {
                if (row.cells[i]) {
                    row.cells[i].style.display = '';
                }
            });
        } else {
            headers[i].style.display = 'none';
            // Hide this column in all rows
            rows.forEach(row => {
                if (row.cells[i]) {
                    row.cells[i].style.display = 'none';
                }
            });
        }
    }
    
    // Update navigation info
    updateNavigationInfo();
}

function nextColumns() {
    console.log('=== Next columns clicked ===');
    console.log(`Current state: offset=${currentColumnOffset}, visible=${visibleColumns}, total=${totalColumns}`);
    
    // Check if table exists
    const table = document.querySelector('.data-table');
    if (!table) {
        console.error('No table found when trying to navigate columns!');
        // Try to initialize
        initColumnNavigation();
        return;
    }
    
    if (totalColumns === 0) {
        console.warn('Total columns is 0, re-initializing...');
        initColumnNavigation();
        return;
    }
    
    if (currentColumnOffset + visibleColumns < totalColumns) {
        currentColumnOffset += visibleColumns;
        console.log(`Moving to offset ${currentColumnOffset}`);
        updateVisibleColumns();
    } else {
        console.log('Already at the last set of columns');
        alert('You are viewing the last set of columns');
    }
}

function prevColumns() {
    console.log('=== Previous columns clicked ===');
    console.log(`Current state: offset=${currentColumnOffset}, visible=${visibleColumns}, total=${totalColumns}`);
    
    // Check if table exists
    const table = document.querySelector('.data-table');
    if (!table) {
        console.error('No table found when trying to navigate columns!');
        // Try to initialize
        initColumnNavigation();
        return;
    }
    
    if (totalColumns === 0) {
        console.warn('Total columns is 0, re-initializing...');
        initColumnNavigation();
        return;
    }
    
    if (currentColumnOffset > 0) {
        currentColumnOffset = Math.max(0, currentColumnOffset - visibleColumns);
        console.log(`Moving to offset ${currentColumnOffset}`);
        updateVisibleColumns();
    } else {
        console.log('Already at the first set of columns');
        alert('You are viewing the first set of columns');
    }
}

let isShowingAllColumns = false; // Track toggle state

function showAllColumns() {
    console.log('Show all columns toggle clicked');
    const table = document.querySelector('.data-table');
    if (!table) {
        console.log('No table found');
        return;
    }
    
    if (!isShowingAllColumns) {
        // Show all columns
        const headers = table.querySelectorAll('thead th');
        const rows = table.querySelectorAll('tbody tr');
        
        headers.forEach(header => header.style.display = '');
        rows.forEach(row => {
            Array.from(row.cells).forEach(cell => cell.style.display = '');
        });
        
        currentColumnOffset = 0;
        visibleColumns = totalColumns;
        isShowingAllColumns = true;
        console.log(`Showing all ${totalColumns} columns`);
        
        // Update button appearance
        const btn = document.getElementById('show-all-columns-btn');
        if (btn) {
            btn.style.background = 'var(--vscode-button-background)';
            btn.style.color = 'var(--vscode-button-foreground)';
            btn.title = 'Show paginated columns';
        }
    } else {
        // Return to paginated view
        currentColumnOffset = 0;
        visibleColumns = 10;
        isShowingAllColumns = false;
        updateVisibleColumns();
        console.log('Returning to paginated view');
        
        // Update button appearance
        const btn = document.getElementById('show-all-columns-btn');
        if (btn) {
            btn.style.background = '';
            btn.style.color = '';
            btn.title = 'Show all columns';
        }
    }
    
    updateNavigationInfo();
}

function updateNavigationInfo() {
    const info = document.getElementById('column-navigation-info');
    if (info) {
        const start = currentColumnOffset + 1;
        const end = Math.min(currentColumnOffset + visibleColumns, totalColumns);
        const text = `Columns ${start}-${end} of ${totalColumns}`;
        info.textContent = text;
        console.log(`Navigation info updated: ${text}`);
    } else {
        console.log('Column navigation info element not found');
    }
}

// Make functions globally available for onclick handlers
window.nextColumns = nextColumns;
window.prevColumns = prevColumns;
window.showAllColumns = showAllColumns;
window.initColumnNavigation = initColumnNavigation;
window.searchTable = searchTable;
window.refreshData = refreshData;
window.showExportMenu = showExportMenu;
window.exportData = exportData;
window.switchMainTab = switchMainTab;
window.loadMoreData = loadMoreData;

// Infinite scroll implementation
function setupInfiniteScroll() {
    const container = document.querySelector('.data-table-container');
    if (!container) return;
    
    let scrollTimeout;
    container.addEventListener('scroll', function() {
        if (isLoadingData) return;
        
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const scrollTop = container.scrollTop;
            const scrollHeight = container.scrollHeight;
            const clientHeight = container.clientHeight;
            const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
            
            // Load more when user scrolls to 80% of current content
            if (scrollPercentage > 0.8 && currentLoadedRows < totalRows) {
                loadMoreRows();
            }
        }, 100);
    });
}

// Load more rows for infinite scroll
function loadMoreRows() {
    if (isLoadingData) return;
    
    isLoadingData = true;
    const startRow = currentLoadedRows + 1;
    const endRow = Math.min(currentLoadedRows + 500, totalRows);
    
    console.log(`Loading rows ${startRow} to ${endRow}`);
    updateDataStatus(`Loading rows ${startRow}-${endRow}...`);
    
    vscode.postMessage({
        command: 'loadRows',
        startRow: startRow,
        endRow: endRow
    });
}

// Navigate to specific row
function navigateToCell() {
    const rowInput = document.getElementById('row-jump');
    
    // Use default value 1 if input is empty or invalid
    let targetRow = 1;
    
    if (rowInput && rowInput.value && rowInput.value.trim() !== '') {
        targetRow = parseInt(rowInput.value) || 1;
    }
    
    console.log(`Navigate to row: ${targetRow}`);
    
    if (targetRow < 1 || targetRow > totalRows) {
        showError(`Row must be between 1 and ${totalRows}`);
        return;
    }
    
    // Update current navigated row
    currentNavigatedRow = targetRow;
    
    console.log(`Navigating to row ${targetRow}`);
    updateDataStatus(`Loading row ${targetRow}...`);
    
    vscode.postMessage({
        command: 'navigateTo',
        row: targetRow,
        column: 1 // Always use column 1
    });
}

// Navigate relative rows
function navigateRelative(offset) {
    // Use the tracked current row instead of input value
    const targetRow = Math.max(1, Math.min(currentNavigatedRow + offset, totalRows));
    
    console.log(`Navigating from row ${currentNavigatedRow} to ${targetRow} (offset: ${offset})`);
    
    // Update the input field
    const rowInput = document.getElementById('row-jump');
    if (rowInput) {
        rowInput.value = targetRow;
    }
    
    // Update current navigated row
    currentNavigatedRow = targetRow;
    
    updateDataStatus(`Loading row ${targetRow}...`);
    
    vscode.postMessage({
        command: 'navigateTo',
        row: targetRow,
        column: 1
    });
}

// Navigate to first row
function navigateToFirst() {
    const targetRow = 1;
    
    console.log(`Navigating to first row`);
    
    // Update the input field
    const rowInput = document.getElementById('row-jump');
    if (rowInput) {
        rowInput.value = targetRow;
    }
    
    // Update current navigated row
    currentNavigatedRow = targetRow;
    
    updateDataStatus(`Loading first row...`);
    
    vscode.postMessage({
        command: 'navigateTo',
        row: targetRow,
        column: 1
    });
}

// Navigate to last row
function navigateToLast() {
    const targetRow = totalRows;
    
    console.log(`Navigating to last row: ${targetRow}`);
    
    // Update the input field
    const rowInput = document.getElementById('row-jump');
    if (rowInput) {
        rowInput.value = targetRow;
    }
    
    // Update current navigated row
    currentNavigatedRow = targetRow;
    
    updateDataStatus(`Loading last row...`);
    
    vscode.postMessage({
        command: 'navigateTo',
        row: targetRow,
        column: 1
    });
}

// Update data status display
function updateDataStatus(message) {
    const statusEl = document.getElementById('data-status');
    if (statusEl) {
        if (message) {
            statusEl.textContent = message;
        } else {
            statusEl.textContent = `${totalRows.toLocaleString()} rows × ${totalColumns} columns`;
        }
    }
}

// Load more data functionality (for button, keeping for compatibility)
function loadMoreData() {
    console.log('=== Load More Data clicked ===');
    
    // Disable button during loading
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = 'Loading...';
    }
    
    // Send message to extension to load more data
    if (typeof vscode !== 'undefined') {
        vscode.postMessage({
            command: 'loadMore'
        });
    } else {
        console.error('vscode API not available');
    }
}

// Check if we need to show load more button
function checkLoadMoreButton() {
    console.log('=== Checking for Load More button ===');
    
    const table = document.querySelector('.data-table');
    if (!table) {
        console.log('No data table found, cannot add Load More button');
        return;
    }
    
    const samplingNotice = document.querySelector('.sampling-notice');
    console.log('Sampling notice found:', !!samplingNotice);
    
    if (samplingNotice) {
        console.log('Sampling notice text:', samplingNotice.textContent);
        
        const container = document.querySelector('.data-table-container');
        console.log('Data table container found:', !!container);
        
        const existingLoadMore = document.querySelector('.load-more-container');
        console.log('Existing Load More container:', !!existingLoadMore);
        
        if (container && !existingLoadMore) {
            const loadMoreContainer = document.createElement('div');
            loadMoreContainer.className = 'load-more-container';
            loadMoreContainer.style.cssText = 'text-align: center; padding: 20px;';
            
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.className = 'load-more-btn';
            loadMoreBtn.id = 'load-more-btn';
            loadMoreBtn.textContent = 'Load More Rows';
            loadMoreBtn.style.cssText = `
                padding: 8px 20px;
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
            `;
            
            // Add event listener
            loadMoreBtn.addEventListener('click', function() {
                console.log('Load More button clicked');
                loadMoreData();
            });
            
            loadMoreContainer.appendChild(loadMoreBtn);
            
            // Try inserting after the parent of container if direct insertion fails
            const parent = container.parentElement;
            if (parent) {
                parent.appendChild(loadMoreContainer);
                console.log('Load More button added to parent element');
            } else {
                container.insertAdjacentElement('afterend', loadMoreContainer);
                console.log('Load More button added after container');
            }
            
            console.log('Load More button successfully created and added to DOM');
        } else if (existingLoadMore) {
            console.log('Load More button already exists');
        }
    } else {
        console.log('No sampling notice found - all data may be loaded');
    }
}

// Variable already declared at the top of the file
// currentLoadedRows = 1000; // Track how many rows are currently loaded

// Update column headers
function updateColumnHeaders(columns) {
    const thead = document.querySelector('.data-table thead tr');
    if (!thead || !columns) return;
    
    // Keep the row number header
    const rowNumberHeader = thead.querySelector('.row-number');
    
    // Clear existing column headers (except row number)
    const existingHeaders = thead.querySelectorAll('th:not(.row-number)');
    existingHeaders.forEach(header => header.remove());
    
    // Add new column headers with numbers
    columns.forEach((col, index) => {
        const th = document.createElement('th');
        th.innerHTML = `
            <div class="column-header">
                <span class="column-number">${index + 1}</span>
                <span class="column-name">${col}</span>
            </div>
        `;
        thead.appendChild(th);
    });
    
    console.log(`Updated ${columns.length} column headers`);
}

// Append rows to existing table
function appendRowsToTable(data, startRow) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody || !data) return;
    
    const columns = data.columns || Object.keys(data.data || {});
    const rows = data.data || data;
    
    // Convert column-based data to rows
    const numRows = rows[columns[0]]?.length || 0;
    
    for (let i = 0; i < numRows; i++) {
        const tr = document.createElement('tr');
        
        // Add row number
        const rowNumTd = document.createElement('td');
        rowNumTd.className = 'row-number';
        rowNumTd.textContent = startRow + i;
        tr.appendChild(rowNumTd);
        
        // Add data cells with tabindex for focus
        columns.forEach(col => {
            const td = document.createElement('td');
            td.setAttribute('tabindex', '0');
            const value = rows[col]?.[i];
            td.textContent = formatCellValue(value);
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    }
}

// Replace table data (for navigation)
function replaceTableData(data, startRow) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody || !data) return;
    
    // Clear existing rows
    tbody.innerHTML = '';
    
    // Add new data
    appendRowsToTable(data, startRow);
}

// Scroll to specific cell
function scrollToCell(rowIndex, colIndex) {
    console.log(`Scrolling to row ${rowIndex}, col ${colIndex}`);
    const table = document.querySelector('.data-table');
    if (!table) {
        console.error('Table not found');
        return;
    }
    
    const rows = table.querySelectorAll('tbody tr');
    console.log(`Found ${rows.length} rows in table`);
    
    if (rowIndex > 0 && rowIndex <= rows.length) {
        const row = rows[rowIndex - 1]; // rowIndex is 1-based
        if (row) {
            const cells = row.querySelectorAll('td');
            // colIndex + 1 because first column is row number
            if (colIndex > 0 && colIndex <= cells.length - 1) {
                const cell = cells[colIndex]; // colIndex already accounts for row number column
                if (cell) {
                    // Make sure the cell is visible
                    cell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                    // Highlight the cell temporarily
                    cell.style.backgroundColor = 'var(--vscode-editor-findMatchHighlightBackground)';
                    setTimeout(() => {
                        cell.style.backgroundColor = '';
                    }, 2000);
                    console.log(`Scrolled to cell at row ${rowIndex}, col ${colIndex}`);
                } else {
                    console.error(`Cell not found at col ${colIndex}`);
                }
            } else {
                console.error(`Column index ${colIndex} out of range (1-${cells.length - 1})`);
            }
        } else {
            console.error(`Row not found at index ${rowIndex}`);
        }
    } else {
        console.error(`Row index ${rowIndex} out of range (1-${rows.length})`);
        // Don't automatically request navigation here to avoid loops
        // The navigateToCell function should handle out-of-range requests
    }
}

// Format cell value for display
function formatCellValue(value) {
    if (value === null || value === undefined) return 'NA';
    if (typeof value === 'number') return value.toLocaleString();
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    return String(value);
}

// Function to bind data control events
function bindDataControlEvents() {
    console.log('Binding data control events');
    
    // Load More button removed - using infinite scroll and navigation instead
    
    // Navigation buttons
    const jumpBtn = document.getElementById('jump-btn');
    if (jumpBtn) {
        jumpBtn.removeEventListener('click', navigateToCell);
        jumpBtn.addEventListener('click', navigateToCell);
        console.log('Bound navigateToCell to jump button');
    }
    
    // Row input enter key
    const rowJump = document.getElementById('row-jump');
    if (rowJump) {
        rowJump.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') navigateToCell();
        });
    }
    
    // Navigation buttons - remove existing listeners first
    const firstBtn = document.getElementById('first-btn');
    const up1000Btn = document.getElementById('up-1000-btn');
    const up100Btn = document.getElementById('up-100-btn');
    const down100Btn = document.getElementById('down-100-btn');
    const down1000Btn = document.getElementById('down-1000-btn');
    const lastBtn = document.getElementById('last-btn');
    
    if (firstBtn) {
        const newBtn = firstBtn.cloneNode(true);
        firstBtn.parentNode.replaceChild(newBtn, firstBtn);
        newBtn.addEventListener('click', navigateToFirst);
        console.log('Bound first button');
    }
    if (up1000Btn) {
        const newBtn = up1000Btn.cloneNode(true);
        up1000Btn.parentNode.replaceChild(newBtn, up1000Btn);
        newBtn.addEventListener('click', () => navigateRelative(-1000));
        console.log('Bound up-1000 button');
    }
    if (up100Btn) {
        const newBtn = up100Btn.cloneNode(true);
        up100Btn.parentNode.replaceChild(newBtn, up100Btn);
        newBtn.addEventListener('click', () => navigateRelative(-100));
        console.log('Bound up-100 button');
    }
    if (down100Btn) {
        const newBtn = down100Btn.cloneNode(true);
        down100Btn.parentNode.replaceChild(newBtn, down100Btn);
        newBtn.addEventListener('click', () => navigateRelative(100));
        console.log('Bound down-100 button');
    }
    if (down1000Btn) {
        const newBtn = down1000Btn.cloneNode(true);
        down1000Btn.parentNode.replaceChild(newBtn, down1000Btn);
        newBtn.addEventListener('click', () => navigateRelative(1000));
        console.log('Bound down-1000 button');
    }
    if (lastBtn) {
        const newBtn = lastBtn.cloneNode(true);
        lastBtn.parentNode.replaceChild(newBtn, lastBtn);
        newBtn.addEventListener('click', navigateToLast);
        console.log('Bound last button');
    }
    
    // Column navigation buttons
    const prevBtn = document.getElementById('prev-columns-btn');
    const nextBtn = document.getElementById('next-columns-btn');
    const showAllBtn = document.getElementById('show-all-columns-btn');
    
    if (prevBtn) {
        prevBtn.removeEventListener('click', prevColumns); // Remove any existing listener
        prevBtn.addEventListener('click', prevColumns);
        console.log('Bound prevColumns to button');
    }
    
    if (nextBtn) {
        nextBtn.removeEventListener('click', nextColumns); // Remove any existing listener
        nextBtn.addEventListener('click', nextColumns);
        console.log('Bound nextColumns to button');
    }
    
    if (showAllBtn) {
        showAllBtn.removeEventListener('click', showAllColumns); // Remove any existing listener
        showAllBtn.addEventListener('click', showAllColumns);
        console.log('Bound showAllColumns to button');
    }
    
    // Search control
    const searchInput = document.getElementById('data-search');
    if (searchInput) {
        // Remove any existing listeners
        const newInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newInput, searchInput);
        
        // Add new search functionality
        newInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchData();
            }, 300); // Debounce search
        });
        
        // Add Enter/Escape key handling
        newInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                nextSearchResult();
            } else if (e.key === 'Escape') {
                e.target.value = '';
                searchData();
            }
        });
    }
    
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.removeEventListener('click', refreshData);
        refreshBtn.addEventListener('click', refreshData);
    }
    
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.removeEventListener('click', showExportMenu);
        exportBtn.addEventListener('click', showExportMenu);
    }
    
    // Setup cell click handler for the table
    const dataTable = document.querySelector('.data-table');
    if (dataTable) {
        dataTable.addEventListener('click', handleCellClick);
        console.log('Cell click handler added to table');
    }
}

// Track selected cell
let selectedCell = null;
let selectedRow = null;

// Handle cell selection
function handleCellClick(event) {
    const cell = event.target.closest('td');
    if (!cell) return;
    
    const row = cell.parentElement;
    
    // Remove previous selection
    if (selectedCell) {
        selectedCell.classList.remove('selected-cell');
    }
    if (selectedRow) {
        selectedRow.classList.remove('selected-row');
    }
    
    // Add new selection
    cell.classList.add('selected-cell');
    row.classList.add('selected-row');
    
    selectedCell = cell;
    selectedRow = row;
    
    // Get row and column numbers
    const rowNum = row.querySelector('.row-number')?.textContent || '';
    const colIndex = Array.from(row.cells).indexOf(cell);
    
    console.log(`Cell selected: Row ${rowNum}, Column ${colIndex}`);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - Initializing RDS Viewer');
    
    // Initialize data tracking from initial data
    if (typeof initialData !== 'undefined' && initialData) {
        console.log('Initial data available:', initialData);
        if (initialData._metadata) {
            totalRows = initialData._metadata.totalRows || 0;
            currentLoadedRows = initialData._metadata.loadedRows || 500;
        } else if (initialData.totalRows) {
            totalRows = initialData.totalRows;
            currentLoadedRows = initialData.sampledRows || initialData.totalRows;
        }
        
        if (initialData.totalCols) {
            totalColumns = initialData.totalCols;
        }
        
        // Initialize current row to 1
        currentNavigatedRow = 1;
    }
    
    if (typeof summaryData !== 'undefined' && summaryData) {
        console.log('Summary data available:', summaryData);
        if (summaryData.dataframe) {
            totalRows = summaryData.dataframe.dimensions.rows || totalRows;
            totalColumns = summaryData.dataframe.dimensions.cols || 0;
        }
    }
    
    console.log(`Initialized with ${totalRows} total rows, ${currentLoadedRows} loaded, ${totalColumns} columns`);
    
    // Bind tab click events - remove any existing listeners first
    const summaryTab = document.getElementById('summary-tab-btn');
    const dataTab = document.getElementById('data-tab-btn');
    
    if (summaryTab) {
        console.log('Summary tab button found');
        // Clone to remove all existing event listeners
        const newSummaryTab = summaryTab.cloneNode(true);
        summaryTab.parentNode.replaceChild(newSummaryTab, summaryTab);
        newSummaryTab.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Summary tab clicked (from event)');
            switchMainTab('summary');
        });
    } else {
        console.error('Summary tab button not found');
    }
    
    if (dataTab) {
        console.log('Data tab button found');
        // Clone to remove all existing event listeners
        const newDataTab = dataTab.cloneNode(true);
        dataTab.parentNode.replaceChild(newDataTab, dataTab);
        newDataTab.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Data tab clicked (from event)');
            switchMainTab('data');
        });
    } else {
        console.error('Data tab button not found');
    }
    
    // Also check for any tab-button elements
    document.querySelectorAll('.tab-button').forEach((btn, index) => {
        console.log(`Found tab button ${index}:`, btn.dataset.tab);
    });
    
    // Check if panels exist
    const summaryPanel = document.getElementById('summary-panel');
    const dataPanel = document.getElementById('data-panel');
    console.log('Summary panel exists:', !!summaryPanel);
    console.log('Data panel exists:', !!dataPanel);
    
    if (dataPanel) {
        console.log('Data panel HTML length:', dataPanel.innerHTML.length);
        console.log('Data panel first 200 chars:', dataPanel.innerHTML.substring(0, 200));
    }
    
    // Initialize column navigation (try even if not on data tab)
    setTimeout(() => {
        // Try to bind events for data controls if they exist
        bindDataControlEvents();
        
        initColumnNavigation();
        
        // No need to check for load more button, it's in HTML now
        // Just bind the events again
        bindDataControlEvents();
        
        // Setup infinite scroll
        setupInfiniteScroll();
        
        // Check if we're already on data tab
        const dataPanel = document.getElementById('data-panel');
        if (dataPanel && dataPanel.classList.contains('active')) {
            console.log('Data panel is active on load, binding events again');
            setTimeout(() => {
                bindDataControlEvents();
                setupInfiniteScroll();
            }, 1000);
        }
    }, 500); // Give time for DOM to fully render
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + F for search
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            const searchInput = document.getElementById('data-search');
            if (searchInput) {
                searchInput.focus();
            }
        }
        
        // Arrow keys for column navigation
        if (e.altKey && e.key === 'ArrowRight') {
            e.preventDefault();
            nextColumns();
        }
        if (e.altKey && e.key === 'ArrowLeft') {
            e.preventDefault();
            prevColumns();
        }
    });
});