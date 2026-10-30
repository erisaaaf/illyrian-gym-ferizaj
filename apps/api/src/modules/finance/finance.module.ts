import { Module } from "@nestjs/common";
import { AuditService } from "../../common/audit/audit.service";
import { FinanceController, MyBillingController } from "./finance.controller";
import { InvoicesService } from "./invoices.service";
import { PaymentsService } from "./payments.service";
import { ExpensesService } from "./expenses.service";
import { FinanceReportsService } from "./finance-reports.service";
import { FinanceExportService } from "./finance-export.service";

@Module({
  controllers: [FinanceController, MyBillingController],
  providers: [InvoicesService, PaymentsService, ExpensesService, FinanceReportsService, FinanceExportService, AuditService],
  exports: [InvoicesService, PaymentsService, FinanceReportsService],
})
export class FinanceModule {}
