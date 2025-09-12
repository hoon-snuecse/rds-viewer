
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
        ),
        variables = get_variable_summary(obj),
        missing = get_missing_summary(obj)
      )
      
      # Add preview (first 5 rows)
      if (nrow(obj) > 0) {
        preview_rows <- min(5, nrow(obj))
        summary_info$dataframe$preview <- head(obj, preview_rows)
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
