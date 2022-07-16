import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();
  app.enableShutdownHooks();
  app.enableVersioning();

  app.use(helmet());
  app.use(compression({ threshold: 0 }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      disableErrorMessages:
        process.env.NODE_ENV === 'development' ? false : true,
    }),
  );

  const swaggerOptions = new DocumentBuilder()
    .setTitle('Find useful forks')
    .setVersion('1.0.0')
    .build();

  const swaggerDoc = SwaggerModule.createDocument(app, swaggerOptions);
  SwaggerModule.setup(`/docs`, app, swaggerDoc, {
    swaggerOptions: {
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  });

  const PORT = process.env.PORT || 8080;
  await app.listen(PORT, async () => {
    Logger.log(`Server is running on: http://localhost:${PORT}/`, 'NestAPI');
  });
}
bootstrap();
