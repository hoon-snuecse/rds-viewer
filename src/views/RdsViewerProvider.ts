import * as vscode from 'vscode';
import { RBridgeService } from '../services/RBridgeService';

export class RdsViewerProvider implements vscode.CustomTextEditorProvider {
    
    constructor(
        _context: vscode.ExtensionContext,
        private readonly rBridge: RBridgeService
    ) {}
    
    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Setup initial content
        webviewPanel.webview.options = {
            enableScripts: true,
        };
        
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
        
        // Load RDS file
        this.loadRdsFile(document.uri, webviewPanel);
        
        // Handle messages from webview
        webviewPanel.webview.onDidReceiveMessage(e => {
            switch (e.type) {
                case 'refresh':
                    this.loadRdsFile(document.uri, webviewPanel);
                    break;
            }
        });
    }
    
    private async loadRdsFile(uri: vscode.Uri, panel: vscode.WebviewPanel) {
        try {
            // Get summary first
            const summary = await this.rBridge.getRdsSummary(uri.fsPath);
            
            // Send summary to webview
            panel.webview.postMessage({
                type: 'summary',
                data: summary
            });
            
            // If it's a small file, load full data
            const fileSize = summary.file.size;
            if (this.isSmallFile(fileSize)) {
                const data = await this.rBridge.readRdsAsJson(uri.fsPath, 1000);
                panel.webview.postMessage({
                    type: 'data',
                    data: data
                });
            }
        } catch (error) {
            panel.webview.postMessage({
                type: 'error',
                message: `Failed to load RDS file: ${error}`
            });
        }
    }
    
    private isSmallFile(sizeString: string): boolean {
        // Parse size string (e.g., "1.5 MB", "500 KB")
        const match = sizeString.match(/^([\d.]+)\s*([KMGT]?B)?$/i);
        if (!match) return true;
        
        const value = parseFloat(match[1]);
        const unit = match[2]?.toUpperCase() || 'B';
        
        const multipliers: { [key: string]: number } = {
            'B': 1,
            'KB': 1024,
            'MB': 1024 * 1024,
            'GB': 1024 * 1024 * 1024,
        };
        
        const bytes = value * (multipliers[unit] || 1);
        return bytes < 10 * 1024 * 1024; // Less than 10MB
    }
    
    private getHtmlForWebview(_webview: vscode.Webview): string {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>RDS Viewer</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 20px;
                    }
                    .loading {
                        text-align: center;
                        padding: 50px;
                    }
                    .error {
                        color: var(--vscode-errorForeground);
                        background: var(--vscode-inputValidation-errorBackground);
                        padding: 10px;
                        border-radius: 3px;
                    }
                </style>
            </head>
            <body>
                <div id="content" class="loading">
                    Loading RDS file...
                </div>
                
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    window.addEventListener('message', event => {
                        const message = event.data;
                        const content = document.getElementById('content');
                        
                        switch (message.type) {
                            case 'summary':
                                displaySummary(message.data);
                                break;
                            case 'data':
                                displayData(message.data);
                                break;
                            case 'error':
                                content.innerHTML = '<div class="error">' + message.message + '</div>';
                                break;
                        }
                    });
                    
                    function displaySummary(summary) {
                        const content = document.getElementById('content');
                        content.classList.remove('loading');
                        
                        let html = '<h2>RDS File Summary</h2>';
                        html += '<p>Type: ' + summary.object.type + '</p>';
                        html += '<p>Class: ' + summary.object.class.join(', ') + '</p>';
                        html += '<p>Size: ' + summary.object.size + '</p>';
                        
                        if (summary.dataframe) {
                            html += '<h3>Data Frame</h3>';
                            html += '<p>Dimensions: ' + summary.dataframe.dimensions.rows + ' × ' + summary.dataframe.dimensions.cols + '</p>';
                        }
                        
                        content.innerHTML = html;
                    }
                    
                    function displayData(data) {
                        // Add data display logic here
                        console.log('Data received:', data);
                    }
                </script>
            </body>
            </html>`;
    }
}