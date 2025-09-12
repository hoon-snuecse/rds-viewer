# Change Log

All notable changes to the "RDS Viewer" extension will be documented in this file.

## [1.0.0] - 2025-01-11

### 🎉 Initial Release

#### Features
- **📊 RDS File Summary**: Instant overview of RDS file contents without loading entire dataset
  - Object type and class information
  - Dimensions and memory usage
  - Variable types and distributions
  - Missing data analysis
  - Statistical summaries for numeric variables

- **📁 Multiple Data Type Support**:
  - Data frames with full variable analysis
  - Lists (including nested structures)
  - Vectors (numeric, character, logical, factor)
  - Matrices
  - Time series objects
  - Linear models (lm) and other S3/S4 objects

- **🔍 Data Exploration**:
  - Real-time search with highlighting
  - Column sorting
  - Pagination for large datasets (>100 rows)
  - Configurable page size (50-1000 rows)

- **💾 Export Options**:
  - Export to CSV format
  - Export to Excel format (requires openxlsx R package)
  - Export to JSON format
  - Copy to clipboard as CSV

- **🎨 User Interface**:
  - Clean WebView-based interface
  - Dark/Light theme support
  - Responsive design
  - Context menu integration
  - Keyboard shortcuts

#### Technical Details
- Built with TypeScript and VS Code Extension API
- R Bridge service for secure R process communication
- Efficient pagination for large datasets
- Automatic R installation detection
- Cross-platform support (Windows, macOS, Linux)

#### Requirements
- VS Code 1.74.0 or higher
- R installation (auto-detected or configurable)
- jsonlite R package (required)
- openxlsx R package (optional, for Excel export)

---

## [Unreleased]

### Planned Features
- Data visualization (simple charts)
- Data editing capabilities
- Multiple file comparison
- Performance improvements for very large files
- Integration with R language server

### Known Issues
- Excel export requires openxlsx R package to be installed
- Very large files (>100MB) may take time to load
- Some complex S4 objects may not display correctly

---

For more information, visit the [GitHub repository](https://github.com/hoon-snuecse/rds-viewer).