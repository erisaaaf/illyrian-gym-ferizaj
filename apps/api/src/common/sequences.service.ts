import { Injectable } from "@nestjs/common";
import { Prisma } from "@illyrian/database";

type Tx = Prisma.TransactionClient;

/**
 * Human-readable unique numbers from PostgreSQL sequences. A sequence hands out each value exactly once even
 * when two staff members act at the same instant, so numbers can never collide (unlike max()+1).
 * Gaps are possible if a transaction rolls back - which is normal and acceptable for invoice numbering.
 */
@Injectable()
export class SequencesService {
  async nextMemberNumber(tx: Tx): Promise<string> {
    const rows = await tx.$queryRaw<Array<{ n: bigint }>>`SELECT nextval('member_number_seq') AS n`;
    return `IG-${String(rows[0].n).padStart(5, "0")}`;
  }

  async nextInvoiceNumber(tx: Tx, issuedAt: Date = new Date()): Promise<string> {
    const rows = await tx.$queryRaw<Array<{ n: bigint }>>`SELECT nextval('invoice_number_seq') AS n`;
    return `INV-${issuedAt.getUTCFullYear()}-${String(rows[0].n).padStart(6, "0")}`;
  }
}
