# RDS 파일 요약 정보 사양서

## 1. 요약 정보의 필요성

RDS 파일을 열기 전에 파일의 전체적인 구조와 내용을 빠르게 파악할 수 있는 요약 정보를 제공하여:
- 불필요한 데이터 로딩 시간 절약
- 파일 내용의 빠른 확인
- 대용량 파일 처리 전 사전 정보 제공
- 여러 RDS 파일 중 원하는 파일 빠른 식별

## 2. 요약 정보 항목

### 2.1 기본 정보 (Basic Information)
```yaml
파일 정보:
  - 파일명: "data.rds"
  - 파일 크기: "15.3 MB"
  - 생성 일시: "2024-01-15 14:30:00"
  - R 버전: "4.3.1"
  - 인코딩: "UTF-8"
```

### 2.2 객체 정보 (Object Information)
```yaml
객체 타입: "data.frame" | "list" | "matrix" | "vector" | "factor" | "custom S3/S4"
클래스: ["data.frame", "tbl_df", "tbl"]
차원:
  - 행(Rows): 10,000
  - 열(Columns): 25
메모리 크기: "12.5 MB"
```

### 2.3 데이터프레임 전용 정보 (DataFrame Specific)

#### 변수 요약 (Variable Summary)
```yaml
변수 개수:
  - 총 변수: 25
  - 수치형(numeric): 10
  - 문자형(character): 5
  - 팩터(factor): 8
  - 논리형(logical): 1
  - 날짜형(Date/POSIXct): 1

변수 목록:
  - id: integer (1 ~ 10000)
  - name: character (unique: 9856)
  - age: numeric (18 ~ 85, mean: 42.3)
  - gender: factor (2 levels: "M", "F")
  - income: numeric (15000 ~ 250000, NA: 234)
  - date: Date (2020-01-01 ~ 2024-01-01)
  ...
```

#### 결측치 정보 (Missing Values)
```yaml
결측치 요약:
  - 완전한 행: 8,543 (85.43%)
  - 결측치 포함 행: 1,457 (14.57%)
  - 전체 결측치: 2,341 (0.94% of total cells)
  
변수별 결측치:
  - income: 234 (2.34%)
  - education: 156 (1.56%)
  - occupation: 89 (0.89%)
```

### 2.4 리스트 전용 정보 (List Specific)
```yaml
리스트 구조:
  - 최상위 요소 개수: 5
  - 최대 중첩 깊이: 3
  - 요소 타입:
    - data.frame: 2
    - numeric vector: 10
    - character vector: 3
    - nested list: 1
    
요소 목록:
  - $data: data.frame [1000 x 10]
  - $metadata: list [5 elements]
  - $results: numeric [100]
  - $labels: character [50]
  - $config: list [nested]
```

### 2.5 벡터/행렬 전용 정보 (Vector/Matrix Specific)
```yaml
벡터 정보:
  - 길이: 10,000
  - 타입: numeric
  - 범위: -3.45 ~ 102.34
  - 평균: 45.67
  - 중앙값: 43.21
  - NA 개수: 123

행렬 정보:
  - 차원: 100 x 50
  - 타입: numeric
  - 희소성(Sparsity): 15.3%
```

### 2.6 통계 요약 (Statistical Summary)
```yaml
수치형 변수 통계:
  - 변수명: age
    - Min: 18
    - Q1: 32
    - Median: 42
    - Mean: 42.3
    - Q3: 53
    - Max: 85
    - SD: 14.2
    - NA: 0

범주형 변수 분포:
  - 변수명: gender
    - M: 4,523 (45.23%)
    - F: 5,477 (54.77%)
    
  - 변수명: region
    - 서울: 2,341 (23.41%)
    - 경기: 1,892 (18.92%)
    - 부산: 876 (8.76%)
    - 기타: 4,891 (48.91%)
```

## 3. UI 디자인

### 3.1 요약 정보 표시 모드

#### 옵션 1: 분할 화면 (Split View)
```
┌─────────────────────────────────────────────────────┐
│  RDS 파일 요약  |  데이터 뷰어                       │
├─────────────────┼───────────────────────────────────┤
│ 📊 기본 정보     │  [데이터 테이블/그리드]           │
│ └ 타입: df      │   ID  Name   Age  Gender         │
│ └ 크기: 10K×25  │   1   John   35   M              │
│                 │   2   Jane   28   F              │
│ 📈 변수 정보     │   3   Bob    42   M              │
│ └ 수치형: 10    │   ...                             │
│ └ 문자형: 5     │                                   │
│                 │                                   │
│ ⚠️ 결측치        │                                   │
│ └ 전체: 2.3%    │                                   │
│                 │                                   │
└─────────────────────────────────────────────────────┘
```

#### 옵션 2: 탭 방식 (Tabbed View)
```
┌─────────────────────────────────────────────────────┐
│ [요약] [데이터] [변수] [통계] [시각화]              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📋 RDS 파일 요약 정보                              │
│  ────────────────────                              │
│                                                     │
│  객체 타입: data.frame                             │
│  차원: 10,000 행 × 25 열                           │
│  메모리: 12.5 MB                                   │
│                                                     │
│  [▼ 변수 정보]                                     │
│  ┌─────────┬──────────┬─────────┬────────┐       │
│  │ 변수명   │ 타입      │ 결측치   │ 요약    │       │
│  ├─────────┼──────────┼─────────┼────────┤       │
│  │ id      │ integer  │ 0       │ 1~10000 │       │
│  │ age     │ numeric  │ 12      │ μ=42.3  │       │
│  │ gender  │ factor   │ 0       │ 2 levels│       │
│  └─────────┴──────────┴─────────┴────────┘       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### 옵션 3: 축소 가능한 패널 (Collapsible Panels)
```
┌─────────────────────────────────────────────────────┐
│ data.rds - RDS Viewer                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│ [▼] 📊 요약 정보 (클릭하여 접기/펼치기)             │
│ ┌─────────────────────────────────────────────┐   │
│ │ • 타입: data.frame (10,000 × 25)             │   │
│ │ • 메모리: 12.5 MB                            │   │
│ │ • 변수: 수치형(10), 문자형(5), 팩터(8)        │   │
│ │ • 결측치: 2.3% (2,341 cells)                 │   │
│ │ [상세 보기...]                               │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ [▶] 📈 변수별 상세 정보                            │
│ [▶] 📊 통계 요약                                   │
│                                                     │
│ ─────────────────────────────────────────────────  │
│                                                     │
│ [데이터 뷰어 영역]                                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 3.2 빠른 요약 팝업 (Quick Summary Popup)
```
┌──────────────────────────────┐
│ 💡 빠른 요약                  │
├──────────────────────────────┤
│ data.rds                     │
│ ─────────                    │
│ ▪ DataFrame: 10K × 25        │
│ ▪ 수치형 10, 문자형 5        │
│ ▪ 결측치 2.3%               │
│ ▪ 메모리 12.5 MB            │
│                              │
│ [자세히] [열기] [닫기]       │
└──────────────────────────────┘
```

## 4. R 스크립트 구현

### 4.1 요약 정보 추출 스크립트
```r
# get_rds_summary.R
library(jsonlite)

get_rds_summary <- function(file_path) {
  # 파일 정보
  file_info <- file.info(file_path)
  
  # RDS 읽기
  obj <- readRDS(file_path)
  
  # 기본 정보
  summary_info <- list(
    file = list(
      name = basename(file_path),
      size = format(file_info$size, big.mark = ","),
      modified = as.character(file_info$mtime)
    ),
    object = list(
      class = class(obj),
      type = typeof(obj),
      size = format(object.size(obj), units = "MB")
    )
  )
  
  # 데이터프레임인 경우
  if (is.data.frame(obj)) {
    summary_info$dataframe <- list(
      dimensions = list(
        rows = nrow(obj),
        cols = ncol(obj)
      ),
      variables = get_variable_summary(obj),
      missing = get_missing_summary(obj),
      preview = head(obj, 5)
    )
  }
  
  # 리스트인 경우
  if (is.list(obj) && !is.data.frame(obj)) {
    summary_info$list <- get_list_structure(obj)
  }
  
  # 벡터/행렬인 경우
  if (is.vector(obj) || is.matrix(obj)) {
    summary_info$vector_matrix <- get_vector_matrix_summary(obj)
  }
  
  return(toJSON(summary_info, auto_unbox = TRUE, na = "null"))
}

get_variable_summary <- function(df) {
  vars <- lapply(df, function(x) {
    list(
      type = class(x)[1],
      unique = length(unique(x)),
      missing = sum(is.na(x)),
      summary = if(is.numeric(x)) {
        list(
          min = min(x, na.rm = TRUE),
          max = max(x, na.rm = TRUE),
          mean = mean(x, na.rm = TRUE),
          median = median(x, na.rm = TRUE)
        )
      } else if(is.factor(x)) {
        list(levels = levels(x), n_levels = nlevels(x))
      } else {
        list(sample = head(unique(x), 5))
      }
    )
  })
  return(vars)
}

get_missing_summary <- function(df) {
  list(
    total_cells = nrow(df) * ncol(df),
    missing_cells = sum(is.na(df)),
    complete_rows = sum(complete.cases(df)),
    missing_by_column = colSums(is.na(df))
  )
}
```

### 4.2 빠른 요약 스크립트 (경량 버전)
```r
# quick_summary.R
quick_rds_summary <- function(file_path) {
  obj <- readRDS(file_path)
  
  summary <- list(
    type = class(obj)[1],
    size = format(object.size(obj), units = "auto")
  )
  
  if (is.data.frame(obj)) {
    summary$rows <- nrow(obj)
    summary$cols <- ncol(obj)
    summary$variables <- table(sapply(obj, function(x) class(x)[1]))
    summary$missing_pct <- round(sum(is.na(obj)) / (nrow(obj) * ncol(obj)) * 100, 2)
  }
  
  return(jsonlite::toJSON(summary, auto_unbox = TRUE))
}
```

## 5. TypeScript 인터페이스

```typescript
// types/rds-summary.ts

export interface RdsSummary {
  file: FileInfo;
  object: ObjectInfo;
  dataframe?: DataFrameInfo;
  list?: ListInfo;
  vectorMatrix?: VectorMatrixInfo;
}

export interface FileInfo {
  name: string;
  size: string;
  modified: string;
  rVersion?: string;
  encoding?: string;
}

export interface ObjectInfo {
  class: string[];
  type: string;
  size: string;
}

export interface DataFrameInfo {
  dimensions: {
    rows: number;
    cols: number;
  };
  variables: Record<string, VariableInfo>;
  missing: MissingInfo;
  preview?: any[][];
}

export interface VariableInfo {
  type: string;
  unique: number;
  missing: number;
  summary: NumericSummary | FactorSummary | CharacterSummary;
}

export interface NumericSummary {
  min: number;
  max: number;
  mean: number;
  median: number;
  sd?: number;
}

export interface FactorSummary {
  levels: string[];
  nLevels: number;
  distribution?: Record<string, number>;
}

export interface CharacterSummary {
  sample: string[];
  maxLength?: number;
  minLength?: number;
}

export interface MissingInfo {
  totalCells: number;
  missingCells: number;
  missingPercent: number;
  completeRows: number;
  missingByColumn: Record<string, number>;
}
```

## 6. 구현 우선순위

### Phase 0: 긴급 구현 (1주)
1. **빠른 요약 정보**
   - 파일 타입과 크기
   - 데이터프레임의 행/열 수
   - 변수 타입 분포
   - 전체 결측치 비율

2. **간단한 UI**
   - VS Code 알림 메시지로 요약 표시
   - 또는 WebView 상단에 고정 요약 패널

### Phase 1: 기본 구현 (2주)
- 변수별 상세 정보
- 결측치 상세 분석
- 분할 화면 UI

### Phase 2: 고급 기능 (3주)
- 통계 요약
- 데이터 미리보기
- 내보내기 기능

## 7. 사용 시나리오

### 시나리오 1: 파일 선택 시 즉시 요약
```
1. 사용자가 RDS 파일 클릭
2. 0.5초 내 요약 정보 팝업 표시
3. "열기" 클릭 시 전체 데이터 로드
```

### 시나리오 2: 호버 미리보기
```
1. 파일 탐색기에서 RDS 파일에 마우스 호버
2. 툴팁으로 간단 요약 표시
3. 클릭하여 상세 보기
```

### 시나리오 3: 명령 팔레트
```
1. Cmd+Shift+P → "RDS: Show Summary"
2. 파일 선택 다이얼로그
3. 요약 정보만 표시 (데이터 로드 안 함)
```