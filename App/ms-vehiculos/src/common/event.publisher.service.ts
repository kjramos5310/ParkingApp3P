import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqp from 'amqplib';

export interface AuditEvent {
    tenant_id: string;
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
    private readonly pending: AuditEvent[] = [];
    private connecting = false;
    private flushing = false;
    private shuttingDown = false;

    constructor(private readonly configService: ConfigService) {
        this.exchangeName = this.configService.get<string>('RABBITMQ_EXCHANGE') || 'audit_exchange';
        this.routingKey = this.configService.get<string>('RABBITMQ_ROUTING_KEY') || 'audit_routing_key';
    }

    async onModuleInit() {
        await this.connect();
    }

    async onModuleDestroy() {
        this.shuttingDown = true;
        if (this.channel) {
            await this.channel.close();
        }
        if (this.connection) {
            await this.connection.close();
        }
    }

    private async connect() {
        if (this.connecting || this.channel || this.shuttingDown) return;
        this.connecting = true;
        try {
            const host = this.configService.get('RABBITMQ_HOST') || 'localhost';
            const port = this.configService.get('RABBITMQ_PORT') || 5672;
            const user = this.configService.get('RABBITMQ_USER') || 'admin';
            const pass = this.configService.get('RABBITMQ_PASSWORD') || 'admin123';
            const url = `amqp://${user}:${pass}@${host}:${port}`;

            this.connection = await amqp.connect(url);
            this.channel = await this.connection.createConfirmChannel();
            await this.channel.assertExchange(this.exchangeName, 'topic', { durable: true });
            this.connection.once('close', () => {
                this.channel = null;
                this.connection = null;
                if (!this.shuttingDown) setTimeout(() => void this.connect(), 1000).unref();
            });
            this.logger.log(`Connected to RabbitMQ and asserted exchange: ${this.exchangeName}`);
            await this.flushPending();
        } catch (error) {
            this.channel = null;
            const errMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to connect to RabbitMQ at URL. Error: ${errMsg}`);
            if (!this.shuttingDown) setTimeout(() => void this.connect(), 5000).unref();
        } finally {
            this.connecting = false;
        }
    }

    private async flushPending(): Promise<void> {
        if (this.flushing || !this.channel) return;
        this.flushing = true;
        try {
            while (this.channel && this.pending.length > 0) {
                const event = this.pending[0];
                this.channel.publish(
                    this.exchangeName,
                    this.routingKey,
                    Buffer.from(JSON.stringify(event)),
                    { persistent: true, contentType: 'application/json' },
                );
                await this.channel.waitForConfirms();
                this.pending.shift();
                this.logger.log(`Evento confirmado: ${event.servicio} ${event.accion} ${event.entidad}`);
            }
        } finally {
            this.flushing = false;
        }
    }

    async publishAuditEvent(event: AuditEvent): Promise<void> {
        this.pending.push(event);
        try {
            if (!this.channel) await this.connect();
            await this.flushPending();
        } catch (error) {
            this.logger.error(`Evento retenido para reintento: ${error}`);
            this.channel = null;
            if (!this.shuttingDown) setTimeout(() => void this.connect(), 1000).unref();
        }
    }

    // Para compatibilidad con código existente que pueda llamar a `.publish()`
    async publish(event: any): Promise<void> {
        return this.publishAuditEvent(event);
    }
}
