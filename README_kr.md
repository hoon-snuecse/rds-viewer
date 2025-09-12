# RDS Viewer for VS Code

📊 Visual Studio Code에서 R 데이터 직렬화(RDS) 파일을 직접 보고 탐색할 수 있습니다.

## 주요 기능

### 🚀 핵심 기능
- **탭 인터페이스**: 요약과 데이터 뷰를 전환
- **엑셀 스타일 데이터 뷰어**: 친숙한 스프레드시트 인터페이스로 데이터 탐색
- **스마트 데이터 로딩**: 성능을 위한 자동 청크 단위 로딩
- **네비게이션**: 특정 행으로 이동, 100/1000행 단위 이동
- **컬럼 네비게이션**: 한 번에 10개 컬럼 보기 또는 전체 컬럼 토글
- **검색 및 하이라이트**: 데이터셋 전체에서 텍스트 검색 및 강조
- **내보내기 옵션**: CSV, JSON, Excel 형식으로 내보내기
- **행 및 셀 선택**: 클릭으로 행이나 셀 선택 및 하이라이트

### 📋 지원 데이터 타입
- 데이터 프레임 (완전한 변수 분석 제공)
- 리스트 (중첩 구조 포함)
- 벡터 (숫자형, 문자형, 논리형, 팩터)
- 행렬
- 시계열 객체
- 복잡한 S3/S4 객체

### 🎯 주요 특징
- **빠른 미리보기**: 큰 파일도 즉시 요약 정보 로드
- **스마트 데이터 로딩**: 필요할 때만 전체 데이터 로드
- **WebView UI**: 정렬 가능한 테이블이 있는 WebView 인터페이스
- **컨텍스트 메뉴**: .rds 파일을 우클릭하여 요약 보기 또는 미리보기
- **보안**: 외부 종속성 없이 격리된 하위 프로세스에서 R 실행

## 시스템 요구사항

- **R 설치 필요**: 시스템에 R이 설치되어 있어야 합니다
  - 다운로드: https://www.r-project.org/
  - 확장이 일반적인 위치에서 R을 자동 감지합니다
  - 또는 설정에서 사용자 정의 경로 구성 가능

- **R 패키지**: 다음 R 패키지가 권장됩니다:
  ```r
  install.packages("jsonlite")
  ```

## 설치

1. VS Code Marketplace에서 확장 설치 (준비 중)
2. 또는 VSIX 파일로 설치:
   ```bash
   code --install-extension rds-viewer-1.0.0.vsix
   ```

## 사용법

### RDS 파일 열기

1. **우클릭 메뉴**: Explorer에서 `.rds` 파일을 우클릭
   - "Show RDS Summary"를 선택하여 빠른 개요 보기
   - "Open RDS Preview"를 선택하여 전체 데이터 보기

2. **명령 팔레트**: `Cmd+Shift+P` (Mac) 또는 `Ctrl+Shift+P` (Windows/Linux) 누르기
   - "RDS: Show Summary" 입력
   - "RDS: Open Preview" 입력

3. **파일 연결**: `.rds` 파일을 더블클릭하여 뷰어로 열기

### 요약 뷰 이해하기

요약 뷰는 다음을 제공합니다:

#### 파일 정보
- 파일 이름과 크기
- 마지막 수정 날짜
- R 버전 호환성

#### 객체 개요
- 객체 타입 (data.frame, list, vector 등)
- 객체 클래스 (사용자 정의 S3/S4 클래스 포함)
- 메모리 사용량

#### 데이터 프레임 세부사항
- **차원**: 행과 열의 수
- **완전한 케이스**: 결측값이 없는 행
- **변수 테이블**:
  - 변수 이름 (클릭하여 복사)
  - 데이터 타입과 클래스
  - 고유값 개수
  - 결측값 개수와 백분율
  - 숫자형 변수의 통계 요약
  - 범주형 변수의 팩터 레벨

## 설정

VS Code 설정에서 확장 구성:

```json
{
  "rdsViewer.rPath": "/usr/local/bin/R",          // R 실행 파일 경로
  "rdsViewer.maxPreviewRows": 1000,               // 표시할 최대 행 수
  "rdsViewer.showSummaryOnOpen": true,            // 기본적으로 요약 표시
  "rdsViewer.summaryPanelPosition": "left"        // 패널 위치: top/left/right/popup
}
```

## 예제

### 샘플 데이터 프레임 요약
```
📊 데이터 프레임 요약
차원: 10,000 행 × 25 열
완전한 행: 8,543 (85.43%)
결측 셀: 2,341 (0.94%)

📋 변수 (25)
┌─────────┬──────────┬─────────┬────────┐
│ 변수    │ 타입     │ 결측    │ 요약   │
├─────────┼──────────┼─────────┼────────┤
│ id      │ integer  │ 0       │ 1~10000│
│ age     │ numeric  │ 12      │ μ=42.3 │
│ gender  │ factor   │ 0       │ 2 levels│
└─────────┴──────────┴─────────┴────────┘
```

## 개발

### 소스에서 빌드하기

```bash
# 리포지토리 클론
git clone https://github.com/hoon-snuecse/rds-viewer.git
cd rds-viewer

# 의존성 설치
npm install

# TypeScript 컴파일
npm run compile

# 개발 모드로 실행
code .
# 그런 다음 F5를 눌러 확장 개발 호스트 실행
```

### 테스트

테스트 파일은 `test-data/` 디렉토리에 포함되어 있습니다:
- `sample_dataframe.rds` - 혼합 타입의 기본 데이터 프레임
- `sample_large_dataframe.rds` - 대용량 데이터셋 (10,000행)
- `sample_complex_list.rds` - 중첩 리스트 구조
- `sample_vector.rds` - 숫자형 벡터
- `sample_matrix.rds` - 행렬 데이터

## 문제 해결

### R을 찾을 수 없음
- R이 설치되어 있는지 확인: 터미널에서 `R --version` 실행
- 설정에서 R 경로 구성: `rdsViewer.rPath`
- macOS Homebrew: 경로는 보통 `/opt/homebrew/bin/R`
- Windows: 경로는 보통 `C:\Program Files\R\R-4.x.x\bin\R.exe`

### RDS 파일이 열리지 않음
- 파일 권한 확인
- 파일이 손상되지 않았는지 확인: R 콘솔에서 `readRDS("file.rds")` 시도
- VS Code 출력 패널에서 오류 메시지 확인

### jsonlite 패키지 누락
R 콘솔에서 설치:
```r
install.packages("jsonlite")
```

## 기여하기

기여를 환영합니다! 다음을 따라주세요:
1. 리포지토리 포크
2. 기능 브랜치 생성
3. 풀 리퀘스트 제출

이슈 보고: https://github.com/hoon-snuecse/rds-viewer/issues

## 라이선스

MIT 라이선스 - 자세한 내용은 LICENSE 파일 참조

## 감사의 말

- Excel Viewer 확장 아키텍처에서 영감을 받음
- 데이터 처리를 위해 R과 jsonlite 사용
- VS Code Extension API로 구축

## 로드맵

### 1단계 (현재) ✅
- [x] 기본 RDS 파일 읽기
- [x] 요약 정보 표시
- [x] WebView UI
- [x] 데이터 프레임 미리보기

### 2단계 (완료) ✅
- [x] CSV/Excel/JSON 내보내기
- [x] 검색 및 필터링 (하이라이트 포함)
- [x] 무한 스크롤로 성능 최적화
- [x] 넓은 데이터셋을 위한 컬럼 페이지네이션

---

**VS Code에서 R 데이터를 탐색하는 즐거움을 누리세요!** 🎉