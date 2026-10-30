import { User, UserRole } from '../models/user.model';

export interface CreateUserInput {
  email: string;
  phone: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
}

export class UserDao {
  findByEmail(email: string): Promise<User | null> {
    return User.findOne({ where: { email } });
  }

  findByPhone(phone: string): Promise<User | null> {
    return User.findOne({ where: { phone } });
  }

  findById(id: string): Promise<User | null> {
    return User.findByPk(id);
  }

  create(input: CreateUserInput): Promise<User> {
    return User.create(input);
  }
}
