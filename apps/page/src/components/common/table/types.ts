export type AdminTableColumnAlign = "center" | "left" | "right";
export type AdminTableColumnFixed = boolean | "left" | "right";
export type AdminTableColumnSortable = boolean | "custom";
export type AdminTableCellContent = boolean | null | number | string | undefined;

export interface AdminTableColumn<TRow extends object> {
  align?: AdminTableColumnAlign;
  field?: Extract<keyof TRow, string>;
  fixed?: AdminTableColumnFixed;
  formatter?: (context: AdminTableCellContext<TRow>) => AdminTableCellContent;
  headerAlign?: AdminTableColumnAlign;
  key: string;
  label: string;
  minWidth?: number | string;
  showOverflowTooltip?: boolean;
  slot?: string;
  sortable?: AdminTableColumnSortable;
  width?: number | string;
}

export interface AdminTableCellContext<TRow extends object> {
  column: AdminTableColumn<TRow>;
  index: number;
  row: TRow;
  value: unknown;
}
