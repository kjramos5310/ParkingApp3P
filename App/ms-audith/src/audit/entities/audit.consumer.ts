// import { Logger, OnModuleInit } from "@nestjs/common";
// import amqp from "amqp-connection-manager";
// import { AuditService } from "../audit.service";
// import { ConfigService } from "@nestjs/config";
// import { connect } from "http2";

// export class AuditConsumer implements OnModuleInit {

//     private readonly logger = new Logger{ AuditConsumer.name };
//     private connection: amqp.Connection;
//     private channel: amqp.Channel;

//     async onModuleInit() {

// }
// constructor(
//     private configService: ConfigService;
//         private auditService: AuditService;
//     ) { }

//     async onModuleInit() { }

//     private async connect() {
//     const host = this.configService.get<string>('RABBITMQ_HOST')
//     const port = this.configService.get<number>('RABBITMQ_PORT')
//     const user = this.configService.get<string>('RABBITMQ_USER')
//     const password = this.configService.get<string>('RABBITMQ_PASSWORD')
//     const queue = this.configService.get<string>('RABBITMQ_QUEUE')
//     const exchange = this.configService.get<string>('RABBITMQ_EXCHANGE')
//     const routingKey = this.configService.get<string>('RABBITMQ_ROUTING_KEY')

//     const url= `amqp://${user}:${password}@${host}:${port}`;

//     try{
//         this.connection = amqp.connect([url]);
//         this.channel = this.connection.createChannel();

//         this.logger.log('Conectado a RabbitMQ');

//         await this.channel.assertExchange(exchange, 'topic', { durable: true });
//         const { queue } = await this.channel.assertQueue(queue, { exclusive: false });

//         await this.channel.bindQueue(queue, exchange, routingKey);

//         this.logger.log(`Esperando mensajes en ${queue}`);
//     } catch(error();
//     )
// }
// }
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit.service';
import * as amqp from 'amqplib';
import { plainToClass } from 'class-transformer';
import { CreateAuditDto } from '../dto/create-audit.dto';
import { validate, ValidationError } from 'class-validator';

@Injectable()
export class AuditConsumer implements OnModuleInit {
    private readonly logger = new Logger(AuditConsumer.name);
    private connection: any;
    private channel: any;

    constructor(
        private configService: ConfigService,
        private auditService: AuditService,
    ) { }

    async onModuleInit() {
        await this.connect();
        await this.consume();
    }

    private async connect() {
        const host = this.configService.get('RABBITMQ_HOST');
        const port = this.configService.get('RABBITMQ_PORT');
        const user = this.configService.get('RABBITMQ_USER');
        const pass = this.configService.get('RABBITMQ_PASSWORD');
        const url = `amqp://${user}:${pass}@${host}:${port}`;

        try {
            this.connection = await amqp.connect(url);
            this.channel = await this.connection.createChannel();
            this.logger.log(`Connected to RabbitMQ at ${url}`);
        } catch (error) {
            this.logger.error(`Failed to connect to RabbitMQ at ${error}`);
            setTimeout(() => this.connect(), 5000); // Retry after 5 seconds
        }
    }

    private async consume() {
        const queue = this.configService.get('RABBITMQ_QUEUE');
        const exchange = this.configService.get('RABBITMQ_EXCHANGE');
        const routingKey = this.configService.get('RABBITMQ_ROUTING_KEY');

        try {
            await this.channel.assertExchange(exchange, 'topic', { durable: true });
            await this.channel.assertQueue(queue, { durable: true });
            await this.channel.bindQueue(queue, exchange, routingKey);

            this.channel.consume(
                queue,
                async (msg) => {
                    if (msg) {
                        const content = msg.content.toString();
                        this.logger.debug(`Mensaje recibido: ${content}`);
                        try {
                            const raw = JSON.parse(content);
                            if (raw.fecha_hora) {
                                raw.fecha_hora = new Date(raw.fecha_hora);
                            }
                            const dto = plainToClass(CreateAuditDto, raw);
                            const errors = await validate(dto);

                            // Verificar que errors sea un arreglo y tenga elementos
                            if (Array.isArray(errors) && errors.length > 0) {
                                const errorMessages = errors.map((e: ValidationError) =>
                                    Object.values(e.constraints || {}).join(', '),
                                );
                                this.logger.warn(`DTO inválido: ${errorMessages.join('; ')}`);
                                // Rechazar el mensaje y no reencolar (para evitar bucles)
                                this.channel.nack(msg, false, false);
                                return;
                            }

                            // Guardar el evento de auditoría
                            await this.auditService.create(dto);
                            this.logger.debug('Evento de auditoría guardado exitosamente');
                            this.channel.ack(msg);
                        } catch (err) {
                            const errorMessage =
                                err instanceof Error ? err.message : 'Error desconocido';
                            this.logger.error(`Error procesando mensaje: ${errorMessage}`);
                            // Rechazar el mensaje y no reencolar
                            this.channel.nack(msg, false, false);
                        }
                    }
                },
                { noAck: false },
            );
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : 'Error desconocido';
            this.logger.error(`Error configurando consumidor: ${errorMessage}`);
        }
    }
}