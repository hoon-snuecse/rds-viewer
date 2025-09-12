export interface RdsSummary {
    file: FileInfo;
    object: ObjectInfo;
    dataframe?: DataFrameInfo;
    list?: ListInfo;
    vector?: VectorInfo;
    matrix?: MatrixInfo;
    error?: string;
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
    class: string;
    unique: number;
    missing: number;
    missingPercent: number;
    summary?: NumericSummary | FactorSummary | CharacterSummary;
}

export interface NumericSummary {
    min: number;
    max: number;
    mean: number;
    median: number;
    q1?: number;
    q3?: number;
    sd?: number;
}

export interface FactorSummary {
    levels: string[];
    nLevels: number;
    topCounts?: Record<string, number>;
}

export interface CharacterSummary {
    sample: string[];
    maxLength?: number;
    minLength?: number;
}

export interface MissingInfo {
    totalCells: number;
    missingCells: number;
    totalMissing: number; // Add this for compatibility
    missingPercent: number;
    completeRows: number;
    completeRowsPercent: number;
    missingByColumn?: Record<string, number>;
}

export interface ListInfo {
    length: number;
    elements: ListElement[];
    maxDepth: number;
}

export interface ListElement {
    name: string;
    type: string;
    class: string[];
    size?: number;
    preview?: any;
}

export interface VectorInfo {
    length: number;
    type: string;
    unique?: number; // Add this for unique values count
    summary?: NumericSummary | CharacterSummary;
    preview?: any[];
}

export interface MatrixInfo {
    dimensions: {
        rows: number;
        cols: number;
    };
    type: string;
    summary?: NumericSummary;
    preview?: any[][];
}