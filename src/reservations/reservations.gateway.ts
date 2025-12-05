import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { IUser } from 'src/types/global.constanst';
import { forwardRef, Inject, Logger } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { RedisService } from 'src/redis-cache/redis-cache.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ReservationsGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ReservationsGateway.name);

  constructor(
    @Inject(forwardRef(() => ReservationsService))
    private readonly reservationsService: ReservationsService,
    private readonly redis: RedisService,
  ) {}

  // khách join vào room của 1 khung giờ đặt bàn
  @SubscribeMessage('joinBookingRoom')
  async handleJoinBookingRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { date: string; timeSlot: string },
  ) {
    const { date, timeSlot } = data;
    const room = `booking:${date}:${timeSlot}`;

    // Rời tất cả room cũ để tránh nhận nhầm
    const rooms = Array.from(client.rooms).filter((r) => r !== client.id);
    rooms.forEach((r) => client.leave(r));

    // Join room mới
    client.join(room);

    // Lấy dữ liệu từ Redis
    const currentBookings = (await this.redis.get(room)) || [];

    // Gửi state hiện tại
    client.emit('bookingCurrentState', currentBookings);

    console.log(`Client joined room: ${room}`);
  }

  // Khách rời phòng
  @SubscribeMessage('leaveBookingRoom')
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { date: string; timeSlot: string },
  ) {
    const { date, timeSlot } = data;
    const room = `booking:${date}:${timeSlot}`;

    client.leave(room);
    console.log(`Client left ${room}`);
  }

  /** 🧠 Khi có người đặt bàn mới */
  @SubscribeMessage('createReservation')
  async handleCreateReservation(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { date, timeSlot, tableId } = data;

      // Tạo key redis
      const redisKey = `booking:${date}:${timeSlot}`;

      // Lấy danh sách từ Redis (đã được parse sẵn bởi RedisService của bạn)
      let bookings = (await this.redis.get(redisKey)) || [];

      // Check trùng bàn
      const duplicate = bookings.some((b) => b.tableId === tableId);

      if (duplicate) {
        client.emit('reservationFailed', {
          message: 'Bàn này đã có người đặt trong khung giờ này',
        });

        return;
      }

      // Tạo booking mới
      const newBooking = {
        ...data,
        createdAt: new Date().toISOString(),
      };

      // Thêm vào danh sách
      bookings.push(newBooking);

      // Lưu lại vào Redis
      await this.redis.set(redisKey, bookings);

      // Gửi realtime cho tất cả client trong room
      this.server.to(redisKey).emit('reservationUpdated', bookings);

      // Gửi thông báo về chính client tạo booking
      this.server.to(redisKey).emit('reservationSuccess', newBooking);

      await this.reservationsService.create(data);
    } catch (err) {
      console.error('Error in createReservation:', err);

      client.emit('reservationFailed', {
        message: 'Có lỗi khi tạo đặt bàn',
      });
    }
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
