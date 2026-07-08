package ec.edu.espe.usuarios.audit;

import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Declara el exchange de auditoria y un RabbitTemplate que serializa
 * los eventos como JSON. El exchange es 'topic' y durable, igual que el
 * que asegura el consumidor de ms-audith.
 */
@Configuration
public class RabbitMQAuditConfig {

    @Value("${app.audit.exchange:audit_exchange}")
    private String exchange;

    @Bean
    public TopicExchange auditExchange() {
        return new TopicExchange(exchange, true, false);
    }

    @Bean
    public Jackson2JsonMessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate auditRabbitTemplate(ConnectionFactory connectionFactory,
                                              Jackson2JsonMessageConverter converter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(converter);
        return template;
    }
}
