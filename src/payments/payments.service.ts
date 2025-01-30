import { Inject, Injectable, Logger } from '@nestjs/common';
import { envs } from '../common/config';
import Stripe from 'stripe';
import { PaymentSessionDto } from './dto/payment-session.dto';
import { Request, Response } from 'express';
import { ClientProxy } from '@nestjs/microservices';
import { Services } from '../common/constants';

@Injectable()
export class PaymentsService {
  private readonly stripe = new Stripe(envs.stripeSecret);
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(Services.NATS_SERVICE) private readonly client: ClientProxy,
  ) {}

  async createPaymentSession(paymentSessionDto: PaymentSessionDto) {
    const { currency, items, orderId } = paymentSessionDto;
    const lineItems = items.map((item) => ({
      price_data: {
        currency: currency,
        product_data: {
          name: item.name,
        },
        unit_amount: Math.round(item.price * 100), //20 USD = 2000 / 100
      },
      quantity: item.quantity,
    }));
    const session = await this.stripe.checkout.sessions.create({
      payment_intent_data: {
        metadata: { orderId },
      },
      line_items: lineItems,
      mode: 'payment',
      success_url: envs.stripeSuccessUrl,
      cancel_url: envs.stripeCancelUrl,
    });

    return {
      cancelUrl: session.cancel_url,
      successUrl: session.success_url,
      url: session.url,
    };
  }

  stripeWebhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'] as string;
    let event: Stripe.Event;
    const endpointSecret = envs.stripeEndpointSecret;
    try {
      event = this.stripe.webhooks.constructEvent(
        req['rawBody'],
        sig,
        endpointSecret,
      );
    } catch (err) {
      res.status(400).send(`Webhook Error: ${err}`);
      return;
    }

    // const eventHandlers: Record<
    //   Stripe.Event.Type,
    //   (event: Stripe.Event) => void
    // > = {
    //   'charge.succeeded': (event) => {
    //     const chargeSucceeded = event.data.object as Stripe.Charge;
    //     const payload = {
    //       stripePaymentId: chargeSucceeded.id,
    //       orderId: chargeSucceeded.metadata.orderId,
    //       receiptUrl: chargeSucceeded.receipt_url,
    //     };
    //     this.logger.log({ payload });
    //   },
    // };

    switch (event.type) {
      case 'charge.succeeded':
        {
          const chargeSucceeded = event.data.object;
          const payload = {
            stripePaymentId: chargeSucceeded.id,
            orderId: chargeSucceeded.metadata.orderId,
            receiptUrl: chargeSucceeded.receipt_url,
          };
          // this.logger.log({ payload });
          this.client.emit('payment.succeeded', payload);
        }
        break;

      default:
        console.log(`Event ${event.type} not handled`);
    }

    return res.status(200).json({ sig });
  }
}
