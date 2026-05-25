export interface Transaction {
  id: string;
  amount: number;
  currency?: string;
  category: string;
  location: string;
  description: string;
}

export interface TaxRules {
  region: string;
  corporateTaxRate: number;
  exemptions: string[];
  flaggableCategories: string[];
  contextRules: string;
}

export interface FlaggedTransaction {
  transactionId: string;
  reason: string;
  severity: "Low" | "Medium" | "High";
}

export interface AuditReport {
  flaggedTransactions: FlaggedTransaction[];
  summary: string;
  overallRiskScore: number;
  recommendations: string[];
}

export interface AuditEvent {
  type: "log" | "ledger_data" | "tax_data" | "report_data" | "complete" | "error";
  message?: string;
  data?: any;
}
