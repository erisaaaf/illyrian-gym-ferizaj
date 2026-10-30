import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Res, StreamableFile } from "@nestjs/common";
import type { Response } from "express";
import { Role } from "@illyrian/database";
import { Roles } from "../../common/decorators/roles.decorator";
import { ReportsService } from "./reports.service";
import { ReportsExportService } from "./reports-export.service";
import { BusinessAssistantService } from "./business-assistant.service";
import { AskBusinessAssistantDto, AtRiskQueryDto, MonthlyReportExportQueryDto, MonthlyReportQueryDto, MonthsQueryDto, RangeQueryDto } from "./dto/reports.dto";

/** Business intelligence is for the owner: financial and member-behaviour data does not go to reception or trainers. */
@Roles(Role.ADMIN)
@Controller("admin/reports")
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly exporter: ReportsExportService,
    private readonly assistant: BusinessAssistantService,
  ) {}

  @Get("dashboard")
  dashboard() {
    return this.reports.dashboard();
  }

  @Get("membership-growth")
  growth(@Query() query: MonthsQueryDto) {
    return this.reports.membershipGrowth(query.months ?? 12);
  }

  @Get("attendance")
  attendance(@Query() query: RangeQueryDto) {
    return this.reports.attendance(query.from, query.to);
  }

  @Get("at-risk")
  atRisk(@Query() query: AtRiskQueryDto) {
    return this.reports.atRisk(query);
  }

  @Get("trainers")
  trainers(@Query() query: RangeQueryDto) {
    return this.reports.trainerActivity(query.from, query.to);
  }

  @Get("monthly")
  monthly(@Query() query: MonthlyReportQueryDto) {
    return this.reports.monthly(query.month);
  }

  @Get("monthly/export")
  async exportMonthly(@Query() query: MonthlyReportExportQueryDto, @Res({ passthrough: true }) res: Response) {
    const file = await this.exporter.monthly(query.month, query.format);
    res.set({ "Content-Type": file.contentType, "Content-Disposition": `attachment; filename="${file.filename}"`, "Cache-Control": "no-store" });
    return new StreamableFile(file.buffer);
  }

  @HttpCode(HttpStatus.OK)
  @Post("assistant")
  ask(@Body() dto: AskBusinessAssistantDto) {
    return this.assistant.ask(dto.question);
  }
}
