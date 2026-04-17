import { Page } from "@playwright/test";
import { WaitHelper } from "./wait-helper";
import { ElementHelper } from "./element-helper";

/** HTML table queries and interactions using 1-based row/column indexing. */
export class TableHelper {
  constructor(
    private readonly page: Page,
    private readonly waits: WaitHelper,
    private readonly elements: ElementHelper
  ) {}

  // ── Cell access ─────────────────────────────────────────────────────────────

  private cellSelector(
    tableSelector: string,
    rowNumber: number,
    columnNumber: number,
    includeHeader: boolean,
    cellType: "td" | "th" = "td"
  ): string {
    const row = includeHeader ? rowNumber : rowNumber + 1;
    return `${tableSelector} tr:nth-child(${row}) ${cellType}:nth-child(${columnNumber})`;
  }

  async getTableCellText(
    tableSelector: string,
    rowNumber: number,
    columnNumber: number,
    includeHeader = false
  ): Promise<string> {
    await this.waits.waitForElement(tableSelector);
    return await this.elements.getText(
      this.cellSelector(tableSelector, rowNumber, columnNumber, includeHeader)
    );
  }

  async clickTableCell(
    tableSelector: string,
    rowNumber: number,
    columnNumber: number,
    includeHeader = false
  ): Promise<void> {
    await this.waits.waitForElement(tableSelector);
    await this.elements.clickElement(
      this.cellSelector(tableSelector, rowNumber, columnNumber, includeHeader)
    );
  }

  async clickTableCellAdvanced(
    tableSelector: string,
    rowNumber: number,
    columnNumber: number,
    cellType: "td" | "th" = "td",
    includeHeader = false
  ): Promise<void> {
    await this.waits.waitForElement(tableSelector);
    await this.elements.clickElement(
      this.cellSelector(tableSelector, rowNumber, columnNumber, includeHeader, cellType)
    );
  }

  async clickElementInTableCell(
    tableSelector: string,
    rowNumber: number,
    columnNumber: number,
    elementSelector: string,
    includeHeader = false
  ): Promise<void> {
    await this.waits.waitForElement(tableSelector);
    const cell = this.cellSelector(tableSelector, rowNumber, columnNumber, includeHeader);
    await this.elements.clickElement(`${cell} ${elementSelector}`);
  }

  async clickTableRow(
    tableSelector: string,
    rowNumber: number,
    includeHeader = false
  ): Promise<void> {
    await this.waits.waitForElement(tableSelector);
    const row = includeHeader ? rowNumber : rowNumber + 1;
    await this.elements.clickElement(`${tableSelector} tr:nth-child(${row})`);
  }

  // ── Search ──────────────────────────────────────────────────────────────────

  async clickTableCellByText(
    tableSelector: string,
    searchText: string,
    searchColumnNumber: number,
    clickColumnNumber: number,
    includeHeader = false
  ): Promise<void> {
    await this.waits.waitForElement(tableSelector);
    const startRow = includeHeader ? 1 : 2;
    const rows = await this.page.locator(`${tableSelector} tr`).count();

    for (let row = startRow; row <= rows; row++) {
      const logicalRow = row - (includeHeader ? 0 : 1);
      const cellText = await this.getTableCellText(
        tableSelector,
        logicalRow,
        searchColumnNumber,
        includeHeader
      );
      if (cellText.trim() === searchText.trim()) {
        await this.clickTableCell(tableSelector, logicalRow, clickColumnNumber, includeHeader);
        return;
      }
    }

    throw new Error(`Text "${searchText}" not found in column ${searchColumnNumber}`);
  }

  // ── Bulk reads ──────────────────────────────────────────────────────────────

  async getTableData(
    tableSelector: string,
    includeHeader = true
  ): Promise<Array<Record<string, string>>> {
    await this.waits.waitForElement(tableSelector);
    return await this.page.evaluate(
      (selector) => {
        const table = document.querySelector(selector) as HTMLTableElement | null;
        if (!table) return [];
        return Array.from(table.querySelectorAll("tr")).map((row, index) => {
          const cells = Array.from(row.querySelectorAll("td, th"));
          const rowData: Record<string, string> = { row: String(index + 1) };
          cells.forEach((cell, i) => {
            rowData[`column_${i + 1}`] = cell.textContent?.trim() ?? "";
          });
          return rowData;
        });
      },
      tableSelector
    );
  }

  async getTableDimensions(
    tableSelector: string,
    includeHeader = true
  ): Promise<{ rows: number; columns: number }> {
    await this.waits.waitForElement(tableSelector);
    const totalRows = await this.page.locator(`${tableSelector} tr`).count();
    const columns = await this.page
      .locator(
        `${tableSelector} tr:first-child td, ${tableSelector} tr:first-child th`
      )
      .count();
    return { rows: includeHeader ? totalRows : totalRows - 1, columns };
  }
}
