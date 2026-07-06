import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqp from 'amqplib';

export interface AuditEvent {
    servicio: string;
    accion: string;
    entidad: string;
    datos?: any;
    fecha_hora: Date;
    id_usuario?: number;
    usuario?: string;
    ip: string;
    mac: string;
    id_vehiculo?: string;
}

@Injectable()
export class EventPublisher implements OnModuleInit, OnModuleDestroy {
    private connection: any = null;
    private channel: any = null;
    private exchangeName: string;
    private routingKey: string;
    private readonly logger = new Logger(EventPublisher.name);

    constructor(private readonly configService: ConfigService) {
        this.exchangeName = this.configService.get<string>('RABBITMQ_EXCHANGE') || 'audit_exchange';
        this.routingKey = this.configService.get<string>('RABBITMQ_ROUTING_KEY') || 'audit_routing_key';
    }

    async onModuleInit() {
        await this.connect();
    }

    async onModuleDestroy() {
        if (this.channel) {
            await this.channel.close();
        }
        if (this.connection) {
            await this.connection.close();
        }
    }

    private async connect() {
        try {
            const host = this.configService.get('RABBITMQ_HOST') || 'localhost';
            const port = this.configService.get('RABBITMQ_PORT') || 5672;
            const user = this.configService.get('RABBITMQ_USER') || 'admin';
            const pass = this.configService.get('RABBITMQ_PASSWORD') || 'admin123';
            const url = `amqp://${user}:${pass}@${host}:${port}`;
            
            this.connection = await amqp.connect(url);
            this.channel = await this.connection.createChannel();

            await this.channel.assertExchange(this.exchangeName, 'topic', { durable: true });
            this.logger.log(`Connected to RabbitMQ and asserted exchange: ${this.exchangeName}`);
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to connect to RabbitMQ at URL. Error: ${errMsg}`);
            setTimeout(() => this.connect(), 5000); // Retry after 5 seconds
        }
    }

    async publishAuditEvent(event: AuditEvent): Promise<void> {
        try {
            if (!this.channel) {
                this.logger.warn('Channel is not established, event is not published');
                return;
            }
            const message = Buffer.from(JSON.stringify(event));
            await this.channel.publish(this.exchangeName, this.routingKey, message, { persistent: true });
            this.logger.log(`Evento Publicado: ${event.servicio} ${event.accion} ${event.entidad}`);
        } catch (error) {
            this.logger.error(`Error publicando evento de auditoría: ${error}`);
        }
    }

    // Para compatibilidad con código existente que pueda llamar a `.publish()`
    async publish(event: any): Promise<void> {
        return this.publishAuditEvent(event);
    }
}