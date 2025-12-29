import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { Table, TableDocument } from './schemas/table.schema';
import { IUser } from 'src/types/global.constanst';
import aqp from 'api-query-params';
import { randomBytes } from 'crypto';
import { Order, OrderDocument } from 'src/order/schemas/order.schema';

@Injectable()
export class TableService {
  constructor(
    @InjectModel(Table.name) private TableModel: SoftDeleteModel<TableDocument>,
    @InjectModel(Order.name) private OrderModel: SoftDeleteModel<OrderDocument>,
  ) {}

  async create(createTableDto: CreateTableDto, user: IUser) {
    const { tableNumber } = createTableDto;
    const existingTable = await this.TableModel.findOne({ tableNumber });
    if (existingTable) {
      throw new BadRequestException(
        `Tạo bàn thất bại vì bàn ${tableNumber} đã tồn tại`,
      );
    }

    const tokenQr = randomBytes(32).toString('hex');
    const newTable = await this.TableModel.create({
      ...createTableDto,
      token: tokenQr,
      createdBy: {
        _id: user._id,
        email: user.email,
      },
    });
    return {
      _id: newTable._id,
      createdAt: newTable.createdAt,
    };
  }

  async findAll(currentPage: number, limit: number, qs: string) {
    const { filter, sort, projection, population } = aqp(qs);
    delete filter.current;
    delete filter.pageSize;
    let offset = (currentPage - 1) * +limit;
    let defaultLimit = limit ? limit : 10;
    const totalItems = (await this.TableModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);
    const result = await this.TableModel.find(filter)
      .skip(offset)
      .limit(defaultLimit)
      // @ts-ignore: Unreachable code error
      .sort(sort as any)
      .populate(population)
      .exec();

    return {
      meta: {
        current: currentPage, //trang hiện tại
        pageSize: limit, //số lượng bản ghi đã lấy
        pages: totalPages, //tổng số trang với điều kiện query
        total: totalItems, // tổng số phần tử (số bản ghi)
      },
      result, //kết quả query
    };
  }

  async findOne(id: string) {
    return await this.TableModel.findById(id);
  }

  async update(id: string, updateTableDto: UpdateTableDto, user: IUser) {
    const { tableNumber, isChangeQrCode } = updateTableDto;
    let tokenQr;
    const table = await this.TableModel.findById(id);
    if (!table) {
      throw new NotFoundException(`Không tìm thấy bàn với id ${id}`);
    }
    const existingTable = await this.TableModel.findOne({ tableNumber });
    if (existingTable && table.tableNumber !== tableNumber) {
      throw new BadRequestException(
        `Bàn ${tableNumber} đã tồn tại hãy đổi số bàn khác`,
      );
    }

    if (isChangeQrCode) {
      tokenQr = randomBytes(32).toString('hex');
    }

    return this.TableModel.updateOne(
      { _id: id },
      {
        ...updateTableDto,
        token: tokenQr ? tokenQr : table.token,
        updatedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );
  }

  async remove(id: string, user: IUser) {
    await this.TableModel.updateOne(
      { _id: id },
      {
        deletedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );
    return await this.TableModel.softDelete({ _id: id });
  }

  async findByToken(token: string) {
    return this.TableModel.findOne({ token });
  }

  async getAllTable() {
    return this.TableModel.find({});
  }

  async handleChangeStatusTable(tableId: string, status: string) {
    const table = await this.TableModel.findById(tableId);
    if (!table) {
      throw new BadRequestException('Không có dữ liệu về table chọn!');
    }
    if (status == 'cleaning') {
      const isCurrentOrder = table.currentOrder;
      if (!isCurrentOrder) {
        return await this.TableModel.findByIdAndUpdate(tableId, {
          status,
        });
      }
      const orderCurrent = await this.OrderModel.findById(isCurrentOrder);
      if (!orderCurrent) {
        throw new BadRequestException(
          'Không có dữ liệu order của bàn hiện tại!',
        );
      }
      await this.OrderModel.findByIdAndUpdate(orderCurrent._id, {
        progressStatus: 'completed',
      });
      return await this.TableModel.findByIdAndUpdate(tableId, {
        currentOrder: null,
        status,
      });
    } else if (status == 'empty') {
      return await this.TableModel.findByIdAndUpdate(tableId, {
        status,
      });
    }
  }
}
