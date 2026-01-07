export const ROLE_SEED_DATA = [
  {
    _id: '68ff81d5d8fdcfb7071a9185',
    name: 'CUSTOMER',
    description: 'role của khách hàng',
    isActive: true,
    permissions: ['68ff8122d8fdcfb7071a9181'],
  },
  {
    _id: '68ff89882a40850599748ac9',
    name: 'ADMIN',
    description: 'role dành cho các người quản lý cao cấp',
    isActive: true,
    permissions: ['68ff8122d8fdcfb7071a9181'],
  },
  {
    _id: '68ff8bff99dfd088f2baeccd',
    name: 'STAFF',
    description: 'role dành cho các nhân viên',
    isActive: true,
    permissions: ['68ff8122d8fdcfb7071a9181'],
  },
  {
    _id: '68ff8c1499dfd088f2baecd0',
    name: 'CHEF',
    description: 'role dành cho các nhân viên làm việc trong bếp',
    isActive: true,
    permissions: ['68ff8122d8fdcfb7071a9181'],
  },
];

export const ACCOUNT_SEED_DATA = [
  {
    name: 'Lê Văn Lợi',
    email: 'levanloi2004bn@gmail.com',
    provider: ['local'],
    password: '$2b$10$tC8QQxSGwrGAuedd.cUX7.pgWqigF4Bn/FSqt.twhXVlM.cgfGbuG',
    phone: '0868318176',
    role: '68ff81d5d8fdcfb7071a9185',
  },
  {
    name: 'Mẫn Nhi',
    email: 'mannhi2005bn@gmail.com',
    provider: ['local'],
    password: '$2b$10$TNKn2/m5nk.3K2nIN09Ea.UMcPpvpC7EdbFeFHGiQd4WFaRoAfOsa',
    phone: '0816727528',
    role: '68ff89882a40850599748ac9',
  },
  {
    name: 'Đầu bếp',
    email: 'daubep2000bn@gmail.com',
    provider: ['local'],
    password: '$2b$10$nXMP/QjIR.ZXg5hxmNUU/uOQsQXY9RXWuc27R5PJT4RcjzyX4WNoC',
    phone: '0972158112',
    role: '68ff8c1499dfd088f2baecd0',
  },
  {
    name: 'Tuấn',
    email: 'tuan2004bn@gmail.com',
    provider: ['local'],
    password: '$2b$10$8UeTteHBAT8sanEpMI0kS.a9PtM0co5VHnX94r7r0Il17iUKXKFie',
    phone: '0972158112',
    role: '68ff8bff99dfd088f2baeccd',
  },
];
