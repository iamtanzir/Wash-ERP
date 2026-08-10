// Ambient Module Shims to satisfy type checking for optional database adapters
declare module 'pg' {
  export interface Client {
    connect(): Promise<void>;
    query(queryText: string, values?: any[]): Promise<any>;
  }
  export const Client: any;
}

declare module 'sequelize' {
  export class Sequelize {
    constructor(...args: any[]);
    authenticate(): Promise<void>;
    define(modelName: string, attributes: any, options?: any): any;
  }
  export const DataTypes: any;
  export const Model: any;
}

declare module 'knex' {
  export interface Knex {
    (tableName: string): any;
    [key: string]: any;
  }
  const knex: any;
  export default knex;
}
