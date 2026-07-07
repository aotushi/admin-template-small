/**
 * 🔄 自维护声明：本文件更新后，请更新本注释 + ./README.md
 *
 * @input  - rowData: Excel 行数据数组，dateStr: 日期字符串
 * @output - ValidationResult: 验证结果（valid + errors[]），validateDateFormat(): 日期格式验证函数
 * @pos    - 数据验证层，作为后端最后防线，防止前端绕过验证，被 router/excel.ts 调用
 */

/**
 * Excel 数据验证工具
 * 用于验证前端上传的 Excel 数据格式
 */

export interface ValidationError {
  row: number;
  column: number;
  field: string;
  value: any;
  error: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * 验证日期格式是否为 YYYY-MM-DD
 * @param dateStr - 日期字符串
 * @returns 是否为有效的 YYYY-MM-DD 格式
 */
export function validateDateFormat(dateStr: any): boolean {
  if (!dateStr) return false;

  const str = String(dateStr).trim();

  // 检查格式: YYYY-MM-DD
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(str)) {
    return false;
  }

  // 验证日期有效性（例如：2025-02-30 是无效的）
  const [year, month, day] = str.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * 验证必填字段是否存在
 * @param value - 字段值
 * @returns 是否有效（非空且非纯空格）
 */
export function validateRequiredField(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  return true;
}

/**
 * 验证单行数据
 * @param row - 数据行数组
 * @param rowIndex - 行号（从1开始，不含标题行）
 * @param expectedColumns - 期望的列数
 * @returns 验证错误列表（空数组表示验证通过）
 */
export function validateDataRow(
  row: any[],
  rowIndex: number,
  expectedColumns: number = 0
): ValidationError[] {
  const errors: ValidationError[] = [];

  // 如果整行为空，跳过（允许空行）
  if (!row || row.length === 0 || row.every(cell => !cell && cell !== 0)) {
    return errors;
  }

  // 验证第一列：日期（必须是 YYYY-MM-DD 格式）
  if (row.length > 0) {
    const dateValue = row[0];
    if (!validateDateFormat(dateValue)) {
      errors.push({
        row: rowIndex,
        column: 0,
        field: 'Date',
        value: dateValue,
        error: `日期格式不正确: "${dateValue}"，请使用 YYYY-MM-DD 格式（如：2025-01-31）`
      });
    }
  } else {
    errors.push({
      row: rowIndex,
      column: 0,
      field: 'Date',
      value: undefined,
      error: '缺少日期字段'
    });
  }

  // 验证第二列：Product（必填字段）
  if (row.length > 1) {
    const productValue = row[1];
    if (!validateRequiredField(productValue)) {
      errors.push({
        row: rowIndex,
        column: 1,
        field: 'Product',
        value: productValue,
        error: `Product 字段缺失或为空`
      });
    }
  } else {
    errors.push({
      row: rowIndex,
      column: 1,
      field: 'Product',
      value: undefined,
      error: '缺少 Product 字段'
    });
  }

  // 如果指定了期望列数，检查列数是否匹配
  if (expectedColumns > 0 && row.length !== expectedColumns) {
    errors.push({
      row: rowIndex,
      column: -1,
      field: 'ColumnCount',
      value: row.length,
      error: `列数不匹配：期望 ${expectedColumns} 列，实际 ${row.length} 列`
    });
  }

  return errors;
}

/**
 * 验证整个 Excel 数据集
 * @param jsonData - Excel 解析后的数据（包含标题行）
 * @param sheetName - 工作表名称
 * @returns 验证结果
 */
export function validateExcelData(
  jsonData: any[][],
  sheetName: string = 'Sheet1'
): ValidationResult {
  const allErrors: ValidationError[] = [];

  // 第一行是标题行，从第二行开始验证
  const headerRow = jsonData[0];
  const expectedColumns = headerRow ? headerRow.length : 0;

  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    const rowErrors = validateDataRow(row, i + 1, expectedColumns);
    allErrors.push(...rowErrors);
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors
  };
}

/**
 * 格式化验证错误信息为用户友好的消息
 * @param errors - 验证错误列表
 * @param maxErrors - 最多显示的错误数量
 * @returns 格式化的错误消息
 */
export function formatValidationErrors(
  errors: ValidationError[],
  maxErrors: number = 10
): string {
  if (errors.length === 0) return '';

  const displayErrors = errors.slice(0, maxErrors);
  const hasMore = errors.length > maxErrors;

  let message = '数据验证失败，发现以下问题：\n\n';

  displayErrors.forEach((error, index) => {
    message += `${index + 1}. 第 ${error.row} 行`;
    if (error.column >= 0) {
      message += `，第 ${error.column + 1} 列（${error.field}）`;
    }
    message += `：${error.error}\n`;
  });

  if (hasMore) {
    message += `\n... 还有 ${errors.length - maxErrors} 个错误未显示\n`;
  }

  message += '\n提示：请确保所有日期格式为 YYYY-MM-DD，且必填字段不为空。';

  return message;
}
