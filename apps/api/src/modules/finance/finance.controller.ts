import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Res, StreamableFile } from "@nestjs/common";
import type { Response } from "express";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import { InvoicesService } from "./invoices.service";
import { PaymentsService } from "./payments.service";
import { ExpensesService } from "./expenses.service";
import { FinanceReportsService } from "./finance-reports.service";
import { FinanceExportService, ExportFile } from "./finance-export.service";
import {
  CorrectPaymentDto,
  CreateExpenseDto,
  CreateInvoiceDto,
  FinanceExportQueryDto,
  FinanceSummaryQueryDto,
  ListExpensesQueryDto,
  ListInvoicesQueryDto,
  ListPaymentsQueryDto,
  ReasonDto,
  RecordPaymentDto,
} from "./dto/finance.dto";

function send(res: Response, file: ExportFile): StreamableFile {
  res.set({ "Content-Type": file.contentType, "Content-Disposition": `attachment; filename="${file.filename}"`, "Cache-Control": "no-store" });
  return new StreamableFile(file.buffer);
}

/**
 * Staff finance endpoints.
 *   Reception + Admin: look up invoices/payments, issue invoices, record payments.
 *   Admin only: voiding/correcting money records, expenses, reports and exports.
 */
@Controller("admin")
export class FinanceController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly payments: PaymentsService,
    private readonly expenses: ExpensesService,
    private readonly reports: FinanceReportsService,
    private readonly exporter: FinanceExportService,
  ) {}

  // --- Invoices
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Get("invoices")
  listInvoices(@Query() query: ListInvoicesQueryDto) {
    return this.invoices.list(query);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Get("invoices/:id")
  invoice(@Param("id", ParseUUIDPipe) id: string) {
    return this.invoices.findOne(id);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Get("invoices/:id/pdf")
  async invoicePdf(@Param("id", ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    return send(res, await this.exporter.invoicePdf(id));
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post("invoices")
  createInvoice(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoices.createManual(dto, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch("invoices/:id/void")
  voidInvoice(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ReasonDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoices.voidInvoice(id, dto.reason, user.sub);
  }

  // --- Payments
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Get("payments")
  listPayments(@Query() query: ListPaymentsQueryDto) {
    return this.payments.list(query);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post("payments")
  recordPayment(@Body() dto: RecordPaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payments.record(dto, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch("payments/:id/void")
  voidPayment(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ReasonDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payments.voidPayment(id, dto.reason, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch("payments/:id/correct")
  correctPayment(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CorrectPaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payments.correct(id, dto, user.sub);
  }

  // --- Expenses (owner only)
  @Roles(Role.ADMIN)
  @Get("expenses")
  listExpenses(@Query() query: ListExpensesQueryDto) {
    return this.expenses.list(query);
  }

  @Roles(Role.ADMIN)
  @Post("expenses")
  createExpense(@Body() dto: CreateExpenseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.expenses.create(dto, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch("expenses/:id/void")
  voidExpense(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ReasonDto, @CurrentUser() user: AuthenticatedUser) {
    return this.expenses.voidExpense(id, dto.reason, user.sub);
  }

  // --- Reports and exports (owner only)
  @Roles(Role.ADMIN)
  @Get("finance/summary")
  summary(@Query() query: FinanceSummaryQueryDto) {
    return this.reports.summary(query);
  }

  @Roles(Role.ADMIN)
  @Get("finance/export")
  async export(@Query() query: FinanceExportQueryDto, @Res({ passthrough: true }) res: Response) {
    return send(res, await this.exporter.export(query));
  }
}

/** The member's own money: invoices, payments, what is owed. Always scoped to the caller. */
@Controller()
export class MyBillingController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly payments: PaymentsService,
    private readonly exporter: FinanceExportService,
  ) {}

  @Get("billing/me")
  billing(@CurrentUser() user: AuthenticatedUser) {
    return this.invoices.billingSummary(user.sub);
  }

  @Get("invoices/me")
  myInvoices(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoices.mine(user.sub, query);
  }

  @Get("invoices/me/:id")
  myInvoice(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoices.mineOne(user.sub, id);
  }

  @HttpCode(HttpStatus.OK)
  @Get("invoices/me/:id/pdf")
  async myInvoicePdf(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    return send(res, await this.exporter.invoicePdf(id, user.sub));
  }

  @Get("payments/me")
  myPayments(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payments.mine(user.sub, query);
  }
}
