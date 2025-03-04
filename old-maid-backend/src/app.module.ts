// import { Module } from '@nestjs/common';
// import { GameGateway } from './game.gateway';

// @Module({
//   providers: [GameGateway],
// })
// export class AppModule {}
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { GameGateway } from './game.gateway';

@Module({
  controllers: [AppController], // Add the controller
  providers: [GameGateway],
})
export class AppModule {}
