import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { envs } from './common/config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  await app.listen(envs.port);
  logger.log(`Payments ms running on port ${envs.port}`);
}
bootstrap();
