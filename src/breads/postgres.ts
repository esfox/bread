import knex, { Knex } from 'knex';
import pg from 'pg';

import { Id } from '@/types';

pg.types.setTypeParser(pg.types.builtins.INT8, (value: string) => Number(value));
pg.types.setTypeParser(pg.types.builtins.FLOAT8, (value: string) => Number(value));
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value: string) => Number(value));

const defaultPoolMaxCount = 10;

export class PostgresBread {
  public db: Knex;

  protected table: string;

  protected primaryKeyColumn: string;

  constructor({
    connectionString,
    table,
    primaryKeyColumn,
    poolMaxCount = defaultPoolMaxCount,
  }: {
    connectionString: string;
    table: string;
    primaryKeyColumn: string;
    poolMaxCount?: number;
  }) {
    this.db = knex({
      client: 'pg',
      connection: connectionString,
      pool: { max: poolMaxCount },
    });

    this.table = table;
    this.primaryKeyColumn = primaryKeyColumn;
  }

  protected query() {
    return this.db(this.table);
  }

  async browse() {
    return this.query().select();
  }

  async read({ id, notFoundReturn }: { id: Id; notFoundReturn?: () => any }) {
    const record = await this.query().where(this.primaryKeyColumn, id).limit(1).first();
    if (!record && notFoundReturn) {
      return notFoundReturn();
    }

    return record;
  }

  async edit({
    id,
    updateData,
    notFoundReturn,
  }: {
    id: Id;
    updateData: Record<string, unknown>;
    notFoundReturn?: () => any;
  }) {
    const record = await this.query()
      .update(updateData)
      .where(this.primaryKeyColumn, id)
      .returning('*');

    if (!record && notFoundReturn) {
      return notFoundReturn();
    }

    return record[0];
  }

  async add({ data }: { data: Record<string, unknown> }) {
    const result = await this.query().insert(data).returning('*');
    return result[0];
  }

  async delete({ id, notFoundReturn }: { id: Id; notFoundReturn?: () => any }) {
    const record = await this.query().delete().where(this.primaryKeyColumn, id).returning('*');

    if (!record && notFoundReturn) {
      return notFoundReturn();
    }

    return record[0];
  }
}
