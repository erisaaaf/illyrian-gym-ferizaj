import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

const METHODS = ["CASH", "BANK", "CARD"] as const;
const EXPENSE_CATEGORIES = ["RENT", "EQUIPMENT", "MAINTENANCE", "UTILITIES", "SALARIES", "MARKETING", "OTHER"] as const;
// Cents. 100,000,000 = 1,000,000.00 - far above any real gym transaction, but stops absurd/overflow values.
const MAX_CENTS = 100_000_000;

export class RecordPaymentDto {
  @IsUUID()
  userId!: string;

  /** The invoice this money pays. Optional only when `membershipId` is given and has an open invoice. */
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsOptional()
  @IsUUID()
  membershipId?: string;

  @IsInt()
  @Min(1)
  @Max(MAX_CENTS)
  amountCents!: number;

  @IsIn(METHODS)
  method!: (typeof METHODS)[number];

  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ReasonDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class CorrectPaymentDto extends ReasonDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_CENTS)
  amountCents?: number;

  @IsOptional()
  @IsIn(METHODS)
  method?: (typeof METHODS)[number];

  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class InvoiceLineDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_CENTS)
  amountCents!: number;
}

export class CreateInvoiceDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsUUID()
  membershipId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_CENTS)
  discountCents?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ListInvoicesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsIn(["PAID", "PARTIAL", "PENDING", "OVERDUE", "VOID", "OUTSTANDING"])
  status?: "PAID" | "PARTIAL" | "PENDING" | "OVERDUE" | "VOID" | "OUTSTANDING";

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ListPaymentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsOptional()
  @IsIn(METHODS)
  method?: (typeof METHODS)[number];

  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsIn(["COMPLETED", "VOIDED"])
  status?: "COMPLETED" | "VOIDED";

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class CreateExpenseDto {
  @IsIn(EXPENSE_CATEGORIES)
  category!: (typeof EXPENSE_CATEGORIES)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_CENTS)
  amountCents!: number;

  @IsDateString()
  spentAt!: string;
}

export class ListExpensesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(EXPENSE_CATEGORIES)
  category?: (typeof EXPENSE_CATEGORIES)[number];

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class FinanceSummaryQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(METHODS)
  method?: (typeof METHODS)[number];

  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsIn(["day", "week", "month"])
  groupBy?: "day" | "week" | "month";
}

export class FinanceExportQueryDto extends FinanceSummaryQueryDto {
  @IsIn(["summary", "payments", "invoices", "expenses"])
  type!: "summary" | "payments" | "invoices" | "expenses";

  @IsIn(["xlsx", "pdf"])
  format!: "xlsx" | "pdf";
}
