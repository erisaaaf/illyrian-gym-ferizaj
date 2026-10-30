import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { paginate, skipTake } from "../../common/pagination.util";
import { CreateExpenseDto, ListExpensesQueryDto } from "./dto/finance.dto";

/** Operating costs (rent, equipment, maintenance...). Separate from payments: an expense is money going out. */
@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListExpensesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ExpenseWhereInput = {
      voidedAt: null,
      ...(query.category ? { category: query.category } : {}),
      ...(query.from || query.to
        ? { spentAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } }
        : {}),
      ...(query.search ? { description: { contains: query.search, mode: "insensitive" } } : {}),
    };
    const [data, total, sum] = await this.prisma.client.$transaction([
      this.prisma.client.expense.findMany({ where, orderBy: { spentAt: "desc" }, ...skipTake(page, pageSize) }),
      this.prisma.client.expense.count({ where }),
      this.prisma.client.expense.aggregate({ where, _sum: { amountCents: true } }),
    ]);
    return { ...paginate(data, total, page, pageSize), totals: { spentCents: sum._sum.amountCents ?? 0 } };
  }

  async create(dto: CreateExpenseDto, actorId: string) {
    const expense = await this.prisma.client.expense.create({
      data: { category: dto.category, description: dto.description, amountCents: dto.amountCents, spentAt: new Date(dto.spentAt), recordedById: actorId },
    });
    await this.audit.record({ actorId, action: "expense.create", entityType: "Expense", entityId: expense.id, metadata: { category: dto.category, amountCents: dto.amountCents } });
    return expense;
  }

  async voidExpense(id: string, reason: string, actorId: string) {
    const existing = await this.prisma.client.expense.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Expense not found");
    if (existing.voidedAt) throw new BadRequestException("This expense is already void");
    const expense = await this.prisma.client.expense.update({ where: { id }, data: { voidedAt: new Date(), voidedById: actorId, voidReason: reason } });
    await this.audit.record({ actorId, action: "expense.void", entityType: "Expense", entityId: id, metadata: { amountCents: existing.amountCents, reason } });
    return expense;
  }
}
