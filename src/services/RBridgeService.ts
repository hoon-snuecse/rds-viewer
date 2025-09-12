import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { RdsSummary } from '../types';

const execAsync = promisify(exec);

export class RBridgeService {
    private rPath: string | null = null;
    private rScriptsPath: string;
    
    constructor() {
        // Set R scripts path relative to extension root
        this.rScriptsPath = path.join(__dirname, '..', '..', 'r-scripts');
        this.initializeRPath();
    }
    
    private async initializeRPath() {
        try {
            this.rPath = await RBridgeService.findRPath();
        } catch (error) {
            console.error('Failed to find R path:', error);
        }
    }
    
    static async findRPath(): Promise<string> {
        // First check user configuration
        const config = vscode.workspace.getConfiguration('rdsViewer');
        const configuredPath = config.get<string>('rPath');
        
        if (configuredPath && fs.existsSync(configuredPath)) {
            return configuredPath;
        }
        
        // Try to find R in common locations
        const commonPaths = process.platform === 'win32' 
            ? [
                'C:\\Program Files\\R\\R-4.3.0\\bin\\R.exe',
                'C:\\Program Files\\R\\R-4.2.0\\bin\\R.exe',
                'C:\\Program Files\\R\\R-4.1.0\\bin\\R.exe',
                'C:\\Program Files (x86)\\R\\R-4.3.0\\bin\\R.exe',
              ]
            : process.platform === 'darwin'
            ? [
                '/usr/local/bin/R',
                '/opt/homebrew/bin/R',
                '/usr/bin/R',
                '/Library/Frameworks/R.framework/Resources/bin/R',
              ]
            : [
                '/usr/bin/R',
                '/usr/local/bin/R',
                '/opt/R/bin/R',
              ];
        
        for (const rPath of commonPaths) {
            if (fs.existsSync(rPath)) {
                return rPath;
            }
        }
        
        // Try 'which R' or 'where R'
        try {
            const command = process.platform === 'win32' ? 'where' : 'which';
            const { stdout } = await execAsync(`${command} R`);
            const rPath = stdout.trim().split('\n')[0];
            if (rPath && fs.existsSync(rPath)) {
                return rPath;
            }
        } catch (error) {
            // Command failed, R not in PATH
        }
        
        throw new Error('R installation not found');
    }
    
    private async executeRScript(script: string): Promise<string> {
        if (!this.rPath) {
            this.rPath = await RBridgeService.findRPath();
        }
        
        return new Promise((resolve, reject) => {
            const rProcess = spawn(this.rPath!, ['--slave', '--no-restore', '--no-save']);
            
            let stdout = '';
            let stderr = '';
            
            rProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            rProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            rProcess.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`R process exited with code ${code}: ${stderr}`));
                } else {
                    resolve(stdout);
                }
            });
            
            rProcess.on('error', (error) => {
                reject(error);
            });
            
            // Write script to stdin
            rProcess.stdin.write(script);
            rProcess.stdin.end();
        });
    }
    
    async getRdsSummary(filePath: string): Promise<RdsSummary> {
        const summaryScriptPath = path.join(this.rScriptsPath, 'get_rds_summary.R');
        
        // Create summary script if it doesn't exist
        if (!fs.existsSync(summaryScriptPath)) {
            await this.createSummaryScript();
        }
        
        const script = `
            source("${summaryScriptPath.replace(/\\/g, '/')}")
            cat(get_rds_summary("${filePath.replace(/\\/g, '/')}"))
        `;
        
        try {
            const result = await this.executeRScript(script);
            return JSON.parse(result);
        } catch (error: any) {
            console.error('Failed to get RDS summary:', error);
            return {
                file: {
                    name: path.basename(filePath),
                    size: 'Unknown',
                    modified: 'Unknown'
                },
                object: {
                    class: ['Unknown'],
                    type: 'Unknown',
                    size: 'Unknown'
                },
                error: error.message
            };
        }
    }
    
    async readRdsAsRange(rdsPath: string, startRow: number, endRow: number): Promise<any> {
        const script = `
            library(jsonlite)
            
            # Read the RDS file
            data <- readRDS("${rdsPath.replace(/\\/g, '/')}")
            
            result <- NULL
            
            # Handle data frames
            if (is.data.frame(data)) {
                total_rows <- nrow(data)
                
                # Ensure valid range
                start_idx <- max(1, min(${startRow}, total_rows))
                end_idx <- min(${endRow}, total_rows)
                
                if (start_idx <= end_idx) {
                    # Extract the specified range
                    subset_data <- data[start_idx:end_idx, , drop = FALSE]
                    
                    # Convert to column-based format for JSON
                    result <- list(
                        columns = names(subset_data),
                        data = lapply(subset_data, function(col) {
                            if (is.factor(col)) as.character(col) else col
                        }),
                        startRow = start_idx,
                        endRow = end_idx,
                        totalRows = total_rows,
                        totalCols = ncol(subset_data)
                    )
                }
            }
            
            # Convert to JSON
            if (!is.null(result)) {
                json_str <- toJSON(result, auto_unbox = TRUE, na = "null", pretty = FALSE, force = TRUE, digits = 4)
                cat(json_str)
            } else {
                cat('{"error": "Invalid data range"}')
            }
        `;
        
        try {
            const result = await this.executeRScript(script);
            return JSON.parse(result);
        } catch (error) {
            console.error('Failed to read RDS range:', error);
            throw error;
        }
    }
    
    async readRdsAsJson(filePath: string, maxRows?: number): Promise<any> {
        const script = `
            library(jsonlite)
            data <- readRDS("${filePath.replace(/\\/g, '/')}")
            
            # Handle different object types
            if (inherits(data, "lm") || inherits(data, "glm")) {
                # For linear models, extract summary information
                result <- list(
                    coefficients = coef(data),
                    residuals = summary(data$residuals),
                    r.squared = summary(data)$r.squared,
                    call = deparse(data$call)
                )
            } else if (is.data.frame(data)) {
                total_rows <- nrow(data)
                total_cols <- ncol(data)
                
                # For large datasets, limit to first maxRows
                if (${maxRows || 'FALSE'} && total_rows > ${maxRows || 1000}) {
                    # Take the first N rows instead of sampling
                    sample_size <- ${maxRows || 1000}
                    data <- head(data, sample_size)
                }
                
                # Optimize column data conversion
                result <- list(
                    columns = names(data),
                    totalRows = total_rows,
                    totalCols = total_cols,
                    sampledRows = nrow(data)
                )
                
                # Convert to more efficient column-based format for large datasets
                if (nrow(data) > 100) {
                    # Use column-based format for better performance
                    result$data <- lapply(data, function(col) {
                        if (is.factor(col)) as.character(col) else col
                    })
                } else {
                    # Use row-based format for small datasets
                    result$data <- lapply(data, function(col) {
                        if (is.factor(col)) as.character(col) else col
                    })
                    if (nrow(data) > 0) {
                        rows <- list()
                        for (i in seq_len(nrow(data))) {
                            row_data <- data[i, , drop = FALSE]
                            rows[[i]] <- lapply(seq_along(row_data), function(j) row_data[[j]])
                            names(rows[[i]]) <- names(data)
                        }
                        result$rows <- rows
                    }
                }
            } else if (is.matrix(data)) {
                # Convert matrix to list format
                result <- list(
                    data = as.list(as.data.frame(data)),
                    dims = dim(data),
                    dimnames = dimnames(data)
                )
            } else if (is.vector(data) || is.integer(data) || is.numeric(data)) {
                # Handle vectors and numeric types
                if (length(data) > 1000 && ${maxRows || 'FALSE'}) {
                    data <- head(data, ${maxRows || 1000})
                }
                result <- as.list(data)
            } else if (is.list(data)) {
                result <- data
            } else {
                # Default case
                result <- data
            }
            
            # Convert to JSON with optimized settings for large data
            json_str <- toJSON(result, auto_unbox = TRUE, na = "null", pretty = FALSE, force = TRUE, digits = 4)
            cat(json_str)
        `;
        
        try {
            const result = await this.executeRScript(script);
            return JSON.parse(result);
        } catch (error) {
            console.error('Failed to read RDS file:', error);
            throw error;
        }
    }
    
    async exportRdsToCsv(rdsPath: string, csvPath: string): Promise<void> {
        const script = `
            data <- readRDS("${rdsPath.replace(/\\/g, '/')}")
            
            # Handle different object types
            if (is.data.frame(data)) {
                write.csv(data, "${csvPath.replace(/\\/g, '/')}", row.names = FALSE)
            } else if (is.matrix(data)) {
                write.csv(as.data.frame(data), "${csvPath.replace(/\\/g, '/')}", row.names = TRUE)
            } else if (is.vector(data)) {
                write.csv(data.frame(value = data), "${csvPath.replace(/\\/g, '/')}", row.names = FALSE)
            } else if (is.list(data)) {
                # Try to convert list to data frame if possible
                tryCatch({
                    df <- as.data.frame(data)
                    write.csv(df, "${csvPath.replace(/\\/g, '/')}", row.names = FALSE)
                }, error = function(e) {
                    stop("Cannot convert this object type to CSV")
                })
            } else {
                stop("Cannot export this object type to CSV")
            }
            cat("Export successful")
        `;
        
        await this.executeRScript(script);
    }
    
    async exportRdsToExcel(rdsPath: string, excelPath: string): Promise<void> {
        const script = `
            # Check if openxlsx is installed
            if (!requireNamespace("openxlsx", quietly = TRUE)) {
                stop("Package 'openxlsx' is required for Excel export. Please install it with: install.packages('openxlsx')")
            }
            
            library(openxlsx)
            data <- readRDS("${rdsPath.replace(/\\/g, '/')}")
            
            # Create workbook
            wb <- createWorkbook()
            
            # Handle different object types
            if (is.data.frame(data)) {
                addWorksheet(wb, "Data")
                writeData(wb, "Data", data)
            } else if (is.matrix(data)) {
                addWorksheet(wb, "Matrix")
                writeData(wb, "Matrix", as.data.frame(data))
            } else if (is.vector(data)) {
                addWorksheet(wb, "Vector")
                writeData(wb, "Vector", data.frame(value = data))
            } else if (is.list(data)) {
                # Export each list element to a separate sheet
                for (i in seq_along(data)) {
                    name <- names(data)[i]
                    if (is.null(name) || name == "") {
                        name <- paste0("Sheet", i)
                    }
                    # Truncate sheet name to 31 characters (Excel limit)
                    name <- substr(name, 1, 31)
                    
                    tryCatch({
                        addWorksheet(wb, name)
                        if (is.data.frame(data[[i]])) {
                            writeData(wb, name, data[[i]])
                        } else {
                            writeData(wb, name, data.frame(value = data[[i]]))
                        }
                    }, error = function(e) {
                        # Skip elements that can't be converted
                    })
                }
            } else {
                stop("Cannot export this object type to Excel")
            }
            
            # Save workbook
            saveWorkbook(wb, "${excelPath.replace(/\\/g, '/')}", overwrite = TRUE)
            cat("Export successful")
        `;
        
        await this.executeRScript(script);
    }
    
    async getRdsAsCsvString(rdsPath: string): Promise<string> {
        const script = `
            data <- readRDS("${rdsPath.replace(/\\/g, '/')}")
            
            # Convert to CSV string
            if (is.data.frame(data)) {
                csv_string <- capture.output(write.csv(data, row.names = FALSE))
            } else if (is.matrix(data)) {
                csv_string <- capture.output(write.csv(as.data.frame(data), row.names = TRUE))
            } else if (is.vector(data)) {
                csv_string <- capture.output(write.csv(data.frame(value = data), row.names = FALSE))
            } else {
                stop("Cannot convert this object type to CSV")
            }
            
            cat(paste(csv_string, collapse = "\\n"))
        `;
        
        return await this.executeRScript(script);
    }
    
    private async createSummaryScript() {
        // Ensure r-scripts directory exists
        if (!fs.existsSync(this.rScriptsPath)) {
            fs.mkdirSync(this.rScriptsPath, { recursive: true });
        }
        
        const scriptContent = `
get_rds_summary <- function(file_path) {
  tryCatch({
    # File information
    file_info <- file.info(file_path)
    
    # Read RDS file
    obj <- readRDS(file_path)
    
    # Basic information
    summary_info <- list(
      file = list(
        name = basename(file_path),
        size = format(file_info$size, big.mark = ",", scientific = FALSE),
        modified = as.character(file_info$mtime)
      ),
      object = list(
        class = class(obj),
        type = typeof(obj),
        size = format(object.size(obj), units = "auto")
      )
    )
    
    # DataFrame specific information
    if (is.data.frame(obj)) {
      summary_info$dataframe <- list(
        dimensions = list(
          rows = nrow(obj),
          cols = ncol(obj)
        )
      )
      
      # Only add variable summary if there are columns
      if (ncol(obj) > 0 && nrow(obj) > 0) {
        summary_info$dataframe$variables <- get_variable_summary(obj)
        summary_info$dataframe$missing <- get_missing_summary(obj)
        
        # Add preview (first 5 rows)
        preview_rows <- min(5, nrow(obj))
        summary_info$dataframe$preview <- head(obj, preview_rows)
      } else {
        summary_info$dataframe$variables <- list()
        summary_info$dataframe$missing <- list(
          totalCells = 0,
          missingCells = 0,
          missingPercent = 0,
          completeRows = 0,
          completeRowsPercent = 0
        )
      }
    }
    
    # List specific information
    if (is.list(obj) && !is.data.frame(obj)) {
      summary_info$list <- get_list_summary(obj)
    }
    
    # Vector specific information
    if (is.vector(obj) && !is.list(obj)) {
      summary_info$vector <- get_vector_summary(obj)
    }
    
    # Matrix specific information
    if (is.matrix(obj)) {
      summary_info$matrix <- get_matrix_summary(obj)
    }
    
    return(jsonlite::toJSON(summary_info, auto_unbox = TRUE, na = "null", pretty = FALSE))
    
  }, error = function(e) {
    error_info <- list(
      file = list(
        name = basename(file_path),
        size = "Error",
        modified = "Error"
      ),
      object = list(
        class = list("Error"),
        type = "error",
        size = "0"
      ),
      error = as.character(e$message)
    )
    return(jsonlite::toJSON(error_info, auto_unbox = TRUE, na = "null", pretty = FALSE))
  })
}

get_variable_summary <- function(df) {
  vars <- list()
  
  for (col_name in names(df)) {
    col <- df[[col_name]]
    n_missing <- sum(is.na(col))
    n_total <- length(col)
    
    var_info <- list(
      type = typeof(col),
      class = class(col)[1],
      unique = length(unique(col)),
      missing = n_missing,
      missingPercent = round(n_missing / n_total * 100, 2)
    )
    
    # Add type-specific summaries
    if (is.numeric(col)) {
      non_na <- col[!is.na(col)]
      if (length(non_na) > 0) {
        var_info$summary <- list(
          min = min(non_na),
          max = max(non_na),
          mean = round(mean(non_na), 2),
          median = median(non_na),
          q1 = quantile(non_na, 0.25, names = FALSE),
          q3 = quantile(non_na, 0.75, names = FALSE),
          sd = round(sd(non_na), 2)
        )
      }
    } else if (is.factor(col)) {
      var_info$summary <- list(
        levels = levels(col),
        nLevels = nlevels(col)
      )
      # Add top 5 most frequent levels
      tbl <- table(col)
      if (length(tbl) > 0) {
        sorted_tbl <- sort(tbl, decreasing = TRUE)
        top_n <- min(5, length(sorted_tbl))
        var_info$summary$topCounts <- as.list(sorted_tbl[1:top_n])
      }
    } else if (is.character(col)) {
      non_na <- col[!is.na(col)]
      if (length(non_na) > 0) {
        var_info$summary <- list(
          sample = head(unique(non_na), 5),
          maxLength = max(nchar(non_na)),
          minLength = min(nchar(non_na))
        )
      }
    }
    
    vars[[col_name]] <- var_info
  }
  
  return(vars)
}

get_missing_summary <- function(df) {
  total_cells <- nrow(df) * ncol(df)
  missing_cells <- sum(is.na(df))
  complete_rows <- sum(complete.cases(df))
  
  list(
    totalCells = total_cells,
    missingCells = missing_cells,
    missingPercent = round(missing_cells / total_cells * 100, 2),
    completeRows = complete_rows,
    completeRowsPercent = round(complete_rows / nrow(df) * 100, 2),
    missingByColumn = as.list(colSums(is.na(df)))
  )
}

get_list_summary <- function(lst) {
  elements <- list()
  
  for (i in seq_along(lst)) {
    name <- names(lst)[i]
    if (is.null(name) || name == "") {
      name <- paste0("[[", i, "]]")
    }
    
    elem <- lst[[i]]
    elem_info <- list(
      name = name,
      type = typeof(elem),
      class = class(elem)
    )
    
    if (is.data.frame(elem)) {
      elem_info$size <- paste(nrow(elem), "x", ncol(elem))
    } else if (is.vector(elem) || is.list(elem)) {
      elem_info$size <- length(elem)
    }
    
    elements[[i]] <- elem_info
  }
  
  list(
    length = length(lst),
    elements = elements,
    maxDepth = get_max_depth(lst)
  )
}

get_vector_summary <- function(vec) {
  info <- list(
    length = length(vec),
    type = typeof(vec)
  )
  
  if (is.numeric(vec)) {
    non_na <- vec[!is.na(vec)]
    if (length(non_na) > 0) {
      info$summary <- list(
        min = min(non_na),
        max = max(non_na),
        mean = round(mean(non_na), 2),
        median = median(non_na)
      )
    }
  }
  
  # Add preview (first 10 elements)
  info$preview <- head(vec, 10)
  
  return(info)
}

get_matrix_summary <- function(mat) {
  info <- list(
    dimensions = list(
      rows = nrow(mat),
      cols = ncol(mat)
    ),
    type = typeof(mat)
  )
  
  if (is.numeric(mat)) {
    non_na <- mat[!is.na(mat)]
    if (length(non_na) > 0) {
      info$summary <- list(
        min = min(non_na),
        max = max(non_na),
        mean = round(mean(non_na), 2),
        median = median(non_na)
      )
    }
  }
  
  # Add preview (first 5x5)
  preview_rows <- min(5, nrow(mat))
  preview_cols <- min(5, ncol(mat))
  info$preview <- mat[1:preview_rows, 1:preview_cols, drop = FALSE]
  
  return(info)
}

get_max_depth <- function(lst, current_depth = 1) {
  if (!is.list(lst)) {
    return(current_depth - 1)
  }
  
  max_depth <- current_depth
  for (elem in lst) {
    if (is.list(elem)) {
      elem_depth <- get_max_depth(elem, current_depth + 1)
      max_depth <- max(max_depth, elem_depth)
    }
  }
  
  return(max_depth)
}
`;
        
        const scriptPath = path.join(this.rScriptsPath, 'get_rds_summary.R');
        fs.writeFileSync(scriptPath, scriptContent);
    }
}