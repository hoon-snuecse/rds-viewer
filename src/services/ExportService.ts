import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { RBridgeService } from './RBridgeService';

export class ExportService {
    constructor(private rBridge: RBridgeService) {}

    /**
     * Export RDS data to CSV format
     */
    async exportToCsv(rdsPath: string): Promise<void> {
        try {
            // Show save dialog
            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(
                    path.join(
                        path.dirname(rdsPath),
                        path.basename(rdsPath, '.rds') + '.csv'
                    )
                ),
                filters: {
                    'CSV Files': ['csv'],
                    'All Files': ['*']
                }
            });

            if (!saveUri) {
                return; // User cancelled
            }

            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Exporting to CSV...",
                cancellable: false
            }, async () => {
                // Export using R
                await this.rBridge.exportRdsToCsv(rdsPath, saveUri.fsPath);
                
                // Show success message with option to open
                const selection = await vscode.window.showInformationMessage(
                    `Successfully exported to ${path.basename(saveUri.fsPath)}`,
                    'Open File',
                    'Open Folder'
                );

                if (selection === 'Open File') {
                    await vscode.commands.executeCommand('vscode.open', saveUri);
                } else if (selection === 'Open Folder') {
                    await vscode.commands.executeCommand('revealFileInOS', saveUri);
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to export CSV: ${error}`);
        }
    }

    /**
     * Export RDS data to Excel format
     */
    async exportToExcel(rdsPath: string): Promise<void> {
        try {
            // Show save dialog
            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(
                    path.join(
                        path.dirname(rdsPath),
                        path.basename(rdsPath, '.rds') + '.xlsx'
                    )
                ),
                filters: {
                    'Excel Files': ['xlsx'],
                    'All Files': ['*']
                }
            });

            if (!saveUri) {
                return; // User cancelled
            }

            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Exporting to Excel...",
                cancellable: false
            }, async () => {
                // Export using R
                await this.rBridge.exportRdsToExcel(rdsPath, saveUri.fsPath);
                
                // Show success message
                const selection = await vscode.window.showInformationMessage(
                    `Successfully exported to ${path.basename(saveUri.fsPath)}`,
                    'Open File',
                    'Open Folder'
                );

                if (selection === 'Open File') {
                    // Try to open with default program
                    vscode.env.openExternal(saveUri);
                } else if (selection === 'Open Folder') {
                    await vscode.commands.executeCommand('revealFileInOS', saveUri);
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to export Excel: ${error}`);
        }
    }

    /**
     * Export RDS data to JSON format
     */
    async exportToJson(rdsPath: string): Promise<void> {
        try {
            // Show save dialog
            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(
                    path.join(
                        path.dirname(rdsPath),
                        path.basename(rdsPath, '.rds') + '.json'
                    )
                ),
                filters: {
                    'JSON Files': ['json'],
                    'All Files': ['*']
                }
            });

            if (!saveUri) {
                return; // User cancelled
            }

            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Exporting to JSON...",
                cancellable: false
            }, async () => {
                // Get data as JSON
                const jsonData = await this.rBridge.readRdsAsJson(rdsPath);
                
                // Write to file
                fs.writeFileSync(
                    saveUri.fsPath, 
                    JSON.stringify(jsonData, null, 2),
                    'utf8'
                );
                
                // Show success message
                const selection = await vscode.window.showInformationMessage(
                    `Successfully exported to ${path.basename(saveUri.fsPath)}`,
                    'Open File'
                );

                if (selection === 'Open File') {
                    await vscode.commands.executeCommand('vscode.open', saveUri);
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to export JSON: ${error}`);
        }
    }

    /**
     * Copy data to clipboard as CSV
     */
    async copyAsCsv(rdsPath: string): Promise<void> {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Copying to clipboard...",
                cancellable: false
            }, async () => {
                // Get CSV string
                const csvString = await this.rBridge.getRdsAsCsvString(rdsPath);
                
                // Copy to clipboard
                await vscode.env.clipboard.writeText(csvString);
                
                vscode.window.showInformationMessage('Data copied to clipboard as CSV');
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to copy data: ${error}`);
        }
    }
}