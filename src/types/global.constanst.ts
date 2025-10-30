export interface IUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  phone: number | string;
  avatar?: string;
}

export const ADMIN_ROLE = 'ADMIN';
export const CUSTOMER_ROLE = 'CUSTOMER';
export const CHEF_ROLE = 'CHEF';
export const STAFF_ROLE = 'STAFF';

export const ADMIN_ROLE_ID = '68ff89882a40850599748ac9';
export const CUSTOMER_ROLE_ID = '68ff81d5d8fdcfb7071a9185';
export const STAFF_ROLE_ID = '68ff8bff99dfd088f2baeccd';
export const CHEF_ROLE_ID = '68ff8c1499dfd088f2baecd0';
