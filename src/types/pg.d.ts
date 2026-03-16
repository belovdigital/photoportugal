declare module "pg" {
  export interface PoolConfig {
    connectionString?: string;
    max?: number;
  }

  export interface QueryResult<T = Record<string, unknown>> {
    rows: T[];
    rowCount: number;
  }

  export class Pool {
    constructor(config?: PoolConfig);
    query<T = Record<string, unknown>>(
      text: string,
      params?: unknown[]
    ): Promise<QueryResult<T>>;
    end(): Promise<void>;
  }
}
