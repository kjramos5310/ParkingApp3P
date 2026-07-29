import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import * as amqp from 'amqplib';
import { AuditOutbox } from './entities/audit-outbox.entity';

/**
 * Evento de dominio publicado hacia ms-auditoria. Los nombres de campo
 * (snake_case) deben coincidir EXACTAMENTE con el CreateAuditDto de
 * ms-auditoria, de lo contrario el mensaje es rechazado por validacion.
 */
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

/**
 * Publicador de eventos de auditoria con patron OUTBOX.
 *
 * El evento se escribe primero en la tabla `audit_outbox` de la propia base de
 * datos del microservicio y solo despues se intenta enviar a RabbitMQ. Un relay
 * periodico reintenta las filas que siguen pendientes.
 *
 * Por que outbox y no un buffer en memoria: si el broker esta caido y el pod se
 * reinicia, un buffer en memoria pierde los eventos y la auditoria queda
 * incompleta. Las filas de la outbox sobreviven al reinicio y se publican en
 * cuanto RabbitMQ vuelve, de modo que no falta ningun registro.
 *
 * Garantias del canal:
 *   - createConfirmChannel + waitForConfirms -> el broker confirma cada mensaje
 *   - exchange durable y mensajes persistent -> sobreviven al reinicio del broker
 *   - la fila solo se marca publicada tras la confirmacion -> at-least-once
 */
@Injectable()
export class EventPublisher implements OnModuleInit, OnModuleDestroy {
    private connection: any = null;
    private channel: any = null;
    private readonly exchangeName: string;
    private readonly routingKey: string;
    private readonly logger = new Logger(EventPublisher.name);
    private connecting = false;
    private relaying = false;
    private shuttingDown = false;
    private temporizador?: ReturnType<typeof setInterval>;
    private ultimaPurga = 0;

    /** Cada cuanto reintenta el relay las filas pendientes. */
    private static readonly INTERVALO_RELAY_MS = 5000;
    /** Filas que se publican como maximo en cada pasada. */
    private static readonly TAMANO_LOTE = 100;
    /** Cuanto se conservan las filas ya publicadas antes de purgarlas. */
    private static readonly RETENCION_HORAS = 24;
    /** Cada cuanto se ejecuta la purga de filas antiguas. */
    private static readonly INTERVALO_PURGA_MS = 60 * 60 * 1000;

    constructor(
        private readonly configService: ConfigService,
        @InjectRepository(AuditOutbox)
        private readonly outbox: Repository<AuditOutbox>,
    ) {
        this.exchangeName = this.configService.get<string>('RABBITMQ_EXCHANGE') || 'audit_exchange';
        this.routingKey = this.configService.get<string>('RABBITMQ_ROUTING_KEY') || 'audit_routing_key';
    }

    async onModuleInit() {
        await this.connect();
        // El relay tambien recupera lo que quedo pendiente de ejecuciones
        // anteriores del proceso, no solo lo de esta sesion.
        this.temporizador = setInterval(
            () => void this.relay(),
            EventPublisher.INTERVALO_RELAY_MS,
        );
        this.temporizador.unref?.();
        await this.relay();
    }

    async onModuleDestroy() {
        this.shuttingDown = true;
        if (this.temporizador) clearInterval(this.temporizador);
        try {
            if (this.channel) await this.channel.close();
        } catch {
            // el canal ya estaba cerrado
        }
        try {
            if (this.connection) await this.connection.close();
        } catch {
            // la conexion ya estaba cerrada
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
            });
            // Sin este manejador, un error de conexion emitido de forma
            // asincrona tumbaria el proceso entero de Node.
            this.connection.on('error', (error: any) => {
                this.logger.warn(`Conexion con RabbitMQ perdida: ${error?.message ?? error}`);
            });
            this.logger.log(`Conectado a RabbitMQ; exchange declarado: ${this.exchangeName}`);
        } catch (error) {
            this.channel = null;
            this.connection = null;
            const errMsg = error instanceof Error ? error.message : String(error);
            this.logger.warn(`RabbitMQ no disponible (se reintentara): ${errMsg}`);
        } finally {
            this.connecting = false;
        }
    }

    /**
     * Persiste el evento en la outbox y trata de publicarlo de inmediato.
     *
     * Nunca lanza: un fallo de auditoria no debe tumbar la operacion de
     * negocio. Tampoco espera a que RabbitMQ conteste si esta caido, para que
     * la latencia de la API no dependa del estado del broker.
     */
    async publishAuditEvent(event: AuditEvent): Promise<void> {
        try {
            await this.outbox.save(
                this.outbox.create({
                    tenantId: event.tenant_id,
                    payload: event as unknown as Record<string, any>,
                }),
            );
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(`No se pudo guardar el evento en la outbox: ${errMsg}`);
            return;
        }

        // Con el broker arriba se publica en el acto; si no, la fila queda
        // pendiente y el relay periodico se encarga.
        if (this.channel) {
            await this.relay();
        }
    }

    /** Alias historico usado por algunos servicios. */
    async publish(event: AuditEvent): Promise<void> {
        return this.publishAuditEvent(event);
    }

    /**
     * Publica las filas pendientes en orden de creacion. Si una falla se
     * detiene el lote: reintentar en orden evita que la auditoria registre los
     * eventos de un mismo recurso desordenados.
     */
    private async relay(): Promise<void> {
        if (this.relaying || this.shuttingDown) return;
        this.relaying = true;
        try {
            if (!this.channel) await this.connect();
            if (!this.channel) return;

            const pendientes = await this.outbox.find({
                where: { publicadoEn: IsNull() },
                order: { creadoEn: 'ASC' },
                take: EventPublisher.TAMANO_LOTE,
            });

            for (const fila of pendientes) {
                if (!this.channel || this.shuttingDown) break;
                try {
                    this.channel.publish(
                        this.exchangeName,
                        this.routingKey,
                        Buffer.from(JSON.stringify(fila.payload)),
                        {
                            persistent: true,
                            contentType: 'application/json',
                            messageId: fila.id,
                        },
                    );
                    await this.channel.waitForConfirms();
                    await this.outbox.update(fila.id, {
                        publicadoEn: new Date(),
                        intentos: fila.intentos + 1,
                        ultimoError: null,
                    });
                } catch (error) {
                    const errMsg = error instanceof Error ? error.message : String(error);
                    this.logger.warn(
                        `Evento ${fila.id} pendiente de publicar (intento ${fila.intentos + 1}): ${errMsg}`,
                    );
                    await this.outbox.update(fila.id, {
                        intentos: fila.intentos + 1,
                        ultimoError: errMsg.slice(0, 1000),
                    });
                    this.channel = null;
                    break;
                }
            }

            await this.purgarPublicados();
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(`Fallo el relay de la outbox: ${errMsg}`);
        } finally {
            this.relaying = false;
        }
    }

    /** Descarta las filas ya confirmadas que superaron la retencion. */
    private async purgarPublicados(): Promise<void> {
        const ahora = Date.now();
        if (ahora - this.ultimaPurga < EventPublisher.INTERVALO_PURGA_MS) return;
        this.ultimaPurga = ahora;
        const limite = new Date(ahora - EventPublisher.RETENCION_HORAS * 60 * 60 * 1000);
        try {
            await this.outbox.delete({ publicadoEn: LessThan(limite) });
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            this.logger.warn(`No se pudo purgar la outbox: ${errMsg}`);
        }
    }
}
