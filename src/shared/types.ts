import { Request } from "express"
import { Types } from "mongoose"

export type Collobrator = {
    user : Types.ObjectId,
}

export interface RequestWithUser extends Request {
    user: {
        userId: string;
        id?: string;
        email?: string;
        username?: string;
    };
}