# RDS Viewer VS Code Extension 개발 계획서

## 1. 프로젝트 개요

### 1.1 목적
R 프로젝트에서 사용되는 RDS (R Data Serialization) 파일을 VS Code에서 직접 열어보고 탐색할 수 있는 Extension 개발

### 1.2 배경
- 현재 VS Code에서 R 개발 시 RDS 파일을 직접 볼 수 없어 불편함
- RStudio로 전환하거나 별도의 R 콘솔을 사용해야 하는 번거로움 존재
- Excel Viewer Extension과 유사한 방식으로 RDS 파일 뷰어 구현 가능

### 1.3 참고 프로젝트
- **Excel Viewer Extension (gc-excelviewer)**: VS Code에서 Excel/CSV 파일을 보고 편집하는 Extension
  - GitHub: https://github.com/jjuback/gc-excelviewer
  - Wijmo 라이브러리를 사용한 WebView 기반 구현
  - Custom Editor API 활용

## 2. 기술 분석

### 2.1 Excel Viewer Extension 아키텍처 분석

#### 핵심 구성 요소
1. **Extension 활성화 (extension.ts)**
   - 명령어 등록 (preview, refresh 등)
   - Custom Editor Provider 등록
   - WebView Panel Serializer 등록

2. **Document View 관리**
   - BaseDocumentView: 기본 WebView 패널 관리
   - ExcelDocumentView: Excel 특화 기능
   - CsvDocumentView: CSV 특화 기능
   - DocumentViewManager: 여러 뷰 인스턴스 관리

3. **Custom Editor Provider**
   - ExcelEditorProvider: .xlsx, .xlsm 파일 처리
   - CsvEditorProvider: .csv, .tsv 파일 처리
   - 파일 저장/읽기 기능 구현

4. **WebView 렌더링**
   - Wijmo 라이브러리 (FlexGrid, FlexSheet)
   - HTML/JavaScript 기반 UI
   - VS Code와 WebView 간 메시지 통신

### 2.2 RDS 파일 형식 이해

#### RDS 특징
- R의 네이티브 바이너리 직렬화 형식
- 단일 R 객체를 저장 (데이터프레임, 리스트, 벡터 등)
- 메타데이터 보존 (클래스, 속성, 이름 등)
- gzip 압축 지원
- R 버전 간 호환성 있음

#### 데이터 처리 방법
- **직접 파싱**: JavaScript에서 RDS 바이너리 형식을 직접 파싱하는 라이브러리 없음
- **R 브릿지 사용**: Node.js에서 R 코드 실행
  - rio (node-rio): Rserve를 통한 R 통합
  - r-integration: 시스템 호출을 통한 R 실행
  - child_process: R 스크립트 직접 실행

## 3. 아키텍처 설계

### 3.1 전체 구조
```
RDS Viewer Extension
├── Extension Core
│   ├── 활성화/비활성화 로직
│   ├── 명령어 등록
│   └── 설정 관리
├── RDS Document Provider
│   ├── RDS 파일 읽기
│   ├── R 브릿지 통신
│   └── 데이터 변환 (RDS → JSON)
├── WebView UI
│   ├── 테이블 뷰어 (데이터프레임)
│   ├── 트리 뷰어 (리스트/중첩 구조)
│   ├── 텍스트 뷰어 (벡터/기본 타입)
│   └── 검색/필터링 기능
└── R Integration Layer
    ├── R 프로세스 관리
    ├── RDS 읽기 스크립트
    └── JSON 변환 로직
```

### 3.2 핵심 컴포넌트

#### 3.2.1 RDS Reader Service
```typescript
interface RdsReaderService {
  readRdsFile(uri: Uri): Promise<RDataObject>
  convertToJson(rObject: RDataObject): JsonData
  getObjectType(rObject: RDataObject): RObjectType
}
```

#### 3.2.2 R Bridge Service
```typescript
interface RBridgeService {
  executeRScript(script: string): Promise<string>
  readRds(filePath: string): Promise<any>
  getDataFrame(filePath: string): Promise<DataFrame>
}
```

#### 3.2.3 WebView Manager
```typescript
interface RdsWebViewManager {
  createWebView(data: JsonData, type: RObjectType): WebviewPanel
  updateWebView(data: JsonData): void
  handleMessage(message: any): void
}
```

### 3.3 데이터 흐름
1. 사용자가 RDS 파일 선택
2. Extension이 R Bridge를 통해 파일 읽기
3. R에서 RDS를 JSON으로 변환
4. JSON 데이터를 WebView로 전송
5. WebView에서 적절한 UI로 렌더링

## 4. 구현 전략

### 4.0 Phase 0: 긴급 기능 - RDS 파일 요약 정보 (1주)
**목표**: RDS 파일의 내용을 빠르게 파악할 수 있는 요약 정보 우선 제공

**핵심 기능**:
- **빠른 요약 정보 표시**
  - 객체 타입 (data.frame, list, matrix, vector 등)
  - 데이터프레임: 행/열 수, 변수 타입 분포
  - 변수 목록 및 타입 (numeric, character, factor, logical)
  - 결측치 비율 및 분포
  - 메모리 크기
  
- **요약 정보 UI**
  - 파일 선택 시 즉시 팝업/패널로 요약 표시
  - 데이터 로딩 전 미리보기
  - 분할 화면 옵션 (요약 + 데이터 뷰)

**구현 방식**:
- R 스크립트로 요약 정보만 빠르게 추출
- JSON 형태로 변환하여 WebView에 표시
- 전체 데이터 로딩은 선택적으로 진행

### 4.1 Phase 1: MVP (최소 기능 제품)
**목표**: 기본적인 RDS 파일 읽기 및 표시

**기능**:
- RDS 파일을 JSON으로 변환
- 데이터프레임을 테이블로 표시
- 기본 벡터/리스트 표시
- 읽기 전용 모드

**기술 스택**:
- TypeScript (Extension 로직)
- Child Process (R 실행)
- HTML/CSS/JavaScript (WebView UI)
- 기본 HTML 테이블 또는 간단한 그리드 라이브러리

### 4.2 Phase 2: 향상된 기능
**기능 추가**:
- 대용량 데이터 페이징
- 검색 및 필터링
- 정렬 기능
- 데이터 타입별 최적화된 뷰
- CSV/Excel 내보내기

**기술 개선**:
- 가상 스크롤링 (대용량 데이터)
- 캐싱 메커니즘
- 비동기 데이터 로딩

### 4.3 Phase 3: 고급 기능
**기능 확장**:
- 복잡한 R 객체 지원 (S3/S4 클래스)
- 데이터 편집 기능
- RDS 파일 저장
- 데이터 시각화 (간단한 차트)
- 다중 파일 비교

## 5. 기술적 도전 과제 및 해결 방안

### 5.1 R 의존성
**문제**: Extension 사용자가 R을 설치해야 함
**해결방안**:
1. R 설치 확인 및 가이드 제공
2. R 경로 자동 탐지
3. 설정을 통한 R 경로 지정
4. (장기) WebAssembly를 통한 브라우저 내 R 실행 검토

### 5.2 성능
**문제**: 대용량 RDS 파일 처리
**해결방안**:
1. 스트리밍 방식 데이터 로딩
2. 가상 스크롤링 구현
3. 데이터 청크 단위 처리
4. 프로그레시브 렌더링

### 5.3 데이터 타입 매핑
**문제**: R과 JavaScript 간 데이터 타입 차이
**해결방안**:
1. 포괄적인 타입 매핑 테이블 구축
2. Factor를 카테고리로 변환
3. Date/POSIXct를 ISO 문자열로 변환
4. NA/NULL 처리 규칙 정의

## 6. 개발 일정

### Phase 0: 긴급 구현 (1주)
- 1-2일차: RDS 요약 정보 추출 R 스크립트 개발
- 3-4일차: 요약 정보 표시 UI 구현
- 5일차: 테스트 및 최적화

### Phase 1 (4주)
- 1주차: 프로젝트 설정 및 기본 Extension 구조
- 2주차: R Bridge 구현 및 테스트
- 3주차: WebView UI 기본 구현
- 4주차: 통합 테스트 및 버그 수정

### Phase 2 (4주)
- 5-6주차: 성능 최적화 및 대용량 데이터 처리
- 7-8주차: 검색/필터/정렬 기능 구현

### Phase 3 (4주)
- 9-10주차: 고급 기능 구현
- 11-12주차: 문서화 및 배포 준비

## 7. 테스트 전략

### 7.1 단위 테스트
- R Bridge 통신 테스트
- 데이터 변환 로직 테스트
- WebView 메시지 핸들링 테스트

### 7.2 통합 테스트
- 다양한 RDS 파일 형식 테스트
- 대용량 데이터 처리 테스트
- 에러 처리 시나리오 테스트

### 7.3 사용자 테스트
- 실제 R 사용자 피드백 수집
- UI/UX 개선사항 도출
- 성능 벤치마킹

## 8. 배포 계획

### 8.1 초기 배포 (Alpha)
- GitHub 저장소 공개
- VSIX 파일 직접 배포
- 얼리 어답터 피드백 수집

### 8.2 마켓플레이스 배포 (Beta)
- VS Code Marketplace 등록
- 상세 문서 작성
- 예제 RDS 파일 제공

### 8.3 정식 버전
- 안정성 검증 완료
- 다국어 지원
- 정기 업데이트 계획

## 9. 라이선스 및 기여

### 9.1 라이선스
- MIT 라이선스 (오픈소스)
- Excel Viewer의 라이선스 참고

### 9.2 기여 가이드라인
- GitHub Issues를 통한 버그 리포트
- Pull Request 환영
- 코드 스타일 가이드 제공

## 10. 참고 자료

### 기술 문서
- [VS Code Extension API](https://code.visualstudio.com/api)
- [Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors)
- [WebView API](https://code.visualstudio.com/api/extension-guides/webview)
- [R Internals - Serialization](https://cran.r-project.org/doc/manuals/r-release/R-ints.html)

### 관련 프로젝트
- [gc-excelviewer](https://github.com/jjuback/gc-excelviewer)
- [vscode-R](https://github.com/REditorSupport/vscode-R)
- [node-rio](https://www.npmjs.com/package/rio)

### R 패키지
- jsonlite: R 객체를 JSON으로 변환
- base::readRDS: RDS 파일 읽기
- base::serialize: R 객체 직렬화

## 11. 예상 코드 구조

### 11.1 Extension 진입점
```typescript
// src/extension.ts
export function activate(context: ExtensionContext) {
    // RDS 요약 정보 명령 등록
    const rdsSummaryCommand = commands.registerCommand('rds.summary', async (uri) => {
        const summary = await rBridge.getRdsSummary(uri.fsPath);
        showSummaryPanel(summary);
    });
    
    // RDS 미리보기 명령 등록
    const rdsPreviewCommand = commands.registerCommand('rds.preview', (uri) => {
        // RDS 파일 미리보기 로직
    });
    
    // Custom Editor Provider 등록
    context.subscriptions.push(RdsEditorProvider.register(context));
}
```

### 11.2 R Bridge 구현 예시
```typescript
// src/rBridge.ts
export class RBridge {
    // 요약 정보만 빠르게 추출
    async getRdsSummary(filePath: string): Promise<RdsSummary> {
        const script = `
            source("./r-scripts/get_rds_summary.R")
            get_rds_summary("${filePath}")
        `;
        const result = await this.executeRScript(script);
        return JSON.parse(result);
    }
    
    // 전체 데이터 읽기
    async readRdsAsJson(filePath: string): Promise<any> {
        const script = `
            library(jsonlite)
            data <- readRDS("${filePath}")
            toJSON(data, auto_unbox = TRUE, na = "null")
        `;
        return await this.executeRScript(script);
    }
}
```

### 11.3 WebView 렌더링
```html
<!-- webview/index.html -->
<!DOCTYPE html>
<html>
<head>
    <link href="${styleUri}" rel="stylesheet">
</head>
<body>
    <!-- 요약 정보 패널 -->
    <div id="summary-panel" class="summary-panel">
        <h3>📊 RDS 파일 요약</h3>
        <div class="summary-content">
            <div class="summary-item">
                <span class="label">타입:</span>
                <span id="object-type"></span>
            </div>
            <div class="summary-item">
                <span class="label">크기:</span>
                <span id="object-size"></span>
            </div>
            <div id="dataframe-summary" style="display:none;">
                <div class="summary-item">
                    <span class="label">차원:</span>
                    <span id="dimensions"></span>
                </div>
                <div class="summary-item">
                    <span class="label">변수:</span>
                    <span id="variables"></span>
                </div>
                <div class="summary-item">
                    <span class="label">결측치:</span>
                    <span id="missing"></span>
                </div>
            </div>
        </div>
        <button id="load-full-data">전체 데이터 보기</button>
    </div>
    
    <!-- 데이터 뷰어 -->
    <div id="data-viewer" style="display:none;"></div>
    
    <script src="${scriptUri}"></script>
</body>
</html>
```

## 12. 결론

RDS Viewer Extension은 VS Code에서 R 개발을 하는 사용자들에게 큰 편의를 제공할 수 있는 도구입니다. Excel Viewer Extension의 검증된 아키텍처를 참고하고, R Bridge를 통한 데이터 처리 방식을 채택함으로써 안정적이고 실용적인 Extension을 개발할 수 있을 것으로 예상됩니다.

초기에는 읽기 전용 기능에 집중하여 빠르게 MVP를 출시하고, 사용자 피드백을 바탕으로 점진적으로 기능을 확장하는 전략을 채택합니다. 특히 R 사용자 커뮤니티와의 소통을 통해 실제 필요한 기능을 파악하고 우선순위를 정하는 것이 중요합니다.