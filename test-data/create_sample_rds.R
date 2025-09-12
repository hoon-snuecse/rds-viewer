# Create sample RDS files for testing the RDS Viewer extension

# Create output directory if it doesn't exist
if (!dir.exists("test-data")) {
  dir.create("test-data")
}

# 1. Simple data frame
df_simple <- data.frame(
  id = 1:100,
  name = paste0("Person_", 1:100),
  age = sample(18:80, 100, replace = TRUE),
  salary = round(runif(100, 30000, 150000), 2),
  department = factor(sample(c("Sales", "IT", "HR", "Finance", "Marketing"), 100, replace = TRUE)),
  hired_date = seq(as.Date("2015-01-01"), by = "month", length.out = 100),
  is_active = sample(c(TRUE, FALSE), 100, replace = TRUE, prob = c(0.85, 0.15))
)

# Add some missing values
df_simple$salary[sample(1:100, 10)] <- NA
df_simple$department[sample(1:100, 5)] <- NA

saveRDS(df_simple, "test-data/sample_dataframe.rds")
cat("Created: sample_dataframe.rds\n")

# 2. Large data frame
df_large <- data.frame(
  record_id = 1:10000,
  timestamp = seq(as.POSIXct("2020-01-01"), by = "hour", length.out = 10000),
  value1 = rnorm(10000, mean = 100, sd = 15),
  value2 = rpois(10000, lambda = 5),
  value3 = rexp(10000, rate = 0.1),
  category_a = factor(sample(LETTERS[1:10], 10000, replace = TRUE)),
  category_b = factor(sample(letters[1:5], 10000, replace = TRUE)),
  text_field = sample(c("Lorem", "Ipsum", "Dolor", "Sit", "Amet"), 10000, replace = TRUE)
)

# Add pattern of missing values
missing_rows <- sample(1:10000, 1000)
df_large$value1[missing_rows] <- NA
df_large$category_a[sample(1:10000, 500)] <- NA

saveRDS(df_large, "test-data/sample_large_dataframe.rds")
cat("Created: sample_large_dataframe.rds\n")

# 3. Complex list structure
complex_list <- list(
  metadata = list(
    title = "Complex Data Structure",
    created = Sys.Date(),
    version = "1.0.0",
    author = "Test Script"
  ),
  data = df_simple[1:20, ],
  models = list(
    linear = lm(salary ~ age + department, data = df_simple),
    summary_stats = summary(df_simple$salary)
  ),
  arrays = list(
    matrix_2d = matrix(1:20, nrow = 4),
    vector_numeric = c(1.5, 2.3, 4.8, 9.1, 3.3),
    vector_character = c("apple", "banana", "cherry")
  ),
  nested = list(
    level1 = list(
      level2 = list(
        level3 = "Deep nested value",
        data = 1:5
      )
    )
  )
)

saveRDS(complex_list, "test-data/sample_complex_list.rds")
cat("Created: sample_complex_list.rds\n")

# 4. Simple vector
simple_vector <- rnorm(1000, mean = 50, sd = 10)
saveRDS(simple_vector, "test-data/sample_vector.rds")
cat("Created: sample_vector.rds\n")

# 5. Matrix
sample_matrix <- matrix(
  rnorm(200), 
  nrow = 20, 
  ncol = 10,
  dimnames = list(
    paste0("Row", 1:20),
    paste0("Col", 1:10)
  )
)
saveRDS(sample_matrix, "test-data/sample_matrix.rds")
cat("Created: sample_matrix.rds\n")

# 6. Factor vector
factor_vector <- factor(
  sample(c("Low", "Medium", "High"), 500, replace = TRUE),
  levels = c("Low", "Medium", "High"),
  ordered = TRUE
)
saveRDS(factor_vector, "test-data/sample_factor.rds")
cat("Created: sample_factor.rds\n")

# 7. Time series data
ts_data <- ts(
  rnorm(120, mean = 100, sd = 10),
  start = c(2014, 1),
  frequency = 12
)
saveRDS(ts_data, "test-data/sample_timeseries.rds")
cat("Created: sample_timeseries.rds\n")

# 8. Data frame with special characters and different encodings
df_special <- data.frame(
  id = 1:10,
  unicode_text = c("Hello", "世界", "مرحبا", "Здравствуй", "こんにちは", 
                   "안녕하세요", "Olá", "Γεια σου", "שלום", "हैलो"),
  special_chars = c("A&B", "C<D", "E>F", "G\"H", "I'J", 
                    "K\\L", "M/N", "O|P", "Q?R", "S*T"),
  numbers_text = c("1st", "2nd", "3rd", "4th", "5th", 
                   "6th", "7th", "8th", "9th", "10th"),
  stringsAsFactors = FALSE
)
saveRDS(df_special, "test-data/sample_special_chars.rds")
cat("Created: sample_special_chars.rds\n")

# 9. Empty data frame
df_empty <- data.frame()
saveRDS(df_empty, "test-data/sample_empty.rds")
cat("Created: sample_empty.rds\n")

# 10. Single value
single_value <- 42
saveRDS(single_value, "test-data/sample_single_value.rds")
cat("Created: sample_single_value.rds\n")

cat("\n✓ All sample RDS files created successfully in test-data/ directory\n")
cat("Files created:\n")
list.files("test-data", pattern = "\\.rds$", full.names = FALSE)