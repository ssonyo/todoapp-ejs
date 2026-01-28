import { ObjectId } from 'mongodb';

declare global {
  namespace Express {
    interface User {
      _id: ObjectId;
      username: string;
    }
  }
}