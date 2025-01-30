import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { envs } from '../common/config';
import { Services } from '../common/constants';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: Services.NATS_SERVICE,
        transport: Transport.NATS,
        options: {
          servers: envs.natsServers,
        },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class NatsModule {}
