import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { IUser } from 'src/types/global.constanst';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ReservationsGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ReservationsGateway.name);

  constructor(private readonly reservationsService: ReservationsService) {}

  /** 🧠 Khi có người đặt bàn mới */
  @SubscribeMessage('createReservation')
  async handleCreateReservation(
    @MessageBody() data: { dto: CreateReservationDto; user: IUser },
  ) {
    const reservation = await this.reservationsService.create(
      data.dto,
      data.user,
    );

    // Gửi thông tin đặt bàn mới cho tất cả client
    this.server.emit('reservationCreated', reservation);

    this.logger.log(`📅 New reservation created by ${data.user.email}`);
    return reservation;
  }

  /** ✏️ Khi có người cập nhật trạng thái đặt bàn */
  @SubscribeMessage('updateReservation')
  async handleUpdateReservation(
    @MessageBody()
    data: {
      id: string;
      dto: UpdateReservationDto;
      user: IUser;
    },
  ) {
    const result = await this.reservationsService.update(
      data.id,
      data.dto,
      data.user,
    );

    // Phát realtime đến tất cả client để đồng bộ UI
    this.server.emit('reservationUpdated', {
      _id: data.id,
      ...data.dto,
    });

    this.logger.log(`♻️ Reservation ${data.id} updated by ${data.user.email}`);
    return result;
  }

  /** ❌ Khi có người hủy hoặc xóa đặt bàn */
  @SubscribeMessage('removeReservation')
  async handleRemoveReservation(
    @MessageBody() data: { id: string; user: IUser },
  ) {
    await this.reservationsService.remove(data.id, data.user);

    // Phát sự kiện realtime
    this.server.emit('reservationRemoved', { _id: data.id });

    this.logger.log(`🗑️ Reservation ${data.id} removed by ${data.user.email}`);
  }

  /** 🕒 Khi trạng thái được cập nhật tự động từ Bull Queue */
  async notifyStatusChange(reservationId: string, newStatus: string) {
    this.server.emit('reservationStatusChanged', {
      _id: reservationId,
      status: newStatus,
    });
    this.logger.debug(`🔄 Realtime: ${reservationId} → ${newStatus}`);
  }
}
