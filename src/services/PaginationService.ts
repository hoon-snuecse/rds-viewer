export class PaginationService {
    private pageSize: number = 100;
    private currentPage: number = 1;
    private totalRows: number = 0;
    private data: any[] = [];

    constructor(pageSize: number = 100) {
        this.pageSize = pageSize;
    }

    /**
     * Set the data for pagination
     */
    setData(data: any[], totalRows?: number) {
        this.data = data;
        this.totalRows = totalRows || data.length;
        this.currentPage = 1;
    }

    /**
     * Get current page data
     */
    getCurrentPage(): any[] {
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        return this.data.slice(start, end);
    }

    /**
     * Get pagination info
     */
    getPaginationInfo() {
        const totalPages = Math.ceil(this.totalRows / this.pageSize);
        const start = ((this.currentPage - 1) * this.pageSize) + 1;
        const end = Math.min(this.currentPage * this.pageSize, this.totalRows);

        return {
            currentPage: this.currentPage,
            totalPages,
            pageSize: this.pageSize,
            totalRows: this.totalRows,
            start,
            end,
            hasPrev: this.currentPage > 1,
            hasNext: this.currentPage < totalPages
        };
    }

    /**
     * Go to specific page
     */
    goToPage(page: number): any[] {
        const totalPages = Math.ceil(this.totalRows / this.pageSize);
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
        }
        return this.getCurrentPage();
    }

    /**
     * Go to next page
     */
    nextPage(): any[] {
        return this.goToPage(this.currentPage + 1);
    }

    /**
     * Go to previous page
     */
    prevPage(): any[] {
        return this.goToPage(this.currentPage - 1);
    }

    /**
     * Go to first page
     */
    firstPage(): any[] {
        return this.goToPage(1);
    }

    /**
     * Go to last page
     */
    lastPage(): any[] {
        const totalPages = Math.ceil(this.totalRows / this.pageSize);
        return this.goToPage(totalPages);
    }

    /**
     * Change page size
     */
    setPageSize(size: number) {
        this.pageSize = size;
        this.currentPage = 1;
        return this.getCurrentPage();
    }

    /**
     * Generate HTML for pagination controls
     */
    generatePaginationHTML(): string {
        const info = this.getPaginationInfo();
        
        return `
            <div class="pagination-controls">
                <div class="pagination-info">
                    Showing ${info.start.toLocaleString()} - ${info.end.toLocaleString()} of ${info.totalRows.toLocaleString()} rows
                </div>
                <div class="pagination-buttons">
                    <button onclick="paginateFirst()" ${!info.hasPrev ? 'disabled' : ''}>⏮ First</button>
                    <button onclick="paginatePrev()" ${!info.hasPrev ? 'disabled' : ''}>◀ Previous</button>
                    <span class="page-indicator">Page ${info.currentPage} of ${info.totalPages}</span>
                    <button onclick="paginateNext()" ${!info.hasNext ? 'disabled' : ''}>Next ▶</button>
                    <button onclick="paginateLast()" ${!info.hasNext ? 'disabled' : ''}>Last ⏭</button>
                </div>
                <div class="page-size-selector">
                    <label>Rows per page:</label>
                    <select onchange="changePageSize(this.value)">
                        <option value="50" ${this.pageSize === 50 ? 'selected' : ''}>50</option>
                        <option value="100" ${this.pageSize === 100 ? 'selected' : ''}>100</option>
                        <option value="200" ${this.pageSize === 200 ? 'selected' : ''}>200</option>
                        <option value="500" ${this.pageSize === 500 ? 'selected' : ''}>500</option>
                        <option value="1000" ${this.pageSize === 1000 ? 'selected' : ''}>1000</option>
                    </select>
                </div>
            </div>
        `;
    }
}