import * as vscode from 'vscode';
import { RdsSummary } from '../types';
import { PaginationService } from '../services/PaginationService';

export class RdsSummaryPanel {
    public static currentPanel: RdsSummaryPanel | undefined;
    public static readonly viewType = 'rdsSummary';
    
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _summary: RdsSummary;
    private _filePath: string;
    private _fullData?: any;
    private _paginationService: PaginationService;
    
    public static createOrShow(extensionUri: vscode.Uri, summary: RdsSummary, filePath: string, fullData?: any) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        
        // If we already have a panel, show it
        if (RdsSummaryPanel.currentPanel) {
            RdsSummaryPanel.currentPanel._panel.reveal(column);
            RdsSummaryPanel.currentPanel._update(summary, filePath, fullData);
            return;
        }
        
        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            RdsSummaryPanel.viewType,
            `RDS: ${summary.file.name}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );
        
        RdsSummaryPanel.currentPanel = new RdsSummaryPanel(panel, extensionUri, summary, filePath, fullData);
    }
    
    public static refresh() {
        if (RdsSummaryPanel.currentPanel) {
            RdsSummaryPanel.currentPanel._updateWebview();
        }
    }
    
    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, summary: RdsSummary, filePath: string, fullData?: any) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._summary = summary;
        this._filePath = filePath;
        this._fullData = fullData;
        this._paginationService = new PaginationService(100);
        
        // Setup pagination if we have data
        if (this._fullData && Array.isArray(this._fullData)) {
            this._paginationService.setData(this._fullData);
        }
        
        // Set the webview's initial html content
        this._updateWebview();
        
        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        
        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'loadFullData':
                        vscode.window.showInformationMessage('Loading full data...');
                        // TODO: Load full data
                        break;
                    case 'exportCsv':
                        this._exportToCsv();
                        break;
                    case 'copyVariable':
                        vscode.env.clipboard.writeText(message.text);
                        vscode.window.showInformationMessage('Variable name copied to clipboard');
                        break;
                    case 'paginate':
                        this._handlePagination(message.action, message.pageSize);
                        break;
                }
            },
            null,
            this._disposables
        );
    }
    
    private _update(summary: RdsSummary, filePath: string, fullData?: any) {
        this._summary = summary;
        this._filePath = filePath;
        this._fullData = fullData;
        this._panel.title = `RDS: ${summary.file.name}`;
        this._updateWebview();
    }
    
    private _updateWebview() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }
    
    private _exportToCsv() {
        // TODO: Implement CSV export
        vscode.window.showInformationMessage('CSV export not yet implemented');
    }
    
    private _handlePagination(action: string, pageSize?: number) {
        if (!this._fullData || !Array.isArray(this._fullData)) {
            return;
        }
        
        switch (action) {
            case 'first':
                this._paginationService.firstPage();
                break;
            case 'prev':
                this._paginationService.prevPage();
                break;
            case 'next':
                this._paginationService.nextPage();
                break;
            case 'last':
                this._paginationService.lastPage();
                break;
            case 'setPageSize':
                if (pageSize) {
                    this._paginationService.setPageSize(pageSize);
                }
                break;
        }
        
        // Update the webview with new page
        this._updateWebview();
    }
    
    public dispose() {
        RdsSummaryPanel.currentPanel = undefined;
        
        // Clean up resources
        this._panel.dispose();
        
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    
    private _getHtmlForWebview(webview: vscode.Webview) {
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'script.js'));
        
        const nonce = getNonce();
        
        // Generate summary HTML
        const summaryHtml = this._generateSummaryHtml();
        const dataHtml = this._fullData ? this._generateDataTableHtml() : '';
        
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
                <title>RDS Viewer</title>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>📊 RDS File Viewer</h1>
                        <div class="file-path">${this._filePath}</div>
                    </div>
                    
                    <div class="content">
                        <div class="summary-panel">
                            ${summaryHtml}
                        </div>
                        
                        ${dataHtml ? `
                        <div class="data-panel">
                            <h2>Data Preview</h2>
                            ${dataHtml}
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
    
    private _generateSummaryHtml(): string {
        const summary = this._summary;
        let html = '';
        
        // File information
        html += `
            <div class="summary-section">
                <h2>📁 File Information</h2>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="label">Name:</span>
                        <span class="value">${summary.file.name}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Size:</span>
                        <span class="value">${summary.file.size}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Modified:</span>
                        <span class="value">${summary.file.modified}</span>
                    </div>
                </div>
            </div>
        `;
        
        // Object information
        html += `
            <div class="summary-section">
                <h2>🎯 Object Information</h2>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="label">Class:</span>
                        <span class="value">${Array.isArray(summary.object.class) ? summary.object.class.join(', ') : summary.object.class}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Type:</span>
                        <span class="value">${summary.object.type}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Memory:</span>
                        <span class="value">${summary.object.size}</span>
                    </div>
                </div>
            </div>
        `;
        
        // DataFrame specific information
        if (summary.dataframe) {
            const df = summary.dataframe;
            html += `
                <div class="summary-section">
                    <h2>📊 Data Frame Summary</h2>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="label">Dimensions:</span>
                            <span class="value">${df.dimensions.rows.toLocaleString()} rows × ${df.dimensions.cols} columns</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Complete Rows:</span>
                            <span class="value">${df.missing.completeRows.toLocaleString()} (${df.missing.completeRowsPercent}%)</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Missing Cells:</span>
                            <span class="value">${df.missing.missingCells.toLocaleString()} (${df.missing.missingPercent}%)</span>
                        </div>
                    </div>
                    
                    <h3>📋 Variables (${df.dimensions.cols})</h3>
                    <div class="variables-table">
                        <table>
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
                                ${this._generateVariablesTableRows(df.variables)}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }
        
        // List specific information
        if (summary.list) {
            const lst = summary.list;
            html += `
                <div class="summary-section">
                    <h2>📝 List Summary</h2>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="label">Length:</span>
                            <span class="value">${lst.length}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Max Depth:</span>
                            <span class="value">${lst.maxDepth}</span>
                        </div>
                    </div>
                    
                    <h3>Elements</h3>
                    <div class="list-elements">
                        ${lst.elements.map(elem => `
                            <div class="list-element">
                                <span class="element-name">${elem.name}</span>
                                <span class="element-type">${elem.type}</span>
                                <span class="element-class">${elem.class.join(', ')}</span>
                                ${elem.size !== undefined ? `<span class="element-size">${elem.size}</span>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        // Vector specific information
        if (summary.vector) {
            const vec = summary.vector;
            html += `
                <div class="summary-section">
                    <h2>📐 Vector Summary</h2>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="label">Length:</span>
                            <span class="value">${vec.length.toLocaleString()}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Type:</span>
                            <span class="value">${vec.type}</span>
                        </div>
                    </div>
                    ${vec.summary ? this._generateNumericSummary(vec.summary) : ''}
                    ${vec.preview ? `
                        <div class="preview">
                            <h3>Preview (first 10 elements)</h3>
                            <code>${vec.preview.join(', ')}</code>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        // Matrix specific information
        if (summary.matrix) {
            const mat = summary.matrix;
            html += `
                <div class="summary-section">
                    <h2>📏 Matrix Summary</h2>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="label">Dimensions:</span>
                            <span class="value">${mat.dimensions.rows} × ${mat.dimensions.cols}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Type:</span>
                            <span class="value">${mat.type}</span>
                        </div>
                    </div>
                    ${mat.summary ? this._generateNumericSummary(mat.summary) : ''}
                </div>
            `;
        }
        
        // Error information
        if (summary.error) {
            html += `
                <div class="summary-section error">
                    <h2>⚠️ Error</h2>
                    <div class="error-message">${summary.error}</div>
                </div>
            `;
        }
        
        // Action buttons
        if (!this._fullData && !summary.error) {
            html += `
                <div class="actions">
                    <button onclick="loadFullData()">Load Full Data</button>
                    <button onclick="exportCsv()">Export to CSV</button>
                </div>
            `;
        }
        
        // Add search box if data is loaded
        if (this._fullData || summary.dataframe) {
            html = `
                <div class="search-container">
                    <input type="text" id="search-input" placeholder="🔍 Search in data..." />
                    <button onclick="clearSearch()">Clear</button>
                </div>
            ` + html;
        }
        
        return html;
    }
    
    private _generateVariablesTableRows(variables: Record<string, any>): string {
        return Object.entries(variables).map(([name, info]) => {
            let summaryText = '';
            
            if (info.summary) {
                if (info.summary.min !== undefined) {
                    // Numeric summary
                    summaryText = `[${info.summary.min} - ${info.summary.max}] μ=${info.summary.mean}`;
                } else if (info.summary.levels) {
                    // Factor summary
                    summaryText = `${info.summary.nLevels} levels`;
                } else if (info.summary.sample) {
                    // Character summary
                    summaryText = `${info.unique} unique`;
                }
            }
            
            return `
                <tr>
                    <td class="var-name" onclick="copyVariable('${name}')">${name}</td>
                    <td>${info.type}</td>
                    <td>${info.class}</td>
                    <td>${info.unique.toLocaleString()}</td>
                    <td class="${info.missing > 0 ? 'has-missing' : ''}">${info.missing} (${info.missingPercent}%)</td>
                    <td class="summary-cell">${summaryText}</td>
                </tr>
            `;
        }).join('');
    }
    
    private _generateNumericSummary(summary: any): string {
        return `
            <div class="numeric-summary">
                <h3>Statistical Summary</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">Min:</span>
                        <span class="stat-value">${summary.min}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Max:</span>
                        <span class="stat-value">${summary.max}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Mean:</span>
                        <span class="stat-value">${summary.mean}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Median:</span>
                        <span class="stat-value">${summary.median}</span>
                    </div>
                    ${summary.q1 !== undefined ? `
                    <div class="stat-item">
                        <span class="stat-label">Q1:</span>
                        <span class="stat-value">${summary.q1}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Q3:</span>
                        <span class="stat-value">${summary.q3}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    private _generateDataTableHtml(): string {
        if (!this._fullData) return '';
        
        // Handle different data types
        if (Array.isArray(this._fullData)) {
            // Array of objects (typical data frame)
            if (this._fullData.length > 0 && typeof this._fullData[0] === 'object') {
                const headers = Object.keys(this._fullData[0]);
                
                // Check if pagination is needed
                const needsPagination = this._fullData.length > 100;
                let rows = this._fullData;
                let paginationHtml = '';
                
                if (needsPagination) {
                    // Use pagination service
                    this._paginationService.setData(this._fullData);
                    rows = this._paginationService.getCurrentPage();
                    paginationHtml = this._paginationService.generatePaginationHTML();
                } else {
                    rows = this._fullData;
                }
                
                return `
                    ${needsPagination ? paginationHtml : ''}
                    <table class="data-table" id="main-data-table">
                        <thead>
                            <tr>
                                <th class="row-number">#</th>
                                ${headers.map(h => `<th>${h}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map((row, index) => {
                                const actualIndex = needsPagination 
                                    ? (this._paginationService.getPaginationInfo().start - 1) + index 
                                    : index;
                                return `
                                    <tr>
                                        <td class="row-number">${actualIndex + 1}</td>
                                        ${headers.map(h => `<td>${row[h] ?? 'NA'}</td>`).join('')}
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                    ${needsPagination ? paginationHtml : ''}
                `;
            }
        }
        
        // Fallback: show as JSON
        return `<pre>${JSON.stringify(this._fullData, null, 2)}</pre>`;
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