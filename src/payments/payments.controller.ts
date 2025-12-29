import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { Public, ResponseMessage } from 'src/decorator/customize';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.create(createPaymentDto);
  }

  @Get()
  findAll() {
    return this.paymentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePaymentDto: UpdatePaymentDto) {
    return this.paymentsService.update(+id, updatePaymentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.paymentsService.remove(+id);
  }

  @ResponseMessage('Thanh toán tiền mặt hoàn tất!')
  @Post('cash')
  async payCash(
    @Body() dto: { orderId: string; amount: number; orderIn: string },
  ) {
    return this.paymentsService.createCashPayment(
      dto.orderId,
      dto.amount,
      dto.orderIn,
    );
  }

  @ResponseMessage('Thanh toán qua ngân hàng hoàn tất!')
  @Post('bank')
  async payBank(
    @Body() dto: { orderId: string; amount: number; orderIn: string },
  ) {
    return this.paymentsService.createBankPayment(
      dto.orderId,
      dto.amount,
      dto.orderIn,
    );
  }

  @Public()
  @ResponseMessage('Thanh toán qua ngân hàng hoàn tất!')
  @Post('vnpay')
  async payVnpay(@Body() dto: { orderId: string; amount: number }) {
    return this.paymentsService.createVnpayUrl(dto.orderId, dto.amount);
  }

  @Public()
  @Post('vnpay-return')
  async vnpayReturn(@Query() query: any) {
    return this.paymentsService.handleVnpayReturn(query);
  }

  @Public()
  @Post('handle-payment-success')
  async handlePaymentSuccess(@Body('id') id: string) {
    return this.paymentsService.handlePaymentSuccess(id);
  }

  @Post('summary')
  async summaryPayment(
    @Body('month') month: string,
    @Body('year') year: string,
  ) {
    return this.paymentsService.summaryPayment(month, year);
  }

  @Post('unpayment')
  async fetchOrderUnpayment() {
    return this.paymentsService.fetchOrderUnpayment();
  }

  @Public()
  @Post('summary-every-month')
  async summaryRevenue(@Body('year') year: string) {
    return this.paymentsService.summaryRevenue(year);
  }
}
