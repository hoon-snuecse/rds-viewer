import * as vscode from 'vscode';
import { RBridgeService } from '../services/RBridgeService';
import { RdsSummary } from '../types';
// import { PaginationService } from '../services/PaginationService';

export class RdsCustomEditor implements vscode.CustomReadonlyEditorProvider {
    
    public static readonly viewType = 'rdsViewer.editor';
    private currentData: Map<string, any> = new Map(); // Store current data for each file
    private loadedRows: Map<string, number> = new Map(); // Track loaded rows for each file
    private currentTab: Map<string, string> = new Map(); // Track current tab for each file
    
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly rBridge: RBridgeService
    ) {}
    
    /**
     * Called when a custom editor is opened
     */
    public async openCustomDocument(
        uri: vscode.Uri,
        _openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken
    ): Promise<vscode.CustomDocument> {
        console.log('RDS Custom Editor - Opening document:', uri.fsPath);
        return { uri, dispose: () => {} };
    }
    
    public async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        console.log('RDS Custom Editor - Resolving editor for:', document.uri.fsPath);
        
        // Setup webview
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'media'),
                vscode.Uri.joinPath(this.context.extensionUri, 'out')
            ]
        };
        
        // Set initial content
        webviewPanel.webview.html = this.getLoadingHtml();
        console.log('RDS Custom Editor - Loading content...');
        
        // Load RDS data
        await this.updateWebview(document.uri, webviewPanel);
        
        // Handle messages from webview
        webviewPanel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'tabChanged':
                        // Track current tab
                        this.currentTab.set(document.uri.fsPath, message.tab);
                        console.log(`Tab changed to: ${message.tab}`);
                        break;
                    case 'switchTab':
                        await this.handleTabSwitch(message.tab, document.uri, webviewPanel);
                        break;
                    case 'paginate':
                        await this.handlePagination(message.action, message.pageSize, document.uri, webviewPanel);
                        break;
                    case 'search':
                        // Handle search in webview
                        break;
                    case 'export':
                        await this.handleExport(message.format, document.uri);
                        break;
                    case 'refresh':
                        await this.updateWebview(document.uri, webviewPanel);
                        break;
                    case 'loadMore':
                        // Load more rows functionality
                        await this.handleLoadMore(document.uri, webviewPanel);
                        break;
                    case 'loadRows':
                        // Load specific rows for infinite scroll or navigation
                        await this.handleLoadRows(document.uri, webviewPanel, message.startRow, message.endRow);
                        break;
                    case 'navigateTo':
                        // Navigate to specific row/column
                        await this.handleNavigateTo(document.uri, webviewPanel, message.row, message.column);
                        break;
                }
            }
        );
        
        // No need to watch for changes in binary files
        webviewPanel.onDidDispose(() => {
            // Cleanup if needed
        });
    }
    
    private async updateWebview(uri: vscode.Uri, panel: vscode.WebviewPanel): Promise<void> {
        try {
            // Show loading message first
            panel.webview.html = this.getLoadingHtml();
            
            // Get file stats
            const fs = require('fs');
            const path = require('path');
            const stats = fs.statSync(uri.fsPath);
            const fileName = path.basename(uri.fsPath);
            
            // Get RDS summary
            const summary = await this.rBridge.getRdsSummary(uri.fsPath);
            
            // Add file info to summary
            summary.file = {
                name: fileName,
                size: this.formatFileSize(stats.size),
                modified: stats.mtime.toISOString().split('T')[0] + ' ' + stats.mtime.toTimeString().split(' ')[0]
            };
            
            // Check if we have cached data
            let initialData = this.currentData.get(uri.fsPath);
            let loadedRowCount = this.loadedRows.get(uri.fsPath);
            
            if (!initialData) {
                // Check if it's a large dataset - threshold at 500 rows for performance
                const isLargeDataset = summary.dataframe && summary.dataframe.dimensions && summary.dataframe.dimensions.rows > 500;
                const maxRows = isLargeDataset ? 500 : undefined; // Load first 500 rows for large datasets
                
                // Get data with row limit for large files
                initialData = await this.rBridge.readRdsAsJson(uri.fsPath, maxRows);
                
                // Store the data and loaded count
                this.currentData.set(uri.fsPath, initialData);
                loadedRowCount = maxRows || summary.dataframe?.dimensions?.rows || 0;
                this.loadedRows.set(uri.fsPath, loadedRowCount);
                
                // Add metadata about sampling
                if (isLargeDataset && initialData && summary.dataframe?.dimensions) {
                    initialData._metadata = {
                        totalRows: summary.dataframe.dimensions.rows,
                        loadedRows: loadedRowCount,
                        sampled: true
                    };
                }
            }
            
            console.log(`Loading RDS file: ${summary.dataframe?.dimensions.rows || 0} total rows, ${loadedRowCount || 'all'} loaded`);
            
            // Generate HTML with tabs, preserving current tab state
            const activeTab = this.currentTab.get(uri.fsPath) || 'summary';
            panel.webview.html = this.getHtmlForWebview(panel.webview, summary, initialData, uri.fsPath, activeTab);
            
        } catch (error) {
            panel.webview.html = this.getErrorHtml(error);
        }
    }
    
    private getHtmlForWebview(webview: vscode.Webview, summary: RdsSummary, data: any, _filePath: string, activeTab: string = 'summary'): string {
        const timestamp = Date.now();
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'tabbed-viewer.js')) + `?v=${timestamp}`;
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'tabbed-viewer.css')) + `?v=${timestamp}`;
        const commonStyleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'style.css')) + `?v=${timestamp}`;
        
        const nonce = getNonce();
        
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${commonStyleUri}" rel="stylesheet">
                <link href="${styleUri}" rel="stylesheet">
                <title>RDS Viewer</title>
            </head>
            <body>
                <div class="rds-viewer-container">
                    <!-- Empty main content area (tabs will fill this) -->
                    <div class="main-content" style="display: none;">
                    </div>
                    
                    <!-- Tab Navigation -->
                    <div class="tab-navigation">
                        <button class="tab-button ${activeTab === 'summary' ? 'active' : ''}" data-tab="summary" id="summary-tab-btn">
                            요약
                        </button>
                        <button class="tab-button ${activeTab === 'data' ? 'active' : ''}" data-tab="data" id="data-tab-btn">
                            데이터
                        </button>
                    </div>
                    
                    <!-- Tab Content -->
                    <div class="tab-content">
                        <div class="tab-panel ${activeTab === 'summary' ? 'active' : ''}" id="summary-panel">
                            ${this.generateFullSummary(summary)}
                        </div>
                        <div class="tab-panel ${activeTab === 'data' ? 'active' : ''}" id="data-panel">
                            ${this.generateDataPanel(data, summary)}
                        </div>
                    </div>
                </div>
                
                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    const summaryData = ${JSON.stringify(summary)};
                    const initialData = ${JSON.stringify(data)};
                </script>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
    
    
    private generateFullSummary(summary: RdsSummary): string {
        let html = '<div class="full-summary">';
        
        // File Information section
        html += `
            <div class="summary-section">
                <h3>📁 File Information</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="label">Name:</span>
                        <span class="value">${summary.file?.name || 'Unknown'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Size:</span>
                        <span class="value">${summary.file?.size || summary.object.size}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Modified:</span>
                        <span class="value">${summary.file?.modified || 'Unknown'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Type:</span>
                        <span class="value">${summary.object.type}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Class:</span>
                        <span class="value">${Array.isArray(summary.object.class) ? summary.object.class.join(', ') : summary.object.class}</span>
                    </div>
                </div>
            </div>
        `;
        
        // Data Frame Summary if available
        if (summary.dataframe) {
            html += `
                <div class="summary-section">
                    <h3>📊 Data Frame Summary</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="label">Dimensions:</span>
                            <span class="value">${summary.dataframe.dimensions.rows.toLocaleString()} rows × ${summary.dataframe.dimensions.cols} columns</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Complete Rows:</span>
                            <span class="value">${summary.dataframe.missing.completeRows.toLocaleString()} (${summary.dataframe.missing.completeRowsPercent}%)</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Missing Cells:</span>
                            <span class="value">${(summary.dataframe.missing.totalMissing || summary.dataframe.missing.missingCells || 0).toLocaleString()} (${summary.dataframe.missing.missingPercent}%)</span>
                        </div>
                    </div>
                </div>
            `;
            
            // Variables section
            if (summary.dataframe.variables) {
                const variables = summary.dataframe.variables;
                const varNames = Object.keys(variables);
                
                html += `
                    <div class="summary-section">
                        <h3>📋 Variables (${varNames.length})</h3>
                        <div class="variables-table">
                            <table class="summary-table">
                                <thead>
                                    <tr>
                                        <th>Variable</th>
                                        <th>Type</th>
                                        <th>Class</th>
                                        <th>Unique</th>
                                        <th>Missing</th>
                                        <th>Summary</th>
                                    </tr>
                                </thead>
                                <tbody>
                `;
                
                varNames.forEach(name => {
                    const info = variables[name];
                    html += `
                        <tr>
                            <td class="var-name">${name}</td>
                            <td>${info.type}</td>
                            <td>${info.class || '-'}</td>
                            <td>${info.unique !== undefined ? info.unique.toLocaleString() : '-'}</td>
                            <td>${info.missing !== undefined ? `${info.missing} (${info.missingPercent}%)` : '0 (0%)'}</td>
                            <td class="summary-text">${info.summary || '-'}</td>
                        </tr>
                    `;
                });
                
                html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            }
        }
        
        // Matrix summary if available
        if (summary.matrix) {
            html += `
                <div class="summary-section">
                    <h3>🔢 Matrix Summary</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="label">Dimensions:</span>
                            <span class="value">${summary.matrix.dimensions.rows} × ${summary.matrix.dimensions.cols}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Type:</span>
                            <span class="value">${summary.matrix.type}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Vector summary if available
        if (summary.vector) {
            html += `
                <div class="summary-section">
                    <h3>📈 Vector Summary</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="label">Length:</span>
                            <span class="value">${summary.vector.length.toLocaleString()}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Type:</span>
                            <span class="value">${summary.vector.type}</span>
                        </div>
                        ${summary.vector.unique !== undefined ? `
                        <div class="info-item">
                            <span class="label">Unique Values:</span>
                            <span class="value">${summary.vector.unique.toLocaleString()}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        return html;
    }
    
    
    private generateDataPanel(data: any, summary: RdsSummary): string {
        let html = '<div class="data-content">';
        
        console.log('generateDataPanel - data:', data);
        console.log('generateDataPanel - summary:', summary);
        
        // Check if data is available
        if (!data) {
            return '<div class="data-content"><p>No data available to display</p></div>';
        }
        
        // Handle different data types - check both data structure and summary
        if (summary.dataframe) {
            // Check for different possible data structures
            if (data.columns && data.rows) {
                // Row-based format
                html += this.generateDataFrameFromRows(data, summary.dataframe);
            } else if (data.columns && data.data) {
                // Column-based format
                html += this.generateDataFrameFromColumns(data, summary.dataframe);
            } else if (Array.isArray(data)) {
                // Data might be just an array
                html += this.generateDataFrameFromArray(data, summary.dataframe);
            } else if (typeof data === 'object') {
                // Data might be column-oriented object
                html += this.generateDataFrameFromObject(data, summary.dataframe);
            } else {
                html += '<p>Unexpected dataframe format</p>';
            }
        } else if (summary.matrix) {
            if (data.data && data.dims) {
                html += this.generateMatrixFromStructured(data, summary.matrix);
            } else if (Array.isArray(data)) {
                html += this.generateMatrixTable(data, summary.matrix);
            } else {
                html += this.generateDataFrameFromObject(data, summary.matrix);
            }
        } else if (summary.vector || summary.object?.type === 'integer' || summary.object?.type === 'numeric') {
            if (Array.isArray(data)) {
                html += this.generateVectorTable(data, summary.vector);
            } else if (typeof data === 'object') {
                // Convert object to array
                const values = Object.values(data);
                html += this.generateVectorTable(values, summary.vector);
            } else {
                html += this.generateVectorTable([data], summary.vector);
            }
        } else if (summary.list) {
            html += this.generateListView(data, summary.list);
        } else {
            // Try to display any data we have
            console.log('Unhandled data type:', summary.object?.type, 'Data:', data);
            if (data) {
                html += `<div class="generic-data"><pre>${JSON.stringify(data, null, 2)}</pre></div>`;
            } else {
                html += `<p>Data format not supported for table view. Type: ${summary.object?.type || 'unknown'}</p>`;
            }
        }
        
        html += '</div>';
        return html;
    }
    
    private generateDataFrameFromRows(data: any, _dfSummary: any): string {
        const columns = data.columns || [];
        const rows = data.rows || [];
        
        return this.buildDataTable(columns, rows, true, null);
    }
    
    private generateDataFrameFromColumns(data: any, _dfSummary: any): string {
        const columns = data.columns || [];
        const columnData = data.data || {};
        const totalRows = data.totalRows || 0;
        const sampledRows = data.sampledRows || 0;
        
        // Convert column-based to row-based - use all sampled rows
        const numRows = sampledRows || columnData[columns[0]]?.length || 0;
        const rows = [];
        
        for (let i = 0; i < numRows; i++) { // Use all available rows
            const row: any = {};
            columns.forEach((col: string) => {
                row[col] = columnData[col]?.[i];
            });
            rows.push(row);
        }
        
        // Add metadata about sampling - mark as sampled if not all rows are loaded
        const metadata = (totalRows > 0 && sampledRows > 0 && totalRows > sampledRows) ? {
            totalRows,
            sampledRows,
            sampled: true
        } : null;
        
        console.log(`generateDataFrameFromColumns: totalRows=${totalRows}, sampledRows=${sampledRows}, metadata=${JSON.stringify(metadata)}`);
        
        return this.buildDataTable(columns, rows, true, metadata);
    }
    
    private generateMatrixFromStructured(data: any, _matrixSummary: any): string {
        const matrixData = data.data || {};
        const dims = data.dims || [0, 0];
        const columns = Object.keys(matrixData);
        
        // Convert to row format
        const numRows = dims[0];
        const rows = [];
        
        for (let i = 0; i < numRows; i++) {
            const row: any[] = [];
            columns.forEach(col => {
                row.push(matrixData[col]?.[i]);
            });
            rows.push(row);
        }
        
        return this.buildDataTable(columns, rows, false, null);
    }
    
    private generateDataFrameFromArray(data: any[], _dfSummary: any): string {
        // Handle case where data is just an array of rows
        if (!data || data.length === 0) {
            return '<p>No data to display</p>';
        }
        
        // Try to extract column names from first row or summary
        const columns = Object.keys(data[0] || {});
        const rows = data;
        
        return this.buildDataTable(columns, rows, true, null);
    }
    
    private generateDataFrameFromObject(data: any, _dfSummary: any): string {
        // Handle column-oriented data
        const columns = Object.keys(data);
        if (columns.length === 0) {
            return '<p>No columns to display</p>';
        }
        
        // Convert column-oriented to row-oriented
        const numRows = data[columns[0]]?.length || 0;
        const rows = [];
        
        for (let i = 0; i < numRows; i++) {
            const row: any[] = [];
            columns.forEach(col => {
                row.push(data[col][i]);
            });
            rows.push(row);
        }
        
        return this.buildDataTable(columns, rows, false, null);
    }
    
    private buildDataTable(columns: string[], rows: any[], isObjectRows: boolean = false, metadata?: any): string {
        // Use provided metadata or check for metadata in rows
        const dataMetadata = metadata || (rows as any)._metadata;
        const actualRows = Array.isArray(rows) ? rows : [];
        const totalRows = dataMetadata?.totalRows || actualRows.length;
        
        // For performance, limit initial display but show all available rows
        // If data is sampled (from R), use all rows since they're already limited
        // If not sampled, show all rows (backend already limits to 1000 for large datasets)
        const displayRows = actualRows;
        
        let html = `
            <div class="data-header">
                <div class="data-controls">
                    <div class="file-info">
                        <span class="row-count data-dimensions" id="data-status">${totalRows.toLocaleString()} rows × ${columns.length} columns</span>
                    </div>
                    <div class="navigation-controls">
                        <button class="btn-nav-text" id="first-btn" title="Go to first row (Row 1)">⏮ First</button>
                        <button class="btn-nav-text" id="up-1000-btn" title="Previous 1000 rows">≪ -1K</button>
                        <button class="btn-nav-text" id="up-100-btn" title="Previous 100 rows">◀ -100</button>
                        <input type="number" id="row-jump" placeholder="Row #" min="1" max="${totalRows}" style="width: 80px;" />
                        <button class="btn-icon" id="jump-btn" title="Go to row">GO</button>
                        <button class="btn-nav-text" id="down-100-btn" title="Next 100 rows">▶ +100</button>
                        <button class="btn-nav-text" id="down-1000-btn" title="Next 1000 rows">≫ +1K</button>
                        <button class="btn-nav-text" id="last-btn" title="Go to last row (Row ${totalRows.toLocaleString()})">⏭ Last</button>
                    </div>
                    <div class="column-navigation">
                        <button class="btn-icon" id="prev-columns-btn" title="Previous columns (Alt+←)">◀</button>
                        <span id="column-navigation-info">All columns</span>
                        <button class="btn-icon" id="next-columns-btn" title="Next columns (Alt+→)">▶</button>
                        <button class="btn-icon" id="show-all-columns-btn" title="Show all columns">⊞</button>
                    </div>
                    <input type="text" id="data-search" placeholder="Search..." />
                    <button class="btn-icon" id="refresh-btn" title="Refresh">🔄</button>
                    <button class="btn-icon" id="export-btn" title="Export">💾</button>
                </div>
            </div>
            <div class="data-table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="row-number">#</th>
        `;
        
        // Add column headers with column numbers
        columns.forEach((col: string, index: number) => {
            html += `<th>
                <div class="column-header">
                    <span class="column-number">${index + 1}</span>
                    <span class="column-name">${this.escapeHtml(String(col))}</span>
                </div>
            </th>`;
        });
        
        html += `
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Add data rows - use displayRows instead of rows
        displayRows.forEach((row: any, index: number) => {
            // Skip metadata object if present
            if (row === dataMetadata) return;
            
            html += `
                        <tr>
                            <td class="row-number">${index + 1}</td>
            `;
            
            if (isObjectRows && typeof row === 'object' && !Array.isArray(row)) {
                // Row is an object, extract values by column names
                columns.forEach(col => {
                    const cellValue = this.formatCellValue(row[col]);
                    html += `<td tabindex="0">${this.escapeHtml(cellValue)}</td>`;
                });
            } else if (Array.isArray(row)) {
                // Row is an array
                row.forEach((cell: any) => {
                    const cellValue = this.formatCellValue(cell);
                    html += `<td tabindex="0">${this.escapeHtml(cellValue)}</td>`;
                });
            } else {
                // Single value row
                html += `<td tabindex="0">${this.escapeHtml(this.formatCellValue(row))}</td>`;
            }
            
            html += `
                        </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        // Removed Load More button - using infinite scroll and navigation buttons instead
        
        return html;
    }
    
    private generateListView(data: any, listSummary: any): string {
        return `
            <div class="list-view">
                <h3>List Object</h3>
                <p>List with ${listSummary.length} elements</p>
                <pre>${JSON.stringify(data, null, 2)}</pre>
            </div>
        `;
    }
    
    private generateMatrixTable(data: any[], matrixSummary: any): string {
        const maxRows = 100;
        const displayData = data.slice(0, maxRows);
        
        let html = `
            <div class="data-table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="row-number">#</th>
        `;
        
        // Generate column headers for matrix
        const ncol = matrixSummary.dimensions.cols;
        for (let i = 0; i < ncol; i++) {
            html += `<th>Col${i + 1}</th>`;
        }
        
        html += `
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Add matrix data
        displayData.forEach((row: any, index: number) => {
            html += `
                        <tr>
                            <td class="row-number">${index + 1}</td>
            `;
            
            if (Array.isArray(row)) {
                row.forEach((cell: any) => {
                    html += `<td>${this.escapeHtml(this.formatCellValue(cell))}</td>`;
                });
            } else {
                html += `<td tabindex="0">${this.escapeHtml(this.formatCellValue(row))}</td>`;
            }
            
            html += `
                        </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        return html;
    }
    
    private generateVectorTable(data: any[], _vectorSummary: any): string {
        const maxRows = 100;
        const displayData = data.slice(0, maxRows);
        
        let html = `
            <div class="data-table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="row-number">Index</th>
                            <th>Value</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        displayData.forEach((value: any, index: number) => {
            html += `
                        <tr>
                            <td class="row-number">${index + 1}</td>
                            <td>${this.escapeHtml(this.formatCellValue(value))}</td>
                        </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        if (data.length > maxRows) {
            html += `
                <div class="pagination-info">
                    <p>Showing first ${maxRows} values. Total: ${data.length} values</p>
                </div>
            `;
        }
        
        return html;
    }
    
    private formatCellValue(value: any): string {
        if (value === null || value === undefined) {
            return 'NA';
        }
        if (typeof value === 'number') {
            return isNaN(value) ? 'NaN' : value.toLocaleString();
        }
        if (typeof value === 'boolean') {
            return value ? 'TRUE' : 'FALSE';
        }
        return String(value);
    }
    
    private escapeHtml(text: string): string {
        const map: { [key: string]: string } = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }
    
    private generateTreeNode(obj: any, name: string, level: number): string {
        const indent = level * 20;
        let html = '';
        
        if (obj === null || obj === undefined) {
            html += `
                <div class="tree-item" style="margin-left: ${indent}px">
                    <span class="tree-label">${name}:</span>
                    <span class="tree-value">NULL</span>
                </div>
            `;
        } else if (typeof obj === 'object' && !Array.isArray(obj)) {
            // Object
            html += `
                <div class="tree-item expandable" style="margin-left: ${indent}px" onclick="toggleTreeNode(this)">
                    <span class="tree-arrow">▶</span>
                    <span class="tree-icon">📁</span>
                    <span class="tree-label">${name}</span>
                    <span class="tree-type">list[${Object.keys(obj).length}]</span>
                </div>
                <div class="tree-children" style="display: none;">
            `;
            
            Object.keys(obj).forEach(key => {
                html += this.generateTreeNode(obj[key], key, level + 1);
            });
            
            html += '</div>';
        } else if (Array.isArray(obj)) {
            // Array
            const displayLength = Math.min(obj.length, 10);
            html += `
                <div class="tree-item expandable" style="margin-left: ${indent}px" onclick="toggleTreeNode(this)">
                    <span class="tree-arrow">▶</span>
                    <span class="tree-icon">📊</span>
                    <span class="tree-label">${name}</span>
                    <span class="tree-type">array[${obj.length}]</span>
                </div>
                <div class="tree-children" style="display: none;">
            `;
            
            for (let i = 0; i < displayLength; i++) {
                html += this.generateTreeNode(obj[i], `[${i}]`, level + 1);
            }
            
            if (obj.length > displayLength) {
                html += `
                    <div class="tree-item" style="margin-left: ${(level + 1) * 20}px">
                        <span class="tree-label">... ${obj.length - displayLength} more items</span>
                    </div>
                `;
            }
            
            html += '</div>';
        } else {
            // Primitive value
            html += `
                <div class="tree-item" style="margin-left: ${indent}px">
                    <span class="tree-label">${name}:</span>
                    <span class="tree-value">${this.formatCellValue(obj)}</span>
                    <span class="tree-type">${typeof obj}</span>
                </div>
            `;
        }
        
        return html;
    }
    
    private formatFileSize(bytes: number): string {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
    
    private getLoadingHtml(): string {
        return `<!DOCTYPE html>
            <html>
            <body style="padding: 20px;">
                <h2>Loading RDS file...</h2>
            </body>
            </html>`;
    }
    
    private getErrorHtml(error: any): string {
        return `<!DOCTYPE html>
            <html>
            <body style="padding: 20px;">
                <h2>Error loading RDS file</h2>
                <p>${error.message || error}</p>
            </body>
            </html>`;
    }
    
    private async handleTabSwitch(_tab: string, _uri: vscode.Uri, _panel: vscode.WebviewPanel): Promise<void> {
        // Handle tab switching logic
        // May need to load additional data for certain tabs
    }
    
    private async handlePagination(_action: string, _pageSize: number | undefined, _uri: vscode.Uri, _panel: vscode.WebviewPanel): Promise<void> {
        // Handle pagination
    }
    
    private async handleLoadRows(uri: vscode.Uri, panel: vscode.WebviewPanel, startRow: number, endRow: number): Promise<void> {
        try {
            const filePath = uri.fsPath;
            const summary = await this.rBridge.getRdsSummary(filePath);
            const totalRows = summary.dataframe?.dimensions?.rows || 0;
            
            // Ensure we don't go beyond total rows
            const actualEndRow = Math.min(endRow, totalRows);
            
            console.log(`Loading rows ${startRow} to ${actualEndRow}`);
            
            // Load specific range of data
            const data = await this.rBridge.readRdsAsRange(filePath, startRow, actualEndRow);
            
            // Update loaded rows tracking
            const currentLoaded = this.loadedRows.get(filePath) || 500;
            this.loadedRows.set(filePath, Math.max(currentLoaded, actualEndRow));
            
            // Get column names from the data
            let columns: string[] = [];
            if (data && typeof data === 'object') {
                columns = Object.keys(data);
            }
            
            // Send row data to frontend with column information
            panel.webview.postMessage({
                command: 'appendRows',
                data: data,
                columns: columns,
                startRow: startRow,
                endRow: actualEndRow,
                totalRows: totalRows
            });
        } catch (error) {
            console.error('Failed to load rows:', error);
            panel.webview.postMessage({
                command: 'showError',
                error: `Failed to load rows: ${error}`
            });
        }
    }
    
    private async handleNavigateTo(uri: vscode.Uri, panel: vscode.WebviewPanel, targetRow: number, targetColumn: number): Promise<void> {
        try {
            const filePath = uri.fsPath;
            const summary = await this.rBridge.getRdsSummary(filePath);
            const totalRows = summary.dataframe?.dimensions?.rows || 0;
            const totalCols = summary.dataframe?.dimensions?.cols || 0;
            
            // Validate row and column
            const row = Math.max(1, Math.min(targetRow, totalRows));
            const col = Math.max(1, Math.min(targetColumn, totalCols));
            
            // Load data starting from the target row
            // Special handling for last row navigation
            let startRow: number;
            let endRow: number;
            
            // Check if this is a "last row" navigation (target is totalRows)
            if (row === totalRows) {
                // For last row, load 500 rows ending at the last row
                endRow = totalRows;
                startRow = Math.max(1, totalRows - 499);
            } else if (row > totalRows - 250) {
                // Near the end, load 500 rows ending at target or totalRows
                endRow = Math.min(totalRows, row + 250);
                startRow = Math.max(1, endRow - 499);
            } else {
                // Normal case: load 500 rows starting from target
                startRow = row;
                endRow = Math.min(totalRows, row + 499);
            }
            
            console.log(`Navigating to row ${row}, column ${col}`);
            
            // Load the data range
            const data = await this.rBridge.readRdsAsRange(filePath, startRow, endRow);
            
            // Send navigation data
            panel.webview.postMessage({
                command: 'navigateToCell',
                data: data,
                targetRow: row,
                targetColumn: col,
                startRow: startRow,
                endRow: endRow,
                totalRows: totalRows,
                totalColumns: totalCols
            });
        } catch (error) {
            console.error('Failed to navigate:', error);
            panel.webview.postMessage({
                command: 'showError',
                error: `Failed to navigate: ${error}`
            });
        }
    }
    
    private async handleLoadMore(uri: vscode.Uri, panel: vscode.WebviewPanel): Promise<void> {
        try {
            const filePath = uri.fsPath;
            const currentRows = this.loadedRows.get(filePath) || 500;
            const additionalRows = 500; // Load 500 more rows each time
            const newMaxRows = currentRows + additionalRows;
            
            // Remember we're on the data tab
            this.currentTab.set(filePath, 'data');
            
            console.log(`Loading more rows: current=${currentRows}, loading up to ${newMaxRows}`);
            
            // Get additional data from R
            const summary = await this.rBridge.getRdsSummary(filePath);
            const totalRows = summary.dataframe?.dimensions?.rows || 0;
            
            if (currentRows >= totalRows) {
                panel.webview.postMessage({
                    command: 'showError',
                    error: 'All rows are already loaded'
                });
                return;
            }
            
            // Load data with new limit
            const data = await this.rBridge.readRdsAsJson(filePath, Math.min(newMaxRows, totalRows));
            
            // Store the new loaded count
            this.loadedRows.set(filePath, Math.min(newMaxRows, totalRows));
            this.currentData.set(filePath, data);
            
            // Add metadata
            if (data && summary.dataframe?.dimensions) {
                data._metadata = {
                    totalRows: totalRows,
                    loadedRows: Math.min(newMaxRows, totalRows),
                    sampled: newMaxRows < totalRows
                };
            }
            
            // Send only the data update to the webview (no full page refresh)
            panel.webview.postMessage({
                command: 'updateData',
                data: data,
                dataPanel: this.generateDataPanel(data, summary)
            });
            
            console.log(`Successfully loaded ${Math.min(newMaxRows, totalRows)} rows`);
        } catch (error) {
            console.error('Failed to load more rows:', error);
            panel.webview.postMessage({
                command: 'showError',
                error: 'Failed to load more rows: ' + error
            });
        }
    }
    
    private async handleExport(format: string, uri: vscode.Uri): Promise<void> {
        // Trigger export commands
        switch (format) {
            case 'csv':
                vscode.commands.executeCommand('rds.exportCsv', uri);
                break;
            case 'excel':
                vscode.commands.executeCommand('rds.exportExcel', uri);
                break;
            case 'json':
                vscode.commands.executeCommand('rds.exportJson', uri);
                break;
        }
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}