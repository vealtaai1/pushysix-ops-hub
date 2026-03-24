export type ExpenseEntryKind = "MANUAL" | "EMPLOYEE_SUBMISSION" | "RETAINER_RECURRING";

export type MoneyInput = {
  amount: string; // keep as string in forms; server should parse to cents
  currency: "CAD" | "USD";
};

export type ExpenseEntryListItem = {
  id: string;
  kind: ExpenseEntryKind;
  clientId: string;
  clientName: string;
  expenseDate: string; // ISO date (yyyy-mm-dd)
  description: string;
  vendor?: string | null;
  amountCents: number;
  currency: string;
  receiptUrl?: string | null;
  status?: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PAID" | "POSTED";
};
