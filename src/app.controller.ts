import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { GetQueryDto } from './dto/getQuery.dto';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getUsefulForks(@Query() query: GetQueryDto) {
    return this.appService.findForkAheadCommits(query.url);
  }
}
