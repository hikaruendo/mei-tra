import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard, WsAuthGuard } from './auth.guard';
import { RepositoriesModule } from '../repositories/repositories.module';

@Module({
  imports: [RepositoriesModule],
  providers: [AuthService, AuthGuard, WsAuthGuard],
  exports: [AuthService, AuthGuard, WsAuthGuard],
})
export class AuthModule {}
