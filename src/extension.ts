import * as vscode from 'vscode';
import { RdsViewerProvider } from './views/RdsViewerProvider';
import { RdsCustomEditor } from './views/RdsCustomEditor';
import { RBridgeService } from './services/RBridgeService';
import { RdsSummaryPanel } from './views/RdsSummaryPanel';
import { ExportService } from './services/ExportService';

let rBridge: RBridgeService;
let exportService: ExportService;

export function activate(context: vscode.ExtensionContext) {
    console.log('RDS Viewer extension is now active!');
    
    // Initialize services
    rBridge = new RBridgeService();
    exportService = new ExportService(rBridge);
    
    // Register Custom Editor Provider FIRST - this is the main viewer
    const customEditor = new RdsCustomEditor(context, rBridge);
    const customEditorRegistration = vscode.window.registerCustomEditorProvider(
        RdsCustomEditor.viewType,
        customEditor,
        {
            webviewOptions: {
                retainContextWhenHidden: true,
            },
            supportsMultipleEditorsPerDocument: false,
        }
    );
    context.subscriptions.push(customEditorRegistration);
    
    // Register RDS Summary Command
    const summaryCommand = vscode.commands.registerCommand('rds.summary', async (uri?: vscode.Uri) => {
        let fileUri = uri;
        
        // If no URI provided, try to get from active editor
        if (!fileUri && vscode.window.activeTextEditor) {
            fileUri = vscode.window.activeTextEditor.document.uri;
        }
        
        if (!fileUri) {
            vscode.window.showErrorMessage('Please select an RDS file first');
            return;
        }
        
        // Check if file has .rds extension
        if (!fileUri.fsPath.toLowerCase().endsWith('.rds')) {
            vscode.window.showErrorMessage('Selected file is not an RDS file');
            return;
        }
        
        try {
            // Show loading message
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Loading RDS summary...",
                cancellable: false
            }, async () => {
                // Get summary from R
                const summary = await rBridge.getRdsSummary(fileUri!.fsPath);
                
                // Show summary panel
                RdsSummaryPanel.createOrShow(context.extensionUri, summary, fileUri!.fsPath);
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load RDS summary: ${error}`);
        }
    });
    
    // Register RDS Preview Command
    const previewCommand = vscode.commands.registerCommand('rds.preview', async (uri?: vscode.Uri) => {
        let fileUri = uri;
        
        if (!fileUri && vscode.window.activeTextEditor) {
            fileUri = vscode.window.activeTextEditor.document.uri;
        }
        
        if (!fileUri) {
            vscode.window.showErrorMessage('Please select an RDS file first');
            return;
        }
        
        if (!fileUri.fsPath.toLowerCase().endsWith('.rds')) {
            vscode.window.showErrorMessage('Selected file is not an RDS file');
            return;
        }
        
        try {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Loading RDS data...",
                cancellable: false
            }, async () => {
                // First get summary
                const summary = await rBridge.getRdsSummary(fileUri!.fsPath);
                
                // Then get full data if it's not too large
                const data = await rBridge.readRdsAsJson(fileUri!.fsPath);
                
                // Show data viewer
                RdsSummaryPanel.createOrShow(context.extensionUri, summary, fileUri!.fsPath, data);
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load RDS file: ${error}`);
        }
    });
    
    // Register Refresh Command
    const refreshCommand = vscode.commands.registerCommand('rds.refresh', () => {
        RdsSummaryPanel.refresh();
    });
    
    // Register Export Commands
    const exportCsvCommand = vscode.commands.registerCommand('rds.exportCsv', async (uri?: vscode.Uri) => {
        let fileUri = uri;
        
        if (!fileUri && vscode.window.activeTextEditor) {
            fileUri = vscode.window.activeTextEditor.document.uri;
        }
        
        if (!fileUri || !fileUri.fsPath.toLowerCase().endsWith('.rds')) {
            vscode.window.showErrorMessage('Please select an RDS file first');
            return;
        }
        
        await exportService.exportToCsv(fileUri.fsPath);
    });
    
    const exportExcelCommand = vscode.commands.registerCommand('rds.exportExcel', async (uri?: vscode.Uri) => {
        let fileUri = uri;
        
        if (!fileUri && vscode.window.activeTextEditor) {
            fileUri = vscode.window.activeTextEditor.document.uri;
        }
        
        if (!fileUri || !fileUri.fsPath.toLowerCase().endsWith('.rds')) {
            vscode.window.showErrorMessage('Please select an RDS file first');
            return;
        }
        
        await exportService.exportToExcel(fileUri.fsPath);
    });
    
    const exportJsonCommand = vscode.commands.registerCommand('rds.exportJson', async (uri?: vscode.Uri) => {
        let fileUri = uri;
        
        if (!fileUri && vscode.window.activeTextEditor) {
            fileUri = vscode.window.activeTextEditor.document.uri;
        }
        
        if (!fileUri || !fileUri.fsPath.toLowerCase().endsWith('.rds')) {
            vscode.window.showErrorMessage('Please select an RDS file first');
            return;
        }
        
        await exportService.exportToJson(fileUri.fsPath);
    });
    
    // Register Open RDS File Command
    const openRdsCommand = vscode.commands.registerCommand('rds.openFile', async (uri: vscode.Uri) => {
        console.log('Opening RDS file command triggered:', uri?.fsPath);
        if (!uri) {
            console.log('No URI provided');
            return;
        }
        
        // Open with our custom editor
        console.log('Opening with custom editor:', RdsCustomEditor.viewType);
        await vscode.commands.executeCommand('vscode.openWith', uri, RdsCustomEditor.viewType);
    });
    
    // Register Open Viewer Command
    const openViewerCommand = vscode.commands.registerCommand('rds.openViewer', async (uri: vscode.Uri) => {
        if (!uri) return;
        
        // Open with our custom editor
        await vscode.commands.executeCommand('vscode.openWith', uri, RdsCustomEditor.viewType);
    });
    
    // Register disposables
    context.subscriptions.push(summaryCommand);
    context.subscriptions.push(previewCommand);
    context.subscriptions.push(refreshCommand);
    context.subscriptions.push(exportCsvCommand);
    context.subscriptions.push(exportExcelCommand);
    context.subscriptions.push(exportJsonCommand);
    context.subscriptions.push(openRdsCommand);
    context.subscriptions.push(openViewerCommand);
    
    // Keep old provider for backward compatibility (can be removed later)
    const provider = new RdsViewerProvider(context, rBridge);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
        'rdsViewer.editor.legacy',
        provider,
        {
            webviewOptions: {
                retainContextWhenHidden: true,
            },
            supportsMultipleEditorsPerDocument: false,
        }
    );
    context.subscriptions.push(providerRegistration);
    
    // Check R installation on activation
    checkRInstallation();
}

async function checkRInstallation() {
    try {
        const rPath = await RBridgeService.findRPath();
        console.log(`R found at: ${rPath}`);
    } catch (error) {
        const selection = await vscode.window.showWarningMessage(
            'R installation not found. RDS Viewer requires R to be installed.',
            'Install R',
            'Set R Path',
            'Ignore'
        );
        
        if (selection === 'Install R') {
            vscode.env.openExternal(vscode.Uri.parse('https://www.r-project.org/'));
        } else if (selection === 'Set R Path') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'rdsViewer.rPath');
        }
    }
}

export function deactivate() {
    console.log('RDS Viewer extension deactivated');
}