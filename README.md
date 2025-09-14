# RDS Viewer for VS Code

📊 View and explore R Data Serialization (RDS) files directly in Visual Studio Code.

## Features

### 🚀 Main Features
- **Tabbed Interface**: Switch between Summary and Data views
- **Excel-like Data Viewer**: Browse your data with familiar spreadsheet interface
- **Smart Data Loading**: Automatically loads data in chunks for performance
- **Navigation**: Jump to any row, navigate by 100/1000 rows
- **Column Navigation**: View 10 columns at a time or toggle to see all
- **Search & Highlight**: Find and highlight text across your dataset
- **Export Options**: Export to CSV, JSON, or Excel formats
- **Row & Cell Selection**: Click to select and highlight rows or cells

### 📋 Supported Data Types
- Data frames (with full variable analysis)
- Lists (including nested structures)
- Vectors (numeric, character, logical, factor)
- Matrices
- Time series objects
- Complex S3/S4 objects

### 🎯 Key Features
- **Fast preview**: Summary information loads instantly, even for large files
- **Smart data loading**: Only loads full data when needed
- **WebView UI**: Clean interface with sortable tables
- **Context menus**: Right-click any .rds file to view summary or preview
- **Secure**: Runs R in isolated subprocess with no external dependencies

## Requirements

- **R installation**: R must be installed on your system
  - Download from: https://www.r-project.org/
  - The extension will auto-detect R in common locations
  - Or configure custom path in settings

- **R packages**: The following R package is recommended:
  ```r
  install.packages("jsonlite")
  ```

## Installation

1. Install the extension from VS Code Marketplace
2. Or install from VSIX file:
   ```bash
   code --install-extension rds-viewer-1.0.0.vsix
   ```

## Usage

### Opening RDS Files

1. **Right-click menu**: Right-click any `.rds` file in the Explorer
   - Select "Show RDS Summary" for quick overview
   - Select "Open RDS Preview" for full data view

2. **Command Palette**: Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Type "RDS: Show Summary"
   - Type "RDS: Open Preview"

3. **File association**: Double-click any `.rds` file to open with the viewer

### Understanding the Summary View

The summary view provides:

#### File Information
- File name and size
- Last modified date
- R version compatibility

#### Object Overview
- Object type (data.frame, list, vector, etc.)
- Object class (including custom S3/S4 classes)
- Memory usage

#### Data Frame Details
- **Dimensions**: Number of rows and columns
- **Complete cases**: Rows without any missing values
- **Variables table**:
  - Variable name (click to copy)
  - Data type and class
  - Number of unique values
  - Missing value count and percentage
  - Statistical summary for numeric variables
  - Factor levels for categorical variables

## Configuration

Configure the extension in VS Code settings:

```json
{
  "rdsViewer.rPath": "/usr/local/bin/R",          // Path to R executable
  "rdsViewer.maxPreviewRows": 1000,               // Max rows to display
  "rdsViewer.showSummaryOnOpen": true,            // Show summary by default
  "rdsViewer.summaryPanelPosition": "left"        // Panel position: top/left/right/popup
}
```

## Examples

### Sample Data Frame Summary
```
📊 Data Frame Summary
Dimensions: 10,000 rows × 25 columns
Complete Rows: 8,543 (85.43%)
Missing Cells: 2,341 (0.94%)

📋 Variables (25)
┌─────────┬──────────┬─────────┬────────┐
│ Variable│ Type     │ Missing │ Summary│
├─────────┼──────────┼─────────┼────────┤
│ id      │ integer  │ 0       │ 1~10000│
│ age     │ numeric  │ 12      │ μ=42.3 │
│ gender  │ factor   │ 0       │ 2 levels│
└─────────┴──────────┴─────────┴────────┘
```

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/hoon-snuecse/rds-viewer.git
cd rds-viewer

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run in development mode
code .
# Then press F5 to launch extension development host
```

### Testing

Test files are included in the `test-data/` directory:
- `sample_dataframe.rds` - Basic data frame with mixed types
- `sample_large_dataframe.rds` - Large dataset (10,000 rows)
- `sample_complex_list.rds` - Nested list structure
- `sample_vector.rds` - Numeric vector
- `sample_matrix.rds` - Matrix data

## Troubleshooting

### R not found
- Ensure R is installed: Run `R --version` in terminal
- Configure R path in settings: `rdsViewer.rPath`
- On macOS with Homebrew: Path is usually `/opt/homebrew/bin/R`
- On Windows: Path is usually `C:\Program Files\R\R-4.x.x\bin\R.exe`

### RDS file won't open
- Check file permissions
- Ensure file is not corrupted: Try `readRDS("file.rds")` in R console
- Check VS Code Output panel for error messages

### Missing jsonlite package
Install in R console:
```r
install.packages("jsonlite")
```

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

Report issues at: https://github.com/hoon-snuecse/rds-viewer/issues

## License

MIT License - See LICENSE file for details

## Acknowledgments

- Inspired by Excel Viewer extension architecture
- Uses R and jsonlite for data processing
- Built with VS Code Extension API

## Roadmap

### Phase 1 (Current) ✅
- [x] Basic RDS file reading
- [x] Summary information display
- [x] WebView UI
- [x] Data frame preview

### Phase 2 (Completed) ✅
- [x] CSV/Excel/JSON export
- [x] Search and filter with highlighting
- [x] Performance optimization with infinite scroll
- [x] Column pagination for wide datasets

---

**Enjoy exploring your R data in VS Code!** 🎉