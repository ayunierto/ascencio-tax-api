export type ExpensesByCategory = Record<
  string,
  {
    [subcategory: string]: ExpenseValues;
    total: ExpenseValues;
  }
>;

export interface ExpenseValues {
  gross: number;
  hst: number;
  net: number;
}
