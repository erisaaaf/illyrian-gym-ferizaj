import { Global, Module } from "@nestjs/common";
import { GymRulesService } from "./gym-rules.service";
import { QrService } from "./qr.service";
import { SequencesService } from "./sequences.service";

/** Cross-cutting services used by many feature modules. Global so each module does not have to re-provide them. */
@Global()
@Module({
  providers: [GymRulesService, QrService, SequencesService],
  exports: [GymRulesService, QrService, SequencesService],
})
export class CommonModule {}
